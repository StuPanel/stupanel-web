"use client";

/**
 * How a studio's logo should be shown so it looks right on any background.
 * The server works it out from the picture and keeps it on the logo address as `?lk=<kind>-<hex>`
 * (see the API: companies/logo-look.ts). For a logo that has no look on its address yet,
 * the browser works out the same thing from the picture.
 *
 *   s  own plain background (white text on a black square) → edge to edge on that colour, no frame
 *   p  photo / busy picture → fill the tile
 *   l  see-through, light artwork (a white PNG) → dark backing
 *   d  see-through, dark artwork → light backing
 *   m  see-through, in-between → light backing
 */
import { useEffect, useState } from "react";

export type LogoLook = { kind: "s" | "p" | "l" | "d" | "m"; hex?: string };

export const INK = "#16141D";

export function lookOf(url?: string | null): LogoLook | null {
  const m = /[?&]lk=([splmd])(?:-([0-9a-f]{6}))?(?:&|#|$)/i.exec(url ?? "");
  return m ? { kind: m[1].toLowerCase() as LogoLook["kind"], hex: m[2]?.toLowerCase() } : null;
}

const hex = (r: number, g: number, b: number) => [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** The same rules as the server, from RGBA pixels. */
export function lookFromPixels(px: Uint8ClampedArray, w: number, h: number): LogoLook {
  const n = w * h;
  let clear = 0, seen = 0, lumSum = 0;
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3];
    if (a < 32) { clear++; continue; }
    if (a >= 128) { seen++; lumSum += lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); }
  }
  if (clear / n > 0.03) {
    if (!seen) return { kind: "m" };
    const l = lumSum / seen;
    return { kind: l > 0.7 ? "l" : l < 0.3 ? "d" : "m" };
  }
  let r = 0, g = 0, b = 0, c = 0;
  const edge: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x > 0 && y > 0 && x < w - 1 && y < h - 1) continue;
    const i = (y * w + x) * 4;
    r += px[i]; g += px[i + 1]; b += px[i + 2]; c++; edge.push(i);
  }
  r /= c; g /= c; b /= c;
  let dev = 0;
  for (const i of edge) dev += Math.abs(px[i] - r) + Math.abs(px[i + 1] - g) + Math.abs(px[i + 2] - b);
  dev /= c * 3;
  return { kind: dev < 14 ? "s" : "p", hex: hex(r, g, b) };
}

const memo = new Map<string, LogoLook | null>();
const waiting = new Map<string, Promise<LogoLook | null>>();
const KEY = "sp:logo-look:";

function measure(url: string): Promise<LogoLook | null> {
  const had = waiting.get(url);
  if (had) return had;
  const p = new Promise<LogoLook | null>(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const s = Math.min(1, 64 / Math.max(img.naturalWidth, img.naturalHeight, 1));
        const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(lookFromPixels(ctx.getImageData(0, 0, w, h).data, w, h));
      } catch { resolve(null); } // the picture's server does not allow reading it: keep the plain look
    };
    img.onerror = () => resolve(null);
    img.src = url;
  }).then(look => {
    memo.set(url, look);
    try { if (look) localStorage.setItem(KEY + url, JSON.stringify(look)); } catch { /* fine without */ }
    return look;
  });
  waiting.set(url, p);
  return p;
}

/** The look of this logo: from its address at once, otherwise measured in the browser (remembered). */
export function useLogoLook(url?: string | null): LogoLook | null {
  const fromUrl = lookOf(url);
  const [measured, setMeasured] = useState<LogoLook | null>(() => (url ? memo.get(url) ?? null : null));
  useEffect(() => {
    if (!url || fromUrl) return;
    if (memo.has(url)) { setMeasured(memo.get(url) ?? null); return; }
    let on = true;
    try {
      const saved = localStorage.getItem(KEY + url);
      if (saved) { const v = JSON.parse(saved) as LogoLook; memo.set(url, v); setMeasured(v); return; }
    } catch { /* measure instead */ }
    void measure(url).then(v => { if (on) setMeasured(v); });
    return () => { on = false; };
  }, [url, fromUrl?.kind, fromUrl?.hex]); // eslint-disable-line react-hooks/exhaustive-deps
  return fromUrl ?? measured;
}

/**
 * The backing a logo needs on a surface, or null when it can sit there as it is.
 * `dark` = the surface behind the logo is dark (a dark header); otherwise it is light (paper, white card).
 */
export function logoBacking(look: LogoLook | null, dark = false): { background: string; pad: boolean } | null {
  if (!look) return null;
  if (look.kind === "s" || look.kind === "p") return look.hex ? { background: `#${look.hex}`, pad: false } : null;
  if (look.kind === "l") return dark ? null : { background: INK, pad: true };
  if (look.kind === "d") return dark ? { background: "#FFFFFF", pad: true } : null;
  return null;
}
