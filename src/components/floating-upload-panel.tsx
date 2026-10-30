"use client";

import { useEffect, useRef, useState } from "react";
import { uploadStore, UploadEntry } from "@/lib/upload-store";
import { subscribePending, resumeWithFiles, discardPending, type PendingUpload } from "@/lib/drive-uploader";
import { notify } from "@/components/feedback";
import { X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, HardDrive, Cloud, XCircle, WifiOff, RotateCcw, FolderOpen, Files } from "lucide-react";

function fmtBytes(n = 0) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
function fmtEta(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "";
  if (sec < 60) return `${Math.ceil(sec)}s left`;
  if (sec < 3600) return `${Math.ceil(sec / 60)} min left`;
  return `${Math.floor(sec / 3600)}h ${Math.ceil((sec % 3600) / 60)}m left`;
}

/**
 * Bottom-right upload panel (all pages). Shows every upload with progress,
 * speed and time left; "Waiting for internet…" when the connection drops;
 * and, after a reload/restart, the unfinished uploads with a button to pick
 * the same files again and continue.
 */
export function FloatingUploadPanel() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => uploadStore.subscribe(setUploads), []);
  useEffect(() => subscribePending(setPending), []);

  // Warn before closing the tab while uploads run.
  useEffect(() => {
    if (!uploadStore.hasActive()) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploads]);

  const active = uploads.filter(u => !u.done && !u.error && !u.cancelled);
  const failed = uploads.filter(u => !!u.error && !u.cancelled);
  const done = uploads.filter(u => u.done);
  const activeFps = new Set(active.map(u => `${u.fileName}|${u.size}`));
  const unfinished = pending.filter(p => !activeFps.has(`${p.fileName}|${p.size}`));

  if (uploads.length === 0 && unfinished.length === 0) return null;

  const totalBytes = active.reduce((s, u) => s + (u.size ?? 0), 0);
  const sentBytes = active.reduce((s, u) => s + (u.sent ?? 0), 0);
  const speed = active.reduce((s, u) => s + (u.speed ?? 0), 0);
  const overall = active.length
    ? (totalBytes ? Math.round((sentBytes / totalBytes) * 100) : Math.round(active.reduce((s, u) => s + u.progress, 0) / active.length))
    : 100;
  const waiting = active.some(u => u.status === "waiting");

  function pick(list: FileList | null) {
    if (!list?.length) return;
    const { matched } = resumeWithFiles(Array.from(list));
    if (matched === 0) notify("These aren't the unfinished files", { error: true });
    else notify(`Continuing ${matched} file${matched > 1 ? "s" : ""}`);
  }

  const leftBytes = unfinished.reduce((s, p) => s + p.size, 0);

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:w-[22rem] bg-white rounded-[22px] border border-[#E3DFEC] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.10)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#17151F] truncate">
            {active.length > 0
              ? waiting ? "Waiting for internet…" : `Uploading ${active.length} file${active.length > 1 ? "s" : ""}`
              : unfinished.length > 0 ? `${unfinished.length} unfinished upload${unfinished.length > 1 ? "s" : ""}`
              : failed.length > 0 ? `${failed.length} upload${failed.length > 1 ? "s" : ""} failed`
              : `${done.length} upload${done.length > 1 ? "s" : ""} complete`}
          </p>
          {active.length > 0 && totalBytes > 0 && (
            <p className="text-xs text-[#6B6680]">
              {fmtBytes(sentBytes)} of {fmtBytes(totalBytes)}
              {!waiting && speed > 0 && <> · {fmtBytes(speed)}/s · {fmtEta((totalBytes - sentBytes) / speed)}</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? "Expand" : "Collapse"}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F3FA] text-[#6B6680]">
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {active.length === 0 && uploads.length > 0 && (
            <button onClick={() => uploadStore.clearDone()} aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F3FA] text-[#6B6680]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {active.length > 0 && (
        <div className="h-1 bg-[#EEE8FD]">
          <div className={`h-full transition-all duration-300 ${waiting ? "bg-[#B29DF8]" : "bg-[#7D5CEF]"}`} style={{ width: `${overall}%` }} />
        </div>
      )}

      {!collapsed && (
        <div className="max-h-80 overflow-y-auto">
          {/* Unfinished from an earlier visit */}
          {unfinished.length > 0 && (
            <div className="m-3 rounded-2xl bg-[#EEE8FD] p-3">
              <div className="flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-[#5B3FD0] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#17151F]">Continue where you stopped</p>
                  <p className="text-xs text-[#4A4658] mt-0.5">
                    {unfinished.length} file{unfinished.length > 1 ? "s" : ""} · {fmtBytes(leftBytes)}. Select the same files or folder again — they continue from where they stopped.
                  </p>
                </div>
              </div>
              <input ref={filesRef} type="file" multiple className="hidden" onChange={e => { pick(e.target.files); e.target.value = ""; }} />
              <input ref={folderRef} type="file" multiple className="hidden"
                {...({ webkitdirectory: "" } as Record<string, string>)}
                onChange={e => { pick(e.target.files); e.target.value = ""; }} />
              <div className="mt-3 flex gap-2">
                <button onClick={() => filesRef.current?.click()}
                  className="flex-1 h-9 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Files className="w-3.5 h-3.5" /> Select files
                </button>
                <button onClick={() => folderRef.current?.click()}
                  className="flex-1 h-9 rounded-full bg-white hover:bg-[#F5F3FA] text-[#17151F] text-xs font-semibold flex items-center justify-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" /> Select folder
                </button>
              </div>
              <button onClick={() => discardPending()} className="mt-2 w-full text-xs text-[#6B6680] hover:text-[#C2304F]">
                Forget these uploads
              </button>
            </div>
          )}

          {uploads.map(u => {
            const isActive = !u.done && !u.error && !u.cancelled;
            return (
              <div key={u.id} className="px-4 py-2.5 flex items-center gap-3 border-t border-[#F5F3FA] first:border-t-0">
                <div className="flex-shrink-0">
                  {u.done ? <CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />
                    : u.error ? <AlertCircle className="w-4 h-4 text-[#C2304F]" />
                    : u.status === "waiting" ? <WifiOff className="w-4 h-4 text-[#B29DF8]" />
                    : u.type === "drive" ? <HardDrive className="w-4 h-4 text-[#5B3FD0]" />
                    : <Cloud className="w-4 h-4 text-[#5B3FD0]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#17151F] truncate">{u.fileName}</p>
                  <p className="text-xs text-[#6B6680] truncate">
                    {u.error ? <span className="text-[#C2304F]">{u.error}</span>
                      : u.done ? <>{u.bookingName}{u.folderName ? ` › ${u.folderName}` : ""}</>
                      : u.status === "waiting" ? "Waiting for internet — will continue"
                      : u.status === "resuming" ? "Continuing from where it stopped…"
                      : u.status === "queued" ? "Waiting in line"
                      : u.status === "finishing" ? "Finishing…"
                      : u.size ? `${fmtBytes(u.sent)} of ${fmtBytes(u.size)}` : `${u.bookingName ?? ""}`}
                  </p>
                  {isActive && (
                    <div className="mt-1 h-1 bg-[#EEE8FD] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#7D5CEF] transition-all duration-200" style={{ width: `${u.progress}%` }} />
                    </div>
                  )}
                </div>
                {isActive && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs font-semibold text-[#6B6680] tabular-nums">{u.progress}%</span>
                    <button onClick={() => uploadStore.cancel(u.id)} title="Cancel upload" aria-label={`Cancel ${u.fileName}`}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#FDECEF] text-[#6B6680] hover:text-[#C2304F]">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
