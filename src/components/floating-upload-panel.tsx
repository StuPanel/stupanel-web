"use client";

import { useEffect, useState } from "react";
import { uploadStore, UploadEntry } from "@/lib/upload-store";
import { X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Cloud, HardDrive, XCircle } from "lucide-react";

export function FloatingUploadPanel() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => uploadStore.subscribe(setUploads), []);

  // Block tab close when uploads are active
  useEffect(() => {
    if (!uploadStore.hasActive()) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploads]);

  const active = uploads.filter(u => !u.done && !u.error);
  const done = uploads.filter(u => u.done);
  const failed = uploads.filter(u => !!u.error);

  if (uploads.length === 0) return null;

  const overallProgress = uploads.length === 0 ? 0
    : Math.round(uploads.reduce((s, u) => s + u.progress, 0) / uploads.length);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {active.length > 0 ? (
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          ) : failed.length > 0 ? (
            <span className="w-2 h-2 rounded-full bg-red-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
          <p className="text-sm font-semibold text-slate-800">
            {active.length > 0
              ? `Uploading ${active.length} file${active.length > 1 ? "s" : ""}…`
              : failed.length > 0
              ? `${failed.length} upload${failed.length > 1 ? "s" : ""} failed`
              : `${done.length} upload${done.length > 1 ? "s" : ""} complete`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {active.length === 0 && (
            <button onClick={() => uploadStore.clearDone()}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      {active.length > 0 && (
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${overallProgress}%` }} />
        </div>
      )}

      {/* File list */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
          {uploads.map(u => (
            <div key={u.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-shrink-0">
                {u.done
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : u.error
                  ? <AlertCircle className="w-4 h-4 text-red-500" />
                  : u.type === "drive"
                  ? <HardDrive className="w-4 h-4 text-green-500" />
                  : <Cloud className="w-4 h-4 text-indigo-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{u.fileName}</p>
                {u.bookingName && (
                  <p className="text-[10px] text-slate-400 truncate">{u.bookingName}{u.folderName ? ` › ${u.folderName}` : ""}</p>
                )}
                {!u.done && !u.error && (
                  <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${u.progress}%`,
                        backgroundColor: u.type === "drive" ? "#22c55e" : "#6366f1",
                      }} />
                  </div>
                )}
                {u.error && <p className="text-[10px] text-red-500 mt-0.5 truncate">{u.error}</p>}
              </div>
              {!u.done && !u.error && !u.cancelled && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-slate-400">{u.progress}%</span>
                  <button
                    onClick={() => uploadStore.cancel(u.id)}
                    title="Cancel upload"
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
