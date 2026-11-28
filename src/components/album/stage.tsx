"use client";

/**
 * The page being edited. Drag a frame or a text to move it, drag a corner to resize it; edges snap to
 * the page, its middle and the other frames, and a red line shows the fold. In "move photo" mode a drag
 * slides the photo inside its frame instead. Photos can be dropped on frames from the photo list.
 */
import { useRef, useState } from "react";
import { useWidth } from "@/lib/album/api";
import { SpreadView } from "./spread-view";
import type { APhoto, Item, Spread } from "@/lib/album/types";

type Patch = Partial<{ x: number; y: number; w: number; h: number; fx: number; fy: number; size: number }>;
type Drag = {
  id: string; mode: "move" | "pan" | "resize"; corner?: "nw" | "ne" | "sw" | "se" | "e" | "w";
  sx: number; sy: number; start: Item; moved: boolean;
};

const r1 = (v: number) => Math.round(v * 10) / 10;

export function Stage({ spread, ratio, byId, sel, setSel, pan, onChange, onDropPhoto, marks, onSwapPick, studio, onDouble }: {
  spread: Spread; ratio: number; byId: Map<string, APhoto>; sel: string | null; setSel: (id: string | null) => void;
  /** Dragging inside the chosen photo slides the photo in its frame */
  pan: boolean;
  onChange: (id: string, patch: Patch) => void; onDropPhoto: (itemId: string, photoId: string) => void; marks: Set<string>;
  /** In "swap" mode the next frame clicked is sent here instead of being chosen */
  onSwapPick?: ((id: string) => void) | null;
  studio?: { name: string; logoUrl: string | null } | null;
  /** Double click: a photo goes into "move photo" mode, a text opens for typing */
  onDouble?: (id: string) => void;
}) {
  const frame = useRef<number | null>(null);
  const [ref, w] = useWidth<HTMLDivElement>();
  const W = Math.min(w, 1100), H = W / ratio;
  const drag = useRef<Drag | null>(null);
  const [live, setLive] = useState<{ id: string; patch: Patch } | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

  const shown: Spread = live ? { ...spread, items: spread.items.map(i => (i.id === live.id ? ({ ...i, ...live.patch } as Item) : i)) } : spread;
  const selItem = shown.items.find(i => i.id === sel) ?? null;

  // Snap lines: page edges, the middle (fold), safe margins and the other items' edges and centres.
  const snapX = (id: string) => [0, 2.5, 50, 97.5, 100, ...spread.items.filter(i => i.id !== id && !(i.k === "img" && i.bg)).flatMap(i => [i.x, i.x + i.w, i.x + i.w / 2])];
  const snapY = (id: string) => [0, 4, 50, 96, 100, ...spread.items.filter(i => i.id !== id && !(i.k === "img" && i.bg) && i.k !== "text").flatMap(i => [i.y, i.y + (i as { h: number }).h, i.y + (i as { h: number }).h / 2])];
  const near = (vals: number[], lines: number[], tol: number) => {
    let best: { d: number; at: number; line: number } | null = null;
    for (const v of vals) for (const l of lines) { const d = l - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: v, line: l }; }
    return best;
  };

  const onPick = (id: string, e: React.PointerEvent) => {
    if (onSwapPick) { onSwapPick(id); return; }
    const it = spread.items.find(i => i.id === id); if (!it) return;
    setSel(id);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    // A full-page background photo never moves by dragging (only its photo slides, in "move photo" mode).
    if (it.k === "img" && it.bg && !(pan && sel === id)) return;
    drag.current = { id, mode: pan && sel === id && it.k === "img" ? "pan" : "move", sx: e.clientX, sy: e.clientY, start: it, moved: false };
  };
  const onHandle = (e: React.PointerEvent<HTMLSpanElement>) => {
    const corner = e.currentTarget.dataset.corner as Drag["corner"];
    e.stopPropagation(); e.preventDefault();
    const it = spread.items.find(i => i.id === sel); if (!it) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id: it.id, mode: "resize", corner, sx: e.clientX, sy: e.clientY, start: it, moved: false };
  };

  // One update per screen frame, however fast the pointer moves.
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const ev = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey };
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { frame.current = null; step(ev); });
  };
  const step = (e: { clientX: number; clientY: number; shiftKey: boolean }) => {
    const d = drag.current; if (!d || !W) return;
    const dxp = e.clientX - d.sx, dyp = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dxp, dyp) < 4) return;
    d.moved = true;
    const dx = (dxp / W) * 100, dy = (dyp / H) * 100;
    const s = d.start as Item & { h?: number };
    const tolX = (6 / W) * 100, tolY = (6 / H) * 100;
    if (d.mode === "pan" && s.k === "img") {
      const fw = (s.w / 100) * W, fh = (s.h / 100) * H;
      setLive({ id: d.id, patch: { fx: Math.round(Math.max(0, Math.min(100, (s.fx ?? 50) - (dxp / fw) * 100))), fy: Math.round(Math.max(0, Math.min(100, (s.fy ?? 40) - (dyp / fh) * 100))) } });
      return;
    }
    const h = s.k === "text" ? 0 : (s.h ?? 0);
    if (d.mode === "move") {
      let x = s.x + dx, y = s.y + dy;
      const gx = near([x, x + s.w / 2, x + s.w], snapX(d.id), tolX);
      const gy = s.k === "text" ? null : near([y, y + h / 2, y + h], snapY(d.id), tolY);
      if (gx) x += gx.d; if (gy) y += gy.d;
      // Keep at least a bit of it on the page, so nothing gets lost off the edge.
      x = Math.max(-s.w + 4, Math.min(96, x)); y = Math.max(s.k === "text" ? -2 : -h + 6, Math.min(94, y));
      setGuides({ v: gx ? [gx.line] : [], h: gy ? [gy.line] : [] });
      setLive({ id: d.id, patch: { x: r1(x), y: r1(y) } });
      return;
    }
    // resize from a corner (texts: sides only, the type grows with the box)
    let { x, y, w } = s; let hh = h;
    const c = d.corner!;
    if (c.includes("w")) { x = s.x + dx; w = s.w - dx; }
    if (c.includes("e")) w = s.w + dx;
    if (s.k !== "text") {
      if (c.includes("n")) { y = s.y + dy; hh = h - dy; }
      if (c.includes("s")) hh = h + dy;
      if (e.shiftKey && s.k === "img") { const k = (w / s.w); hh = h * k; if (c.includes("n")) y = s.y + h - hh; }
    }
    const edgeX = c.includes("w") ? x : x + w;
    const gx = near([edgeX], snapX(d.id), tolX);
    if (gx) { if (c.includes("w")) { x += gx.d; w -= gx.d; } else w += gx.d; }
    let gy = null;
    if (s.k !== "text" && (c.includes("n") || c.includes("s"))) {
      const edgeY = c.includes("n") ? y : y + hh;
      gy = near([edgeY], snapY(d.id), tolY);
      if (gy) { if (c.includes("n")) { y += gy.d; hh -= gy.d; } else hh += gy.d; }
    }
    w = Math.max(2, w); hh = Math.max(4, hh);
    setGuides({ v: gx ? [gx.line] : [], h: gy ? [gy.line] : [] });
    if (s.k === "text") setLive({ id: d.id, patch: { x: r1(x), w: r1(w) } });
    else setLive({ id: d.id, patch: { x: r1(x), y: r1(y), w: r1(w), h: r1(hh) } });
  };
  const end = () => {
    if (frame.current) { cancelAnimationFrame(frame.current); frame.current = null; }
    const d = drag.current; drag.current = null;
    if (d?.moved && live) onChange(live.id, live.patch);
    setLive(null); setGuides({ v: [], h: [] });
  };

  // Box of the chosen item on screen (texts: measured height is unknown, so a slim band).
  const box = selItem ? {
    l: (selItem.x / 100) * W, t: (selItem.y / 100) * H, w: (selItem.w / 100) * W,
    h: selItem.k === "text" ? Math.max(18, (selItem.size / 100) * H * (selItem.lh ?? 1.15) * Math.max(1, selItem.t.split("\n").length)) : ((selItem as { h: number }).h / 100) * H,
  } : null;
  const overFold = selItem && selItem.k !== "text" && !(selItem.k === "img" && selItem.bg) && selItem.x < 50 && selItem.x + selItem.w > 50;
  const corners: Drag["corner"][] = selItem?.k === "text" ? ["w", "e"] : ["nw", "ne", "sw", "se"];

  return (
    <div ref={ref} className="w-full flex justify-center touch-none select-none" onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onPointerDown={() => { if (!drag.current && !onSwapPick) setSel(null); }}>
      {W > 0 && (
        <div className="relative shadow-[0_34px_50px_-26px_rgba(60,30,10,.6),0_4px_10px_rgba(60,30,10,.2)]" style={{ cursor: onSwapPick ? "crosshair" : undefined }}>
          <SpreadView spread={shown} width={W} ratio={ratio} photos={byId} selected={sel} onPick={onPick} onDropPhoto={onDropPhoto} marks={marks} studio={studio} onDouble={onDouble} />
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {guides.v.map((v, i) => <span key={`v${i}`} className="absolute top-0 bottom-0 w-px" style={{ left: (v / 100) * W, background: v === 50 ? "#E5484D" : "#7D5CEF" }} />)}
            {guides.h.map((v, i) => <span key={`h${i}`} className="absolute left-0 right-0 h-px bg-[#7D5CEF]" style={{ top: (v / 100) * H }} />)}
            {overFold && <span className="absolute top-0 bottom-0 border-l border-dashed border-[#E5484D]" style={{ left: W / 2 }} />}
          </div>
          {box && !onSwapPick && !(selItem?.k === "img" && selItem.bg) && corners.map(c => {
            const x = c!.includes("w") ? box.l : box.l + box.w, y = c === "e" || c === "w" ? box.t + box.h / 2 : c!.includes("n") ? box.t : box.t + box.h;
            return (
              <span key={c} role="presentation" data-corner={c} onPointerDown={onHandle}
                className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-[3px] bg-white border-2 border-[#7D5CEF] shadow z-20"
                style={{ left: x, top: y, cursor: c === "e" || c === "w" ? "ew-resize" : c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize" }} />
            );
          })}
        </div>
      )}
    </div>
  );
}
