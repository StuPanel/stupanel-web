"use client";

/**
 * Full-screen photo viewer for photo selection (studio, client and family).
 *
 * Touch: the photo follows the finger and the next one slides in beside it; two fingers zoom in
 * around the spot between them, one finger then moves the zoomed photo; drag down to close.
 * Double-tap (double-click) does the page's quick action (e.g. choose it) — or zooms when the
 * page has none. Mouse: arrows / buttons, wheel to zoom, drag to move. Esc closes.
 *
 * Everything that moves is moved by changing the element's transform directly (no re-render
 * per frame), and the small grid picture is shown at once while the big one loads on top.
 * The page passes the bar below the photo (mark buttons, notes…) as `footer`.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { useBackClose } from "@/lib/back-stack";
import { cn } from "@/lib/utils";

const GAP = 24;           // space between two photos while sliding
const EASE = "cubic-bezier(.22,.8,.24,1)";
const SLIDE_MS = 260;
const MAX_ZOOM = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Zoom = { s: number; x: number; y: number };

const Slide = memo(function Slide({ src, thumb, zoomSrc, offset, alt, zoomRef }: {
  src: string; thumb?: string; zoomSrc?: string; offset: number; alt: string;
  zoomRef?: (el: HTMLDivElement | null) => void;
}) {
  const [ready, setReady] = useState(false);
  const [sharp, setSharp] = useState(false);
  const img = "absolute inset-0 w-full h-full object-contain select-none pointer-events-none";
  return (
    <div className="absolute inset-0" style={{ transform: `translate3d(calc(${offset * 100}% + ${offset * GAP}px),0,0)` }} aria-hidden={offset !== 0}>
      <div ref={zoomRef} className="absolute inset-0 origin-center [will-change:transform]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb && !sharp && <img src={thumb} alt="" draggable={false} referrerPolicy="no-referrer" className={img} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={offset === 0 ? alt : ""} draggable={false} referrerPolicy="no-referrer" decoding="async"
          onLoad={() => setReady(true)}
          className={cn(img, "transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {zoomSrc && <img src={zoomSrc} alt="" draggable={false} referrerPolicy="no-referrer" decoding="async" onLoad={() => setSharp(true)}
          className={cn(img, sharp ? "opacity-100" : "opacity-0")} />}
        {!ready && !thumb && <Loader2 className="absolute left-1/2 top-1/2 -ml-4 -mt-4 w-8 h-8 animate-spin text-white/50" />}
      </div>
    </div>
  );
});

export function PhotoViewer({ count, index, onIndex, onClose, src, srcAt, thumbAt, zoomAt, preload, title, sub, footer, top, onKey, onDoubleTap, hint }: {
  count: number; index: number; onIndex: (i: number) => void; onClose: () => void;
  /** The opened photo. */
  src: string;
  /** Big picture of photo i — lets the neighbours slide in with the finger. */
  srcAt?: (i: number) => string;
  /** Small picture of photo i (already loaded by the grid): shown at once, the big one fades in over it. */
  thumbAt?: (i: number) => string;
  /** A sharper picture of photo i, loaded only when the person zooms in. */
  zoomAt?: (i: number) => string;
  preload?: string[]; title: string; sub?: React.ReactNode;
  footer?: React.ReactNode; top?: React.ReactNode;
  /** Extra keys (e.g. S = select). Return true when handled. */
  onKey?: (e: KeyboardEvent) => boolean;
  /** Double-tap / double-click on the photo (a check pops up). Without it, double-tap zooms. */
  onDoubleTap?: () => void;
  /** A short tip shown for a moment when the viewer opens. */
  hint?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const zoomEl = useRef<HTMLDivElement | null>(null);
  const z = useRef<Zoom>({ s: 1, x: 0, y: 0 });
  const busy = useRef(false);
  const [sharpFor, setSharpFor] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  // Phone Back closes the photo, not the page
  useBackClose(true, onClose);

  // ─── moving things (no re-render) ──────────────────────────────────────────
  const setTrack = (x: number, y = 0, ms = 0) => {
    const el = track.current; if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ease` : "none";
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
    el.style.opacity = y ? String(clamp(1 - Math.abs(y) / 500, 0.35, 1)) : "1";
  };
  const applyZoom = (ms = 0) => {
    const el = zoomEl.current; if (!el) return;
    const { s, x, y } = z.current;
    el.style.transition = ms ? `transform ${ms}ms ${EASE}` : "none";
    el.style.transform = s === 1 && !x && !y ? "" : `translate3d(${x}px,${y}px,0) scale(${s})`;
  };
  /** How far the zoomed photo may be moved so its edge never comes inside the screen. */
  const bounds = (s: number) => {
    const r = stage.current?.getBoundingClientRect();
    const W = r?.width ?? 1, H = r?.height ?? 1;
    // The photo's shape, from whichever picture of it has loaded.
    const pic = [...(zoomEl.current?.querySelectorAll("img") ?? [])].find(i => i.naturalWidth > 0);
    const n = pic ? { w: pic.naturalWidth, h: pic.naturalHeight } : null;
    const k = n ? Math.min(W / n.w, H / n.h) : 1;
    const w = n ? n.w * k : W, h = n ? n.h * k : H;
    return { x: Math.max(0, (w * s - W) / 2), y: Math.max(0, (h * s - H) / 2) };
  };
  const settleZoom = () => {
    const c = z.current;
    if (c.s < 1.06) z.current = { s: 1, x: 0, y: 0 };
    else {
      const s = Math.min(c.s, MAX_ZOOM - 1);
      const b = bounds(s);
      z.current = { s, x: clamp(c.x, -b.x, b.x), y: clamp(c.y, -b.y, b.y) };
    }
    applyZoom(220);
    if (z.current.s > 1.3 && zoomAt) setSharpFor(index);
  };
  /** Zoom to `s`, keeping the point (px, py) — measured from the middle of the screen — where it is. */
  const zoomTo = (s: number, px: number, py: number, ms = 0) => {
    const c = z.current;
    const ix = (px - c.x) / c.s, iy = (py - c.y) / c.s;
    z.current = { s, x: px - ix * s, y: py - iy * s };
    applyZoom(ms);
  };

  // ─── previous / next ───────────────────────────────────────────────────────
  const go = useCallback((dir: 1 | -1) => {
    if (busy.current) return;
    const to = index + dir;
    if (to < 0 || to >= count) { setTrack(0, 0, 200); return; }
    const W = stage.current?.clientWidth ?? window.innerWidth;
    if (!srcAt) { onIndex(to); return; }
    busy.current = true;
    if (z.current.s !== 1) { z.current = { s: 1, x: 0, y: 0 }; applyZoom(SLIDE_MS); }
    setTrack(-dir * (W + GAP), 0, SLIDE_MS);
    setTimeout(() => { busy.current = false; onIndex(to); }, SLIDE_MS);
  }, [index, count, onIndex, srcAt]);

  // A new photo is in the middle: put the track back (the photo that slid in is the same element, so nothing jumps).
  useLayoutEffect(() => {
    setTrack(0);
    z.current = { s: 1, x: 0, y: 0 };
    applyZoom();
  }, [index, src]);

  const doubleTap = useCallback((px: number, py: number) => {
    if (onDoubleTap) {
      onDoubleTap();
      setBurst(b => b + 1);
      navigator.vibrate?.(15);
    } else if (z.current.s > 1) { z.current = { s: 1, x: 0, y: 0 }; applyZoom(240); }
    else { zoomTo(2.5, px, py, 240); settleZoom(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDoubleTap, index]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) { if (e.key === "Escape") el.blur(); return; }
      if (onKey?.(e)) { e.preventDefault(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go, onClose, onKey]);

  // The browser's back button closes the viewer (phones)
  useEffect(() => {
    window.history.pushState({ spViewer: true }, "");
    const pop = () => onClose();
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      if (window.history.state?.spViewer) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("sp-locked");
    return () => document.documentElement.classList.remove("sp-locked");
  }, []);

  useEffect(() => {
    for (const u of preload ?? []) { if (!u) continue; const i = new Image(); i.referrerPolicy = "no-referrer"; i.src = u; }
  }, [preload]);

  // ─── touch ─────────────────────────────────────────────────────────────────
  type Gesture =
    | { kind: "wait" | "swipe" | "close" | "pan"; x: number; y: number; t: number; z0: Zoom; dx: number; dy: number }
    | { kind: "pinch"; d0: number; mx: number; my: number; z0: Zoom };
  const g = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  /** A point on the screen, measured from the middle of the photo area. */
  const fromMiddle = (cx: number, cy: number) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: cx - r.left - r.width / 2, y: cy - r.top - r.height / 2 };
  };
  const startOne = (t: React.Touch): Gesture => ({ kind: z.current.s > 1 ? "pan" : "wait", x: t.clientX, y: t.clientY, t: Date.now(), z0: { ...z.current }, dx: 0, dy: 0 });
  const startTwo = (a: React.Touch, b: React.Touch): Gesture => {
    const m = fromMiddle((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    return { kind: "pinch", d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, mx: m.x, my: m.y, z0: { ...z.current } };
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (busy.current) return;
    if (e.touches.length >= 2) { setTrack(0); g.current = startTwo(e.touches[0], e.touches[1]); }
    else g.current = startOne(e.touches[0]);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const c = g.current; if (!c) return;
    if (c.kind === "pinch") {
      if (e.touches.length < 2) return;
      const [a, b] = [e.touches[0], e.touches[1]];
      const m = fromMiddle((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      const s = clamp(c.z0.s * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / c.d0), 0.7, MAX_ZOOM);
      // The spot that was between the fingers stays between the fingers.
      const ix = (c.mx - c.z0.x) / c.z0.s, iy = (c.my - c.z0.y) / c.z0.s;
      z.current = { s, x: m.x - ix * s, y: m.y - iy * s };
      applyZoom();
      return;
    }
    const t = e.touches[0];
    c.dx = t.clientX - c.x; c.dy = t.clientY - c.y;
    if (c.kind === "pan") {
      const b = bounds(z.current.s);
      // A little give past the edge, like pulling a rubber band.
      const soft = (v: number, lim: number) => (Math.abs(v) <= lim ? v : Math.sign(v) * (lim + (Math.abs(v) - lim) * 0.3));
      z.current = { s: c.z0.s, x: soft(c.z0.x + c.dx, b.x), y: soft(c.z0.y + c.dy, b.y) };
      applyZoom();
      return;
    }
    if (c.kind === "wait" && Math.hypot(c.dx, c.dy) > 8) c.kind = Math.abs(c.dx) >= Math.abs(c.dy) ? "swipe" : c.dy > 0 ? "close" : "wait";
    if (c.kind === "swipe") {
      const edge = (c.dx > 0 && index === 0) || (c.dx < 0 && index === count - 1);
      setTrack(edge ? c.dx * 0.3 : c.dx);
    } else if (c.kind === "close") setTrack(0, Math.max(0, c.dy));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const c = g.current;
    if (!c) return;
    if (c.kind === "pinch") {
      // One finger still down: go on moving the zoomed photo with it.
      // (Fingers lift one after the other, so a pinch that ended too small is put right here.)
      if (e.touches.length === 1) { if (z.current.s < 1.06) settleZoom(); g.current = startOne(e.touches[0]); return; }
      g.current = null; settleZoom(); return;
    }
    if (e.touches.length) return;
    g.current = null;
    const ms = Math.max(1, Date.now() - c.t);
    if (c.kind === "pan") { settleZoom(); return; }
    if (c.kind === "close") { if (c.dy > 110 || c.dy / ms > 0.6) onClose(); else setTrack(0, 0, 200); return; }
    if (c.kind === "swipe") {
      const fast = Math.abs(c.dx) > 24 && Math.abs(c.dx) / ms > 0.35;
      const W = stage.current?.clientWidth ?? 360;
      if (c.dx < -W * 0.22 || (fast && c.dx < 0)) go(1);
      else if (c.dx > W * 0.22 || (fast && c.dx > 0)) go(-1);
      else setTrack(0, 0, 200);
      return;
    }
    // A quick tap that didn't move: two of them close together = double-tap
    const t = e.changedTouches[0];
    if (t && ms < 260) {
      const l = lastTap.current;
      if (l && Date.now() - l.t < 320 && Math.hypot(t.clientX - l.x, t.clientY - l.y) < 40) {
        lastTap.current = null; e.preventDefault();
        const p = fromMiddle(t.clientX, t.clientY); doubleTap(p.x, p.y); return;
      }
      lastTap.current = { t: Date.now(), x: t.clientX, y: t.clientY };
    } else lastTap.current = null;
  };

  // ─── mouse ─────────────────────────────────────────────────────────────────
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWheel = (e: React.WheelEvent) => {
    if (busy.current) return;
    const p = fromMiddle(e.clientX, e.clientY);
    zoomTo(clamp(z.current.s * Math.exp(-e.deltaY * 0.0022), 1, MAX_ZOOM - 1), p.x, p.y);
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(settleZoom, 140);
  };
  const drag = useRef<{ x: number; y: number; z0: Zoom } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => { if (z.current.s > 1 && e.button === 0 && !(e.target as HTMLElement).closest("button")) { drag.current = { x: e.clientX, y: e.clientY, z0: { ...z.current } }; e.preventDefault(); } };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = drag.current; if (!d) return;
    z.current = { s: d.z0.s, x: d.z0.x + e.clientX - d.x, y: d.z0.y + e.clientY - d.y };
    applyZoom();
  };
  const onMouseUp = () => { if (drag.current) { drag.current = null; settleZoom(); } };

  const at = (i: number) => (i === index ? src : srcAt?.(i) ?? "");
  const slides = [-1, 0, 1].map(o => ({ o, i: index + o })).filter(x => x.i >= 0 && x.i < count && (x.o === 0 || !!srcAt)).map(x => ({ ...x, url: at(x.i) })).filter(x => x.url);

  return (
    <div className="fixed inset-0 z-[80] bg-[#0E0C14] text-white flex flex-col sp-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center gap-3 px-3 sm:px-5 h-14 flex-shrink-0">
        <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold truncate">{title}</p>
          {sub && <p className="text-[12px] text-white/60 truncate">{sub}</p>}
        </div>
        <span className="text-[13px] text-white/70 tabular-nums">{index + 1} / {count}</span>
        {top}
      </div>
      <div ref={stage} className="relative flex-1 min-h-0 overflow-hidden select-none [touch-action:none] [overscroll-behavior:contain]"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onDoubleClick={e => { if ((e.target as HTMLElement).closest("button")) return; const p = fromMiddle(e.clientX, e.clientY); doubleTap(p.x, p.y); }} onContextMenu={e => e.preventDefault()}>
        <div ref={track} className="absolute inset-0 [will-change:transform]">
          {slides.map(s => (
            <Slide key={s.url} src={s.url} thumb={thumbAt?.(s.i)} offset={s.o} alt={title}
              zoomSrc={s.o === 0 && sharpFor === s.i ? zoomAt?.(s.i) : undefined}
              zoomRef={s.o === 0 ? el => { zoomEl.current = el; } : undefined} />
          ))}
        </div>
        {burst > 0 && (
          <span key={burst} className="sp-burst absolute left-1/2 top-1/2 -ml-12 -mt-12 w-24 h-24 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center shadow-2xl" aria-hidden>
            <Check className="w-14 h-14" strokeWidth={3} />
          </span>
        )}
        {hint && <span className="sp-hint absolute left-1/2 -translate-x-1/2 bottom-4 px-4 py-2 rounded-full bg-black/60 backdrop-blur text-[13px] text-white whitespace-nowrap">{hint}</span>}
        {index > 0 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur items-center justify-center"><ChevronLeft className="w-6 h-6" /></button>
        )}
        {index < count - 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next photo"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur items-center justify-center"><ChevronRight className="w-6 h-6" /></button>
        )}
      </div>
      {footer && <div className="flex-shrink-0 px-3 sm:px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  );
}
