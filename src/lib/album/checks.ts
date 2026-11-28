/** Things to look at before printing: soft photos, photos used twice, empty frames. */
import { ratioOf, sizeOf, type APhoto, type AlbumSize, type Faces, type ImgItem, type Spread } from "./types";

/** Is any face of this photo on the fold (the middle 6% of the spread)? */
export function faceOnFold(it: ImgItem, p: APhoto | undefined, boxes: number[][] | undefined, ar: number) {
  if (!p?.w || !p?.h || !boxes?.length || !(it.x < 50 && it.x + it.w > 50)) return false;
  const fw = (it.w / 100) * ar, fh = it.h / 100, pa = p.w / p.h, z = it.z ?? 1;
  const s = Math.max(fw / pa, fh) * z, dw = pa * s;
  const fx = (it.fx ?? 50) / 100;
  // object-position then zoom around that point (as the page draws it)
  const ox0 = (fw - dw / z) * fx, cx = fw * fx;
  const L = cx + (ox0 - cx) * z;
  return boxes.some(([bx, , bw]) => {
    const l = (((it.x / 100) * ar + L + bx * dw) / ar) * 100, r = (((it.x / 100) * ar + L + (bx + bw) * dw) / ar) * 100;
    return r > 47 && l < 53;
  });
}

export type Check = { spread: number; item?: string; kind: "soft" | "twice" | "empty" | "fold"; text: string };

/** Pixels the photo really has across the frame, as dots per inch at print size. */
export function dpiOf(it: ImgItem, p: APhoto | undefined, size: AlbumSize) {
  if (!p?.w || !p?.h) return null;
  const z = sizeOf(size);
  const fw = (it.w / 100) * z.w, fh = (it.h / 100) * z.h; // frame in inches
  const scale = Math.max(fw / p.w, fh / p.h) * (it.z ?? 1); // inches per photo pixel (cover)
  return Math.round(1 / scale);
}

export function checkAlbum(spreads: Spread[], byId: Map<string, APhoto>, size: AlbumSize, faces?: Faces | null): Check[] {
  const ar = ratioOf(size);
  const out: Check[] = [];
  const seen = new Map<string, number>();
  spreads.forEach((s, si) => {
    for (const it of s.items) {
      if (it.k !== "img") continue;
      if (!it.p) { out.push({ spread: si, item: it.id, kind: "empty", text: "A frame has no photo." }); continue; }
      const p = byId.get(it.p);
      if (faceOnFold(it, p, faces?.[it.p], ar)) out.push({ spread: si, item: it.id, kind: "fold", text: "A face is on the fold. Move the photo in its frame." });
      const dpi = it.bg ? null : dpiOf(it, p, size);
      if (dpi !== null && dpi < 150) out.push({ spread: si, item: it.id, kind: "soft", text: `A photo is ${dpi} DPI here. It may print soft; make its frame smaller.` });
      if (seen.has(it.p) && !it.bg) out.push({ spread: si, item: it.id, kind: "twice", text: `This photo is also on page ${seen.get(it.p)! + 1}.` });
      else if (!it.bg) seen.set(it.p, si);
    }
  });
  return out;
}
