"use client";

/** Earlier versions of the album's pages (kept every 15 minutes of work); put one back. */
import { useEffect, useState } from "react";
import { History, Loader2, X } from "lucide-react";
import { notify } from "@/components/feedback";
import { albumApi } from "@/lib/album/api";
import type { Spread } from "@/lib/album/types";

export function VersionsDialog({ albumId, onClose, onRestored }: { albumId: string; onClose: () => void; onRestored: (spreads: Spread[], rev: number) => void }) {
  const [list, setList] = useState<{ at: string; pages: number; by: string | null }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { albumApi.versions(albumId).then(setList).catch(e => { notify(e.message, { error: true }); setList([]); }); }, [albumId]);

  async function restore(at: string) {
    if (!confirm("Put this version back? The pages as they are now are kept as a version too, so you can come back.")) return;
    setBusy(at);
    try { const r = await albumApi.restore(albumId, at); onRestored(r.spreads, r.rev); notify("Earlier version put back"); onClose(); }
    catch (e) { notify((e as Error).message, { error: true }); } finally { setBusy(null); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(23,21,31,.45)] flex items-center justify-center p-3" role="dialog" aria-modal aria-label="Earlier versions">
      <div className="w-full max-w-[460px] rounded-[26px] bg-white p-6 flex flex-col gap-4 shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)] max-h-[90dvh]">
        <div className="flex items-start gap-3">
          <div className="flex-1"><h2 className="text-[21px] font-extrabold">Earlier versions</h2><p className="text-[14px] text-[#5B5670]">Kept by itself every 15 minutes of work (the last 20).</p></div>
          <button aria-label="Close" onClick={onClose} className="w-9 h-9 rounded-full bg-[#F2EFF8] flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex flex-col gap-2 min-h-0">
          {list === null && <p className="text-[14px] text-[#6B6680] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</p>}
          {list?.length === 0 && <p className="text-[14px] text-[#6B6680]">No earlier versions yet. They appear after some editing.</p>}
          {list?.map(v => (
            <div key={v.at} className="flex items-center gap-3 rounded-2xl border border-[#ECE8F2] p-3">
              <History className="w-4 h-4 text-[#6B6680] flex-shrink-0" />
              <div className="flex-1 min-w-0"><b className="block text-[14px]">{new Date(v.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</b><span className="text-[12.5px] text-[#6B6680]">{v.pages} pages{v.by ? ` · ${v.by}` : ""}</span></div>
              <button onClick={() => restore(v.at)} disabled={!!busy} className="h-9 px-3 rounded-full bg-[#F2EFF8] text-[13px] font-semibold text-[#3F2A9E] inline-flex items-center gap-1.5">{busy === v.at && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Put back</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
