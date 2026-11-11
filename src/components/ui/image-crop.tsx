"use client";

/**
 * Position a picture inside a square before it is saved: drag to move, zoom with the slider,
 * the mouse wheel or two fingers. Saves a small JPG — it is shrunk to `size` pixels and the
 * quality is lowered step by step until the file is under `maxBytes`, so it uses little storage.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X, ZoomIn, ZoomOut } from "lucide-react";

const CD = 280; // on-screen size

export function ImageCropModal({ src, title, onSave, onClose, size = 400, maxBytes = 600 * 1024, quality = 0.9, saveLabel = "Use this", start = "fill" }: {
  src: string; title: string; onSave: (b: Blob) => void; onClose: () => void;
  /** Saved width and height in pixels. */
  size?: number;
  /** The saved file is kept under this size. */
  maxBytes?: number;
  /** JPG quality to start from (0–1). */
  quality?: number;
  saveLabel?: string;
  /** How it opens: "fill" covers the square (photos), "fit" shows the whole picture (logos). */
  start?: "fill" | "fit";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  // Zoom range: from half of "whole picture fits" (room around it) up to 4× "fills the square".
  const minRef = useRef(1);
  const maxRef = useRef(4);
  const [scale, setScaleS] = useState(1);
  const [offset, setOffsetS] = useState({ x: 0, y: 0 });
  const [range, setRange] = useState({ min: 1, max: 4 });
  const [exporting, setExporting] = useState(false);
  const [bad, setBad] = useState(false);
  // Fingers / mouse on the picture: one drags, two zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const applyScale = (s: number) => { scaleRef.current = s; setScaleS(s); };
  const applyOffset = (o: { x: number; y: number }) => { offsetRef.current = o; setOffsetS(o); };

  const redraw = useCallback(() => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF"; // the saved picture gets the same white ground
    ctx.fillRect(0, 0, CD, CD);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, offsetRef.current.x, offsetRef.current.y, img.width * scaleRef.current, img.height * scaleRef.current);
  }, []);
  useEffect(() => { redraw(); }, [scale, offset, redraw]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      if (!image.width || !image.height) { setBad(true); return; }
      const fill = Math.max(CD / image.width, CD / image.height);
      const fit = Math.min(CD / image.width, CD / image.height);
      const s = start === "fit" ? fit : fill;
      imgRef.current = image;
      minRef.current = fit * 0.5; maxRef.current = fill * 4;
      setRange({ min: minRef.current, max: maxRef.current });
      applyScale(s);
      applyOffset({ x: (CD - image.width * s) / 2, y: (CD - image.height * s) / 2 });
    };
    image.onerror = () => setBad(true);
    image.src = src;
  }, [src, start]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  // Bigger than the square: no empty edge may show. Smaller: it stays inside the square.
  function clamp(x: number, y: number, sc: number) {
    const img = imgRef.current;
    if (!img) return { x, y };
    const lim = (v: number, len: number) => (len >= CD ? Math.min(0, Math.max(CD - len, v)) : Math.max(0, Math.min(CD - len, v)));
    return { x: lim(x, img.width * sc), y: lim(y, img.height * sc) };
  }
  function zoomTo(next: number) {
    if (!imgRef.current) return;
    const s = Math.min(maxRef.current, Math.max(minRef.current, next));
    const cur = scaleRef.current;
    if (Math.abs(s - cur) < 0.0001) return;
    const r = s / cur, c = CD / 2, { x, y } = offsetRef.current;
    applyScale(s);
    applyOffset(clamp(c - (c - x) * r, c - (c - y) * r, s));
  }
  // Each + / − is a small, even step (8%), at any size.
  const STEP = 1.08;

  function exportCrop() {
    const img = imgRef.current;
    if (!img) return;
    setExporting(true);
    const out = document.createElement("canvas");
    out.width = size; out.height = size;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF"; // JPG has no see-through — empty space and transparent PNGs get white, not black
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    const r = size / CD, { x, y } = offsetRef.current, sc = scaleRef.current;
    ctx.drawImage(img, x * r, y * r, img.width * sc * r, img.height * sc * r);
    const tryQ = (q: number) => out.toBlob(b => {
      if (!b) { setExporting(false); return; }
      if (b.size > maxBytes && q > 0.3) tryQ(q - 0.08);
      else { setExporting(false); onSave(b); }
    }, "image/jpeg", q);
    tryQ(quality);
  }

  const dist = () => { const [a, b] = [...pointers.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  // The slider moves evenly in "feel": each part of it is the same zoom ratio.
  const SL = 1000;
  const toSlider = (v: number) => Math.round((Math.log(v / range.min) / Math.log(range.max / range.min)) * SL) || 0;
  const fromSlider = (n: number) => range.min * Math.pow(range.max / range.min, n / SL);

  return (
    <>
      <div className="sp-backdrop z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label={title} className="sp-modal pointer-events-auto w-full max-w-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#17151F] text-lg">{title}</h2>
              <p className="text-sm text-[#6B6680]">Drag to move · pinch, scroll or use the slider to zoom</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA] flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
          {bad ? (
            <p role="alert" className="mt-5 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium px-4 py-3">We couldn&apos;t open this picture. Please choose a JPG or PNG.</p>
          ) : (
            <>
              <div className="relative mx-auto mt-5 overflow-hidden rounded-[20px] max-w-full" style={{ width: CD, height: CD }}>
                <canvas ref={canvasRef} width={CD} height={CD} className="block cursor-grab active:cursor-grabbing touch-none select-none"
                  onPointerDown={e => {
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                    pinch.current = pointers.current.size === 2 ? { dist: dist(), scale: scaleRef.current } : null;
                  }}
                  onPointerMove={e => {
                    const prev = pointers.current.get(e.pointerId);
                    if (!prev) return;
                    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                    if (pointers.current.size === 2 && pinch.current) {
                      if (pinch.current.dist > 0) zoomTo(pinch.current.scale * (dist() / pinch.current.dist));
                    } else if (pointers.current.size === 1) {
                      applyOffset(clamp(offsetRef.current.x + e.clientX - prev.x, offsetRef.current.y + e.clientY - prev.y, scaleRef.current));
                    }
                  }}
                  onPointerUp={e => { pointers.current.delete(e.pointerId); pinch.current = null; }}
                  onPointerCancel={e => { pointers.current.delete(e.pointerId); pinch.current = null; }}
                  onWheel={e => zoomTo(scaleRef.current * Math.pow(1.0015, -Math.max(-60, Math.min(60, e.deltaY))))} />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle ${CD / 2 - 12}px at center, transparent 99%, rgba(23,21,31,.55) 100%)` }} />
                <div className="absolute pointer-events-none rounded-full border-2 border-white/80" style={{ inset: 12 }} />
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button type="button" onClick={() => zoomTo(scaleRef.current / STEP)} aria-label="Zoom out" className="w-9 h-9 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] flex items-center justify-center flex-shrink-0"><ZoomOut className="w-4 h-4 text-[#4A4658]" /></button>
                <input type="range" aria-label="Zoom" min={0} max={SL} step={1} value={toSlider(scale)}
                  onChange={e => zoomTo(fromSlider(Number(e.target.value)))} className="flex-1 min-w-0 accent-[#7D5CEF]" />
                <button type="button" onClick={() => zoomTo(scaleRef.current * STEP)} aria-label="Zoom in" className="w-9 h-9 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] flex items-center justify-center flex-shrink-0"><ZoomIn className="w-4 h-4 text-[#4A4658]" /></button>
              </div>
            </>
          )}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold hover:bg-[#EEEBF4]">Cancel</button>
            {!bad && (
              <button type="button" onClick={exportCrop} disabled={exporting}
                className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                {exporting && <Loader2 className="w-4 h-4 animate-spin" />}{saveLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
