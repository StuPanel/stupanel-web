/**
 * Photo selection (albums): shared types and helpers for the studio pages and the client portal.
 */
import { API_URL as API } from "@/lib/api";

export type Mark = "selected" | "important" | "rejected";
export const PICKED: Mark[] = ["selected", "important"];
export const isPicked = (m?: Mark | null) => m === "selected" || m === "important";

/** A photo, in the short form the API sends (thousands per gallery). */
export type GPhoto = {
  id: string; a: string; n: string; w: number | null; h: number | null;
  m: Mark | null; no: string | null; hl: boolean;
  /** studio only */
  st?: "uploading" | "pending" | "processing" | "ready" | "failed"; err?: string | null; src?: string; t?: boolean;
};

export type Album = {
  id: string; name: string; minPicks: number | null; maxPicks: number | null; allowExtra?: boolean; limit: string;
  picked: number; total?: number; ready?: number; important?: number; rejected?: number; sortOrder?: number;
};

export type GalleryStatus = "preparing" | "open" | "submitted" | "taken" | "closed";
export type Img = { e: number; s: string };

export type GalleryCard = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; submittedAt: string | null; takenAt: string | null;
  reopenRequestedAt: string | null; changedAfterSubmitAt: string | null; createdAt: string; updatedAt: string;
  program: { id: string; name: string; number: string; date: string | null };
  client: { id: string; name: string };
  albums: { id: string; name: string; minPicks: number | null; maxPicks: number | null; limit: string; picked: number; total: number }[];
  counts: Counts; covers: string[];
};

export type Counts = { total: number; ready: number; failed: number; working: number; picked: number; important: number; rejected: number };

export type GalleryDetail = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; watermark: boolean; allowNotes: boolean; welcome: string | null;
  clientNote: string | null; submittedAt: string | null; changedAfterSubmitAt: string | null; takenAt: string | null;
  reopenRequestedAt: string | null; reopenReason: string | null; createdAt: string; updatedAt: string;
  program: { id: string; name: string; number: string; date: string | null };
  client: { id: string; name: string; firstName: string; lastName: string | null; phone: string | null; email: string | null };
  albums: Album[]; counts: Counts; watermarkOn: boolean; img: Img; photos: GPhoto[];
};

export type ClientGalleryCard = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; bookingId: string; program: string; submittedAt: string | null;
  photos: number; picked: number; albums: { id: string; name: string; minPicks: number | null; maxPicks: number | null; limit: string; picked: number }[];
  covers: string[];
};

export type ClientGallery = {
  id: string; title: string; status: GalleryStatus; deadline: string | null; welcome: string | null; allowNotes: boolean;
  clientNote: string | null; submittedAt: string | null; takenAt: string | null; reopenRequestedAt: string | null;
  studio: string; canChange: boolean; lockedWhy: string;
  albums: Album[]; img: Img; photos: GPhoto[];
};

/** Picture link for a photo: t = small (grid), v = big (viewer, watermarked), m = clean (studio only). */
export function photoUrl(galleryId: string, photoId: string, size: "t" | "v" | "m", img: Img) {
  return `${API}/public/photo-selection/img/${galleryId}/${photoId}/${size}?e=${img.e}&s=${img.s}`;
}
/** The API sends cover links without the API address. */
export const apiUrl = (path: string) => `${API}${path}`;

export const STATUS_LABEL: Record<GalleryStatus, string> = {
  preparing: "Getting ready", open: "Client is choosing", submitted: "Client sent", taken: "Album started", closed: "Closed",
};

export const STATUS_STYLE: Record<GalleryStatus, string> = {
  preparing: "bg-white/90 text-[#4A4658]",
  open: "bg-[#EEE8FD] text-[#5B3FD0]",
  submitted: "bg-[#E2F4EA] text-[#1F8A5B]",
  taken: "bg-[#E6EEF8] text-[#1F5C99]",
  closed: "bg-[#F5F3FA] text-[#A29DB3]",
};

/** "3 days left", "Ends today", "Ended" */
export function timeLeft(deadline: string | null, now = Date.now()) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return { text: "Time is over", over: true, soon: true };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 2) return { text: `${days} days left`, over: false, soon: days <= 3 };
  if (days === 1) return { text: `1 day ${hours}h left`, over: false, soon: true };
  const mins = Math.floor((ms % 3600000) / 60000);
  return { text: hours ? `${hours}h ${mins}m left` : `${mins} min left`, over: false, soon: true };
}

/** "60–80", "up to 80", "at least 60", "" — with the count: "42 / 60–80" */
export function albumProgress(a: { minPicks: number | null; maxPicks: number | null; limit: string }, picked: number) {
  const under = a.minPicks !== null && picked < a.minPicks;
  const over = a.maxPicks !== null && picked > a.maxPicks;
  const full = a.maxPicks !== null && picked >= a.maxPicks;
  const target = a.maxPicks ?? a.minPicks ?? 0;
  const pct = target ? Math.min(100, Math.round((picked / target) * 100)) : picked ? 100 : 0;
  const okRange = picked > 0 && !under && !over && (a.minPicks !== null || a.maxPicks !== null);
  return { under, over, full, pct, okRange, text: a.limit ? `${picked} / ${a.limit}` : `${picked}` };
}

/** File names, one per line — paste into Lightroom's search or a text file. */
export function namesList(photos: GPhoto[], albums: { id: string; name: string }[], which: "picked" | "important" = "picked", byAlbum = true) {
  const keep = photos.filter(p => (which === "important" ? p.m === "important" : isPicked(p.m)));
  if (!byAlbum) return keep.map(p => p.n).join("\n");
  return albums
    .map(a => ({ a, list: keep.filter(p => p.a === a.id) }))
    .filter(x => x.list.length)
    .map(x => `${x.a.name} (${x.list.length})\n${x.list.map(p => p.n).join("\n")}`)
    .join("\n\n");
}

/** A CSV the studio can open in Excel: album, file, mark, note. */
export function namesCsv(photos: GPhoto[], albums: { id: string; name: string }[]) {
  const name = new Map(albums.map(a => [a.id, a.name]));
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = photos.filter(p => p.m).map(p => [name.get(p.a) ?? "", p.n, p.m === "important" ? "Important" : p.m === "selected" ? "Selected" : "Rejected", p.no ?? ""].map(esc).join(","));
  return ["Album,File,Mark,Note", ...rows].join("\n");
}

// ─── Making the small copy in the browser (uploads) ──────────────────────────

export const UPLOAD_PX = 1600;
const OK_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/i;
const RAW_EXT = /\.(cr2|cr3|nef|nrw|arw|srf|sr2|raf|rw2|orf|dng|pef|x3f|srw|3fr|iiq)$/i;
export const isRawName = (n: string) => RAW_EXT.test(n);
export const canUpload = (f: File) => OK_TYPES.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);

/** A 1600px JPEG of the photo, turned the right way up. Throws if the browser cannot read it. */
export async function makeUploadCopy(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const scale = Math.min(1, UPLOAD_PX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.86));
  if (!blob) throw new Error("no blob");
  return { blob, width: w, height: h };
}

/** Group files picked as folders by their folder name ("Wedding/IMG_1.jpg" → "Wedding"). Loose files → "". */
export function byFolder(files: File[]) {
  const map = new Map<string, File[]>();
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    const parts = rel.split("/").filter(Boolean);
    const folder = parts.length > 1 ? parts[parts.length - 2] : "";
    map.set(folder, [...(map.get(folder) ?? []), f]);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return map;
}

// ─── Watermark ───────────────────────────────────────────────────────────────

export type WmPosition = "tl" | "tc" | "tr" | "ml" | "c" | "mr" | "bl" | "bc" | "br" | "tile";
export type Watermark = {
  enabled: boolean; kind: "text" | "logo"; text: string; font: string; color: string; shadow: boolean;
  logoSource: "studio" | "custom"; logoTint: "original" | "white" | "black";
  imageKey: string | null; imageW: number; imageH: number; imageUrl?: string | null;
  position: WmPosition; size: number; opacity: number; margin: number; rotation: number; gap: number; version: number;
  studioName?: string;
};
export const WM_FONTS = ["Plus Jakarta Sans", "Playfair Display", "Great Vibes", "Montserrat", "Cormorant Garamond", "Hind Siliguri"];

/** Same maths as the server: where the mark sits on a W×H photo. */
export function placeMark(W: number, H: number, wm: Pick<Watermark, "size" | "margin" | "position">, ratio: number) {
  let w = Math.max(1, Math.round((W * wm.size) / 100));
  let h = Math.max(1, Math.round(w / (ratio || 1)));
  const m = Math.round((Math.min(W, H) * wm.margin) / 100);
  const maxW = Math.max(1, W - 2 * m), maxH = Math.max(1, H - 2 * m);
  if (w > maxW) { h = Math.max(1, Math.round((h * maxW) / w)); w = maxW; }
  if (h > maxH) { w = Math.max(1, Math.round((w * maxH) / h)); h = maxH; }
  const p = wm.position;
  const col = ["tl", "ml", "bl"].includes(p) ? 0 : ["tr", "mr", "br"].includes(p) ? 2 : 1;
  const row = ["tl", "tc", "tr"].includes(p) ? 0 : ["bl", "bc", "br"].includes(p) ? 2 : 1;
  return {
    left: col === 0 ? m : col === 2 ? W - m - w : Math.round((W - w) / 2),
    top: row === 0 ? m : row === 2 ? H - m - h : Math.round((H - h) / 2),
    width: w, height: h,
  };
}
