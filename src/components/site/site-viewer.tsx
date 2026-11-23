"use client";
/**
 * Full-screen photo viewer of the studio website (albums and package photos).
 * The next and previous photos are fetched before they are needed, and the small copy the visitor
 * already saw in the grid shows at once under the big one, so a swipe never shows a black screen.
 */
import { useEffect, useRef, useState } from "react";
import { ICON, Ic, type SitePhoto } from "./site-view";

/** Asks the browser for these photos now (they come from its cache when the visitor gets there). */
function warm(list: (string | null | undefined)[]) {
  for (const src of list) {
    if (!src) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}

export function PhotoViewer({ shots, at, title, onStep, onClose }: {
  shots: SitePhoto[]; /** Index of the photo shown */ at: number; title: string;
  onStep: (by: number) => void; onClose: () => void;
}) {
  const touch = useRef(0);
  /** Which way the last move went (the new photo slides in from that side). */
  const [dir, setDir] = useState(0);
  const p = shots[at];
  const n = shots.length;

  // The two photos on each side, and their small copies, start loading now.
  useEffect(() => {
    if (!n) return;
    const near = [1, -1, 2, -2].map(k => shots[(at + k + n) % n]).filter(Boolean);
    warm(near.map(x => x.sm));
    warm(near.map(x => x.url));
  }, [at, n, shots]);

  // Keys: arrows move, Escape closes.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") { setDir(1); onStep(1); }
      if (e.key === "ArrowLeft") { setDir(-1); onStep(-1); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onStep, onClose]);

  if (!p) return null;
  const ratio = p.w && p.h ? p.w / p.h : 1.5;
  const go = (by: number) => { setDir(by); onStep(by); };
  return (
    <div className="vw" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50 && n > 1) { e.preventDefault(); go(dx < 0 ? 1 : -1); } }}>
      {/* The box has the photo's shape from the start; the grid's small copy fills it until the big one is here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={p.url} src={p.url} alt={`${title}, photo ${at + 1}`} onClick={e => e.stopPropagation()} decoding="async" draggable={false}
        className={dir > 0 ? "vin-r" : dir < 0 ? "vin-l" : undefined}
        style={{ width: `min(94vw, calc(88dvh * ${ratio.toFixed(4)}))`, aspectRatio: `${p.w || 3} / ${p.h || 2}`, height: "auto", backgroundImage: `url(${p.sm ?? p.blur ?? p.url})` }} />
      <button type="button" className="vx" aria-label="Close the photo" onClick={onClose}><Ic d={ICON.x} size={20} /></button>
      {n > 1 && <>
        <button type="button" className="vp" aria-label="Previous photo" onClick={e => { e.stopPropagation(); go(-1); }}><Ic d={ICON.prev} size={20} /></button>
        <button type="button" className="vn" aria-label="Next photo" onClick={e => { e.stopPropagation(); go(1); }}><Ic d={ICON.next} size={20} /></button>
      </>}
      <div className="vc" aria-hidden="true">{at + 1} / {n}</div>
    </div>
  );
}
