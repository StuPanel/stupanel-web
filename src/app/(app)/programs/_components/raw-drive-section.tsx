"use client";

/**
 * Raw (camera) files of a program on Google Drive.
 * Files go to a private "StuPanel Raw / <year> / <program> / <part> / <who · camera>" folder,
 * made automatically on the first upload. Never shared by link — clients can't see them.
 * Upload goes straight from the browser to Google (resumable; progress bottom-right).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, FileUp, FolderUp, HardDrive, Loader2, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, askDriveDelete, notify } from "@/components/feedback";
import { Tile } from "@/components/ui/apple";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import type { Booking } from "./types";

type RawFile = { id: string; name: string; size: number; mimeType: string; path: string; viewUrl: string; thumb: string | null };
type Overview = {
  connected: boolean;
  account: { email: string; totalBytes: number; usedBytes: number; freeBytes: number | null } | null;
  folderUrl: string | null;
  folders: { path: string; count: number; bytes: number }[];
  files: RawFile[];
  totals: { count: number; bytes: number };
  truncated: boolean;
  shares?: { userId: string; email: string; name: string }[];
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
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    apiFetch(`${API}/google-drive/raw/${booking.id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Overview) => { setData(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, [booking.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 3000);
  }, [load]);

  // Parts (days) of the program, and who worked each one.
  const days = useMemo(() => [...(booking.eventDays ?? [])].sort((a, b) => (a.date || "").localeCompare(b.date || "")), [booking.eventDays]);
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
  const whoName = clean(who === "__other" ? otherWho : who);
  const base = [activePart, [whoName, clean(camera)].filter(Boolean).join(" · ")].filter(Boolean);

  async function startUpload(list: FileList | null, fromFolder: boolean) {
    if (!list?.length || busy) return;
    const files = Array.from(list);
    const folderFor = (f: File) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      // Keep the card's own sub-folders (DCIM/100CANON…), minus the picked folder itself.
      const sub = fromFolder && rel.includes("/") ? rel.split("/").slice(1, -1).map(clean).filter(Boolean) : [];
      return [...base, ...sub].join("/") || undefined;
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
    const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/file/${f.id}${how === "forever" ? "?permanent=1" : ""}`, { method: "DELETE" });
    if (!r.ok) { notify("Delete failed", { error: true }); return; }
    notify(how === "forever" ? "Deleted forever" : "Moved to Drive trash");
    load();
  }
  async function removeFolder(path: string) {
    const how = await askDriveDelete(`the folder "${path}" and everything in it`);
    if (!how) return;
    const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/folder?path=${encodeURIComponent(path)}${how === "forever" ? "&permanent=1" : ""}`, { method: "DELETE" });
    if (!r.ok) { notify("Delete failed", { error: true }); return; }
    notify(how === "forever" ? "Deleted forever" : "Moved to Drive trash");
    load();
  }

  async function revoke(x: { userId: string; name: string }) {
    const ok = await askConfirm({ title: `Remove ${x.name}'s access?`, message: "They won't be able to open this program's raw folder any more.", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    const r = await apiFetch(`${API}/google-drive/raw/${booking.id}/share/${x.userId}`, { method: "DELETE" });
    if (!r.ok) { notify("Couldn't remove", { error: true }); return; }
    notify("Access removed");
    load();
  }

  const header = (
    <div className="flex items-center gap-3">
      <Tile icon={HardDrive} color="green" size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-[#17151F]">Raw files</p>
        <p className="text-[12px] text-[#6B6680]">Private — only your studio sees these</p>
      </div>
      {data?.folderUrl && (
        <a href={data.folderUrl} target="_blank" rel="noopener noreferrer"
          className="h-9 px-3 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#E4DCFB]">
          <ExternalLink className="w-3.5 h-3.5" />Open in Drive
        </a>
      )}
    </div>
  );

  if (failed) return <div className="rounded-2xl border border-[#E6E2EE] p-4 space-y-2">{header}<p className="text-sm text-[#6B6680]">Couldn&apos;t load raw files. <button type="button" onClick={load} className="font-semibold text-[#5B3FD0]">Try again</button></p></div>;
  if (!data) return <div className="rounded-2xl border border-[#E6E2EE] p-4 space-y-3">{header}<div className="h-16 rounded-xl bg-[#F5F3FA] animate-pulse" /></div>;
  if (!data.connected) return (
    <div className="rounded-2xl border border-[#E6E2EE] p-4 space-y-3">
      {header}
      <p className="text-sm text-[#4A4658]">Connect Google Drive to upload raw files straight from here.</p>
      <Link href="/settings?pane=integrations" className="inline-flex h-9 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold items-center">Connect Google Drive</Link>
    </div>
  );

  const acc = data.account;
  const usedPct = acc && acc.totalBytes ? Math.min(100, Math.round((acc.usedBytes / acc.totalBytes) * 100)) : 0;
  const filesIn = (path: string) => data.files.filter(f => f.path === path);
  const topFolders = data.folders.filter(f => f.count > 0);

  return (
    <div className="rounded-2xl border border-[#E6E2EE] p-4 space-y-4">
      {header}

      {acc && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[12px] text-[#6B6680]">
            <span className="truncate">{acc.email}</span>
            {acc.freeBytes != null && <span className={cn("font-semibold", usedPct > 90 ? "text-[#C2304F]" : "text-[#4A4658]")}>{fmtSize(acc.freeBytes)} free</span>}
          </div>
          {acc.totalBytes > 0 && (
            <div className="h-1.5 rounded-full bg-[#EEEBF4] overflow-hidden">
              <div className={cn("h-full rounded-full", usedPct > 90 ? "bg-[#C2304F]" : "bg-[#1F8A5B]")} style={{ width: `${usedPct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Where the next files go */}
      <div className="rounded-2xl bg-[#F7F5FB] p-3 space-y-3">
        {partNames.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-[#4A4658]">Part</p>
            <div className="flex flex-wrap gap-1.5">
              {partNames.map(p => <button key={p} type="button" className={chip(activePart === p)} onClick={() => { setPart(p); setWho(""); }}>{p}</button>)}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-[#4A4658]">Who shot it</p>
          <div className="flex flex-wrap gap-1.5">
            {people.map(p => <button key={p} type="button" className={chip(who === p)} onClick={() => setWho(who === p ? "" : p)}>{p}</button>)}
            <button type="button" className={chip(who === "__other")} onClick={() => setWho(who === "__other" ? "" : "__other")}>Someone else</button>
          </div>
          {who === "__other" && (
            <input value={otherWho} onChange={e => setOtherWho(e.target.value)} placeholder="Name"
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-[#4A4658]">Camera <span className="font-normal text-[#8A8599]">(optional)</span></p>
          <input value={camera} onChange={e => setCamera(e.target.value)} placeholder="e.g. Camera A, Drone, Video"
            className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
        </div>
        <p className="text-[12px] text-[#6B6680] break-words">Goes to: <span className="font-semibold text-[#17151F]">{base.length ? base.join(" / ") : "the program folder"}</span></p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => folderRef.current?.click()}
            className="h-11 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4" />}Card / folder
          </button>
          <button type="button" disabled={busy} onClick={() => filesRef.current?.click()}
            className="h-11 rounded-full bg-white border border-[#E6E2EE] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
            <FileUp className="w-4 h-4" />Files
          </button>
        </div>
        <input ref={filesRef} type="file" multiple hidden onChange={e => startUpload(e.target.files, false)} />
        <input ref={folderRef} type="file" multiple hidden onChange={e => startUpload(e.target.files, true)}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
      </div>

      {/* What is on Drive */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[13px] font-bold text-[#4A4658]">On Drive</p>
          <p className="text-[12px] text-[#6B6680]">{data.totals.count} files · {fmtSize(data.totals.bytes)}</p>
        </div>
        {topFolders.length === 0 ? (
          <p className="text-sm text-[#8A8599] px-1">Nothing uploaded yet.</p>
        ) : (
          <div className="rounded-2xl border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
            {topFolders.map(g => {
              const isOpen = !!open[g.path];
              const list = isOpen ? filesIn(g.path) : [];
              return (
                <div key={g.path}>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button type="button" onClick={() => setOpen(o => ({ ...o, [g.path]: !isOpen }))} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                      <ChevronDown className={cn("w-4 h-4 text-[#8A8599] transition-transform", !isOpen && "-rotate-90")} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[#17151F] truncate">{g.path || "Program folder"}</span>
                        <span className="block text-[11px] text-[#6B6680]">{g.count} files · {fmtSize(g.bytes)}</span>
                      </span>
                    </button>
                    {g.path && (
                      <button type="button" onClick={() => removeFolder(g.path)} title="Delete folder"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="bg-[#FBFAFD] px-3 pb-2 max-h-72 overflow-y-auto">
                      {list.slice(0, 300).map(f => (
                        <div key={f.id} className="flex items-center gap-2 py-1.5">
                          <a href={f.viewUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-[12px] text-[#17151F] truncate hover:text-[#5B3FD0]">{f.name}</a>
                          <span className="text-[11px] text-[#8A8599] tabular-nums">{fmtSize(f.size)}</span>
                          <button type="button" onClick={() => removeFile(f)} title="Delete"
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {list.length > 300 && <p className="text-[11px] text-[#8A8599] py-1.5">+{list.length - 300} more — open in Drive to see all.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!!data.shares?.length && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[13px] font-bold text-[#4A4658] px-1">Editors who can open it</p>
            {data.shares.map(x => (
              <div key={x.userId} className="flex items-center gap-2 rounded-xl bg-[#F7F5FB] px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#17151F] truncate">{x.name}</span>
                  <span className="block text-[11px] text-[#6B6680] truncate">{x.email} · view & download</span>
                </span>
                <button type="button" onClick={() => revoke(x)} className="h-8 px-3 rounded-full text-[12px] font-semibold text-[#C2304F] hover:bg-[#FDECEF]">Remove</button>
              </div>
            ))}
          </div>
        )}
        {data.truncated && <p className="text-[11px] text-[#8A8599] mt-2 px-1">Very large folder — some files are only shown in Drive.</p>}
      </div>
    </div>
  );
}
