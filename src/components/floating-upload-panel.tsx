"use client";

import { useEffect, useRef, useState } from "react";
import { uploadStore, UploadEntry } from "@/lib/upload-store";
import {
  subscribePending, subscribePaused, resumeWithFiles, discardPending, pauseDriveUploads, resumeDriveUploads,
  cancelAllDriveUploads, retryFailedDriveUploads, failedDriveUploadCount, pendingElsewhere, type PendingUpload,
} from "@/lib/drive-uploader";
import { askConfirm, notify } from "@/components/feedback";
import { X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, HardDrive, Cloud, XCircle, WifiOff, RotateCcw, FolderOpen, Files, Pause, Play } from "lucide-react";

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
 * Bottom-right upload panel (all pages). Shows the uploads with progress,
 * speed and time left; "Waiting for internet…" when the connection drops;
 * Pause all / Resume / Cancel all; and, after a reload/restart, the unfinished
 * uploads (also the ones that never started) with a button to pick the same
 * files or folder again and continue.
 */
export function FloatingUploadPanel({ lift = false }: { lift?: boolean } = {}) {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  // On a phone the list would cover the page — start small (the bar and % stay visible).
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => uploadStore.subscribe(setUploads), []);
  useEffect(() => subscribePending(setPending), []);
  const [paused, setPaused] = useState(false);
  useEffect(() => subscribePaused(setPaused), []);
  // Look again every few seconds while something is remembered (another tab may have closed).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!pending.length) return;
    const t = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(t);
  }, [pending.length]);

  // Warn before closing the tab while uploads run.
  useEffect(() => {
    if (!uploadStore.hasActive()) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploads]);

  // Keep the phone screen on while files upload (a sleeping phone stops the upload).
  const running = uploads.some(u => !u.done && !u.error && !u.cancelled);
  useEffect(() => {
    if (!running) return;
    type Lock = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
    if (!wl) return;
    let lock: Lock | null = null;
    let stop = false;
    const get = () => { wl.request("screen").then(l => { if (stop) void l.release(); else lock = l; }).catch(() => {}); };
    get();
    // The lock is dropped when the tab is hidden; take it again when the page is back.
    const onVis = () => { if (document.visibilityState === "visible") get(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop = true; document.removeEventListener("visibilitychange", onVis); void lock?.release().catch(() => {}); };
  }, [running]);

  const active = uploads.filter(u => !u.done && !u.error && !u.cancelled);
  const failed = uploads.filter(u => !!u.error && !u.cancelled);
  const done = uploads.filter(u => u.done);
  const activeFps = new Set(active.map(u => `${u.fileName}|${u.size}`));
  // Files another open tab is uploading right now are not "unfinished" — they are busy there.
  const elsewhere = new Set(pendingElsewhere(pending).map(p => p.fp));
  const unfinished = pending.filter(p => !elsewhere.has(p.fp) && !activeFps.has(`${p.fileName}|${p.size}`));

  if (uploads.length === 0 && unfinished.length === 0 && elsewhere.size === 0) return null;

  const totalBytes = active.reduce((s, u) => s + (u.size ?? 0), 0);
  const sentBytes = active.reduce((s, u) => s + (u.sent ?? 0), 0);
  const speed = active.reduce((s, u) => s + (u.speed ?? 0), 0);
  // Overall % of this batch — finished files count as done, not left out.
  const batch = uploads.filter(u => !u.cancelled && !u.error);
  const batchBytes = batch.reduce((s, u) => s + (u.size ?? 0), 0);
  const batchSent = batch.reduce((s, u) => s + (u.done ? (u.size ?? 0) : (u.sent ?? 0)), 0);
  const overall = active.length
    ? (batchBytes ? Math.round((batchSent / batchBytes) * 100) : Math.round(batch.reduce((s, u) => s + (u.done ? 100 : u.progress), 0) / Math.max(1, batch.length)))
    : 100;
  const waiting = !paused && active.some(u => u.status === "waiting");
  const activeDrive = active.filter(u => u.type === "drive");
  const canRetry = failed.length > 0 && failedDriveUploadCount() > 0;

  async function cancelAll() {
    const ok = await askConfirm({
      title: "Cancel all uploads?",
      message: `${active.length} file${active.length === 1 ? "" : "s"} not finished yet will stop.${done.length ? ` The ${done.length} already uploaded stay on Drive.` : ""}`,
      confirmLabel: "Cancel uploads", cancelLabel: "Keep uploading", danger: true,
    });
    if (!ok) return;
    cancelAllDriveUploads();
    for (const u of uploadStore.getAll()) if (!u.done && !u.error && !u.cancelled) uploadStore.cancel(u.id);
    notify("Uploads cancelled");
  }

  // A big card can be thousands of files — draw only what is useful to see.
  const isLive = (u: UploadEntry) => !u.done && !u.error && !u.cancelled && u.status !== "queued" && u.status !== "paused";
  const live = uploads.filter(isLive);
  const inLine = active.filter(u => !isLive(u));
  const SHOW_LINE = 25, SHOW_DONE = 25;
  const cancelledList = uploads.filter(u => u.cancelled);
  const shown = [...live, ...failed, ...inLine.slice(0, SHOW_LINE), ...done.slice(-SHOW_DONE).reverse(), ...cancelledList.slice(0, 5)];
  const hiddenLine = Math.max(0, inLine.length - SHOW_LINE);
  const hiddenDone = Math.max(0, done.length - SHOW_DONE);

  function pick(list: FileList | null) {
    if (!list?.length) return;
    const { matched } = resumeWithFiles(Array.from(list));
    if (matched === 0) notify("These aren't the unfinished files", { error: true });
    else notify(matched < unfinished.length
      ? `Continuing ${matched} file${matched > 1 ? "s" : ""} — ${unfinished.length - matched} more are in another folder`
      : `Continuing ${matched} file${matched > 1 ? "s" : ""}`);
  }

  const leftBytes = unfinished.reduce((s, p) => s + p.size, 0);
  // Where the unfinished files were going, e.g. "AKA-NOV26-0004 › Holud / Md Bappy".
  const places = [...new Set(unfinished.map(p => [p.bookingName, p.folderPath?.split("/").slice(0, 2).join(" / ")].filter(Boolean).join(" › ")).filter(Boolean))];

  return (
    <div className={`fixed ${lift ? "bottom-24 lg:bottom-4" : "bottom-4"} right-4 left-4 sm:left-auto z-50 sm:w-[22rem] bg-white rounded-[22px] border border-[#E3DFEC] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.10)] overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#17151F] truncate">
            {active.length > 0
              ? waiting ? "Waiting for internet…" : `${paused ? "Paused" : "Uploading"} · ${done.length} of ${uploads.filter(u => !u.cancelled).length} done · ${overall}%`
              : unfinished.length > 0 ? `${unfinished.length} unfinished upload${unfinished.length > 1 ? "s" : ""}`
              : uploads.length === 0 ? "Uploading in another tab"
              : failed.length > 0 ? `${failed.length} upload${failed.length > 1 ? "s" : ""} failed`
              : `${done.length} upload${done.length > 1 ? "s" : ""} complete`}
          </p>
          {active.length > 0 && totalBytes > 0 && (
            <p className="text-xs text-[#6B6680]">
              {fmtBytes(sentBytes)} of {fmtBytes(totalBytes)}
              {!waiting && !paused && speed > 0 && <> · {fmtBytes(speed)}/s · {fmtEta((totalBytes - sentBytes) / speed)}</>}
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
          <div className={`h-full transition-all duration-300 ${waiting || paused ? "bg-[#B29DF8]" : "bg-[#7D5CEF]"}`} style={{ width: `${overall}%` }} />
        </div>
      )}

      {active.length > 0 && (
        <div className="px-3 py-2 bg-[#FBFAFD] flex items-center gap-2">
          <p className="flex-1 min-w-0 pl-1 text-[11px] leading-snug text-[#6B6680]">
            {paused ? "Paused — press Resume to continue." : "Keep this page open until it finishes."}
          </p>
          {activeDrive.length > 0 && (paused ? (
            <button type="button" onClick={resumeDriveUploads}
              className="h-8 px-3 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-xs font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
              <Play className="w-3.5 h-3.5" />Resume
            </button>
          ) : (
            <button type="button" onClick={pauseDriveUploads}
              className="h-8 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-xs font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
              <Pause className="w-3.5 h-3.5" />Pause all
            </button>
          ))}
          <button type="button" onClick={cancelAll}
            className="h-8 px-3 rounded-full bg-white hover:bg-[#FDECEF] text-[#C2304F] text-xs font-semibold inline-flex items-center gap-1.5 flex-shrink-0 border border-[#F3D3DA]">
            <XCircle className="w-3.5 h-3.5" />Cancel all
          </button>
        </div>
      )}

      {canRetry && (
        <div className="px-3 py-2 bg-[#FEF5F7] flex items-center gap-2">
          <p className="flex-1 min-w-0 pl-1 text-[11px] text-[#8A2340]">{failed.length} file{failed.length === 1 ? "" : "s"} did not upload.</p>
          <button type="button" onClick={() => { const n = retryFailedDriveUploads(); if (n) notify(`Trying ${n} file${n === 1 ? "" : "s"} again`); }}
            className="h-8 px-3 rounded-full bg-[#C2304F] hover:bg-[#A82843] text-white text-xs font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
            <RotateCcw className="w-3.5 h-3.5" />Try again
          </button>
        </div>
      )}

      {elsewhere.size > 0 && (
        <p className="px-4 py-2 text-[11px] leading-snug text-[#6B6680] bg-[#FBFAFD]">
          {elsewhere.size} file{elsewhere.size === 1 ? " is" : "s are"} uploading in another StuPanel tab. Keep that tab open.
        </p>
      )}

      {/* Unfinished from an earlier visit — always visible when nothing is running (also on a phone) */}
      {unfinished.length > 0 && (!collapsed || active.length === 0) && (

            <div className="m-3 rounded-2xl bg-[#EEE8FD] p-3">
              <div className="flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-[#5B3FD0] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#17151F]">{unfinished.length} file{unfinished.length > 1 ? "s" : ""} left to upload · {fmtBytes(leftBytes)}</p>
                  <p className="text-xs text-[#4A4658] mt-0.5">
                    Select the same folder or files again. Files already uploaded are skipped, half-done ones continue, and the rest start.
                  </p>
                  {places.length > 0 && (
                    <p className="text-[11px] text-[#5B3FD0] font-semibold mt-1 break-words">{places.slice(0, 3).join(" · ")}{places.length > 3 ? ` · +${places.length - 3} more` : ""}</p>
                  )}
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
              <button onClick={async () => {
                if (await askConfirm({ title: "Forget these uploads?", message: `${unfinished.length} file${unfinished.length > 1 ? "s" : ""} will not be uploaded. Files already on Drive stay there.`, confirmLabel: "Forget", cancelLabel: "Keep", danger: true })) discardPending();
              }} className="mt-2 w-full text-xs text-[#6B6680] hover:text-[#C2304F]">
                Forget these uploads
              </button>
            </div>
      )}

      {!collapsed && uploads.length > 0 && (
        <div className="max-h-[40vh] sm:max-h-80 overflow-y-auto">
          {shown.map(u => {
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
                      : paused ? (u.sent ? `Paused at ${fmtBytes(u.sent)} of ${fmtBytes(u.size)}` : "Paused")
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
          {(hiddenLine > 0 || hiddenDone > 0) && (
            <p className="px-4 py-2.5 text-[11px] text-[#8A8599] border-t border-[#F5F3FA]">
              {[hiddenLine > 0 ? `${hiddenLine} more waiting in line` : "", hiddenDone > 0 ? `${hiddenDone} more finished` : ""].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
