"use client";

/**
 * One album page (spread) drawn with HTML. The print export draws the same model on a canvas
 * (lib/album/export.ts), so what the studio sees is what goes to the lab.
 */
import { useEffect } from "react";
import { FONT_HREF } from "@/lib/album/looks";
import { photoUrl, type APhoto, type Corners, type ImgItem, type Item, type Spread, type TextItem } from "@/lib/album/types";

let fontsAdded = false;
/** Album fonts (Google Fonts, free), added once. */
export function useAlbumFonts() {
  useEffect(() => {
    if (fontsAdded || typeof document === "undefined") return;
    fontsAdded = true;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);
}

const radius = (r: Corners | undefined, H: number) => (r ? r.map(v => `${(v / 100) * H}px`).join(" ") : undefined);
export const TORN = "polygon(0 0,100% 0,100% 82%,94% 88%,86% 80%,77% 90%,66% 84%,55% 93%,44% 85%,33% 92%,22% 84%,12% 91%,4% 85%,0 90%)";

type Props = {
  spread: Spread; width: number; ratio: number; photos: Map<string, APhoto>;
  selected?: string | null; onPick?: (id: string, e: React.PointerEvent) => void;
  /** Draw the fold shadow (off for flat previews) */
  fold?: boolean; className?: string; marks?: Set<string>;
  onDropPhoto?: (itemId: string, photoId: string) => void;
};

export function SpreadView({ spread, width, ratio, photos, selected, onPick, fold = true, className, marks, onDropPhoto }: Props) {
  useAlbumFonts();
  const W = width, H = width / ratio;
  return (
    <div className={className} style={{ position: "relative", width: W, height: H, background: spread.bg, overflow: "hidden", borderRadius: 2 }}>
      {spread.items.map(it => <ItemView key={it.id} it={it} W={W} H={H} photos={photos} selected={selected === it.id} onPick={onPick} mark={marks?.has(it.id)} onDropPhoto={onDropPhoto} />)}
      {fold && <div aria-hidden style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: W * 0.05, transform: "translateX(-50%)", background: "linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.16) 47%,rgba(255,255,255,.1) 52%,rgba(0,0,0,0))", pointerEvents: "none" }} />}
    </div>
  );
}

function ItemView({ it, W, H, photos, selected, onPick, mark, onDropPhoto }: { it: Item; W: number; H: number; photos: Map<string, APhoto>; selected: boolean; onPick?: Props["onPick"]; mark?: boolean; onDropPhoto?: Props["onDropPhoto"] }) {
  const pos: React.CSSProperties = { position: "absolute", left: (it.x / 100) * W, top: (it.y / 100) * H, width: (it.w / 100) * W };
  const ring = selected ? { outline: "2px solid #7D5CEF", outlineOffset: 2, zIndex: 5 } : mark ? { outline: "2px dashed #E3A21A", outlineOffset: 2 } : {};
  const pick = onPick ? (e: React.PointerEvent) => { e.stopPropagation(); onPick(it.id, e); } : undefined;
  if (it.k === "box") {
    return <div aria-hidden onPointerDown={pick} style={{ ...pos, height: (it.h / 100) * H, background: it.fill, opacity: it.o ?? 1, borderRadius: radius(it.r, H), border: it.line ? `${Math.max(1, (it.line.w / 100) * H)}px solid ${it.line.c}` : undefined, backdropFilter: it.glass ? `blur(${H * 0.025}px)` : undefined, mixBlendMode: it.blend, boxSizing: "border-box", pointerEvents: onPick ? "auto" : "none", ...(it.glass ? { opacity: 1, background: `rgba(255,255,255,${it.o ?? 0.18})` } : {}) }} />;
  }
  if (it.k === "text") return <TextView it={it} pos={pos} H={H} ring={ring} pick={pick} />;
  return <ImgView it={it} pos={pos} W={W} H={H} photos={photos} ring={ring} pick={pick} onDropPhoto={onDropPhoto} />;
}

function TextView({ it, pos, H, ring, pick }: { it: TextItem; pos: React.CSSProperties; H: number; ring: React.CSSProperties; pick?: (e: React.PointerEvent) => void }) {
  return (
    <div onPointerDown={pick} style={{
      ...pos, ...ring, fontFamily: it.font, fontSize: (it.size / 100) * H, color: it.color, textAlign: it.align ?? "left",
      fontStyle: it.italic ? "italic" : undefined, fontWeight: it.weight ?? 400, letterSpacing: it.ls ? `${it.ls}em` : undefined,
      lineHeight: it.lh ?? 1.15, textTransform: it.up ? "uppercase" : undefined, textShadow: it.shadow ? "0 2px 12px rgba(0,0,0,.35)" : undefined,
      cursor: pick ? "text" : undefined, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
      ...(it.bg ? { background: it.bg, width: "auto", padding: `${H * 0.006}px ${H * 0.02}px`, display: "inline-block" } : {}),
    }}>{it.t}</div>
  );
}

function ImgView({ it, pos, W, H, photos, ring, pick, onDropPhoto }: { it: ImgItem; pos: React.CSSProperties; W: number; H: number; photos: Map<string, APhoto>; ring: React.CSSProperties; pick?: (e: React.PointerEvent) => void; onDropPhoto?: Props["onDropPhoto"] }) {
  const p = it.p ? photos.get(it.p) : undefined;
  const fw = (it.w / 100) * W, fh = (it.h / 100) * H;
  const bd = it.bd ? Math.max(1, (it.bd.w / 100) * H) : 0;
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const filter = [it.bw ? "grayscale(1) contrast(1.05)" : "", it.light ? `brightness(${it.light})` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div onPointerDown={pick}
      onDragOver={onDropPhoto ? e => { if (e.dataTransfer.types.includes("text/photo")) e.preventDefault(); } : undefined}
      onDrop={onDropPhoto ? e => { const id = e.dataTransfer.getData("text/photo"); if (id) { e.preventDefault(); onDropPhoto(it.id, id); } } : undefined}
      style={{
        ...pos, ...ring, height: fh, borderRadius: radius(it.r, H), overflow: "hidden", opacity: it.o ?? 1,
        border: bd ? `${bd}px solid ${it.bd!.c}` : undefined, boxSizing: "border-box",
        boxShadow: it.sh ? `0 ${H * 0.03}px ${H * 0.07}px -${H * 0.03}px rgba(0,0,0,.55)` : undefined,
        clipPath: it.cut === "torn" ? TORN : undefined, background: p ? "#d9d4cc" : "repeating-linear-gradient(45deg,#e7e2da 0 8px,#efebe5 8px 16px)",
        cursor: pick ? "pointer" : undefined,
      }}>
      {p?.d && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(p.d, Math.max(fw, fh * ((p.w ?? 3) / (p.h ?? 2))) * dpr * (it.z ?? 1))} alt="" draggable={false} loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${it.fx ?? 50}% ${it.fy ?? 40}%`, transform: it.z && it.z !== 1 ? `scale(${it.z})` : undefined, transformOrigin: `${it.fx ?? 50}% ${it.fy ?? 40}%`, filter, display: "block", userSelect: "none", pointerEvents: "none" }} />
      )}
    </div>
  );
}
