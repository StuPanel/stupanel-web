/**
 * Resumable Google Drive uploader.
 *
 * The browser sends each file straight to Google in 32 MB pieces (our server
 * only opens the session), up to 3 files at a time. If the internet drops it
 * waits and continues from the last byte Google has.
 *
 * The WHOLE batch is remembered on this device the moment it is added — files that are
 * uploading and files still waiting in line. If the tab or PC closes, the user picks the
 * same files or folder again: finished files are skipped, half-done ones continue where
 * they stopped (Google keeps a session for about a week) and the rest start.
 *
 * Pause all / Resume / Cancel all work on every Drive upload in this tab. A paused upload
 * keeps its place; nothing is lost if the page is closed while paused.
 */
import { apiFetch, API_URL as API } from "@/lib/api";
import { uploadStore } from "@/lib/upload-store";

const CHUNK = 32 * 1024 * 1024; // multiple of 256 KB, as Google requires
const PARALLEL = 3;
const PENDING_KEY = "sp_drive_pending_v1";

export type DriveFileResult = {
  id: string; fileName: string; mimeType: string; fileSize: number;
  folderName: string | null; viewUrl: string; downloadUrl: string;
  path?: string;
  replacedFileId?: string | null;
};

/** Per-file choice made before uploading (duplicate check). */
export type UploadPlan = { name?: string; replaceFileId?: string };

/** "delivery" = StuPanel Deliveries (client can open); "raw" = private StuPanel Raw. */
export type DriveKind = "delivery" | "raw" | "raw-member" | "edited";

const ENDPOINTS = {
  delivery: (id: string) => ({ session: `/google-drive/upload-session/${id}`, complete: `/google-drive/upload-complete/${id}`, check: `/google-drive/upload-check/${id}`, status: "/google-drive/upload-status" }),
  raw: (id: string) => ({ session: `/google-drive/raw/${id}/session`, complete: `/google-drive/raw/${id}/complete`, check: `/google-drive/raw/${id}/check`, status: "/google-drive/upload-status" }),
  // A team member uploading into their own raw folder from the member panel.
  // An editor uploading a version of their work for review (id = editor assignment id).
  edited: (id: string) => ({ session: `/member/editing/${id}/files/session`, complete: `/member/editing/${id}/files/complete`, check: `/member/editing/${id}/files/check`, status: "/member/raw/upload-status" }),
  "raw-member": (id: string) => ({ session: `/member/programs/${id}/raw/session`, complete: `/member/programs/${id}/raw/complete`, check: `/member/programs/${id}/raw/check`, status: "/member/raw/upload-status" }),
};

export type PendingUpload = {
  kind?: DriveKind;
  fp: string;               // fingerprint: name|size|lastModified|bookingId|folder
  bookingId: string;
  bookingName?: string;
  folderPath?: string;
  fileName: string;
  size: number;
  lastModified: number;
  /** Google's upload address; "" while the file is still waiting in line. */
  uploadUrl: string;
  createdAt: number;
  uploadName?: string;
  replaceFileId?: string;
  /** The browser tab that holds this file right now (see "other tabs" below). */
  tab?: string;
};

type Job = {
  kind: DriveKind;
  id: string;
  file: File;
  bookingId: string;
  bookingName?: string;
  folderPath?: string;
  plan?: UploadPlan;
  onDone?: (f: DriveFileResult) => void;
  cancelled?: boolean;
  xhr?: XMLHttpRequest;
};

// ─── pending list (survives reloads) ──────────────────────────────────────────
function fpOf(p: { kind?: DriveKind; fileName: string; size: number; lastModified: number; bookingId: string; folderPath?: string }) {
  const base = [p.fileName, p.size, p.lastModified, p.bookingId, p.folderPath ?? ""];
  return (p.kind && p.kind !== "delivery" ? [p.kind, ...base] : base).join("|");
}
/** Kept in memory so a batch of thousands of files isn't parsed again for every file. */
let pendingCache: PendingUpload[] | null = null;
function readPending(): PendingUpload[] {
  if (pendingCache) return pendingCache;
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as (Omit<PendingUpload, "fp"> & { fp?: string })[];
    pendingCache = Array.isArray(raw) ? raw.map(p => ({ ...p, fp: p.fp ?? fpOf(p), uploadUrl: p.uploadUrl ?? "" })) : [];
  } catch { pendingCache = []; }
  return pendingCache;
}
function writePending(list: PendingUpload[]) {
  pendingCache = list;
  // The fingerprint stays in the stored list: a tab that still runs the older uploader reads it.
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* storage full — still works until the page closes */ }
  pendingListeners.forEach(fn => fn(list));
}
const pendingListeners = new Set<(l: PendingUpload[]) => void>();
// Another tab changed the list.
if (typeof window !== "undefined") {
  window.addEventListener("storage", e => {
    if (e.key !== PENDING_KEY) return;
    pendingCache = null;
    const list = readPending();
    pendingListeners.forEach(fn => fn(list));
  });
}

export function subscribePending(fn: (l: PendingUpload[]) => void) {
  pendingListeners.add(fn);
  fn(readPending().filter(p => !activeFps.has(p.fp)));
  return () => { pendingListeners.delete(fn); };
}
export function discardPending(fp?: string) {
  writePending(fp ? readPending().filter(p => p.fp !== fp) : []);
}

function fingerprint(file: File, bookingId: string, folderPath?: string, kind: DriveKind = "delivery") {
  return fpOf({ kind, fileName: file.name, size: file.size, lastModified: file.lastModified, bookingId, folderPath });
}

// ─── other tabs ───────────────────────────────────────────────────────────────
// The pending list is shared by every StuPanel tab on this device. A tab that is uploading
// writes a heartbeat, so the other tabs know those files are busy there — not "unfinished".
const TAB_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : String(Math.random()).slice(2, 10);
const TABS_KEY = "sp_drive_tabs_v1";
const ALIVE_MS = 15000;
function readTabs(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) || "{}") ?? {}; } catch { return {}; }
}
let beat: ReturnType<typeof setInterval> | null = null;
function heartbeat(on: boolean) {
  const write = (alive: boolean) => {
    try {
      const now = Date.now();
      const tabs = Object.fromEntries(Object.entries(readTabs()).filter(([id, t]) => id !== TAB_ID && now - t < ALIVE_MS));
      if (alive) tabs[TAB_ID] = now;
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
    } catch { /* ignore */ }
  };
  if (on) { write(true); if (!beat) beat = setInterval(() => write(true), 4000); }
  else if (beat) { clearInterval(beat); beat = null; write(false); }
}
/** True when another open tab is uploading (or holding, paused) this file right now. */
export function isUploadingElsewhere(p: PendingUpload, tabs: Record<string, number> = readTabs()) {
  return !!p.tab && p.tab !== TAB_ID && Date.now() - (tabs[p.tab] ?? 0) < ALIVE_MS;
}
export function pendingElsewhere(list: PendingUpload[]) {
  const tabs = readTabs();
  return list.filter(p => isUploadingElsewhere(p, tabs));
}

// ─── queue ────────────────────────────────────────────────────────────────────
const queue: Job[] = [];
const runningJobs = new Set<Job>();
const failedJobs = new Map<string, Job>();
const activeFps = new Set<string>();
let running = 0;

// Pause all: running files stop after the piece Google already has; everything keeps its place.
let paused = false;
const pausedListeners = new Set<(p: boolean) => void>();
const emitPaused = () => pausedListeners.forEach(fn => fn(paused));
export function subscribePaused(fn: (p: boolean) => void) {
  pausedListeners.add(fn);
  fn(paused);
  return () => { pausedListeners.delete(fn); };
}
export function pauseDriveUploads() {
  if (paused) return;
  paused = true;
  for (const job of runningJobs) job.xhr?.abort();
  emitPaused();
}
export function resumeDriveUploads() {
  if (!paused) return;
  paused = false;
  emitPaused();
  pump();
}
/** Stop every Drive upload in this tab and forget it. Files that already finished stay on Drive. */
export function cancelAllDriveUploads() {
  const jobs = [...runningJobs, ...queue];
  const fps = new Set<string>();
  for (const job of jobs) {
    job.cancelled = true;
    job.xhr?.abort();
    fps.add(fingerprint(job.file, job.bookingId, job.folderPath, job.kind));
  }
  queue.length = 0;
  writePending(readPending().filter(p => !fps.has(p.fp)));
  uploadStore.cancelMany(jobs.map(j => j.id));
  if (paused) { paused = false; emitPaused(); }
  if (running === 0) heartbeat(false);
  return jobs.length;
}
/** Try again the files that failed (their place in the list is kept). */
export function retryFailedDriveUploads() {
  const jobs = [...failedJobs.values()];
  failedJobs.clear();
  for (const job of jobs) {
    uploadStore.update(job.id, { error: undefined, status: "queued", progress: 0, speed: 0 });
    queue.push(job);
  }
  pump();
  return jobs.length;
}
export const failedDriveUploadCount = () => failedJobs.size;

function pump() {
  if (paused) return;
  while (running < PARALLEL && queue.length) {
    const job = queue.shift()!;
    if (job.cancelled) continue;
    running++;
    runningJobs.add(job);
    runJob(job).finally(() => { running--; runningJobs.delete(job); pump(); if (running === 0 && queue.length === 0) heartbeat(false); });
  }
}

/** Add files for one program. folderPath like "Raw/Holud/Photo" (optional). */
export function uploadToDrive(opts: {
  kind?: DriveKind;
  files: File[];
  bookingId: string;
  bookingName?: string;
  folderFor?: (f: File) => string | undefined;
  plans?: Map<File, UploadPlan>;
  onDone?: (f: DriveFileResult) => void;
}) {
  const known = new Set(readPending().map(p => p.fp));
  const remember: PendingUpload[] = [];
  const retake = new Set<string>();
  if (opts.files.length) heartbeat(true);
  for (const file of opts.files) {
    const id = crypto.randomUUID();
    const folderPath = opts.folderFor?.(file);
    const plan = opts.plans?.get(file);
    const kind = opts.kind ?? "delivery";
    const job: Job = { kind, id, file, bookingId: opts.bookingId, bookingName: opts.bookingName, folderPath, plan, onDone: opts.onDone };
    const fp = fingerprint(file, job.bookingId, folderPath, kind);
    // Remember every file now — also the ones waiting in line — so a closed tab loses nothing.
    if (!known.has(fp)) {
      known.add(fp);
      remember.push({
        kind, fp, bookingId: opts.bookingId, bookingName: opts.bookingName, folderPath, fileName: file.name,
        size: file.size, lastModified: file.lastModified, uploadUrl: "", createdAt: Date.now(),
        uploadName: plan?.name, replaceFileId: plan?.replaceFileId, tab: TAB_ID,
      });
    } else retake.add(fp); // remembered from an earlier visit — this tab holds it now
    uploadStore.add({
      id, fileName: plan?.name ?? file.name, progress: 0, done: false, type: "drive",
      bookingId: opts.bookingId, bookingName: opts.bookingName,
      folderName: kind === "edited" ? ["Edited", folderPath].filter(Boolean).join(" / ") : kind !== "delivery" ? ["Raw", folderPath].filter(Boolean).join(" / ") : folderPath,
      size: file.size, sent: 0, status: "queued",
    });
    uploadStore.registerCancel(id, () => {
      job.cancelled = true;
      job.xhr?.abort();
      failedJobs.delete(id);
      discardPending(fp);
    });
    queue.push(job);
  }
  if (remember.length || retake.size) writePending([...readPending().map(p => (retake.has(p.fp) ? { ...p, tab: TAB_ID } : p)), ...remember]);
  pump();
}

/** Re-picked files: match them to the unfinished list and continue. */
export function resumeWithFiles(files: File[]): { matched: number } {
  const tabs = readTabs();
  const pending = readPending().filter(p => !isUploadingElsewhere(p, tabs));
  let matched = 0;
  type Group = { kind: DriveKind; bookingName?: string; files: File[]; folders: Map<File, string | undefined>; plans: Map<File, UploadPlan> };
  const byProgram = new Map<string, Group>();
  for (const file of files) {
    const p = pending.find(x => x.fileName === file.name && x.size === file.size && x.lastModified === file.lastModified && !activeFps.has(x.fp));
    if (!p) continue;
    matched++;
    const gKey = `${p.kind ?? "delivery"}|${p.bookingId}`;
    const g: Group = byProgram.get(gKey) ?? { kind: p.kind ?? "delivery", bookingName: p.bookingName, files: [], folders: new Map<File, string | undefined>(), plans: new Map<File, UploadPlan>() };
    g.files.push(file);
    g.folders.set(file, p.folderPath);
    if (p.uploadName || p.replaceFileId) g.plans.set(file, { name: p.uploadName, replaceFileId: p.replaceFileId });
    byProgram.set(gKey, g);
  }
  for (const [gKey, g] of byProgram) {
    const bookingId = gKey.split("|")[1];
    uploadToDrive({ kind: g.kind, files: g.files, bookingId, bookingName: g.bookingName, folderFor: f => g.folders.get(f), plans: g.plans });
  }
  return { matched };
}

// ─── one file ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function waitOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return sleep(3000);
  return new Promise(r => window.addEventListener("online", () => r(), { once: true }));
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const r = await apiFetch(`${API}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || "Upload failed"), { status: r.status });
  return d as T;
}

function putChunk(job: Job, url: string, start: number, end: number, total: number, onProgress: (n: number) => void)
  : Promise<{ status: number; next?: number; fileId?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    job.xhr = xhr;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", end > start ? `bytes ${start}-${end - 1}/${total}` : `bytes */${total}`);
    xhr.upload.onprogress = e => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        let fileId: string | undefined;
        try { fileId = JSON.parse(xhr.responseText).id; } catch { /* ignore */ }
        resolve({ status: xhr.status, fileId });
      } else if (xhr.status === 308) {
        const range = xhr.getResponseHeader("Range");
        resolve({ status: 308, next: range ? Number(range.split("-")[1]) + 1 : end });
      } else {
        resolve({ status: xhr.status });
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("cancelled"));
    xhr.send(job.file.slice(start, end));
  });
}

async function runJob(job: Job) {
  const { file, bookingId, folderPath, kind } = job;
  const fp = fingerprint(file, bookingId, folderPath, kind);
  const ep = ENDPOINTS[kind](bookingId);
  activeFps.add(fp);
  const total = file.size;
  const update = uploadStore.update.bind(uploadStore, job.id);
  let speedMark = { t: Date.now(), b: 0 };

  try {
    // 1. Session: reuse a remembered one (resume) or open a new one.
    if (paused) throw new Error("paused");
    let pending = readPending().find(p => p.fp === fp);
    // Remembered but never started (it was waiting in line): open a session like a new file.
    if (pending && !pending.uploadUrl) pending = undefined;
    let offset = 0;
    let fileId: string | undefined;
    if (pending) {
      update({ status: "resuming" });
      const st = await api<{ state: string; offset: number; fileId: string | null }>(
        ep.status, { uploadUrl: pending.uploadUrl, size: total }).catch(() => ({ state: "expired", offset: 0, fileId: null }));
      if (st.state === "done") { offset = total; fileId = st.fileId ?? undefined; }
      else if (st.state === "partial") offset = st.offset;
      else { discardPending(fp); pending = undefined; }
    }
    if (!pending) {
      const s = await api<{ uploadUrl: string }>(ep.session, {
        fileName: job.plan?.name ?? file.name, mimeType: file.type || "application/octet-stream", size: total, folderPath,
      });
      // Cancelled while the session was opening: don't remember it again.
      if (job.cancelled) throw new Error("cancelled");
      pending = {
        kind, fp, bookingId, bookingName: job.bookingName, folderPath, fileName: file.name,
        size: total, lastModified: file.lastModified, uploadUrl: s.uploadUrl, createdAt: Date.now(),
        uploadName: job.plan?.name, replaceFileId: job.plan?.replaceFileId, tab: TAB_ID,
      };
      writePending([...readPending().filter(p => p.fp !== fp), pending]);
    }

    // 2. Pieces.
    let failures = 0;
    while (!fileId && (offset < total || total === 0)) {
      if (job.cancelled) throw new Error("cancelled");
      if (paused) throw new Error("paused");
      const end = Math.min(offset + CHUNK, total);
      update({ status: "uploading" });
      try {
        const r = await putChunk(job, pending.uploadUrl, offset, end, total, loaded => {
          const sent = offset + loaded;
          const now = Date.now();
          const dt = (now - speedMark.t) / 1000;
          const patch: Record<string, number> = { sent, progress: Math.floor((sent / Math.max(total, 1)) * 99) };
          if (dt >= 1) { patch.speed = (sent - speedMark.b) / dt; speedMark = { t: now, b: sent }; }
          update(patch);
        });
        if (r.fileId) { fileId = r.fileId; offset = total; break; }
        if (r.status === 308) { offset = r.next ?? end; failures = 0; continue; }
        if (r.status === 404 || r.status === 410) { discardPending(fp); throw new Error("Upload session expired — please upload this file again"); }
        throw new Error(`http ${r.status}`);
      } catch (err) {
        if (job.cancelled) throw new Error("cancelled");
        if (paused) throw new Error("paused");
        if ((err as Error).message === "cancelled") throw new Error("cancelled");
        if ((err as Error).message.startsWith("Upload session expired")) throw err;
        failures++;
        update({ status: "waiting" });
        await waitOnline();
        if (failures > 20) throw new Error("Upload keeps failing — check your internet and try again");
        // Ask Google how much it really has, then continue from there.
        const st = await api<{ state: string; offset: number; fileId: string | null }>(
          ep.status, { uploadUrl: pending.uploadUrl, size: total }).catch(() => null);
        if (st?.state === "done") { fileId = st.fileId ?? undefined; offset = total; }
        else if (st?.state === "partial") offset = st.offset;
        else if (st?.state === "expired") { discardPending(fp); throw new Error("Upload session expired — please upload this file again"); }
      }
    }

    // 3. Check + share.
    update({ status: "finishing", progress: 99, sent: total });
    if (!fileId) throw new Error("Upload finished but Drive did not return the file");
    const result = await api<DriveFileResult>(ep.complete,
      { fileId, replaceFileId: job.plan?.replaceFileId ?? pending?.replaceFileId });
    discardPending(fp);
    update({ progress: 100, done: true, status: "done" });
    job.onDone?.(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "paused" && !job.cancelled) {
      // Keep its place at the front; Resume continues from the last piece Google has.
      update({ status: "paused", speed: 0 });
      queue.unshift(job);
    } else if (msg === "cancelled" || job.cancelled) {
      if (readPending().some(p => p.fp === fp)) discardPending(fp);
      update({ cancelled: true, error: "Cancelled", status: "cancelled" });
    }
    else { failedJobs.set(job.id, job); update({ error: msg || "Upload failed", status: "error", speed: 0 }); }
  } finally {
    activeFps.delete(fp);
  }
}

export function hasRunningDriveUploads() {
  return running > 0 || queue.length > 0;
}

// ─── duplicate check (before uploading) ──────────────────────────────────────
export type ExistingFile = { id: string; name: string; size: number };
export type DuplicateCheck = {
  files: File[];
  folderOf: Map<File, string>;
  existingByFolder: Record<string, ExistingFile[]>;
  /** Same name and same size already in the folder. */
  same: Map<File, ExistingFile>;
  /** Same name, different size (a different file). */
  nameOnly: Map<File, ExistingFile>;
  /** Already uploading right now in this tab. */
  inFlight: File[];
  fresh: File[];
};
export type DuplicateChoice = "skip" | "keep" | "replace";

const cleanPath = (p?: string) =>
  (p ?? "").split("/").map(x => x.trim()).filter(x => x && x !== "." && x !== ".." && x !== "Other Files").slice(0, 6).join("/");

/** Ask Drive which of these files already sit in their target folders. */
export async function checkDuplicates(opts: {
  files: File[]; bookingId: string; folderFor?: (f: File) => string | undefined; kind?: DriveKind;
}): Promise<DuplicateCheck> {
  const kind = opts.kind ?? "delivery";
  const folderOf = new Map<File, string>();
  for (const f of opts.files) folderOf.set(f, cleanPath(opts.folderFor?.(f)));
  const paths = [...new Set(folderOf.values())];
  const { folders } = await api<{ folders: Record<string, ExistingFile[]> }>(
    ENDPOINTS[kind](opts.bookingId).check, { folderPaths: paths });

  const same = new Map<File, ExistingFile>();
  const nameOnly = new Map<File, ExistingFile>();
  const inFlight: File[] = [];
  const fresh: File[] = [];
  for (const f of opts.files) {
    const folder = folderOf.get(f) ?? "";
    if (activeFps.has(fingerprint(f, opts.bookingId, opts.folderFor?.(f), kind))) { inFlight.push(f); continue; }
    const list = folders[folder] ?? [];
    const exact = list.find(x => x.name === f.name && x.size === f.size);
    if (exact) { same.set(f, exact); continue; }
    const byName = list.find(x => x.name === f.name);
    if (byName) { nameOnly.set(f, byName); continue; }
    fresh.push(f);
  }
  return { files: opts.files, folderOf, existingByFolder: folders, same, nameOnly, inFlight, fresh };
}

/** "photo.jpg" → "photo (1).jpg", skipping names already taken. */
function numberedName(name: string, taken: Set<string>) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 1; n < 10000; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!taken.has(candidate)) { taken.add(candidate); return candidate; }
  }
  return `${base} (${Date.now()})${ext}`;
}

/** Turn the user's choice into the files to upload and their names/replacements. */
export function applyDuplicateChoice(check: DuplicateCheck, choice: DuplicateChoice) {
  const files: File[] = [...check.fresh];
  const plans = new Map<File, UploadPlan>();
  const taken: Record<string, Set<string>> = {};
  const takenIn = (folder: string) =>
    (taken[folder] ??= new Set((check.existingByFolder[folder] ?? []).map(x => x.name)));

  const keepBoth = (f: File) => {
    files.push(f);
    plans.set(f, { name: numberedName(f.name, takenIn(check.folderOf.get(f) ?? "")) });
  };
  const replace = (f: File, old: ExistingFile) => {
    files.push(f);
    plans.set(f, { replaceFileId: old.id });
  };

  for (const [f, old] of check.same) {
    if (choice === "keep") keepBoth(f);
    else if (choice === "replace") replace(f, old);
    // skip: identical file is already there
  }
  for (const [f, old] of check.nameOnly) {
    // Different file with the same name: never thrown away by "skip".
    if (choice === "replace") replace(f, old);
    else keepBoth(f);
  }
  return { files, plans };
}
