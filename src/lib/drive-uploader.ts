/**
 * Resumable Google Drive uploader.
 *
 * The browser sends each file straight to Google in 32 MB pieces (our server
 * only opens the session), up to 3 files at a time. If the internet drops it
 * waits and continues from the last byte Google has. If the tab or PC closes,
 * the unfinished list is remembered on this device; the user picks the same
 * files again and each one continues where it stopped (Google keeps a session
 * for about a week).
 */
import { apiFetch, API_URL as API } from "@/lib/api";
import { uploadStore } from "@/lib/upload-store";

const CHUNK = 32 * 1024 * 1024; // multiple of 256 KB, as Google requires
const PARALLEL = 3;
const PENDING_KEY = "sp_drive_pending_v1";

export type DriveFileResult = {
  id: string; fileName: string; mimeType: string; fileSize: number;
  folderName: string | null; viewUrl: string; downloadUrl: string;
};

export type PendingUpload = {
  fp: string;               // fingerprint: name|size|lastModified|bookingId|folder
  bookingId: string;
  bookingName?: string;
  folderPath?: string;
  fileName: string;
  size: number;
  lastModified: number;
  uploadUrl: string;
  createdAt: number;
};

type Job = {
  id: string;
  file: File;
  bookingId: string;
  bookingName?: string;
  folderPath?: string;
  onDone?: (f: DriveFileResult) => void;
  cancelled?: boolean;
  xhr?: XMLHttpRequest;
};

// ─── pending list (survives reloads) ──────────────────────────────────────────
function readPending(): PendingUpload[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
}
function writePending(list: PendingUpload[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  pendingListeners.forEach(fn => fn(list));
}
const pendingListeners = new Set<(l: PendingUpload[]) => void>();

export function subscribePending(fn: (l: PendingUpload[]) => void) {
  pendingListeners.add(fn);
  fn(readPending().filter(p => !activeFps.has(p.fp)));
  return () => { pendingListeners.delete(fn); };
}
export function discardPending(fp?: string) {
  writePending(fp ? readPending().filter(p => p.fp !== fp) : []);
}

function fingerprint(file: File, bookingId: string, folderPath?: string) {
  return [file.name, file.size, file.lastModified, bookingId, folderPath ?? ""].join("|");
}

// ─── queue ────────────────────────────────────────────────────────────────────
const queue: Job[] = [];
const activeFps = new Set<string>();
let running = 0;

function pump() {
  while (running < PARALLEL && queue.length) {
    const job = queue.shift()!;
    if (job.cancelled) continue;
    running++;
    runJob(job).finally(() => { running--; pump(); });
  }
}

/** Add files for one program. folderPath like "Raw/Holud/Photo" (optional). */
export function uploadToDrive(opts: {
  files: File[];
  bookingId: string;
  bookingName?: string;
  folderFor?: (f: File) => string | undefined;
  onDone?: (f: DriveFileResult) => void;
}) {
  for (const file of opts.files) {
    const id = crypto.randomUUID();
    const folderPath = opts.folderFor?.(file);
    const job: Job = { id, file, bookingId: opts.bookingId, bookingName: opts.bookingName, folderPath, onDone: opts.onDone };
    uploadStore.add({
      id, fileName: file.name, progress: 0, done: false, type: "drive",
      bookingId: opts.bookingId, bookingName: opts.bookingName, folderName: folderPath,
      size: file.size, sent: 0, status: "queued",
    });
    uploadStore.registerCancel(id, () => {
      job.cancelled = true;
      job.xhr?.abort();
      discardPending(fingerprint(file, job.bookingId, folderPath));
    });
    queue.push(job);
  }
  pump();
}

/** Re-picked files: match them to the unfinished list and continue. */
export function resumeWithFiles(files: File[]): { matched: number } {
  const pending = readPending();
  let matched = 0;
  type Group = { bookingName?: string; files: File[]; folders: Map<File, string | undefined> };
  const byProgram = new Map<string, Group>();
  for (const file of files) {
    const p = pending.find(x => x.fileName === file.name && x.size === file.size && x.lastModified === file.lastModified && !activeFps.has(x.fp));
    if (!p) continue;
    matched++;
    const g: Group = byProgram.get(p.bookingId) ?? { bookingName: p.bookingName, files: [], folders: new Map<File, string | undefined>() };
    g.files.push(file);
    g.folders.set(file, p.folderPath);
    byProgram.set(p.bookingId, g);
  }
  for (const [bookingId, g] of byProgram) {
    uploadToDrive({ files: g.files, bookingId, bookingName: g.bookingName, folderFor: f => g.folders.get(f) });
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
  const { file, bookingId, folderPath } = job;
  const fp = fingerprint(file, bookingId, folderPath);
  activeFps.add(fp);
  const total = file.size;
  const update = uploadStore.update.bind(uploadStore, job.id);
  let speedMark = { t: Date.now(), b: 0 };

  try {
    // 1. Session: reuse a remembered one (resume) or open a new one.
    let pending = readPending().find(p => p.fp === fp);
    let offset = 0;
    let fileId: string | undefined;
    if (pending) {
      update({ status: "resuming" });
      const st = await api<{ state: string; offset: number; fileId: string | null }>(
        "/google-drive/upload-status", { uploadUrl: pending.uploadUrl, size: total }).catch(() => ({ state: "expired", offset: 0, fileId: null }));
      if (st.state === "done") { offset = total; fileId = st.fileId ?? undefined; }
      else if (st.state === "partial") offset = st.offset;
      else { discardPending(fp); pending = undefined; }
    }
    if (!pending) {
      const s = await api<{ uploadUrl: string }>(`/google-drive/upload-session/${bookingId}`, {
        fileName: file.name, mimeType: file.type || "application/octet-stream", size: total, folderPath,
      });
      pending = {
        fp, bookingId, bookingName: job.bookingName, folderPath, fileName: file.name,
        size: total, lastModified: file.lastModified, uploadUrl: s.uploadUrl, createdAt: Date.now(),
      };
      writePending([...readPending().filter(p => p.fp !== fp), pending]);
    }

    // 2. Pieces.
    let failures = 0;
    while (!fileId && (offset < total || total === 0)) {
      if (job.cancelled) throw new Error("cancelled");
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
        if (job.cancelled || (err as Error).message === "cancelled") throw new Error("cancelled");
        if ((err as Error).message.startsWith("Upload session expired")) throw err;
        failures++;
        update({ status: "waiting" });
        await waitOnline();
        if (failures > 20) throw new Error("Upload keeps failing — check your internet and try again");
        // Ask Google how much it really has, then continue from there.
        const st = await api<{ state: string; offset: number; fileId: string | null }>(
          "/google-drive/upload-status", { uploadUrl: pending.uploadUrl, size: total }).catch(() => null);
        if (st?.state === "done") { fileId = st.fileId ?? undefined; offset = total; }
        else if (st?.state === "partial") offset = st.offset;
        else if (st?.state === "expired") { discardPending(fp); throw new Error("Upload session expired — please upload this file again"); }
      }
    }

    // 3. Check + share.
    update({ status: "finishing", progress: 99, sent: total });
    if (!fileId) throw new Error("Upload finished but Drive did not return the file");
    const result = await api<DriveFileResult>(`/google-drive/upload-complete/${bookingId}`, { fileId });
    discardPending(fp);
    update({ progress: 100, done: true, status: "done" });
    job.onDone?.(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "cancelled") update({ cancelled: true, error: "Cancelled", status: "cancelled" });
    else update({ error: msg || "Upload failed", status: "error" });
  } finally {
    activeFps.delete(fp);
  }
}

export function hasRunningDriveUploads() {
  return running > 0 || queue.length > 0;
}
