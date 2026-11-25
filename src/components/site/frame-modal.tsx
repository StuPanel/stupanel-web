"use client";
/** Move and zoom a photo inside its frame (website photos, a team member's photo). */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cropStyle, type SiteCrop } from "@/components/site/site-view";

/** One place the photo is shown in: its own shape and its own placing. */
export interface FrameView { key: string; label: string; ratio: number; round?: boolean; /** CSS border-radius for a special shape (an arch) */ shape?: string; value?: SiteCrop }

const CENTRE: SiteCrop = { x: 50, y: 50, z: 1 };

/**
 * Move and zoom a photo. With `views` the photo is placed once for each place it shows in (a round team row,
 * the member's own page): tabs switch between them and "Use this" saves all of them together.
 */
export function FrameModal({ photo, title, ratio, round, value, onSave, onClose, views, onSaveAll }: {
  photo: { url: string }; title: string; ratio?: number; /** Shown in a circle on the site (team) */ round?: boolean; value?: SiteCrop; onSave?: (v: SiteCrop | null) => void; onClose: () => void;
  views?: FrameView[]; onSaveAll?: (v: Record<string, SiteCrop>) => void;
}) {
  const list: FrameView[] = views?.length ? views : [{ key: "one", label: "", ratio: ratio ?? 1, round, value }];
  const [all, setAll] = useState<Record<string, SiteCrop>>(() => Object.fromEntries(list.map(x => [x.key, x.value ?? CENTRE])));
  const [tab, setTab] = useState(list[0].key);
  const view = list.find(x => x.key === tab) ?? list[0];
  const v = all[view.key];
  const setV = (f: (c: SiteCrop) => SiteCrop) => setAll(m => ({ ...m, [view.key]: f(m[view.key]) }));
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n * 10) / 10));
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    // Dragging right shows more of the left side of the photo.
    setV(c => ({ ...c, x: clamp(c.x - (dx / r.width) * 140 / c.z), y: clamp(c.y - (dy / r.height) * 140 / c.z) }));
  };
  const save = () => {
    if (onSaveAll) onSaveAll(all);
    else onSave?.(v.x === 50 && v.y === 50 && v.z === 1 ? null : v);
  };
  return (
    <>
      <div className="sp-backdrop z-[90]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Adjust: ${title}`} className="fixed z-[95] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-[520px] sm:h-fit max-h-[94dvh] overflow-y-auto bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold text-[#17151F] truncate">Adjust: {title}</h2>
            <p className="text-[13px] text-[#6B6680]">Drag the photo to move it. Use the slider to zoom.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-full bg-[#F5F3FA] text-[#6B6680]"><X className="w-4 h-4" /></button>
        </div>
        {list.length > 1 && (
          <div role="tablist" aria-label="Where the photo shows" className="flex p-1 mb-4 rounded-full bg-[#F5F3FA]">
            {list.map(x => (
              <button key={x.key} type="button" role="tab" aria-selected={x.key === view.key} onClick={() => setTab(x.key)}
                className={cn("flex-1 h-10 px-3 rounded-full text-[13px] font-semibold transition-colors", x.key === view.key ? "bg-white text-[#17151F] shadow-[0_1px_4px_rgba(23,21,31,.12)]" : "text-[#6B6680] hover:text-[#17151F]")}>{x.label}</button>
            ))}
          </div>
        )}
        <div ref={box} key={view.key} className={cn("relative mx-auto overflow-hidden bg-[#F5F3FA] touch-none cursor-grab active:cursor-grabbing select-none", view.round ? "rounded-full" : "rounded-[12px]")}
          style={{ aspectRatio: String(view.ratio), borderRadius: view.shape, width: view.round ? "min(100%, 340px)" : view.ratio >= 1 ? "100%" : `min(100%, ${Math.round(420 * view.ratio)}px)` }}
          onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={cropStyle({ ...v, z: Math.max(v.z, 1.0001) })} />
        </div>
        <label className="flex items-center gap-3 mt-4 text-[13px] font-semibold text-[#4A4658]">Zoom
          <input type="range" min={1} max={3} step={0.05} value={v.z} onChange={e => setV(c => ({ ...c, z: Number(e.target.value) }))} className="flex-1 accent-[#7D5CEF]" />
          <span className="w-10 text-right tabular-nums">{v.z.toFixed(1)}×</span>
        </label>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={() => setV(() => CENTRE)} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold text-[#4A4658]">Reset</button>
          <button type="button" onClick={save} className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold">Use this</button>
        </div>
      </div>
    </>
  );
}
