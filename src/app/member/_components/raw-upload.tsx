"use client";

/**
 * Member panel: upload my raw (camera) files for this program to the studio's Google Drive.
 * They land in "<part>/<my name · camera>" inside the program's private raw folder.
 * I only see my own files and can't delete — the studio manages the rest.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FileUp, FolderUp, HardDrive, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { fmtSize } from "@/app/(app)/programs/_components/raw-drive-section";

type Mine = {
  connected: boolean; name: string; parts: string[];
  folders: { path: string; count: number; bytes: number }[];
  files: { id: string; name: string; size: number; path: string; viewUrl: string }[];
  totals: { count: number; bytes: number };
  freeBytes: number | null;
};
const clean = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
const chip = (on: boolean) => cn(
  "h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors",
  on ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE]",
);

export function MemberRawUpload({ bookingId, bookingNumber }: { bookingId: string; bookingNumber: string }) {
  const [data, setData] = useState<Mine | null>(null);
  const [failed, setFailed] = useState(false);
  const [part, setPart] = useState("");
  const [camera, setCamera] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    apiFetch(`${API}/member/programs/${bookingId}/raw`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Mine) => { setData(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, [bookingId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 3000);
  }, [load]);

  if (failed || (data && !data.connected)) return null; // studio hasn't connected Drive (or no access)
  const card = "bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden";
  if (!data) return <div className={cn(card, "h-24 animate-pulse")} />;

  const activePart = part || data.parts[0] || "";
  const cam = clean(camera);

  async function start(list: FileList | null, fromFolder: boolean) {
    if (!list?.length || busy || !data) return;
    if (!activePart) { notify("Choose the part first", { error: true }); return; }
    const files = Array.from(list);
    const folderFor = (f: File) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      const sub = fromFolder && rel.includes("/") ? rel.split("/").slice(1, -1).map(clean).filter(Boolean) : [];
      return [activePart, cam || "_", ...sub].join("/");
    };
    const total = files.reduce((s, f) => s + f.size, 0);
    if (data.freeBytes != null && total > data.freeBytes) {
      const ok = await askConfirm({ title: "Studio Drive is almost full", message: `These files are ${fmtSize(total)} but only ${fmtSize(data.freeBytes)} is free. Tell the studio, or upload anyway.`, confirmLabel: "Upload anyway", danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const check = await checkDuplicates({ kind: "raw-member", files, bookingId, folderFor });
      const { files: toSend, plans } = applyDuplicateChoice(check, "skip");
      const skipped = files.length - toSend.length;
      if (!toSend.length) { notify(`All ${files.length} files are already uploaded`); return; }
      uploadToDrive({ kind: "raw-member", files: toSend, plans, folderFor, bookingId, bookingName: bookingNumber, onDone: refreshSoon });
      notify(`Uploading ${toSend.length} files${skipped ? ` · ${skipped} already there, skipped` : ""} — keep this page open`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't start the upload", { error: true });
    } finally {
      setBusy(false);
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  const folders = data.folders.filter(f => f.count > 0);
  return (
    <div className={card}>
      <div className="px-4 py-3 border-b border-[#EEEBF4] flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-[#1F8A5B]" />
        <span className="font-bold text-[13px] text-[#4A4658] flex-1">Upload my raw files</span>
        <span className="text-[12px] text-[#6B6680]">{data.totals.count} files · {fmtSize(data.totals.bytes)}</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        {data.parts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-[#4A4658]">Part</p>
            <div className="flex flex-wrap gap-1.5">
              {data.parts.map(p => <button key={p} type="button" className={chip(activePart === p)} onClick={() => setPart(p)}>{p}</button>)}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-[#4A4658]">Camera <span className="font-normal text-[#8A8599]">(optional)</span></p>
          <input value={camera} onChange={e => setCamera(e.target.value)} placeholder="e.g. Camera A, Drone, Video"
            className="w-full h-10 px-3 rounded-xl bg-white border border-[#E6E2EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30" />
        </div>
        <p className="text-[12px] text-[#6B6680] break-words">Goes to: <span className="font-semibold text-[#17151F]">{[activePart, [data.name, cam].filter(Boolean).join(" · ")].filter(Boolean).join(" / ")}</span></p>
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
        <input ref={filesRef} type="file" multiple hidden onChange={e => start(e.target.files, false)} />
        <input ref={folderRef} type="file" multiple hidden onChange={e => start(e.target.files, true)}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />

        {folders.length > 0 && (
          <div className="rounded-2xl border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
            {folders.map(g => {
              const isOpen = !!open[g.path];
              return (
                <div key={g.path}>
                  <button type="button" onClick={() => setOpen(o => ({ ...o, [g.path]: !isOpen }))} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                    <ChevronDown className={cn("w-4 h-4 text-[#8A8599] transition-transform", !isOpen && "-rotate-90")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[#17151F] truncate">{g.path}</span>
                      <span className="block text-[11px] text-[#6B6680]">{g.count} files · {fmtSize(g.bytes)}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="bg-[#FBFAFD] px-3 pb-2 max-h-64 overflow-y-auto">
                      {data.files.filter(f => f.path === g.path).slice(0, 300).map(f => (
                        <div key={f.id} className="flex items-center gap-2 py-1.5">
                          <span className="flex-1 min-w-0 text-[12px] text-[#17151F] truncate">{f.name}</span>
                          <span className="text-[11px] text-[#8A8599] tabular-nums">{fmtSize(f.size)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-[#8A8599]">Only the studio can delete uploaded files.</p>
      </div>
    </div>
  );
}
