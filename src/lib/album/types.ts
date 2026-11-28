/**
 * Album Studio — the page model shared by the editor, the previews and the print export.
 * Positions are in % of the spread: x and w of its width, y and h of its height. Sizes of
 * corners, borders and type are in % of the spread height, so a page looks the same at any size.
 */

export type Corners = [number, number, number, number]; // top-left, top-right, bottom-right, bottom-left (% of height)

export type ImgItem = {
  k: "img"; id: string;
  /** Which photo of the page this frame holds (for layouts); the photo itself is `p`. */
  slot: number; p: string | null;
  /** The shape the frame likes: p = tall, l = wide, a = any */
  want: "p" | "l" | "a";
  x: number; y: number; w: number; h: number;
  r?: Corners; bw?: boolean; o?: number;
  /** White (or coloured) border, % of height */
  bd?: { w: number; c: string };
  sh?: boolean;
  /** Photo position inside the frame (0–100) and zoom (1–3) */
  fx?: number; fy?: number; z?: number;
  /** "torn" = a torn-paper bottom edge */
  cut?: "torn";
  /** Full-page background photo (dim, may sit under the fold) */
  bg?: boolean;
  light?: number;
};

export type BoxItem = {
  k: "box"; id: string;
  x: number; y: number; w: number; h: number;
  fill?: string; o?: number; r?: Corners;
  line?: { w: number; c: string };
  /** Frosted glass: blurs what is under it */
  glass?: boolean;
  blend?: "multiply";
};

export type TextRole = "name" | "title" | "quote" | "label";
export type TextItem = {
  k: "text"; id: string; role: TextRole; t: string;
  x: number; y: number; w: number;
  size: number; font: string; color: string;
  align?: "left" | "center" | "right"; italic?: boolean; weight?: number;
  /** letter spacing in em */
  ls?: number; lh?: number; up?: boolean; shadow?: boolean;
  bg?: string;
};

/** The studio's logo (from Settings), kept whole inside its box. */
export type LogoItem = { k: "logo"; id: string; x: number; y: number; w: number; h: number; o?: number };

export type Item = ImgItem | BoxItem | TextItem | LogoItem;

export type Spread = { id: string; look: LookId; v: string; bg: string; items: Item[]; chapter?: string | null };

export type LookId = "mono" | "inset" | "couple" | "arch" | "strips" | "band" | "blush" | "bride";
export type AlbumSize = "12x36" | "12x30" | "10x30" | "12x24";
export type AlbumStatus = "draft" | "client" | "approved" | "lab";
export type Names = { bride?: string; groom?: string; date?: string };

/** A photo of the selection, short form from the API. */
export type APhoto = { id: string; a: string; n: string; w: number | null; h: number | null; f: string | null; d: string | null; m: string | null; hl: boolean };

export type AlbumRow = {
  id: string; title: string; size: AlbumSize; look: LookId; status: AlbumStatus; names: Names | null; approvedAt?: string | null; rev?: number;
  galleryId: string | null; bookingId: string | null; createdAt: string; updatedAt: string;
};
export type AlbumListRow = AlbumRow & { pages: number; cover: Spread | null; coverPhotos?: APhoto[]; openNotes?: number };
export type AlbumNote = { id: string; spread: string; text: string; by: "client" | "studio"; at: string; done?: boolean };
export type Source = {
  gallery: { id: string; title: string; status: string; albums: { id: string; name: string }[] };
  program: { id: string; name: string; number: string; date: string | null };
  client: { firstName: string; lastName: string | null };
  photos: APhoto[];
};
export type AlbumDetail = AlbumRow & { spreads: Spread[]; source: Source | null; notes: AlbumNote[]; proofUrl: string | null; approvedAt: string | null; sentAt: string | null;
  printFolder: { url: string; email: string; at: string; pages: number | null; shared: boolean } | null;
  versions?: number; faces?: Faces | null; studio?: { name: string; logoUrl: string | null } };
/** Faces per photo: boxes [x, y, w, h] in 0–1 of the photo. */
export type Faces = Record<string, number[][]>;
/** What the client's proof link gets. */
export type ProofView = {
  title: string; size: AlbumSize; names: Names | null; spreads: Spread[]; status: AlbumStatus; approvedAt: string | null;
  notes: { id: string; spread: string; text: string; at: string }[];
  photos: { id: string; d: string | null; w: number | null; h: number | null }[];
  studio: { name: string; logoUrl: string | null; phone: string | null };
};

export const SIZES: { id: AlbumSize; label: string; w: number; h: number }[] = [
  { id: "12x36", label: "12 × 36", w: 36, h: 12 },
  { id: "12x30", label: "12 × 30", w: 30, h: 12 },
  { id: "10x30", label: "10 × 30", w: 30, h: 10 },
  { id: "12x24", label: "12 × 24", w: 24, h: 12 },
];
export const sizeOf = (s: AlbumSize) => SIZES.find(x => x.id === s) ?? SIZES[0];
export const ratioOf = (s: AlbumSize) => { const z = sizeOf(s); return z.w / z.h; };

export const STATUS: Record<AlbumStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "#EEEDF2", fg: "#4A4658" },
  client: { label: "With client", bg: "#FFF0D6", fg: "#8A5300" },
  approved: { label: "Approved", bg: "#E7F5EE", fg: "#1F7A4F" },
  lab: { label: "Sent to lab", bg: "#E8F0FE", fg: "#1D4ED8" },
};

export const isPickedMark = (m: string | null) => m === "selected" || m === "important";
/** A picture straight from Google Drive, about `px` wide. */
export const photoUrl = (d: string, px: number) => `https://lh3.googleusercontent.com/d/${d}=w${Math.max(64, Math.round(px))}`;
