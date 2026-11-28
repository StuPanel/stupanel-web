/** Things to look at before printing: soft photos, photos used twice, empty frames. */
import { sizeOf, type APhoto, type AlbumSize, type ImgItem, type Spread } from "./types";

export type Check = { spread: number; item?: string; kind: "soft" | "twice" | "empty"; text: string };

/** Pixels the photo really has across the frame, as dots per inch at print size. */
export function dpiOf(it: ImgItem, p: APhoto | undefined, size: AlbumSize) {
  if (!p?.w || !p?.h) return null;
  const z = sizeOf(size);
  const fw = (it.w / 100) * z.w, fh = (it.h / 100) * z.h; // frame in inches
  const scale = Math.max(fw / p.w, fh / p.h) * (it.z ?? 1); // inches per photo pixel (cover)
  return Math.round(1 / scale);
}

export function checkAlbum(spreads: Spread[], byId: Map<string, APhoto>, size: AlbumSize): Check[] {
  const out: Check[] = [];
  const seen = new Map<string, number>();
  spreads.forEach((s, si) => {
    for (const it of s.items) {
      if (it.k !== "img") continue;
      if (!it.p) { out.push({ spread: si, item: it.id, kind: "empty", text: "A frame has no photo." }); continue; }
      const p = byId.get(it.p);
      const dpi = it.bg ? null : dpiOf(it, p, size);
      if (dpi !== null && dpi < 150) out.push({ spread: si, item: it.id, kind: "soft", text: `A photo is ${dpi} DPI here. It may print soft; make its frame smaller.` });
      if (seen.has(it.p) && !it.bg) out.push({ spread: si, item: it.id, kind: "twice", text: `This photo is also on page ${seen.get(it.p)! + 1}.` });
      else if (!it.bg) seen.set(it.p, si);
    }
  });
  return out;
}
