"use client";

/**
 * Export for print: every page drawn in the browser at print size and saved as a JPEG, into a folder the
 * studio picks (Chrome/Edge on a computer) or as downloads. Free; nothing goes through our server.
 */
import { useRef, useState } from "react";
import { Check, FolderDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { drawSpread, pageName, pagePixels, toJpeg, type ExportOptions } from "@/lib/album/export";
import { sizeOf, type AlbumDetail, type APhoto, type Spread } from "@/lib/album/types";

type DirHandle = { getFileHandle: (n: string, o: { create: boolean }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> };
const canPickFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export function ExportDialog({ album, spreads, byId, checks, onClose }: { album: AlbumDetail; spreads: Spread[]; byId: Map<string, APhoto>; checks: number; onClose: () => void }) {
  const [dpi, setDpi] = useState(300);
  const [bleed, setBleed] = useState(3);
  const [run, setRun] = useState<{ at: number; done: boolean; missing: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);
  const o: ExportOptions = { size: album.size, dpi, bleedMm: bleed };
  const px = pagePixels(o);
  const z = sizeOf(album.size);

  async function go() {
    setErr(null); stop.current = false;
    let dir: DirHandle | null = null;
    if (canPickFolder()) {
      try { dir = await (window as unknown as { showDirectoryPicker: (o: { mode: string }) => Promise<DirHandle> }).showDirectoryPicker({ mode: "readwrite" }); }
      catch { return; } // the studio closed the folder window
    }
    setRun({ at: 0, done: false, missing: 0 });
    const canvas = document.createElement("canvas");
    let missing = 0;
    try {
      for (let i = 0; i < spreads.length; i++) {
        if (stop.current) break;
        setRun({ at: i, done: false, missing });
        const r = await drawSpread(spreads[i], byId, { ...o, quality: 0.95 }, canvas);
        missing += r.missing.length;
        const blob = await toJpeg(r.canvas, 0.95);
        const name = pageName(i, album.title);
        if (dir) {
          const fh = await dir.getFileHandle(name, { create: true });
          const w = await fh.createWritable(); await w.write(blob); await w.close();
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          await new Promise(ok => setTimeout(ok, 400));
        }
      }
      setRun({ at: spreads.length, done: !stop.current, missing });
    } catch (e) {
      setErr((e as Error).message || "The export stopped. Try again.");
      setRun(null);
    } finally { canvas.width = canvas.height = 1; }
  }

  const busy = run && !run.done;
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(23,21,31,.45)] flex items-center justify-center p-3" role="dialog" aria-modal aria-label="Export for print">
      <div className="w-full max-w-[560px] rounded-[26px] bg-white p-6 sm:p-7 flex flex-col gap-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)] max-h-[94dvh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1"><h2 className="text-[22px] font-extrabold">Export for print</h2><p className="text-[14px] text-[#5B5670]">{album.title} · {spreads.length} pages · JPEG</p></div>
          <button aria-label="Close" onClick={() => { stop.current = true; onClose(); }} className="w-9 h-9 rounded-full bg-[#F2EFF8] flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {!run && (
          <>
            <Seg label="Quality" value={dpi} set={setDpi} options={[[300, "300 DPI (labs)"], [240, "240 DPI (smaller files)"]]} />
            <Seg label="Bleed" value={bleed} set={setBleed} options={[[0, "None"], [3, "3 mm"], [5, "5 mm"]]} />
            <p className="text-[13px] text-[#4A4658] rounded-xl bg-[#FAF8F4] p-3">
              Each page: <b>{px.cw.toLocaleString()} × {px.ch.toLocaleString()} px</b> ({(z.w + (2 * bleed) / 25.4).toFixed(2)} × {(z.h + (2 * bleed) / 25.4).toFixed(2)} in with bleed). Colour: sRGB, which most labs use.
            </p>
            {checks > 0 && <p className="text-[13px] text-[#5C3B00] rounded-xl bg-[#FFF7E6] p-3">{checks} {checks === 1 ? "thing" : "things"} to look at in Checks (soft photos, empty frames). You can still export.</p>}
            <p className="text-[12.5px] text-[#6B6680]">{canPickFolder() ? "You'll choose a folder, and the pages are saved into it one by one." : "The pages download one by one. If the browser asks, allow several downloads."} Keep this tab open until it finishes.</p>
            {err && <p role="alert" className="text-[13px] text-[#B42318]">{err}</p>}
            <button onClick={go} className="h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_12px_24px_-12px_rgba(109,74,230,.95)]"><FolderDown className="w-5 h-5" />Export {spreads.length} pages</button>
          </>
        )}

        {run && (
          <div className="flex flex-col gap-3" aria-live="polite">
            <div className="flex justify-between text-[14px] font-semibold">
              <span>{run.done ? "Done" : `Making page ${run.at + 1} of ${spreads.length}`}</span>
              <span className="tabular-nums">{Math.round((Math.min(run.at, spreads.length) / spreads.length) * 100)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#EEEBF4] overflow-hidden"><div className="h-full bg-[#7D5CEF] rounded-full transition-[width]" style={{ width: `${(Math.min(run.at, spreads.length) / spreads.length) * 100}%` }} /></div>
            {busy && <p className="text-[13px] text-[#6B6680] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Reading photos from Google Drive and drawing the page…</p>}
            {run.done && <p className="text-[14px] text-[#1C5A3C] flex items-center gap-2"><Check className="w-4 h-4" />{spreads.length} pages saved. Send them to your lab.</p>}
            {run.missing > 0 && <p className="text-[13px] text-[#B42318]">{run.missing} {run.missing === 1 ? "photo" : "photos"} could not be read from Google Drive and are grey. Check that the selection’s photos are still shared, then export again.</p>}
            {busy ? <button onClick={() => { stop.current = true; }} className="h-11 rounded-full bg-[#F2EFF8] text-[14px] font-semibold">Stop</button>
              : <button onClick={onClose} className="h-11 rounded-full bg-[#17151F] text-white text-[14px] font-semibold">Close</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function Seg<T extends number>({ label, value, set, options }: { label: string; value: T; set: (v: T) => void; options: [T, string][] }) {
  return (
    <div>
      <p className="text-[13px] font-bold text-[#33303F] mb-2">{label}</p>
      <div className="flex gap-1.5 p-1 rounded-[14px] bg-[#F2EFF8]">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => set(v)} className={cn("flex-1 h-10 rounded-[10px] text-[13.5px] font-semibold", value === v ? "bg-white text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.12),0_4px_12px_-6px_rgba(40,28,96,.3)]" : "text-[#4A4658]")}>{l}</button>
        ))}
      </div>
    </div>
  );
}
