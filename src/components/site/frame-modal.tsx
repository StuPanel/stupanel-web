"use client";
/** Move and zoom a photo inside its frame (website photos, a team member's photo). */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cropStyle, type SiteCrop } from "@/components/site/site-view";

export function FrameModal({ photo, title, ratio, round, value, onSave, onClose }: {
  photo: { url: string }; title: string; ratio: number; /** Shown in a circle on the site (team) */ round?: boolean; value?: SiteCrop; onSave: (v: SiteCrop | null) => void; onClose: () => void;
}) {
  const [v, setV] = useState<SiteCrop>(value ?? { x: 50, y: 50, z: 1 });
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
  return (
    <>
      <div className="sp-backdrop z-[90]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Adjust: ${title}`} className="fixed z-[95] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-[520px] sm:h-fit max-h-[94dvh] overflow-y-auto bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold text-[#17151F] truncate">Adjust: {title}</h2>
            <p className="text-[13px] text-[#6B6680]">Drag the photo to move it. Use the slider to zoom.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F3FA] text-[#6B6680]"><X className="w-4 h-4" /></button>
        </div>
        <div ref={box} className={cn("relative mx-auto overflow-hidden bg-[#F5F3FA] touch-none cursor-grab active:cursor-grabbing select-none", round ? "rounded-full" : "rounded-[12px]")}
          style={{ aspectRatio: String(ratio), width: round ? "min(100%, 340px)" : ratio >= 1 ? "100%" : `min(100%, ${Math.round(420 * ratio)}px)` }}
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
          <button type="button" onClick={() => setV({ x: 50, y: 50, z: 1 })} className="h-11 px-4 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold text-[#4A4658]">Reset</button>
          <button type="button" onClick={() => onSave(v.x === 50 && v.y === 50 && v.z === 1 ? null : v)} className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold">Use this</button>
        </div>
      </div>
    </>
  );
}

