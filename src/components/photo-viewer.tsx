"use client";

/**
 * Full-screen photo viewer for photo selection (studio and client).
 * Swipe / arrow keys / buttons for the previous and next photo, Esc to close,
 * the next photos are loaded ahead so flipping feels instant.
 * The page passes the bar below the photo (mark buttons, notes…) as `footer`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PhotoViewer({ count, index, onIndex, onClose, src, preload, title, sub, footer, top, onKey }: {
  count: number; index: number; onIndex: (i: number) => void; onClose: () => void;
  src: string; preload?: string[]; title: string; sub?: React.ReactNode;
  footer?: React.ReactNode; top?: React.ReactNode;
  /** Extra keys (e.g. S = select). Return true when handled. */
  onKey?: (e: KeyboardEvent) => boolean;
}) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const drag = useRef(0);
  const prev = useCallback(() => { if (index > 0) onIndex(index - 1); }, [index, onIndex]);
  const next = useCallback(() => { if (index < count - 1) onIndex(index + 1); }, [index, count, onIndex]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) { if (e.key === "Escape") el.blur(); return; }
      if (onKey?.(e)) { e.preventDefault(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [prev, next, onClose, onKey]);

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
    for (const u of preload ?? []) { const i = new Image(); i.src = u; }
  }, [preload]);

  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, t: Date.now() }; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const x = t.clientX - start.current.x, y = t.clientY - start.current.y;
    if (Math.abs(x) > Math.abs(y)) { drag.current = x; setDx(x); }
  };
  const onTouchEnd = () => {
    const s = start.current; start.current = null;
    const d = drag.current; drag.current = 0;
    if (!s) return;
    const fast = Math.abs(d) > 30 && Math.abs(d) / Math.max(1, Date.now() - s.t) > 0.4;
    if (d < -80 || (fast && d < 0)) next();
    else if (d > 80 || (fast && d > 0)) prev();
    setDx(0);
  };

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
      <div className="relative flex-1 min-h-0 select-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={src} src={src} alt={title} draggable={false} onLoad={() => setLoaded(src)} onContextMenu={e => e.preventDefault()}
          className={cn("absolute inset-0 m-auto max-w-full max-h-full object-contain transition-opacity duration-200", loaded === src ? "opacity-100" : "opacity-0")}
          style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : undefined }} />
        {loaded !== src && <Loader2 className="absolute left-1/2 top-1/2 -ml-4 -mt-4 w-8 h-8 animate-spin text-white/50" />}
        {index > 0 && (
          <button type="button" onClick={prev} aria-label="Previous photo"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur items-center justify-center"><ChevronLeft className="w-6 h-6" /></button>
        )}
        {index < count - 1 && (
          <button type="button" onClick={next} aria-label="Next photo"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur items-center justify-center"><ChevronRight className="w-6 h-6" /></button>
        )}
      </div>
      {footer && <div className="flex-shrink-0 px-3 sm:px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  );
}
