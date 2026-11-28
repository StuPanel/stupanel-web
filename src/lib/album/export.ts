/**
 * Print export, made entirely in the browser (free: no server, no paid service). Each page is drawn
 * on a canvas at the album's print size (300 DPI by default) with bleed on every side, from the same
 * page model the editor shows, and saved as a JPEG. Photos are read from Google Drive at the size the
 * frame needs (never more than the original).
 */
import { photoUrl, sizeOf, type APhoto, type AlbumSize, type BoxItem, type Corners, type ImgItem, type Spread, type TextItem } from "./types";

export type ExportOptions = { size: AlbumSize; dpi: number; bleedMm: number; quality?: number; studio?: { name: string; logoUrl: string | null } | null };
export const MM = 25.4;

/** Canvas size of one page, bleed included. */
export function pagePixels(o: ExportOptions) {
  const z = sizeOf(o.size);
  const bleed = Math.round((o.bleedMm / MM) * o.dpi);
  const tw = Math.round(z.w * o.dpi), th = Math.round(z.h * o.dpi);
  return { tw, th, bleed, cw: tw + bleed * 2, ch: th + bleed * 2 };
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string) {
  let p = imgCache.get(url);
  if (!p) {
    p = new Promise<HTMLImageElement>((ok, bad) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.decoding = "async";
      im.onload = () => ok(im);
      im.onerror = () => bad(new Error("A photo could not be read from Google Drive."));
      im.src = url;
    });
    imgCache.set(url, p);
    p.catch(() => imgCache.delete(url));
  }
  return p;
}

type Box = { l: number; t: number; w: number; h: number };

function roundPath(ctx: CanvasRenderingContext2D, b: Box, r: number[] | null) {
  ctx.beginPath();
  if (r && r.some(v => v > 0) && typeof ctx.roundRect === "function") ctx.roundRect(b.l, b.t, b.w, b.h, r.map(v => Math.max(0, Math.min(v, b.w / 2, b.h / 2))));
  else ctx.rect(b.l, b.t, b.w, b.h);
}

const TORN_PTS = [[0, 0], [100, 0], [100, 82], [94, 88], [86, 80], [77, 90], [66, 84], [55, 93], [44, 85], [33, 92], [22, 84], [12, 91], [4, 85], [0, 90]];
function tornPath(ctx: CanvasRenderingContext2D, b: Box) {
  ctx.beginPath();
  TORN_PTS.forEach(([x, y], i) => { const px = b.l + (x / 100) * b.w, py = b.t + (y / 100) * b.h; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.closePath();
}

/** Turn the drawing around the centre of a box. */
function turn(ctx: CanvasRenderingContext2D, b: Box, deg?: number) {
  if (!deg) return;
  const cx = b.l + b.w / 2, cy = b.t + b.h / 2;
  ctx.translate(cx, cy); ctx.rotate((deg * Math.PI) / 180); ctx.translate(-cx, -cy);
}
function polyPath(ctx: CanvasRenderingContext2D, b: Box, pts: number[]) {
  ctx.beginPath();
  for (let i = 0; i + 1 < pts.length; i += 2) { const x = b.l + (pts[i] / 100) * b.w, y = b.t + (pts[i + 1] / 100) * b.h; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.closePath();
}

const hasFilter = (ctx: CanvasRenderingContext2D) => typeof (ctx as unknown as { filter?: unknown }).filter === "string";

/** Draws one page. `onPhoto` reports photos that could not be read. */
export async function drawSpread(s: Spread, photos: Map<string, APhoto>, o: ExportOptions, canvas?: HTMLCanvasElement) {
  const { tw, th, bleed, cw, ch } = pagePixels(o);
  const cv = canvas ?? document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d", { alpha: false })!;
  ctx.fillStyle = s.bg; ctx.fillRect(0, 0, cw, ch);
  const H = th;
  // Trim-space % → canvas pixels; anything touching an edge runs out into the bleed.
  const place = (it: { x: number; y: number; w: number; h: number }): Box => {
    let l = bleed + (it.x / 100) * tw, t = bleed + (it.y / 100) * th;
    let r = bleed + ((it.x + it.w) / 100) * tw, b = bleed + ((it.y + it.h) / 100) * th;
    if (it.x <= 0.05) l = 0; if (it.y <= 0.05) t = 0;
    if (it.x + it.w >= 99.95) r = cw; if (it.y + it.h >= 99.95) b = ch;
    return { l, t, w: r - l, h: b - t };
  };
  const rad = (r: Corners | undefined) => (r ? r.map(v => (v / 100) * H) : null);
  const fonts = new Set(s.items.filter((i): i is TextItem => i.k === "text").map(t => `${t.italic ? "italic " : ""}${t.weight ?? 400} 40px ${t.font}`));
  await Promise.all([...fonts].map(f => document.fonts?.load(f).catch(() => null)));

  const missing: string[] = [];
  for (const it of s.items) {
    if (it.k === "img") { if (!(await drawImg(ctx, it, place(it), rad(it.r), H, photos))) missing.push(it.id); }
    else if (it.k === "box") drawBox(ctx, it, place(it), rad(it.r), H);
    else if (it.k === "logo") await drawLogo(ctx, place(it), o.studio, s.bg, H);
    else drawText(ctx, it, bleed + (it.x / 100) * tw, bleed + (it.y / 100) * th, (it.w / 100) * tw, H);
  }
  return { canvas: cv, missing };
}

async function drawImg(ctx: CanvasRenderingContext2D, it: ImgItem, b: Box, r: number[] | null, H: number, photos: Map<string, APhoto>) {
  const p = it.p ? photos.get(it.p) : undefined;
  const bd = it.bd ? (it.bd.w / 100) * H : 0;
  ctx.save();
  turn(ctx, b, it.rot);
  ctx.globalAlpha = it.o ?? 1;
  const outline = () => (it.cut === "torn" ? tornPath(ctx, b) : it.poly ? polyPath(ctx, b, it.poly) : roundPath(ctx, b, r));
  if (it.sh) {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = H * 0.06; ctx.shadowOffsetY = H * 0.03;
    outline(); ctx.fillStyle = it.bd?.c ?? "#000"; ctx.fill(); ctx.restore();
  }
  if (bd) { outline(); ctx.fillStyle = it.bd!.c; ctx.fill(); }
  const inner: Box = { l: b.l + bd, t: b.t + bd, w: b.w - bd * 2, h: b.h - bd * 2 };
  const ir = r ? r.map(v => Math.max(0, v - bd)) : null;
  if (it.cut === "torn") tornPath(ctx, inner); else if (it.poly) polyPath(ctx, inner, it.poly); else roundPath(ctx, inner, ir);
  ctx.clip();
  let ok = true;
  if (p?.d && p.w && p.h) {
    const z = (it.z ?? 1) * (it.blur ? 1.06 : 1), fx = (it.fx ?? 50) / 100, fy = (it.fy ?? 40) / 100;
    const s = Math.max(inner.w / p.w, inner.h / p.h);
    const want = Math.min(p.w, Math.ceil(p.w * s * z));
    try {
      const im = await loadImage(photoUrl(p.d, want));
      const dw = p.w * s, dh = p.h * s;
      const ox = inner.l + (inner.w - dw) * fx, oy = inner.t + (inner.h - dh) * fy;
      const cx = inner.l + inner.w * fx, cy = inner.t + inner.h * fy;
      const L = cx + (ox - cx) * z, T = cy + (oy - cy) * z;
      const parts = [it.bw ? "grayscale(1) contrast(1.05)" : "", it.light ? `brightness(${it.light})` : "", it.blur ? `blur(${Math.round((it.blur / 100) * H)}px)` : ""].filter(Boolean).join(" ");
      if (parts && hasFilter(ctx)) ctx.filter = parts;
      ctx.drawImage(im, L, T, dw * z, dh * z);
      ctx.filter = "none";
      if (parts && !hasFilter(ctx)) grayscaleRegion(ctx, inner, !!it.bw, it.light ?? 1);
      if (it.tint) {
        ctx.save(); ctx.globalAlpha = (it.o ?? 1) * it.tint.o;
        if (it.tint.mode === "color") ctx.globalCompositeOperation = "color";
        ctx.fillStyle = it.tint.c; ctx.fillRect(inner.l, inner.t, inner.w, inner.h); ctx.restore();
      }
    } catch { ok = false; ctx.fillStyle = "#d9d4cc"; ctx.fillRect(inner.l, inner.t, inner.w, inner.h); }
  } else if (it.p) ok = false;
  ctx.restore();
  return ok;
}

/** For browsers without canvas filters (older Safari): black-and-white and brightness by hand. */
function grayscaleRegion(ctx: CanvasRenderingContext2D, b: Box, bw: boolean, light: number) {
  const l = Math.max(0, Math.floor(b.l)), t = Math.max(0, Math.floor(b.t));
  const w = Math.min(ctx.canvas.width - l, Math.ceil(b.w)), h = Math.min(ctx.canvas.height - t, Math.ceil(b.h));
  if (w <= 0 || h <= 0) return;
  const d = ctx.getImageData(l, t, w, h); const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    let r = a[i] * light, g = a[i + 1] * light, bl = a[i + 2] * light;
    if (bw) { const y = 0.2126 * r + 0.7152 * g + 0.0722 * bl; r = g = bl = (y - 128) * 1.05 + 128; }
    a[i] = r; a[i + 1] = g; a[i + 2] = bl;
  }
  ctx.putImageData(d, l, t);
}

function drawBox(ctx: CanvasRenderingContext2D, it: BoxItem, b: Box, r: number[] | null, H: number) {
  ctx.save();
  turn(ctx, b, it.rot);
  if (it.glass) {
    if (hasFilter(ctx)) {
      const tmp = document.createElement("canvas");
      tmp.width = Math.max(1, Math.round(b.w)); tmp.height = Math.max(1, Math.round(b.h));
      tmp.getContext("2d")!.drawImage(ctx.canvas, b.l, b.t, b.w, b.h, 0, 0, tmp.width, tmp.height);
      roundPath(ctx, b, r); ctx.clip();
      ctx.filter = `blur(${Math.round(H * 0.025)}px)`;
      ctx.drawImage(tmp, b.l, b.t, b.w, b.h);
      ctx.filter = "none";
    }
    ctx.fillStyle = `rgba(255,255,255,${it.o ?? 0.18})`;
    roundPath(ctx, b, r); ctx.fill();
  } else if (it.fill) {
    ctx.globalAlpha = it.o ?? 1;
    if (it.blend === "multiply") ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = it.fill; roundPath(ctx, b, r); ctx.fill();
  }
  ctx.restore();
  if (it.line) {
    ctx.save();
    turn(ctx, b, it.rot);
    const lw = Math.max(1, (it.line.w / 100) * H);
    ctx.lineWidth = lw; ctx.strokeStyle = it.line.c;
    roundPath(ctx, { l: b.l + lw / 2, t: b.t + lw / 2, w: b.w - lw, h: b.h - lw }, r);
    ctx.stroke(); ctx.restore();
  }
}

async function drawLogo(ctx: CanvasRenderingContext2D, b: Box, studio: ExportOptions["studio"], bg: string, H: number) {
  if (studio?.logoUrl) {
    try {
      const im = await loadImage(studio.logoUrl);
      const k = Math.min(b.w / im.naturalWidth, b.h / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      ctx.drawImage(im, b.l + (b.w - w) / 2, b.t + (b.h - h) / 2, w, h);
      return;
    } catch { /* fall back to the name */ }
  }
  const dark = (() => { const m = /^#?([0-9a-f]{6})$/i.exec(bg); if (!m) return false; const n = parseInt(m[1], 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 128; })();
  ctx.save();
  ctx.font = `400 ${b.h * 0.28}px 'Cinzel', serif`; ctx.fillStyle = dark ? "#ffffff" : "#17151F";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(studio?.name || "", b.l + b.w / 2, b.t + b.h / 2, b.w);
  ctx.restore();
  void H;
}

function drawText(ctx: CanvasRenderingContext2D, it: TextItem, x: number, y: number, w: number, H: number) {
  const px = (it.size / 100) * H;
  const text = it.up ? it.t.toUpperCase() : it.t;
  ctx.save();
  ctx.font = `${it.italic ? "italic " : ""}${it.weight ?? 400} ${px}px ${it.font}`;
  const c2 = ctx as unknown as { letterSpacing?: string };
  if (it.ls && "letterSpacing" in ctx) c2.letterSpacing = `${it.ls * px}px`;
  ctx.textBaseline = "middle";
  const lineH = px * (it.lh ?? 1.15);
  // Wrap words to the width, keeping the studio's own line breaks.
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && ctx.measureText(next).width > w && !it.bg) { lines.push(cur); cur = word; } else cur = next;
    }
    lines.push(cur);
  }
  if (it.bg) {
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
    const padX = H * 0.02, padY = H * 0.006;
    ctx.fillStyle = it.bg; ctx.fillRect(x, y, tw + padX * 2, lines.length * lineH + padY * 2);
    x += padX; y += padY; w = tw;
  }
  // A turned title spins around the middle of its text block (as the page shows it).
  turn(ctx, { l: x, t: y, w, h: lines.length * lineH }, it.rot);
  if (it.shadow) { ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = px * 0.5; ctx.shadowOffsetY = px * 0.08; }
  ctx.fillStyle = it.color;
  ctx.textAlign = it.align === "center" ? "center" : it.align === "right" ? "right" : "left";
  const ax = it.align === "center" ? x + w / 2 : it.align === "right" ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + lineH * (i + 0.5)));
  ctx.restore();
}

export const toJpeg = (cv: HTMLCanvasElement, q = 0.95) =>
  new Promise<Blob>((ok, bad) => cv.toBlob(b => (b ? ok(b) : bad(new Error("The page could not be saved."))), "image/jpeg", q));

/** File name for a page: "01-cover.jpg", "02.jpg"… */
export const pageName = (i: number, title: string) => `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "album"}-${String(i + 1).padStart(2, "0")}.jpg`;
