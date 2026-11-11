"use client";

/**
 * Raw (camera) files of a program on Google Drive.
 * Files go to a private "StuPanel Raw / <year> / <program> / <part> / <who · camera>" folder,
 * made automatically on the first upload. Never shared by link — clients can't see them.
 * Upload goes straight from the browser to Google (resumable; progress bottom-right).
 *
 * Shown as the "Raw files" tab of a program, top to bottom:
 *   1. three numbers (on Drive, copies, free space)
 *   2. a checklist — one row per day + person who shot it: uploaded, linked to a Drive folder, or not yet
 *   3. every file on Drive (browse, rename, move, delete)
 *   4. Safety (other copies), Links, Who can open, Activity
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, CircleDashed, Cloud, ExternalLink, FileUp, FolderOpen, FolderUp, HardDrive, Link2, Loader2, Lock, Monitor, Plus, RefreshCw, Server, ShieldAlert, ShieldCheck, Trash2, Users } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, askDriveDelete, notify } from "@/components/feedback";
import { FormDrawer } from "@/components/ui/form-kit";
import { Empty, Section, card, linkBtn } from "@/components/ui/profile-page";
import { RawBrowser } from "@/components/raw-browser";
import { FileActivity } from "@/components/file-activity";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { pickDriveFolder } from "@/lib/drive-picker";
import type { Booking } from "./types";

type RawFile = { id: string; name: string; size: number; mimeType: string; path: string; conn: string; viewUrl: string; thumb: string | null };
/** A pasted link, or (folder: true) a folder on the studio's Drive chosen in Google's window. */
type RawLink = { id: string; url: string; label: string; folder?: boolean; email?: string; part?: string; who?: string };
type RawLocation = { conn: string; email: string; url: string; current: boolean; reachable: boolean; count: number; bytes: number };
type BackupKind = "hdd" | "pc" | "nas" | "cloud" | "other";
type RawBackup = { id: string; kind: BackupKind; label: string; at: string; by?: string };
type BackupState = { copies: number; needed: number; safe: boolean; onDrive: boolean; linked: boolean; backups: RawBackup[] };
type Overview = {
  connected: boolean;
  account: { email: string; totalBytes: number; usedBytes: number; freeBytes: number | null } | null;
  folderUrl: string | null;
  folders: { path: string; conn: string; email: string; count: number; bytes: number }[];
  locations?: RawLocation[];
  links?: RawLink[];
  files: RawFile[];
  totals: { count: number; bytes: number };
  truncated: boolean;
  shares?: { userId: string; email: string; name: string }[];
  backup?: BackupState;
};
type Member = { id: string; firstName: string; lastName?: string };

export function fmtSize(b: number) {
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TB`;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}
/** Same rule the server uses for folder names. */
const clean = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);

const chip = (on: boolean) => cn(
  "h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors",
  on ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE] hover:border-[#CFC8DD]",
);

export function RawDriveSection({ booking, teamMembers }: { booking: Booking; teamMembers: Member[] }) {
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [linking, setLinking] = useState<string | null>(null);
  const browserRef = useRef<HTMLDivElement>(null);
  const [browse, setBrowse] = useState<{ conn: string | null; path: string }>({ conn: null, path: "" });
  const uploadInto = useRef<string | null>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback((fresh = false) => {
    if (fresh) setRefreshing(true);
    apiFetch(`${API}/google-drive/raw/${booking.id}${fresh ? "?fresh=1" : ""}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Overview) => { setData(d); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setRefreshing(false));
  }, [booking.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 3000);
  }, [load]);

  // Parts (days) of the program, and who worked each one.
  const days = useMemo(() => [...(booking.eventDays ?? [])].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")), [booking.eventDays]);
  const partNames = useMemo(() => {
    const names = days.map(d => clean(d.eventType || "")).filter(Boolean);
    return [...new Set(names)];
  }, [days]);
  const [part, setPart] = useState<string>("");
  const activePart = part || partNames[0] || "";
  const nameOf = useCallback((id: string, fallback?: string) => {
    const m = teamMembers.find(t => t.id === id);
    return m ? `${m.firstName} ${m.lastName ?? ""}`.trim() : fallback ?? "";
  }, [teamMembers]);
  const people = useMemo(() => {
    const onPart = days.filter(d => clean(d.eventType || "") === activePart)
      .flatMap(d => d.shifts.flatMap(s => s.assignments.map(a => nameOf(a.id, a.name))));
    const all = onPart.length ? onPart : (booking.costEntries ?? []).map(e => e.memberName);
    return [...new Set(all.map(n => clean(n || "")).filter(Boolean))];
  }, [days, activePart, booking.costEntries, nameOf]);
  const [who, setWho] = useState("");
  const [otherWho, setOtherWho] = useState("");
  const [camera, setCamera] = useState("");
  const whoName = clean(who === "__other" ? otherWho : who === "__mixed" ? "" : who);
  const base = [activePart, [whoName, clean(camera)].filter(Boolean).join(" · ")].filter(Boolean);

  async function startUpload(list: FileList | null, fromFolder: boolean) {
    if (!list?.length || busy) return;
    const files = Array.from(list);
    // "Add to this folder" in the browser uploads there; otherwise part / who · camera.
    const target = uploadInto.current != null ? uploadInto.current.split("/").filter(Boolean) : base;
    uploadInto.current = null;
    const folderFor = (f: File) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      // Keep the picked folder itself ("Clip") and the card's own sub-folders (DCIM/100CANON…).
      const sub = fromFolder && rel.includes("/") ? rel.split("/").slice(0, -1).map(clean).filter(Boolean) : [];
      return [...target, ...sub].join("/") || undefined;
    };
    const total = files.reduce((s, f) => s + f.size, 0);
    const free = data?.account?.freeBytes;
    if (free != null && total > free) {
      const ok = await askConfirm({
        title: "Not enough space on Drive",
        message: `These files are ${fmtSize(total)} but ${data?.account?.email ?? "this Drive"} has only ${fmtSize(free)} free.\nThe upload will stop when Drive is full.`,
        confirmLabel: "Upload anyway", danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const check = await checkDuplicates({ kind: "raw", files, bookingId: booking.id, folderFor });
      // Identical files already there are skipped; a different file with the same name is kept as a copy.
      const { files: toSend, plans } = applyDuplicateChoice(check, "skip");
      const skipped = files.length - toSend.length;
      if (!toSend.length) { notify(`All ${files.length} files are already on Drive`); return; }
      uploadToDrive({
        kind: "raw", files: toSend, plans, folderFor, bookingId: booking.id,
        bookingName: booking.bookingNumber, onDone: refreshSoon,
      });
      notify(`Uploading ${toSend.length} files${skipped ? ` · ${skipped} already there, skipped` : ""} — progress at the bottom-right`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't start the upload", { error: true });
    } finally {
      setBusy(false);
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  async function removeFile(f: RawFile) {
    const how = await askDriveDelete(`"${f.name}"`);
    if (!how) return;
    const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/file/${f.id}?conn=${encodeURIComponent(f.conn)}${how === "forever" ? "&permanent=1" : ""}`, { method: "DELETE" });
    if (!r.ok) { notify("Delete failed", { error: true }); return; }
    notify(how === "forever" ? "Deleted forever" : "Moved to Drive trash");
    load();
  }
  async function removeFolder(path: string, conn: string) {
    const how = await askDriveDelete(`the folder "${path}" and everything in it`);
    if (!how) return;
    const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/folder?path=${encodeURIComponent(path)}&conn=${encodeURIComponent(conn)}${how === "forever" ? "&permanent=1" : ""}`, { method: "DELETE" });
    if (!r.ok) { notify("Delete failed", { error: true }); return; }
    notify(how === "forever" ? "Deleted forever" : "Moved to Drive trash");
    load();
  }

  async function renameOrMove(body: Record<string, unknown>, done: string) {
    const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/item`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(d?.message || "Couldn't save", { error: true }); return false; }
    notify(done);
    // Show it right away instead of reading the whole Drive folder again.
    setData(cur => cur ? { ...cur, files: patchFiles(cur.files, body, d) } : cur);
    return true;
  }

  async function revoke(x: { userId: string; name: string }) {
    const ok = await askConfirm({ title: `Remove ${x.name}'s access?`, message: "They won't be able to open this program's raw folder any more.", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/share/${x.userId}`, { method: "DELETE" });
    if (!r.ok) { notify("Couldn't remove", { error: true }); return; }
    notify("Access removed");
    load();
  }

  const loadingCard = (text: React.ReactNode, right?: React.ReactNode) => (
    <div className={cn(card, "p-4 flex items-center gap-3")}>
      <span className="w-10 h-10 rounded-full bg-[#E7F5EE] text-[#1F8A5B] flex items-center justify-center flex-shrink-0"><HardDrive className="w-[18px] h-[18px]" /></span>
      <div className="min-w-0 flex-1 text-[14px] text-[#4A4658]">{text}</div>
      {right}
    </div>
  );
  if (failed) return loadingCard("Couldn't load the raw files.", <button type="button" onClick={() => load()} className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#E2D9FC]">Try again</button>);
  if (!data) return loadingCard(<span className="inline-block h-3 w-40 rounded bg-[#EEEBF4] animate-pulse align-middle" />);

  const acc = data.account;
  const usedPct = acc && acc.totalBytes ? Math.min(100, Math.round((acc.usedBytes / acc.totalBytes) * 100)) : 0;
  // A program can have files on more than one Google account (the raw account was changed later).
  const locations = (data.locations ?? []).filter(l => l.count > 0 || l.current || !l.reachable);
  const several = locations.length > 1;
  const nLinks = data.links?.length ?? 0;

  // Copies — a warning only once the shoot is over and the raw files aren't in 2 places yet.
  const bk = data.backup;
  const shotOver = (() => {
    const ds = days.map(d => (d.date || "").slice(0, 10)).filter(Boolean).sort();
    const last = ds[ds.length - 1] || (booking.eventDate ? String(booking.eventDate).slice(0, 10) : "");
    return !!last && new Date(`${last}T23:59:59`) < new Date();
  })();

  // ── Checklist: one row per day + person on that day. Their folder is "<day>/<name>" or "<day>/<name> · <camera>".
  type Slot = { key: string; part: string; date: string; who: string; roles: string[]; count: number; bytes: number; folders: string[]; linked: RawLink[] };
  const slots: Slot[] = [];
  for (const d of days) {
    const partName = clean(d.eventType || "");
    for (const sh of d.shifts) for (const a of sh.assignments) {
      const name = clean(nameOf(a.id, a.name));
      if (!name) continue;
      const key = `${partName}|${name}`;
      let slot = slots.find(x => x.key === key);
      if (!slot) { slot = { key, part: partName, date: d.date || "", who: name, roles: [], count: 0, bytes: 0, folders: [], linked: [] }; slots.push(slot); }
      const roleName = String(a.role || "").replace(/_/g, " ");
      if (roleName && !slot.roles.includes(roleName)) slot.roles.push(roleName);
    }
  }
  for (const f of data.files) {
    const seg = f.path.split("/").filter(Boolean);
    for (const slot of slots) {
      const at = slot.part ? 1 : 0;
      if (slot.part && seg[0] !== slot.part) continue;
      const folder = seg[at];
      if (!folder || !(folder === slot.who || folder.startsWith(`${slot.who} · `))) continue;
      slot.count++; slot.bytes += f.size;
      const full = seg.slice(0, at + 1).join("/");
      if (!slot.folders.includes(full)) slot.folders.push(full);
      break;
    }
  }
  // Folders already on the studio's Drive, linked to a row (nothing uploaded — they stay where they are).
  const folderLinks = (data.links ?? []).filter(l => l.folder);
  for (const l of folderLinks) {
    const slot = slots.find(x => x.part === (l.part ?? "") && x.who === (l.who ?? ""));
    if (slot && l.who) slot.linked.push(l);
  }
  const doneSlots = slots.filter(x => x.count > 0 || x.linked.length > 0).length;
  const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
  const dayLabel = (iso: string) => { const d = iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""; };

  function openUpload(slot?: Slot) {
    setUploadError("");
    setPart(slot?.part ?? "");
    setWho(slot ? slot.who : "");
    setOtherWho(""); setCamera("");
    uploadInto.current = null;
    setUploadOpen(true);
  }
  function pick(fromFolder: boolean) {
    if (!who) { setUploadError("Pick who shot these files first."); return; }
    if (who === "__other" && !clean(otherWho)) { setUploadError("Write the name of the person who shot these files."); return; }
    setUploadError("");
    uploadInto.current = null;
    (fromFolder ? folderRef : filesRef).current?.click();
  }
  /** Choose a folder in Google's own window and link it — to one row of the checklist, or to the whole program. */
  async function linkFolder(slot?: Slot) {
    if (linking) return;
    setLinking(slot?.key ?? "program");
    try {
      const { folder, email } = await pickDriveFolder(slot ? `Folder with ${slot.who}'s files${slot.part ? ` — ${slot.part}` : ""}` : "Folder with this program's raw files");
      if (!folder) return;
      const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/link-folder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folder.id, part: slot?.part ?? "", who: slot?.who ?? "" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || `Couldn't link the folder (${email})`, { error: true }); return; }
      setData(cur => cur ? { ...cur, links: d.links ?? cur.links, backup: d.backup ?? cur.backup } : cur);
      notify(`Linked "${d.link?.label ?? folder.name}"`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't open Google Drive", { error: true });
    } finally { setLinking(null); }
  }
  function openFolder(slot: Slot) {
    const conn = locations.find(l => l.current)?.conn ?? locations[0]?.conn ?? null;
    setBrowse({ conn, path: slot.folders.length === 1 ? slot.folders[0] : slot.part });
    requestAnimationFrame(() => browserRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  // The person list in the upload box always includes the picked name (a row's person may not be on the picked day).
  const peopleChips = who && !["__other", "__mixed"].includes(who) && !people.includes(who) ? [who, ...people] : people;

  const stat = "px-3 sm:px-4 py-3 min-w-0";
  // Red only when there is something to protect: the shoot is over and files (or one copy) exist but not in 2 places.
  const warn = !!bk && !bk.safe && shotOver && (data.totals.count > 0 || bk.copies > 0);
  const copyTone = bk?.safe ? "text-[#1F8A5B]" : bk && warn ? "text-[#C2304F]" : "text-[#17151F]";

  return (
    <div>
      {/* ── What this is + Drive shortcuts ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 mb-3">
        <p className="flex-1 min-w-[200px] text-[12.5px] text-[#6B6680] inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 flex-shrink-0" />Private — only your studio and the editors you allow can open these. Clients never see them.</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(true)} disabled={refreshing} aria-label="Check Drive again" title="Check Drive again (for files added outside StuPanel)"
            className="h-9 px-3 rounded-full bg-white text-[#4A4658] text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#F5F3FA] shadow-[0_1px_2px_rgba(22,18,40,.06)] disabled:opacity-60">
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />Refresh
          </button>
          {data.folderUrl && (
            <a href={data.folderUrl} target="_blank" rel="noopener noreferrer"
              className="h-9 px-3 rounded-full bg-white text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#F5F3FA] shadow-[0_1px_2px_rgba(22,18,40,.06)]">
              <ExternalLink className="w-3.5 h-3.5" />Open in Drive
            </a>
          )}
        </div>
      </div>

      {/* ── 1. Three numbers ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <div className={cn(card, "!rounded-[18px]", stat)}>
          <p className="text-[12px] font-semibold text-[#6B6680]">On Drive</p>
          <p className="text-[15px] sm:text-[18px] font-extrabold text-[#17151F] tabular-nums truncate">{data.totals.count ? fmtSize(data.totals.bytes) : "—"}</p>
          <p className="text-[11.5px] text-[#8A8599] truncate">{data.totals.count ? `${data.totals.count} file${data.totals.count === 1 ? "" : "s"}` : "Nothing yet"}</p>
        </div>
        <div className={cn(card, "!rounded-[18px]", stat)}>
          <p className="text-[12px] font-semibold text-[#6B6680]">Copies</p>
          <p className={cn("text-[15px] sm:text-[18px] font-extrabold tabular-nums truncate inline-flex items-center gap-1", copyTone)}>
            {bk?.safe && <ShieldCheck className="w-4 h-4" />}{bk ? `${Math.min(bk.copies, 9)} of ${bk.needed}` : "—"}
          </p>
          <p className="text-[11.5px] text-[#8A8599] truncate">{!bk ? "" : bk.safe ? "Safe" : bk.copies === 0 ? "Keep 2 copies" : "Add one more"}</p>
        </div>
        <div className={cn(card, "!rounded-[18px]", stat)}>
          <p className="text-[12px] font-semibold text-[#6B6680]">Drive space</p>
          <p className={cn("text-[15px] sm:text-[18px] font-extrabold tabular-nums truncate", usedPct > 90 ? "text-[#C2304F]" : "text-[#17151F]")}>{acc?.freeBytes != null ? fmtSize(acc.freeBytes) : "—"}</p>
          <p className="text-[11.5px] text-[#8A8599] truncate">{acc ? (acc.freeBytes != null ? "free" : acc.email) : "Not connected"}</p>
        </div>
      </div>

      {!data.connected && (
        <div className={cn(card, "p-4 mb-6 flex flex-wrap items-center gap-3")}>
          <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><Cloud className="w-[18px] h-[18px]" /></span>
          <div className="flex-1 min-w-[180px]">
            <p className="text-[14.5px] font-semibold text-[#17151F]">Connect Google Drive to upload from here</p>
            <p className="text-[12.5px] text-[#6B6680]">Until then you can still add links and note where the copies are kept.</p>
          </div>
          <Link href="/settings?pane=integrations" className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center flex-shrink-0">Connect Drive</Link>
        </div>
      )}

      {/* ── 2. Checklist ── */}
      {data.connected && (
        <Section
          title={slots.length ? `Cards to upload · ${doneSlots} of ${slots.length} done` : "Upload"}
          action={<button type="button" onClick={() => openUpload()} className={linkBtn}><Plus className="w-3.5 h-3.5" />{slots.length ? "Other files" : "Upload files"}</button>}>
          {slots.length === 0 ? (
            <Empty icon={Camera} title="Nobody is on a shift yet" text="Put your team on the program's days and each person's card shows here. You can still upload now.">
              <button type="button" onClick={() => openUpload()} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><FolderUp className="w-4 h-4" />Upload files</button>
            </Empty>
          ) : (
            <div className={cn(card, "overflow-hidden divide-y divide-[#EEEBF4]")}>
              {slots.map(slot => {
                const uploaded = slot.count > 0;
                const linked = slot.linked.length > 0;
                const done = uploaded || linked;
                const status = [
                  uploaded ? `${slot.count} file${slot.count === 1 ? "" : "s"} · ${fmtSize(slot.bytes)}` : "",
                  linked ? `Linked: ${slot.linked.map(l => l.label).join(", ")}` : "",
                ].filter(Boolean).join(" · ") || "Not uploaded yet";
                return (
                  <div key={slot.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <span className={cn("w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0", done ? "bg-[#E7F5EE] text-[#1F8A5B]" : "bg-[#F1EFF6] text-[#8A8599]")}>
                      {done ? <CheckCircle2 className="w-[18px] h-[18px]" /> : <CircleDashed className="w-[18px] h-[18px]" />}
                    </span>
                    <span className="flex-1 min-w-[150px]">
                      <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{slot.who}</span>
                      <span className="block text-[12.5px] text-[#6B6680] truncate">{[slot.part || "Program", dayLabel(slot.date), slot.roles.map(cap).join(", ")].filter(Boolean).join(" · ")}</span>
                      <span className={cn("block text-[12.5px] font-semibold mt-0.5 truncate", done ? "text-[#1F8A5B]" : "text-[#8A8599]")}>{status}</span>
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                      {uploaded && (
                        <button type="button" onClick={() => openFolder(slot)} aria-label={`Open ${slot.who}'s files`} className="h-9 px-3 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[12.5px] font-semibold inline-flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" />Open</button>
                      )}
                      {linked && !uploaded && (
                        <a href={slot.linked[0].url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${slot.linked[0].label} in Drive`} className="h-9 px-3 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[12.5px] font-semibold inline-flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Open in Drive</a>
                      )}
                      {!linked && !uploaded && (
                        <button type="button" onClick={() => linkFolder(slot)} disabled={!!linking} aria-label={`Link a Drive folder for ${slot.who}`} title="The files are already on Google Drive — choose the folder"
                          className="h-9 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                          {linking === slot.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}Link Drive folder
                        </button>
                      )}
                      {done ? (
                        <button type="button" onClick={() => openUpload(slot)} aria-label={`Upload more files for ${slot.who}`} className="h-9 px-3 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[12.5px] font-semibold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Upload</button>
                      ) : (
                        <button type="button" onClick={() => openUpload(slot)} className="h-9 px-3.5 rounded-full bg-[#17151F] hover:bg-[#2A2735] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5"><FolderUp className="w-3.5 h-3.5" />Upload</button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {slots.length > 0 && (
            <p className="px-1 mt-2 text-[12px] text-[#8A8599]"><b className="font-semibold text-[#6B6680]">Upload</b> sends the card to your Drive. <b className="font-semibold text-[#6B6680]">Link Drive folder</b> is for files that are already on your Drive — nothing is uploaded or moved.</p>
          )}
        </Section>
      )}

      {/* ── 3. Everything on Drive ── */}
      <div ref={browserRef} className="scroll-mt-32">
        <Section title="Files on Drive" action={data.totals.count ? <span className="text-[12.5px] text-[#6B6680] tabular-nums">{data.totals.count} files · {fmtSize(data.totals.bytes)}</span> : undefined}>
          {data.files.length === 0 ? (
            <div className={cn(card, "px-4 py-4 text-[13.5px] text-[#8A8599]")}>Nothing uploaded yet. Files show here after the first upload — sorted by day, then by who shot them.</div>
          ) : (() => {
            const conn = browse.conn && locations.some(l => l.conn === browse.conn) ? browse.conn : (locations.find(l => l.current)?.conn ?? locations[0]?.conn ?? null);
            const loc = locations.find(l => l.conn === conn);
            return (
              <div className={cn(card, "p-3 space-y-2")}>
                {several && (
                  <div className="flex flex-wrap gap-1.5">
                    {locations.map(l => (
                      <button key={l.conn} type="button" onClick={() => setBrowse({ conn: l.conn, path: "" })}
                        className={cn("h-8 px-3 rounded-full text-[12px] font-semibold border", l.conn === conn ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE]")}>
                        {l.email}{l.current ? " · new uploads" : ""}
                      </button>
                    ))}
                  </div>
                )}
                {loc && !loc.reachable ? (
                  <p className="text-[12.5px] text-[#6B6680] px-1 py-2">Account disconnected — reconnect it to see these files.</p>
                ) : (
                  <RawBrowser
                    files={data.files.filter(f => !conn || f.conn === conn)}
                    path={browse.path} onPath={p => setBrowse({ conn, path: p })}
                    rootLabel={several && loc ? loc.email : "All raw files"}
                    canDelete busy={busy}
                    canUploadHere={data.connected && (!loc || loc.current)}
                    onUploadHere={(p, fromFolder) => { uploadInto.current = p; (fromFolder ? folderRef : filesRef).current?.click(); }}
                    onDeleteFile={f => removeFile(f as RawFile)}
                    onDeleteFolder={p => removeFolder(p, conn ?? "")}
                    onRename={(t, name) => t.file
                      ? renameOrMove({ conn: t.file.conn ?? conn, fileId: t.file.id, name, oldName: t.file.name }, "Renamed")
                      : renameOrMove({ conn, folder: t.folder, name }, "Folder renamed")}
                    onMove={(f, toPath) => renameOrMove({ conn: f.conn ?? conn, fileId: f.id, toPath }, `Moved to ${toPath || "the main folder"}`)}
                  />
                )}
                {data.truncated && <p className="text-[11.5px] text-[#8A8599] px-1">Very large folder — some files are only shown in Drive.</p>}
              </div>
            );
          })()}
        </Section>
      </div>

      {/* ── 4. Safety, links, access ── */}
      <div className="grid grid-cols-1 gap-x-5 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
        <Section title="Safety — where the copies are">
          <div className={cn(card, "p-4")}>
            {bk ? (
              <RawBackups bookingId={booking.id} state={bk} driveCount={data.totals.count} nLinks={nLinks} shotOver={warn}
                onSaved={b => setData(d => d ? { ...d, backup: b } : d)} />
            ) : <p className="text-[13.5px] text-[#8A8599]">Nothing to show yet.</p>}
          </div>
        </Section>
        <div>
          <Section title="Raw files already on a Drive">
            <div className={cn(card, "p-4")}>
              <RawLinks bookingId={booking.id} links={data.links ?? []} canPick={data.connected} picking={linking === "program"} onPick={() => linkFolder()}
                onSaved={(links, backup) => setData(d => d ? { ...d, links, backup: backup ?? d.backup } : d)} />
            </div>
          </Section>
          <Section title="Who can open the raw folder">
            <div className={cn(card, "p-4 space-y-1.5")}>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#F7F5FB] px-3 py-2">
                <Users className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#17151F]">Your studio (owner and managers)</span>
                <span className="text-[11.5px] text-[#6B6680] flex-shrink-0">always</span>
              </div>
              {(data.shares ?? []).map(x => (
                <div key={x.userId} className="flex items-center gap-2 rounded-xl bg-[#F7F5FB] px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#17151F] truncate">{x.name}</span>
                    <span className="block text-[11.5px] text-[#6B6680] truncate">{x.email} · view and download</span>
                  </span>
                  <button type="button" onClick={() => revoke(x)} className="h-8 px-3 rounded-full text-[12px] font-semibold text-[#C2304F] hover:bg-[#FDECEF] flex-shrink-0">Remove</button>
                </div>
              ))}
              {!data.shares?.length && <p className="text-[12.5px] text-[#8A8599] px-1 pt-1">No editor has access yet. Editors get it when you assign them in the Editing tab.</p>}
            </div>
          </Section>
        </div>
      </div>

      <FileActivity bookingId={booking.id} area="raw" />

      {/* Inputs live outside the upload box so a running pick isn't lost if it closes */}
      <input ref={filesRef} type="file" multiple hidden onChange={e => { setUploadOpen(false); startUpload(e.target.files, false); }} />
      <input ref={folderRef} type="file" multiple hidden onChange={e => { setUploadOpen(false); startUpload(e.target.files, true); }}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />

      {/* ── Upload box: where it goes, then choose the card ── */}
      <FormDrawer open={uploadOpen} onClose={() => setUploadOpen(false)} icon={FolderUp} color="green" title="Upload raw files"
        sub={`${booking.bookingNumber}${booking.eventName ? ` · ${booking.eventName}` : ""}`}
        footer={<button type="button" onClick={() => setUploadOpen(false)} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F] hover:bg-[#E4E0EC]">Cancel</button>}>
        <div className="space-y-4">
          {uploadError && <div role="alert" className="px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{uploadError}</div>}

          {partNames.length > 0 && (
            <div className={cn(card, "p-4")}>
              <p className="text-[13px] font-bold text-[#17151F] mb-2"><span className="text-[#8A8599]">1 ·</span> Which day?</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Which day">
                {partNames.map(p => <button key={p} type="button" role="radio" aria-checked={activePart === p} className={chip(activePart === p)} onClick={() => setPart(p)}>{p}</button>)}
              </div>
            </div>
          )}

          <div className={cn(card, "p-4")}>
            <p className="text-[13px] font-bold text-[#17151F] mb-2"><span className="text-[#8A8599]">{partNames.length > 0 ? 2 : 1} ·</span> Who shot it?</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Who shot it">
              {peopleChips.map(p => <button key={p} type="button" role="radio" aria-checked={who === p} className={chip(who === p)} onClick={() => { setWho(p); setUploadError(""); }}>{p}</button>)}
              <button type="button" role="radio" aria-checked={who === "__other"} className={chip(who === "__other")} onClick={() => { setWho("__other"); setUploadError(""); }}>Someone else</button>
              <button type="button" role="radio" aria-checked={who === "__mixed"} className={chip(who === "__mixed")} onClick={() => { setWho("__mixed"); setUploadError(""); }}>Mixed / not sure</button>
            </div>
            {who === "__other" && (
              <input autoFocus value={otherWho} onChange={e => { setOtherWho(e.target.value); setUploadError(""); }} placeholder="Their name" aria-label="Name of the person"
                className="mt-2 w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
            )}
          </div>

          <div className={cn(card, "p-4")}>
            <p className="text-[13px] font-bold text-[#17151F] mb-2"><span className="text-[#8A8599]">{partNames.length > 0 ? 3 : 2} ·</span> Which camera? <span className="font-normal text-[#8A8599]">(optional)</span></p>
            <input value={camera} onChange={e => setCamera(e.target.value)} placeholder="e.g. Camera A, Drone, Video" aria-label="Camera"
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
            <p className="mt-1.5 text-[11.5px] text-[#8A8599]">Use it when one person has more than one card.</p>
          </div>

          <div className={cn(card, "p-4")}>
            <p className="text-[12px] font-semibold text-[#6B6680]">Saved in this folder</p>
            <p className="mt-0.5 text-[14px] font-semibold text-[#17151F] break-words">{base.length ? base.join("  ›  ") : "The program's main folder"}</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button type="button" disabled={busy} onClick={() => pick(true)}
                className="h-12 rounded-full bg-[#17151F] text-white text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4" />}Whole card / folder
              </button>
              <button type="button" disabled={busy} onClick={() => pick(false)}
                className="h-12 rounded-full bg-white border border-[#E6E2EE] text-[#17151F] text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                <FileUp className="w-4 h-4" />Pick files
              </button>
            </div>
            <ul className="mt-3 space-y-1 text-[12px] text-[#6B6680] list-disc pl-4">
              <li>Files go straight to your Google Drive. Progress shows at the bottom-right — you can keep working.</li>
              <li>Files that are already there are skipped, so it is safe to upload the same card again.</li>
              {acc?.freeBytes != null && <li>{fmtSize(acc.freeBytes)} free on {acc.email}.</li>}
            </ul>
          </div>
        </div>
      </FormDrawer>
    </div>
  );
}

/**
 * Raw files that are already on a Drive (uploaded by hand, or synced from a PC).
 * The studio pastes the folder link here; editors of the program see it in their panel.
 */
function RawLinks({ bookingId, links, onSaved, canPick, picking, onPick }: {
  bookingId: string; links: RawLink[]; onSaved: (l: RawLink[], backup?: BackupState) => void;
  /** Google Drive is connected: offer Google's folder window. */
  canPick: boolean; picking: boolean; onPick: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  // Google does not let StuPanel share a folder it did not make. For each linked folder we ask
  // which of the program's editors can't open it yet, so the studio can share it in Drive.
  type Access = { editors: { userId: string; name: string; email: string }[]; links: { id: string; checked: boolean; anyone: boolean; missing: string[] }[] };
  const [access, setAccess] = useState<Access | null>(null);
  const [checking, setChecking] = useState(false);
  const folderIds = links.filter(l => l.folder).map(l => l.id).join(",");
  const checkAccess = useCallback(() => {
    if (!folderIds) { setAccess(null); return; }
    setChecking(true);
    apiFetch(`${API}/google-drive/raw/${bookingId}/link-access`)
      .then(r => (r.ok ? r.json() : null)).then((d: Access | null) => setAccess(d)).catch(() => {})
      .finally(() => setChecking(false));
  }, [bookingId, folderIds]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { checkAccess(); }, [checkAccess]);

  async function save(next: { id?: string; url: string; label?: string }[]) {
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/google-drive/raw/${bookingId}/links`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || "Couldn't save", { error: true }); return false; }
      onSaved(d.links ?? [], d.backup);
      return true;
    } finally { setBusy(false); }
  }
  async function add() {
    const u = url.trim();
    if (!u) return;
    if (await save([...links, { url: /^https?:\/\//i.test(u) ? u : `https://${u}`, label: label.trim() }])) {
      setUrl(""); setLabel(""); setAdding(false); notify("Link added");
    }
  }
  async function remove(l: RawLink) {
    const ok = await askConfirm(l.folder
      ? { title: `Unlink "${l.label}"?`, message: "Only the connection is removed. The folder, its files and who it is shared with stay as they are on your Drive.", confirmLabel: "Unlink", danger: true }
      : { title: "Remove this link?", message: "Only the link is removed from StuPanel — the files on Drive are not touched.", confirmLabel: "Remove", danger: true });
    if (ok && await save(links.filter(x => x.id !== l.id))) notify(l.folder ? "Folder unlinked" : "Link removed");
  }
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-[#6B6680]">Files that are already on Google Drive (for example synced from your PC) don&apos;t need uploading — point StuPanel at the folder.</p>
      {links.map(l => {
        const acc = l.folder ? access?.links.find(x => x.id === l.id) : undefined;
        const need = acc && access!.editors.length > 0 && (acc.missing.length > 0 || !acc.checked);
        const emails = (acc?.missing ?? []).filter(m => m.includes("@"));
        return (
          <div key={l.id} className="rounded-xl bg-[#F7F5FB]">
            <div className="flex items-center gap-2 px-3 py-2">
              {l.folder ? <Cloud className="w-4 h-4 text-[#1F8A5B] flex-shrink-0" /> : <Link2 className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />}
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#17151F] truncate">{l.label || host(l.url)}</span>
                <span className="block text-[11px] text-[#6B6680] truncate">
                  {l.folder ? ["Linked Drive folder", [l.part, l.who].filter(Boolean).join(" · ") || "whole program", l.email].filter(Boolean).join(" · ") : l.url}
                </span>
              </a>
              <button type="button" onClick={() => remove(l)} disabled={busy} title={l.folder ? "Unlink folder" : "Remove link"} aria-label={l.folder ? `Unlink ${l.label}` : "Remove link"}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {acc && access!.editors.length > 0 && !need && (
              <p className="px-3 pb-2 -mt-0.5 text-[11.5px] font-semibold text-[#1F8A5B] inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{acc.anyone ? "Anyone with the link can open it" : "Your editors can open it"}</p>
            )}
            {need && (
              <div className="mx-2 mb-2 rounded-[10px] bg-[#FFF3E0] px-3 py-2.5" role="status">
                <p className="text-[12.5px] font-semibold text-[#7A4800]">{acc!.checked ? "Your editor can't open this folder yet" : "Check that your editor can open this folder"}</p>
                <p className="text-[12px] text-[#7A4800] mt-0.5">Google only lets you share your own folders. Open it in Drive, press <b>Share</b> and add:</p>
                <p className="text-[12.5px] font-semibold text-[#17151F] mt-1 break-words">{acc!.missing.join(", ")}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="h-8 px-3 rounded-full bg-[#17151F] text-white text-[12px] font-semibold inline-flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Open in Drive</a>
                  {emails.length > 0 && (
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(emails.join(", ")).then(() => notify(emails.length === 1 ? "Email copied" : "Emails copied")).catch(() => notify("Couldn't copy", { error: true })); }}
                      className="h-8 px-3 rounded-full bg-white text-[#17151F] text-[12px] font-semibold inline-flex items-center gap-1.5 border border-[#E6E2EE]">Copy email{emails.length === 1 ? "" : "s"}</button>
                  )}
                  <button type="button" onClick={checkAccess} disabled={checking} className="h-8 px-3 rounded-full bg-white text-[#17151F] text-[12px] font-semibold inline-flex items-center gap-1.5 border border-[#E6E2EE] disabled:opacity-60">
                    <RefreshCw className={cn("w-3.5 h-3.5", checking && "animate-spin")} />I shared it — check again
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {adding ? (
        <div className="rounded-2xl border border-[#E6E2EE] p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" aria-label="Link"
            className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Name (optional) — e.g. Ceremony · Camera A" aria-label="Name"
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
          <p className="text-[11px] text-[#8A8599]">For a pasted link, make sure the editor can open it on Drive (share the folder with them, or &quot;Anyone with the link&quot;).</p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setAdding(false); setUrl(""); setLabel(""); }} className="h-9 px-4 rounded-full text-[13px] font-semibold text-[#4A4658] hover:bg-[#F2EFF8]">Cancel</button>
            <button type="button" onClick={add} disabled={busy || !url.trim()} className="h-9 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Save link
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {canPick && (
            <button type="button" onClick={onPick} disabled={picking}
              className="h-10 px-4 rounded-full bg-[#17151F] hover:bg-[#2A2735] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
              {picking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}Choose a folder from Drive
            </button>
          )}
          <button type="button" onClick={() => setAdding(true)}
            className="h-10 px-4 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5">
            <Link2 className="w-4 h-4" />Paste a link
          </button>
        </div>
      )}
      {canPick && !adding && <p className="text-[11px] text-[#8A8599]">The Google window shows the Drive connected to StuPanel. Folders in another Google account: paste their link.</p>}
    </div>
  );
}

const KINDS: { value: BackupKind; label: string; icon: typeof HardDrive }[] = [
  { value: "hdd", label: "External HDD", icon: HardDrive },
  { value: "pc", label: "PC", icon: Monitor },
  { value: "nas", label: "NAS", icon: Server },
  { value: "cloud", label: "Other cloud", icon: Cloud },
  { value: "other", label: "Other", icon: HardDrive },
];

/**
 * Where else the raw files are kept. They are safe once they are in 2 places:
 * StuPanel's Drive folder and the raw links count by themselves, the rest is added here.
 */
function RawBackups({ bookingId, state, driveCount, nLinks, shotOver, onSaved }: {
  bookingId: string; state: BackupState; driveCount: number; nLinks: number; shotOver: boolean; onSaved: (s: BackupState) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<BackupKind>("hdd");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: RawBackup[] | Omit<RawBackup, "id" | "at">[]) {
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/google-drive/raw/${bookingId}/backups`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backups: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || "Couldn't save", { error: true }); return false; }
      onSaved(d as BackupState);
      return true;
    } finally { setBusy(false); }
  }
  async function add() {
    const l = label.trim();
    if (!l) return;
    if (await save([...state.backups, { kind, label: l }] as RawBackup[])) {
      setLabel(""); setAdding(false); notify("Backup added");
    }
  }
  async function remove(b: RawBackup) {
    const ok = await askConfirm({ title: `Remove "${b.label}"?`, message: "Only removes it from this list — nothing is deleted from the drive.", confirmLabel: "Remove", danger: true });
    if (ok && await save(state.backups.filter(x => x.id !== b.id))) notify("Removed");
  }

  const pct = Math.min(100, Math.round((state.copies / state.needed) * 100));
  const tone = state.safe ? "#1F8A5B" : shotOver ? "#C2304F" : "#7D5CEF";
  const when = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };
  const KindIcon = ({ k }: { k: BackupKind }) => { const I = KINDS.find(x => x.value === k)?.icon ?? HardDrive; return <I className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />; };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {state.safe ? <ShieldCheck className="w-4 h-4" style={{ color: tone }} /> : <ShieldAlert className="w-4 h-4" style={{ color: tone }} />}
        <p className="flex-1 text-[13px] font-bold text-[#17151F]">{state.copies} of {state.needed} copies</p>
        <span className="text-[12px] font-semibold" style={{ color: tone }}>
          {state.safe ? "Safe" : state.copies === 0 ? "No copy yet" : "Add one more copy"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#EEEBF4] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: tone }} />
      </div>

      <div className="space-y-1.5">
        {state.onDrive && (
          <div className="flex items-center gap-2 rounded-xl bg-[#F7F5FB] px-3 py-2">
            <Cloud className="w-4 h-4 text-[#1F8A5B] flex-shrink-0" />
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#17151F] truncate">Google Drive (StuPanel)</span>
            <span className="text-[11px] text-[#6B6680]">{driveCount} files · auto</span>
          </div>
        )}
        {state.linked && (
          <div className="flex items-center gap-2 rounded-xl bg-[#F7F5FB] px-3 py-2">
            <Link2 className="w-4 h-4 text-[#1F8A5B] flex-shrink-0" />
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#17151F] truncate">Linked Drive folder{nLinks > 1 ? "s" : ""}</span>
            <span className="text-[11px] text-[#6B6680]">{nLinks} · auto</span>
          </div>
        )}
        {state.backups.map(b => (
          <div key={b.id} className="flex items-center gap-2 rounded-xl bg-[#F7F5FB] px-3 py-2">
            <KindIcon k={b.kind} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-[#17151F] truncate">{b.label}</span>
              <span className="block text-[11px] text-[#6B6680] truncate">
                {[KINDS.find(k => k.value === b.kind)?.label, when(b.at), b.by].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button type="button" onClick={() => remove(b)} disabled={busy} title="Remove"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#FDECEF] hover:text-[#C2304F]">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {state.copies === 0 && !adding && (
          <p className="text-[12px] text-[#8A8599] px-1">Raw files are safe once they are in 2 places. Uploading here counts as one; add where else the card was copied (HDD, PC…).</p>
        )}
      </div>

      {adding ? (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(k => <button key={k.value} type="button" className={chip(kind === k.value)} onClick={() => setKind(k.value)}>{k.label}</button>)}
          </div>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }}
            placeholder={kind === "hdd" ? "Name — e.g. WD 4TB #2" : kind === "pc" ? "Name — e.g. Editing PC, D:/2026/Nov" : "Name or where it is"}
            className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setAdding(false); setLabel(""); }} className="h-9 px-4 rounded-full text-[13px] font-semibold text-[#4A4658] hover:bg-[#F2EFF8]">Cancel</button>
            <button type="button" onClick={add} disabled={busy || !label.trim()} className="h-9 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Save
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full h-9 rounded-full border border-dashed border-[#CFC8DD] text-[12px] font-semibold text-[#5B3FD0] hover:bg-[#F7F5FB] inline-flex items-center justify-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />Add a copy (HDD, PC, NAS…)
        </button>
      )}
    </div>
  );
}

/** Apply a rename / move to the list we already have. */
function patchFiles(files: RawFile[], body: Record<string, unknown>, res: { name?: string; from?: string; to?: string; renamed?: string }) {
  if (res.renamed === "folder" && typeof res.from === "string" && res.name) {
    const from = res.from;
    const to = [...from.split("/").slice(0, -1), res.name].join("/");
    return files.map(f => (body.conn && f.conn !== body.conn) || !(f.path === from || f.path.startsWith(`${from}/`))
      ? f : { ...f, path: to + f.path.slice(from.length) });
  }
  return files.map(f => f.id !== body.fileId ? f : {
    ...f,
    ...(res.name ? { name: res.name } : {}),
    ...(typeof res.to === "string" ? { path: res.to } : {}),
  });
}
