"use client";
/**
 * "Send from this computer" in a gallery's Live tab: choose a folder on the laptop, Start, and every new JPEG that
 * lands in it goes to this event (see lib/computer-live.ts). Chrome / Edge on a computer only.
 */
import { useEffect, useState } from "react";
import { FolderOpen, Laptop, Loader2, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";
import { anySending, computerLiveSupported, computerSender, type SenderState } from "@/lib/computer-live";

const ago = (t: number) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`; };

export function ComputerSender({ galleryId, onSent }: { galleryId: string; onSent?: () => void }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [st, setSt] = useState<SenderState | null>(null);
  const [old, setOld] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, setNow] = useState(0);
  const s = computerSender(galleryId);

  useEffect(() => { const id = setTimeout(() => setOk(computerLiveSupported()), 0); return () => clearTimeout(id); }, []);
  useEffect(() => s.subscribe(setSt), [s]);
  // "2 s ago" stays right.
  useEffect(() => { const t = setInterval(() => setNow(n => n + 1), 5000); return () => clearInterval(t); }, []);
  // A new photo went: the numbers above refresh.
  const sent = st?.sent ?? 0;
  useEffect(() => { if (sent) onSent?.(); }, [sent, onSent]);
  // Closing the page stops sending: ask first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (anySending()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (ok === null || !st) return null;
  const running = st.status === "running";

  return (
    <section className={cn("bg-white rounded-[20px] p-4 sm:p-5", CARD_SHADOW)}>
      <div className="flex items-start gap-4">
        <span className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", running ? "bg-[#E7F5EE] text-[#176B47]" : "bg-[#EEE8FD] text-[#5B3FD0]")}><Laptop className="w-6 h-6" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[15.5px] font-bold text-[#17151F] flex items-center gap-2">
            Send from this computer
            {running && <span className="h-6 px-2 rounded-full bg-[#E7F5EE] text-[#176B47] text-[12px] font-bold inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#1F8A5B] animate-pulse" />Sending</span>}
            {st.status === "paused" && <span className="h-6 px-2 rounded-full bg-[#FFF4DC] text-[#7A5410] text-[12px] font-bold inline-flex items-center">Paused</span>}
          </p>
          <p className="text-[13.5px] text-[#6B6680] mt-0.5">Choose a folder on this laptop. Every new JPEG that lands in it goes to this event: from a camera on a cable, a card you copy in, or Lightroom exports. Works with any camera.</p>
        </div>
      </div>

      {!ok ? (
        <p className="mt-4 rounded-[14px] bg-[#F5F3FA] px-4 py-3 text-[13.5px] text-[#4A4658]">Open this page in <b>Chrome</b> or <b>Edge</b> on a computer to send from a folder.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || running} onClick={async () => { setBusy(true); await s.choose(); setBusy(false); }}
              className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[14px] font-semibold text-[#17151F] inline-flex items-center gap-2 disabled:opacity-50">
              <FolderOpen className="w-4 h-4" />{st.folder ? "Change folder" : "Choose folder"}
            </button>
            {st.folder && <span className="text-[14px] text-[#4A4658]">Folder: <b className="text-[#17151F]">{st.folder}</b></span>}
          </div>

          {st.folder && st.status !== "running" && st.status !== "paused" && (
            <label className="mt-3 flex items-center gap-2.5 text-[14px] text-[#33303F] cursor-pointer w-fit">
              <input type="checkbox" checked={old} onChange={e => setOld(e.target.checked)} className="w-4 h-4 accent-[#7D5CEF]" />
              Also send the photos already in this folder
            </label>
          )}

          {st.folder && (
            <div className="mt-4 flex flex-wrap gap-2">
              {st.status === "running" ? (
                <button type="button" onClick={() => s.pause()} className="h-11 px-5 rounded-full bg-[#FFF4DC] text-[#7A5410] text-[14px] font-bold inline-flex items-center gap-2"><Pause className="w-4 h-4" />Pause</button>
              ) : st.status === "paused" ? (
                <button type="button" onClick={() => s.resume()} className="h-11 px-5 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[14px] font-bold inline-flex items-center gap-2"><Play className="w-4 h-4" fill="currentColor" />Go on</button>
              ) : (
                <button type="button" disabled={busy} onClick={async () => { setBusy(true); await s.start(old); setBusy(false); }}
                  className="h-11 px-5 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[14px] font-bold inline-flex items-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" fill="currentColor" />}Start sending
                </button>
              )}
              {(st.status === "running" || st.status === "paused") && (
                <button type="button" onClick={() => void s.stop()} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[14px] font-semibold text-[#4A4658] inline-flex items-center gap-2"><Square className="w-3.5 h-3.5" fill="currentColor" />Stop</button>
              )}
            </div>
          )}

          {(st.sent > 0 || st.status !== "idle") && (
            <div className="mt-4 grid grid-cols-3 rounded-[14px] border border-[#EEEBF4] overflow-hidden">
              {[["Sent", st.sent, "text-[#176B47]"], ["Waiting", st.waiting, "text-[#17151F]"], ["Tried again", st.failed, st.failed ? "text-[#A82743]" : "text-[#17151F]"]].map(([l, v, c]) => (
                <div key={l as string} className="px-3 py-2.5 border-r last:border-r-0 border-[#EEEBF4]">
                  <p className="text-[12px] font-semibold text-[#6B6680]">{l}</p>
                  <p className={cn("text-[22px] font-extrabold tabular-nums leading-tight", c as string)}>{v as number}</p>
                </div>
              ))}
            </div>
          )}
          {st.error && <p role="status" className="mt-3 text-[13.5px] text-[#A82743]">{st.error}</p>}
          {st.recent.length > 0 && (
            <ul className="mt-3 text-[13px] text-[#4A4658] space-y-1">
              {st.recent.map(r => <li key={`${r.name}${r.at}`} className="flex justify-between gap-3"><span className="truncate">{r.name}</span><span className="text-[#8A8599] flex-shrink-0">{ago(r.at)}</span></li>)}
            </ul>
          )}
          {running && <p className="mt-3 text-[12.5px] text-[#6B6680]">Keep this tab open and the laptop awake. You can use other StuPanel pages in this tab; closing it stops sending. RAW files are skipped: export or shoot JPEG too.</p>}
        </>
      )}
    </section>
  );
}
