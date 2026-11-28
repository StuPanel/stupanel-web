/**
 * The eight page designs (Faisal's references, 28-NOV-2026). Each design has a few page layouts:
 * one with a title (names, a heading, a quote) and some with photos only. Frames never cross the
 * fold in the middle, except dimmed background photos, so no face is lost in the binding.
 */
import type { BoxItem, Faces, ImgItem, LogoItem, LookId, Names, TextItem, TextRole } from "./types";

export const FONTS = {
  bodoni: "'Bodoni Moda', serif",
  playfair: "'Playfair Display', serif",
  italiana: "'Italiana', serif",
  pinyon: "'Pinyon Script', cursive",
  vibes: "'Great Vibes', cursive",
  mont: "'Montserrat', sans-serif",
  corm: "'Cormorant Garamond', serif",
  cinzel: "'Cinzel', serif",
  alex: "'Alex Brush', cursive",
  sacra: "'Sacramento', cursive",
  archivo: "'Archivo Black', sans-serif",
} as const;

/** Fonts the editor offers for a text, with the names people see. */
export const FONT_CHOICES: { id: string; label: string; css: string }[] = [
  { id: "bodoni", label: "Bodoni Moda", css: FONTS.bodoni },
  { id: "playfair", label: "Playfair Display", css: FONTS.playfair },
  { id: "italiana", label: "Italiana", css: FONTS.italiana },
  { id: "pinyon", label: "Pinyon Script", css: FONTS.pinyon },
  { id: "vibes", label: "Great Vibes", css: FONTS.vibes },
  { id: "mont", label: "Montserrat", css: FONTS.mont },
  { id: "corm", label: "Cormorant Garamond", css: FONTS.corm },
  { id: "cinzel", label: "Cinzel", css: FONTS.cinzel },
  { id: "alex", label: "Alex Brush", css: FONTS.alex },
  { id: "sacra", label: "Sacramento", css: FONTS.sacra },
  { id: "archivo", label: "Archivo Black", css: FONTS.archivo },
  { id: "bn-serif", label: "Noto Serif Bengali (বাংলা)", css: "'Noto Serif Bengali', serif" },
  { id: "bn-script", label: "Galada (বাংলা)", css: "'Galada', cursive" },
  { id: "bn-sans", label: "Hind Siliguri (বাংলা)", css: "'Hind Siliguri', sans-serif" },
  { id: "bn-tiro", label: "Tiro Bangla (বাংলা)", css: "'Tiro Bangla', serif" },
  { id: "bn-anek", label: "Anek Bangla (বাংলা)", css: "'Anek Bangla', sans-serif" },
];
export const fontLabel = (css: string) => FONT_CHOICES.find(f => f.css === css)?.label ?? "Font";

export const FONT_HREF = "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Playfair+Display:ital@0;1&family=Italiana&family=Pinyon+Script&family=Great+Vibes&family=Montserrat:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Cinzel:wght@400;500&family=Alex+Brush&family=Sacramento&family=Archivo+Black&family=Noto+Serif+Bengali:wght@400;600&family=Galada&family=Hind+Siliguri:wght@300;400;500&family=Tiro+Bangla&family=Anek+Bangla:wght@300;500&display=swap";

export type Ctx = { ar: number; names: Names; title: string | null; quote: string; faces?: Faces };
type Draft = Omit<ImgItem, "id"> | Omit<BoxItem, "id"> | Omit<TextItem, "id"> | Omit<LogoItem, "id">;
export type Variant = { id: string; photos: number; title?: boolean; /** closing page (studio logo) */ end?: boolean; make: (c: Ctx) => Draft[] };
export type Look = { id: LookId; name: string; note: string; bg: string; variants: Variant[] };

const img = (slot: number, want: ImgItem["want"], x: number, y: number, w: number, h: number, more: Partial<ImgItem> = {}): Omit<ImgItem, "id"> =>
  ({ k: "img", slot, p: null, want, x, y, w, h, ...more });
const box = (x: number, y: number, w: number, h: number, more: Partial<BoxItem> = {}): Omit<BoxItem, "id"> => ({ k: "box", x, y, w, h, ...more });
const txt = (role: TextRole, t: string, x: number, y: number, w: number, size: number, font: string, color: string, more: Partial<TextItem> = {}): Omit<TextItem, "id"> =>
  ({ k: "text", role, t, x, y, w, size, font, color, ...more });
/** Width (% of the spread) of a square that is h% tall. */
const sq = (h: number, ar: number) => h / ar;
const WHITE = { w: 1.6, c: "#ffffff" };
const one = (n: Names) => n.bride || n.groom || "Our Story";
const both = (n: Names) => [n.groom, n.bride].filter(Boolean).join(" & ") || "Our Wedding";

export const LOOKS: Look[] = [
  {
    id: "mono", name: "Monochrome + colour", note: "Pinyon Script · black-and-white background, colour frames", bg: "#222222",
    variants: [
      { id: "mono-t", photos: 4, title: true, make: c => [
        img(0, "l", 0, 0, 100, 100, { bw: true, o: 0.72, bg: true, fy: 30 }),
        img(1, "p", 5, 16, 12, 50, { bd: WHITE, sh: true }),
        img(2, "p", 19.5, 26, 12.5, 54, { bd: { w: 1.2, c: "#fff" }, r: [0, 26, 0, 0], sh: true }),
        img(3, "p", 34.5, 19, 12, 56, { bd: WHITE, sh: true }),
        txt("name", c.title ?? one(c.names), 57, 36, 40, 25, FONTS.pinyon, "#ffffff"),
        txt("quote", c.quote, 57.5, 63, 32, 4.4, FONTS.corm, "#ffffff", { italic: true }),
      ] },
      { id: "mono-4", photos: 5, make: () => [
        img(0, "l", 0, 0, 100, 100, { bw: true, o: 0.7, bg: true }),
        img(1, "p", 7, 14, 17, 72, { bd: WHITE, sh: true }),
        img(2, "p", 27, 22, 17, 64, { bd: WHITE, sh: true }),
        img(3, "p", 56, 22, 17, 64, { bd: WHITE, sh: true }),
        img(4, "p", 76, 14, 17, 72, { bd: WHITE, sh: true }),
      ] },
      { id: "mono-3", photos: 4, make: () => [
        img(0, "l", 0, 0, 100, 100, { bw: true, o: 0.68, bg: true }),
        img(1, "p", 6, 12, 16, 76, { bd: WHITE, sh: true }),
        img(2, "p", 25, 20, 16, 66, { bd: WHITE, sh: true, r: [0, 30, 0, 0] }),
        img(3, "l", 55, 12, 40, 76, { bd: WHITE, sh: true }),
      ] },
    ],
  },
  {
    id: "inset", name: "Bride · inset frame", note: "Bodoni Moda · glass panel with a framed photo", bg: "#3E4A3A",
    variants: [
      { id: "inset-t", photos: 3, title: true, make: c => [
        img(0, "p", 0, 0, 50, 100, { fy: 30 }),
        box(29.5, 0, 17.5, 100, { glass: true, fill: "#ffffff", o: 0.18, line: { w: 0.7, c: "rgba(255,255,255,.9)" } }),
        img(1, "p", 32, 22, 12.5, 49, { bd: WHITE, sh: true }),
        img(2, "p", 50, 0, 50, 100, { fy: 20 }),
        txt("title", c.title ?? "BRIDE", 74, 22, 24, 17, FONTS.bodoni, "#ffffff", { ls: 0.02 }),
        txt("quote", c.quote, 74.5, 44, 19, 3.4, FONTS.corm, "#ffffff", { italic: true }),
      ] },
      { id: "inset-2", photos: 3, make: () => [
        img(0, "a", 0, 0, 50, 100),
        box(53, 0, 18, 100, { glass: true, fill: "#ffffff", o: 0.16 }),
        img(1, "p", 55.5, 20, 13, 56, { bd: WHITE, sh: true }),
        img(2, "p", 71, 0, 29, 100),
      ] },
      { id: "inset-4", photos: 4, make: () => [
        img(0, "p", 0, 0, 31, 100),
        img(1, "p", 33, 12, 15, 76, { bd: WHITE, sh: true }),
        img(2, "p", 52, 12, 15, 76, { bd: WHITE, sh: true }),
        img(3, "p", 69, 0, 31, 100),
      ] },
    ],
  },
  {
    id: "couple", name: "Beautiful couple", note: "Playfair Display · one hero photo, a white mat of small frames", bg: "#FFFFFF",
    variants: [
      { id: "couple-t", photos: 5, title: true, make: c => [
        img(0, "a", 0, 0, 49.75, 100),
        txt("title", c.title ?? "Beautiful", 5, 14, 40, 12.5, FONTS.playfair, "#ffffff", { italic: true, align: "center", shadow: true, lh: 0.95 }),
        txt("label", c.title ? both(c.names) : "Couple", 5, 28, 40, c.title ? 5 : 12.5, FONTS.playfair, "#ffffff", { align: "center", shadow: true, lh: 0.95 }),
        txt("quote", c.quote, 9, 42, 32, 3.6, FONTS.corm, "#ffffff", { italic: true, align: "center", shadow: true }),
        img(1, "l", 50.25, 0, 49.75, 56),
        box(50.25, 57.5, 34, 42.5, { fill: "#F7F5F1" }),
        img(2, "p", 52.5, 62, 14, 33.5, { sh: true }),
        img(3, "p", 67.5, 62, 14, 33.5, { sh: true }),
        img(4, "p", 84.5, 57.5, 15.5, 42.5),
      ] },
      { id: "couple-5", photos: 5, make: () => [
        img(0, "l", 0, 0, 49.75, 56),
        img(1, "p", 0, 57.5, 15.5, 42.5),
        box(17, 57.5, 32.75, 42.5, { fill: "#F7F5F1" }),
        img(2, "p", 18.5, 62, 14.5, 33.5, { sh: true }),
        img(3, "p", 34, 62, 14.5, 33.5, { sh: true }),
        img(4, "a", 50.25, 0, 49.75, 100),
      ] },
      { id: "couple-4", photos: 4, make: () => [
        img(0, "l", 0, 0, 49.75, 49.25),
        img(1, "l", 0, 50.75, 49.75, 49.25),
        img(2, "l", 50.25, 0, 49.75, 49.25),
        img(3, "l", 50.25, 50.75, 49.75, 49.25),
      ] },
    ],
  },
  {
    id: "arch", name: "Arch", note: "Bodoni Moda · warm sand, arch and circle frames", bg: "#E7CDA2",
    variants: [
      { id: "arch-t", photos: 3, title: true, make: c => [
        img(0, "p", 0, 0, 37.5, 100, { fy: 25 }),
        box(37.5, 0, 0.25, 100, { fill: "#ffffff" }),
        img(1, "p", 37.5 - sq(36, c.ar) / 2, 23, sq(36, c.ar), 36, { r: [50, 50, 50, 50], bd: WHITE }),
        box(75, 9, 18.75, 86, { line: { w: 0.55, c: "rgba(255,255,255,.85)" }, r: [28, 28, 0, 0] }),
        img(2, "p", 76.5, 13.5, 15.75, 81.5, { r: [24, 24, 0, 0], fy: 20 }),
        txt("title", c.title ?? "BRIDE", 55, 28, 19, 15, FONTS.bodoni, "#ffffff"),
        txt("quote", c.quote, 55.5, 46, 16, 3.3, FONTS.corm, "#ffffff", { up: true, ls: 0.06 }),
      ] },
      { id: "arch-3", photos: 3, make: () => [
        box(14, 8, 21, 86, { line: { w: 0.55, c: "rgba(255,255,255,.85)" }, r: [32, 32, 0, 0] }),
        img(0, "p", 15.75, 12.5, 17.5, 81.5, { r: [27, 27, 0, 0] }),
        img(1, "p", 56, 12.5, 17.5, 81.5, { r: [27, 27, 0, 0] }),
        img(2, "p", 77, 12.5, 17.5, 81.5, { r: [27, 27, 0, 0] }),
      ] },
      { id: "arch-2", photos: 2, make: c => [
        img(0, "l", 0, 0, 50, 100),
        box(64, 8, 21, 86, { line: { w: 0.55, c: "rgba(255,255,255,.85)" }, r: [32, 32, 0, 0] }),
        img(1, "p", 65.75, 12.5, 17.5, 81.5, { r: [27, 27, 0, 0] }),
        txt("label", c.names.date ?? "", 87, 84, 12, 3.2, FONTS.corm, "#ffffff", { ls: 0.2 }),
      ] },
    ],
  },
  {
    id: "strips", name: "Strips", note: "Montserrat Light · details in vertical strips", bg: "#2A201C",
    variants: [
      { id: "strips-t", photos: 6, title: true, make: c => [
        img(0, "p", 4.25, 23, 7, 56), img(1, "p", 12.5, 12, 7, 56), img(2, "p", 20.75, 19, 7, 64),
        img(3, "p", 29, 12, 7, 56), img(4, "p", 37.25, 23, 7, 56),
        img(5, "l", 52.5, 7.5, 45, 67.5),
        txt("name", c.title ?? one(c.names), 52.5, 79, 45, 7.5, FONTS.mont, "#E9D6C8", { up: true, ls: 0.7, align: "center", weight: 300 }),
        txt("quote", c.quote, 55, 89, 40, 3.7, FONTS.corm, "#E9D6C8", { italic: true, align: "center" }),
      ] },
      { id: "strips-6", photos: 6, make: () => [
        img(0, "l", 2.5, 7.5, 45, 85),
        img(1, "p", 55.75, 23, 7, 56), img(2, "p", 64, 12, 7, 56), img(3, "p", 72.25, 19, 7, 64),
        img(4, "p", 80.5, 12, 7, 56), img(5, "p", 88.75, 23, 7, 56),
      ] },
      { id: "strips-2", photos: 2, make: () => [
        img(0, "a", 3, 8, 44, 84), img(1, "a", 53, 8, 44, 84),
      ] },
    ],
  },
  {
    id: "band", name: "Red band", note: "Great Vibes · black-and-white with one bold colour band", bg: "#1C1C1C",
    variants: [
      { id: "band-t", photos: 4, title: true, make: c => [
        img(0, "p", 0, 0, 50, 100, { bw: true, fy: 25 }),
        box(10, 0, 13.75, 100, { fill: "#C4121E", o: 0.78, blend: "multiply" }),
        img(1, "p", 11.5, 42, 10.75, 41),
        txt("name", c.title ?? one(c.names), 4, 70, 44, 20, FONTS.vibes, "#ffffff", { shadow: true }),
        img(2, "a", 50, 0, 50, 100, { bw: true, o: 0.85 }),
        img(3, "p", 70, 10.5, 18.75, 63.5, { sh: true }),
        txt("quote", `“${c.quote}”`, 58.75, 80, 37.5, 4.1, FONTS.mont, "#ffffff", { align: "center" }),
      ] },
      { id: "band-3", photos: 3, make: () => [
        img(0, "a", 0, 0, 50, 100),
        img(1, "a", 50, 0, 50, 100, { bw: true }),
        box(77, 0, 13.75, 100, { fill: "#C4121E", o: 0.78, blend: "multiply" }),
        img(2, "p", 78.5, 30, 10.75, 41),
      ] },
      { id: "band-4", photos: 4, make: () => [
        img(0, "l", 0, 0, 50, 100, { bw: true, o: 0.8 }),
        img(1, "p", 8, 14, 15, 72, { sh: true }),
        img(2, "p", 27, 14, 15, 72, { sh: true }),
        img(3, "a", 50, 0, 50, 100),
      ] },
    ],
  },
  {
    id: "blush", name: "Blush", note: "Italiana · soft blush, torn-paper edge, sage frames", bg: "#FBF3F1",
    variants: [
      { id: "blush-t", photos: 4, title: true, make: c => [
        img(0, "p", 0, 0, 31.25, 100, { r: [0, 45, 0, 0] }),
        txt("name", c.names.groom || (c.title ?? "Forever"), 33.5, 22, 16, 15, FONTS.italiana, "#C9959B"),
        txt("label", "LOVE", 37, 40, 6, 3, FONTS.mont, "#ffffff", { bg: "#17151F", ls: 0.2, align: "center" }),
        txt("name", c.names.bride || "", 33.5, 50, 16, 15, FONTS.italiana, "#C9959B"),
        img(1, "l", 50, 0, 50, 45, { cut: "torn" }),
        img(2, "p", 58.75, 49.5, 12, 41, { bd: { w: 1.9, c: "#B8C3A8" } }),
        img(3, "p", 73.25, 47, 12, 41, { bd: { w: 1.9, c: "#B8C3A8" } }),
        txt("label", "TALES OF THE HEARTS", 87.5, 52, 11, 4.5, FONTS.mont, "#C9A26A", { ls: 0.14, lh: 1.3 }),
      ] },
      { id: "blush-3", photos: 3, make: () => [
        img(0, "l", 0, 0, 50, 55, { cut: "torn" }),
        img(1, "p", 12, 58, 12, 36, { bd: { w: 1.9, c: "#B8C3A8" } }),
        img(2, "p", 62, 0, 31.25, 100, { r: [45, 45, 0, 0] }),
      ] },
      { id: "blush-4", photos: 4, make: () => [
        img(0, "p", 4, 10, 18, 80, { r: [40, 40, 0, 0] }),
        img(1, "p", 26, 10, 18, 80, { r: [40, 40, 0, 0] }),
        img(2, "p", 56, 10, 18, 80, { r: [40, 40, 0, 0] }),
        img(3, "p", 78, 10, 18, 80, { r: [40, 40, 0, 0] }),
      ] },
    ],
  },
  {
    id: "bride", name: "The Bride", note: "Cinzel + Great Vibes · white column, outline frame", bg: "#FFFFFF",
    variants: [
      { id: "bride-t", photos: 4, title: true, make: c => [
        img(0, "p", 0, 0, 50, 100, { fy: 70, light: 1.08 }),
        img(1, "l", 3.75, 6.75, 31.25, 24, { bd: { w: 1.1, c: "#fff" } }),
        txt("title", "THE", 52.5, 9, 25, 9, FONTS.cinzel, "#17151F", { align: "center", ls: 0.06 }),
        txt("name", c.title ?? "Bride", 52.5, 16, 25, 7.5, FONTS.vibes, "#9E7B4F", { align: "center" }),
        box(58.75, 30.7, 14, 56, { line: { w: 0.55, c: "#D9D2C7" } }),
        img(2, "p", 57.5, 27, 14, 56),
        img(3, "p", 77.5, 0, 22.5, 100),
      ] },
      { id: "bride-3", photos: 3, make: () => [
        img(0, "p", 0, 0, 22.5, 100),
        box(28.5, 26.7, 14, 56, { line: { w: 0.55, c: "#D9D2C7" } }),
        img(1, "p", 27.25, 23, 14, 56),
        img(2, "a", 50, 0, 50, 100),
      ] },
      { id: "bride-4", photos: 4, make: () => [
        img(0, "l", 4, 10, 42, 46), img(1, "l", 4, 60, 20.5, 30), img(2, "l", 25.5, 60, 20.5, 30),
        img(3, "p", 60, 8, 30, 84),
      ] },
    ],
  },
];

// ── Sixteen more designs (Faisal's second set of references, 29-NOV-2026) ──
const T = (o: number, c = "#000000"): ImgItem["tint"] => ({ c, o, mode: "normal" });
const thin = (c = "#ffffff", w = 0.5) => ({ w, c });
const pill = (r: number): [number, number, number, number] => [r, r, r, r];

const MORE: Look[] = [
  {
    id: "candid", name: "Candid frame", note: "Italiana · soft black-and-white background, thin frame, title over its edge", bg: "#1b1b1b",
    variants: [
      { id: "candid-t", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 100, 100, { bw: true, blur: 0.8, o: 0.8, bg: true }),
        img(2, "p", 13, 12, 22, 76, { bd: thin() }),
        box(57, 7, 30, 80, { line: thin("#ffffff", 0.45) }),
        img(1, "p", 58.6, 10, 26.8, 74),
        txt("title", c.title ?? "Candid", 50, 69, 44, 16, FONTS.italiana, "#ffffff", { align: "center", ls: 0.08, up: true }),
        txt("label", both(c.names), 50, 88, 44, 2.6, FONTS.mont, "#ffffff", { align: "center", ls: 0.45, up: true }),
      ] },
      { id: "candid-2", photos: 3, make: () => [
        img(0, "l", 0, 0, 100, 100, { bw: true, blur: 0.8, o: 0.75, bg: true }),
        img(1, "p", 9, 10, 18, 80, { bd: thin() }), img(2, "l", 55, 14, 40, 72, { bd: thin() }),
      ] },
      { id: "candid-3", photos: 4, make: () => [
        img(0, "l", 0, 0, 100, 100, { bw: true, blur: 0.8, o: 0.75, bg: true }),
        img(1, "p", 6, 14, 14, 72, { bd: thin() }), img(2, "p", 23, 14, 14, 72, { bd: thin() }), img(3, "l", 57, 14, 37, 72, { bd: thin() }),
      ] },
    ],
  },
  {
    id: "majestic", name: "Majestic", note: "Bodoni Moda · deep wine, a tilted white frame, side words", bg: "#2a0a0e",
    variants: [
      { id: "majestic-t", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 100, 100, { o: 0.5, tint: T(0.55, "#3a0610"), bg: true, blur: 0.4 }),
        img(2, "p", 10, 10, 28, 58, { sh: true }),
        img(1, "p", 58, 12, 24, 76, { sh: true }),
        box(55, 8, 30, 84, { line: thin("#ffffff", 0.9), rot: -9 }),
        txt("quote", c.quote, 79, 47, 26, 2.4, FONTS.mont, "#f1e3e3", { rot: 90, align: "center", ls: 0.08 }),
        txt("title", c.title ?? "Majestic", 6, 74, 42, 13, FONTS.bodoni, "#E8C4C0", { up: true, ls: 0.04 }),
      ] },
      { id: "majestic-2", photos: 3, make: () => [
        img(0, "l", 0, 0, 100, 100, { o: 0.5, tint: T(0.55, "#3a0610"), bg: true, blur: 0.4 }),
        img(1, "p", 11, 12, 26, 76, { sh: true }), box(9, 8, 30, 84, { line: thin("#ffffff", 0.8), rot: 8 }),
        img(2, "p", 61, 12, 26, 76, { sh: true }), box(59, 8, 30, 84, { line: thin("#ffffff", 0.8), rot: -8 }),
      ] },
      { id: "majestic-3", photos: 2, make: () => [
        img(0, "l", 4, 10, 42, 80, { sh: true }),
        img(1, "p", 60, 10, 28, 80, { sh: true }), box(58, 6, 32, 88, { line: thin("#ffffff", 0.8), rot: -7 }),
      ] },
    ],
  },
  {
    id: "triptych", name: "Triptych", note: "Bodoni Moda · three tall panels, the middle one black and white", bg: "#f4f2ef",
    variants: [
      { id: "triptych-t", photos: 4, title: true, make: c => [
        img(0, "p", 0, 0, 16.3, 100), img(1, "p", 16.85, 0, 16.3, 100, { bw: true }), img(2, "p", 33.7, 0, 16.3, 100),
        txt("title", c.title ?? "Adored", 15, 60, 20, 11, FONTS.bodoni, "#ffffff", { align: "center", shadow: true }),
        txt("label", "Together is my favourite place", 14, 77, 22, 2.2, FONTS.mont, "#ffffff", { align: "center", ls: 0.12, up: true }),
        img(3, "l", 54, 8, 42, 60),
        txt("name", both(c.names), 54, 72, 42, 9, FONTS.pinyon, "#5a4a48", { align: "center" }),
        txt("label", c.names.date ?? "", 54, 89, 42, 2.6, FONTS.mont, "#5a4a48", { align: "center", ls: 0.5 }),
      ] },
      { id: "triptych-6", photos: 6, make: () => [
        img(0, "p", 0, 0, 16.3, 100), img(1, "p", 16.85, 0, 16.3, 100, { bw: true }), img(2, "p", 33.7, 0, 16.3, 100),
        img(3, "p", 50, 0, 16.3, 100), img(4, "p", 66.85, 0, 16.3, 100, { bw: true }), img(5, "p", 83.7, 0, 16.3, 100),
      ] },
      { id: "triptych-4", photos: 4, make: () => [
        img(0, "p", 0, 0, 16.3, 100), img(1, "p", 16.85, 0, 16.3, 100, { bw: true }), img(2, "p", 33.7, 0, 16.3, 100),
        img(3, "a", 50, 0, 50, 100),
      ] },
    ],
  },
  {
    id: "gallery", name: "Gallery row", note: "Bodoni Moda · a row of three thin-framed photos in an outline box", bg: "#140f12",
    variants: [
      { id: "gallery-t", photos: 4, title: true, make: c => [
        img(0, "p", 0, 0, 50, 100),
        txt("title", c.title ?? "Bride", 54, 7, 42, 13, FONTS.bodoni, "#F0D2C4", { align: "right", up: true }),
        box(56, 31, 22, 0.35, { fill: "#ffffff" }),
        txt("name", one(c.names), 79, 26.5, 17, 6, FONTS.corm, "#ffffff", { align: "right" }),
        box(55, 43, 41, 46, { line: thin("#ffffff", 0.35) }),
        img(1, "p", 56.5, 46, 12.5, 40, { bd: thin("#ffffff", 0.3) }), img(2, "p", 70, 46, 12.5, 40, { bd: thin("#ffffff", 0.3) }), img(3, "p", 83.5, 46, 12.5, 40, { bd: thin("#ffffff", 0.3) }),
        box(64, 93, 24, 0.3, { fill: "#cfc3bd" }),
      ] },
      { id: "gallery-2", photos: 5, make: c => [
        img(0, "l", 0, 0, 100, 100, { o: 0.55, bg: true }),
        img(1, "p", 12, 10, 24, 80, { bd: thin("#ffffff", 0.35) }),
        box(55, 22, 41, 50, { line: thin("#ffffff", 0.35) }),
        img(2, "p", 56.5, 25, 12.5, 44, { bw: true }), img(3, "p", 70, 25, 12.5, 44, { bw: true }), img(4, "p", 83.5, 25, 12.5, 44, { bw: true }),
        txt("title", c.title ?? "Vogue", 54, 78, 44, 9, FONTS.bodoni, "#f4ecea", { align: "center", ls: 0.18, up: true }),
      ] },
      { id: "gallery-3", photos: 4, make: () => [
        img(0, "a", 4, 8, 42, 84),
        box(55, 18, 41, 58, { line: thin("#ffffff", 0.35) }),
        img(1, "p", 56.5, 21, 12.5, 52), img(2, "p", 70, 21, 12.5, 52), img(3, "p", 83.5, 21, 12.5, 52),
      ] },
    ],
  },
  {
    id: "centre", name: "Centre colour", note: "Montserrat · soft photo above, three in a row with colour only in the middle", bg: "#2b2026",
    variants: [
      { id: "centre-t", photos: 5, title: true, make: c => [
        img(0, "l", 0, 0, 50, 100, { blur: 0.5, o: 0.9 }),
        img(1, "l", 50, 0, 50, 40, { blur: 0.5, o: 0.75 }),
        img(2, "p", 52, 42, 14.5, 40, { bw: true }), img(3, "p", 67.75, 42, 14.5, 40), img(4, "p", 83.5, 42, 14.5, 40, { bw: true }),
        txt("quote", c.quote, 52, 85, 46, 2.6, FONTS.mont, "#ffffff", { align: "center", up: true, ls: 0.04 }),
        txt("name", one(c.names), 52, 91.5, 46, 3.6, FONTS.mont, "#ffffff", { align: "center", up: true, weight: 500, ls: 0.08 }),
      ] },
      { id: "centre-6", photos: 6, make: () => [
        img(0, "p", 2, 14, 14.5, 72, { bw: true }), img(1, "p", 17.75, 14, 14.5, 72), img(2, "p", 33.5, 14, 14.5, 72, { bw: true }),
        img(3, "p", 52, 14, 14.5, 72, { bw: true }), img(4, "p", 67.75, 14, 14.5, 72), img(5, "p", 83.5, 14, 14.5, 72, { bw: true }),
      ] },
      { id: "centre-4", photos: 5, make: () => [
        img(0, "l", 0, 0, 50, 100, { blur: 0.6, o: 0.8 }),
        img(1, "p", 4, 40, 13.5, 46, { bw: true }), img(2, "p", 18.25, 40, 13.5, 46), img(3, "p", 32.5, 40, 13.5, 46, { bw: true }),
        img(4, "a", 54, 6, 42, 88),
      ] },
    ],
  },
  {
    id: "diagonal", name: "Slanted bands", note: "Great Vibes · three slanted bands, the middle in black and white", bg: "#ffffff",
    variants: [
      { id: "diagonal-t", photos: 4, title: true, make: c => [
        img(0, "l", 0, 0, 50, 37, { poly: [0, 0, 100, 0, 100, 84, 0, 100] }),
        img(1, "l", 0, 32, 50, 38, { bw: true, poly: [0, 14, 100, 0, 100, 86, 0, 100] }),
        img(2, "l", 0, 65, 50, 35, { poly: [0, 15, 100, 0, 100, 100, 0, 100] }),
        txt("quote", c.quote.toLowerCase(), 5, 47, 40, 3.6, FONTS.corm, "#ffffff", { align: "center", ls: 0.04, shadow: true }),
        img(3, "p", 54, 6, 42, 88),
        txt("name", c.title ?? one(c.names), 56, 66, 38, 14, FONTS.vibes, "#ffffff", { align: "center", shadow: true }),
      ] },
      { id: "diagonal-6", photos: 6, make: () => [
        img(0, "l", 0, 0, 50, 37, { poly: [0, 0, 100, 0, 100, 84, 0, 100] }), img(1, "l", 0, 32, 50, 38, { bw: true, poly: [0, 14, 100, 0, 100, 86, 0, 100] }), img(2, "l", 0, 65, 50, 35, { poly: [0, 15, 100, 0, 100, 100, 0, 100] }),
        img(3, "l", 50, 0, 50, 37, { poly: [0, 0, 100, 0, 100, 100, 0, 84] }), img(4, "l", 50, 32, 50, 38, { bw: true, poly: [0, 0, 100, 14, 100, 100, 0, 86] }), img(5, "l", 50, 65, 50, 35, { poly: [0, 0, 100, 15, 100, 100, 0, 100] }),
      ] },
      { id: "diagonal-4", photos: 4, make: () => [
        img(0, "a", 0, 0, 50, 100),
        img(1, "l", 50, 0, 50, 37, { poly: [0, 0, 100, 0, 100, 100, 0, 84] }), img(2, "l", 50, 32, 50, 38, { bw: true, poly: [0, 0, 100, 14, 100, 100, 0, 86] }), img(3, "l", 50, 65, 50, 35, { poly: [0, 0, 100, 15, 100, 100, 0, 100] }),
      ] },
    ],
  },
  {
    id: "polaroid", name: "Polaroid stack", note: "Alex Brush · tilted white-edged photos beside one big portrait", bg: "#1a1512",
    variants: [
      { id: "polaroid-t", photos: 4, title: true, make: c => [
        img(0, "p", 6, 8, 15, 44, { bd: thin("#ffffff", 1.2), sh: true, rot: -6 }),
        img(1, "p", 19, 30, 15, 44, { bd: thin("#ffffff", 1.2), sh: true, rot: 4 }),
        img(2, "p", 32, 12, 15, 44, { bd: thin("#ffffff", 1.2), sh: true, rot: -3 }),
        txt("quote", c.quote, 6, 80, 40, 3, FONTS.corm, "#d6cdc4", { italic: true }),
        img(3, "p", 50, 0, 50, 100),
        txt("name", c.title ?? one(c.names), 56, 64, 40, 13, FONTS.alex, "#ffffff", { shadow: true }),
      ] },
      { id: "polaroid-6", photos: 6, make: () => [
        img(0, "p", 5, 10, 14, 40, { bd: thin("#ffffff", 1.2), sh: true, rot: -5 }), img(1, "p", 19, 46, 14, 40, { bd: thin("#ffffff", 1.2), sh: true, rot: 4 }), img(2, "p", 32, 12, 14, 40, { bd: thin("#ffffff", 1.2), sh: true, rot: -3 }),
        img(3, "p", 55, 46, 14, 40, { bd: thin("#ffffff", 1.2), sh: true, rot: 5 }), img(4, "p", 68, 10, 14, 40, { bd: thin("#ffffff", 1.2), sh: true, rot: -4 }), img(5, "p", 81, 44, 14, 40, { bd: thin("#ffffff", 1.2), sh: true, rot: 3 }),
      ] },
      { id: "polaroid-4", photos: 4, make: () => [
        img(0, "p", 0, 0, 50, 100),
        img(1, "p", 58, 8, 15, 44, { bd: thin("#ffffff", 1.2), sh: true, rot: -6 }), img(2, "p", 72, 30, 15, 44, { bd: thin("#ffffff", 1.2), sh: true, rot: 5 }), img(3, "p", 62, 54, 15, 42, { bd: thin("#ffffff", 1.2), sh: true, rot: -2 }),
      ] },
    ],
  },
  {
    id: "grid", name: "Editorial grid", note: "Cinzel · charcoal, four photos with one framed on top, corner lines", bg: "#262628",
    variants: [
      { id: "grid-t", photos: 6, title: true, make: c => [
        img(0, "p", 4, 8, 20.5, 41), img(1, "p", 25.5, 8, 20.5, 41, { bw: true }), img(2, "p", 4, 51, 20.5, 41, { bw: true }), img(3, "p", 25.5, 51, 20.5, 41),
        img(4, "p", 17, 27, 16, 46, { bd: thin("#ffffff", 0.6), sh: true }),
        box(56, 10, 0.25, 26, { fill: "#a3a3a3" }), box(56, 36, 30, 0.35, { fill: "#a3a3a3" }),
        txt("title", c.title ?? "The Bride", 59, 20, 36, 6.5, FONTS.cinzel, "#ffffff", { up: true }),
        img(5, "p", 78, 44, 18, 46),
        txt("label", "Wedding day", 55, 62, 22, 5, FONTS.cinzel, "#ffffff", { up: true }),
        box(55, 72, 21, 0.35, { fill: "#a3a3a3" }), box(76, 72, 0.25, 22, { fill: "#a3a3a3" }),
        txt("quote", c.quote, 55, 76, 20, 1.9, FONTS.corm, "#d7d7d7", { up: true, lh: 1.5 }),
      ] },
      { id: "grid-5", photos: 6, make: () => [
        img(0, "p", 4, 8, 20.5, 41), img(1, "p", 25.5, 8, 20.5, 41, { bw: true }), img(2, "p", 4, 51, 20.5, 41, { bw: true }), img(3, "p", 25.5, 51, 20.5, 41),
        img(4, "p", 17, 27, 16, 46, { bd: thin("#ffffff", 0.6), sh: true }),
        img(5, "a", 54, 8, 42, 84),
      ] },
      { id: "grid-r", photos: 6, make: () => [
        img(0, "a", 4, 8, 42, 84),
        img(1, "p", 54, 8, 20.5, 41, { bw: true }), img(2, "p", 75.5, 8, 20.5, 41), img(3, "p", 54, 51, 20.5, 41), img(4, "p", 75.5, 51, 20.5, 41, { bw: true }),
        img(5, "p", 67, 27, 16, 46, { bd: thin("#ffffff", 0.6), sh: true }),
      ] },
    ],
  },
  {
    id: "golden", name: "Golden hour", note: "Alex Brush + Cinzel · a photo washed in gold, corner-mark frames", bg: "#f3ede3",
    variants: [
      { id: "golden-t", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 50, 50, { bw: true }),
        img(1, "l", 14, 60, 22, 33, { bd: thin("#ffffff", 0.9) }),
        box(12.8, 57.5, 2.4, 0.5, { fill: "#17151F" }), box(12.8, 57.5, 0.28, 5, { fill: "#17151F" }),
        box(34.8, 95, 2.4, 0.5, { fill: "#17151F" }), box(36.9, 90.5, 0.28, 5, { fill: "#17151F" }),
        img(2, "l", 50, 0, 50, 100, { tint: { c: "#d6a24f", o: 0.55, mode: "color" }, light: 1.06 }),
        box(54, 56, 40, 38, { fill: "#f3ede3", o: 0.82 }),
        txt("name", c.title ?? "Together", 57, 58, 34, 12, FONTS.alex, "#2b1d0e"),
        txt("label", "Forever", 67, 74, 26, 4.6, FONTS.cinzel, "#2b1d0e", { up: true, ls: 0.15 }),
        txt("quote", c.quote, 67, 82, 26, 2, FONTS.corm, "#4a3a26", { italic: true }),
      ] },
      { id: "golden-2", photos: 3, make: () => [
        img(0, "l", 0, 0, 50, 100, { tint: { c: "#d6a24f", o: 0.5, mode: "color" } }),
        img(1, "p", 56, 10, 18, 80, { bd: thin("#ffffff", 0.9), sh: true }), img(2, "p", 77, 10, 18, 80, { bd: thin("#ffffff", 0.9), sh: true }),
      ] },
      { id: "golden-3", photos: 2, make: () => [
        img(0, "l", 0, 0, 50, 100, { bw: true }),
        img(1, "l", 50, 0, 50, 100, { tint: { c: "#d6a24f", o: 0.5, mode: "color" } }),
      ] },
    ],
  },
  {
    id: "olive", name: "Olive paper", note: "Bodoni Moda · black-and-white photo above, olive paper below, big title", bg: "#5f5d45",
    variants: [
      { id: "olive-t", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 100, 60, { bw: true, tint: T(0.3, "#6b6a4c"), bg: true }),
        img(1, "l", 4, 44, 21, 34, { bd: thin() }), img(2, "l", 25.5, 44, 21, 34, { bd: thin() }),
        txt("title", c.title ?? "Vibes", 52, 58, 46, 26, FONTS.bodoni, "#d9d08f", { align: "center", up: true, lh: 1 }),
        txt("quote", c.quote, 54, 88, 42, 3, FONTS.mont, "#e9e4c9", { align: "center" }),
      ] },
      { id: "olive-d", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 100, 60, { bw: true, o: 0.75, bg: true }),
        img(1, "p", 8, 18, 17, 56, { bd: thin("#6b6a4c", 0.5) }), img(2, "p", 26, 18, 17, 56, { bd: thin("#6b6a4c", 0.5) }),
        txt("name", c.title ?? "dreams", 54, 60, 42, 17, FONTS.sacra, "#f1e8b8", { align: "center" }),
        txt("quote", c.quote, 54, 84, 42, 3, FONTS.mont, "#e9e4c9", { align: "center" }),
      ] },
      { id: "olive-o", photos: 5, make: c => [
        img(0, "l", 0, 0, 100, 58, { bw: true, tint: T(0.3, "#6b6a4c"), bg: true }),
        img(1, "l", 4, 34, 21, 32, { bd: thin() }), img(2, "l", 25.5, 34, 21, 32, { bd: thin() }),
        img(3, "l", 53.5, 34, 21, 32, { bd: thin() }), img(4, "l", 75, 34, 21, 32, { bd: thin() }),
        txt("label", "Ours", 4, 70, 92, 19, FONTS.archivo, "#2e2d22", { align: "center", up: true, lh: 1 }),
        txt("quote", c.quote, 4, 91, 92, 2.6, FONTS.mont, "#efe7b0", { align: "center", up: true, ls: 0.2 }),
      ] },
    ],
  },
  {
    id: "heartbeat", name: "Heartbeat", note: "Montserrat · dark photo behind, double frame, bold spaced title", bg: "#1f1f1f",
    variants: [
      { id: "heartbeat-t", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 100, 100, { bw: true, tint: T(0.5, "#1f1f1f"), bg: true }),
        img(2, "p", 14, 12, 22, 76, { bd: thin() }),
        box(56, 9, 38, 56, { line: thin("#ffffff", 0.5) }),
        img(1, "l", 58.5, 13, 33, 48, { bd: thin("#ffffff", 0.4) }),
        txt("title", c.title ?? "Heartbeats", 52, 70, 46, 5, FONTS.mont, "#ffffff", { align: "center", up: true, ls: 0.15, weight: 500 }),
        txt("quote", `“${c.quote}”`, 57, 79, 36, 2.4, FONTS.mont, "#e6e6e6", { align: "center", up: true, lh: 1.5 }),
        txt("label", both(c.names), 52, 93, 46, 2.2, FONTS.mont, "#cfcfcf", { align: "center", up: true, ls: 0.3 }),
      ] },
      { id: "heartbeat-2", photos: 4, make: () => [
        img(0, "l", 0, 0, 100, 100, { bw: true, tint: T(0.5, "#1f1f1f"), bg: true }),
        img(1, "l", 5, 14, 40, 66), img(2, "l", 29, 32, 14, 28, { bd: thin("#ffffff", 0.5) }),
        box(58, 9, 32, 82, { line: thin("#ffffff", 0.5) }), img(3, "p", 60.5, 13, 27, 74, { bd: thin("#ffffff", 0.4) }),
      ] },
      { id: "heartbeat-3", photos: 3, make: () => [
        img(0, "l", 0, 0, 100, 100, { bw: true, tint: T(0.5, "#1f1f1f"), bg: true }),
        box(8, 9, 34, 82, { line: thin("#ffffff", 0.5) }), img(1, "p", 10.5, 13, 29, 74, { bd: thin("#ffffff", 0.4) }),
        box(58, 9, 34, 82, { line: thin("#ffffff", 0.5) }), img(2, "p", 60.5, 13, 29, 74, { bd: thin("#ffffff", 0.4) }),
      ] },
    ],
  },
  {
    id: "pill", name: "Soft pills", note: "Sacramento · rounded frames over a dim photo, a line of words", bg: "#3a3833",
    variants: [
      { id: "pill-t", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 100, 100, { o: 0.55, tint: T(0.35, "#2b2a26"), bg: true }),
        img(1, "p", 6, 12, 19, 74, { r: pill(16), bd: thin("#ffffff", 0.4) }), img(2, "p", 26, 12, 19, 74, { r: pill(16), bd: thin("#ffffff", 0.4) }),
        txt("name", c.title ?? both(c.names), 54, 26, 42, 11, FONTS.sacra, "#ffffff", { align: "center" }),
        txt("quote", c.quote, 58, 52, 34, 3.6, FONTS.mont, "#f1ede4", { align: "center", lh: 1.5 }),
      ] },
      { id: "pill-4", photos: 5, make: () => [
        img(0, "l", 0, 0, 100, 100, { o: 0.55, tint: T(0.35, "#2b2a26"), bg: true }),
        img(1, "p", 6, 12, 19, 76, { r: pill(16), bd: thin("#ffffff", 0.4) }), img(2, "p", 26, 12, 19, 76, { r: pill(16), bd: thin("#ffffff", 0.4) }),
        img(3, "p", 55, 12, 19, 76, { r: pill(16), bd: thin("#ffffff", 0.4) }), img(4, "p", 75, 12, 19, 76, { r: pill(16), bd: thin("#ffffff", 0.4) }),
      ] },
      { id: "pill-2", photos: 2, make: () => [
        img(0, "l", 0, 0, 50, 100),
        img(1, "p", 66, 10, 20, 80, { r: pill(50), bd: thin("#ffffff", 0.6) }),
      ] },
    ],
  },
  {
    id: "peach", name: "Peach", note: "Bodoni Moda · warm peach, arch and oval frames, a circle", bg: "#e8c39c",
    variants: [
      { id: "peach-t", photos: 3, title: true, make: c => [
        img(0, "p", 0, 0, 50, 100),
        box(49.9, 0, 0.3, 100, { fill: "#ffffff" }),
        img(1, "p", 50 - sq(28, c.ar) / 2 - 8, 36, sq(28, c.ar), 28, { r: pill(50), bd: thin("#ffffff", 1) }),
        box(70, 7, 19, 87, { line: thin("#ffffff", 0.5), r: [30, 30, 0, 0] }),
        img(2, "p", 71.6, 11, 15.8, 83, { r: [26, 26, 0, 0] }),
        txt("title", c.title ?? "Bride", 54, 34, 17, 11, FONTS.bodoni, "#ffffff", { up: true }),
        txt("quote", c.quote, 54.5, 50, 14, 2.6, FONTS.corm, "#ffffff", { up: true, lh: 1.4 }),
      ] },
      { id: "peach-2", photos: 2, make: () => [
        img(0, "p", 0, 0, 74, 100),
        box(75, 0, 25, 100, { fill: "#c99069" }), box(75, 12, 25, 0.3, { fill: "#f6e3d3" }), box(75, 88, 25, 0.3, { fill: "#f6e3d3" }),
        img(1, "p", 79, 16, 17, 68, { r: pill(50) }),
      ] },
      { id: "peach-3", photos: 3, make: () => [
        img(0, "p", 4, 10, 20, 80, { r: pill(50) }), img(1, "p", 26, 10, 20, 80, { r: pill(50) }),
        img(2, "p", 54, 0, 46, 100),
      ] },
    ],
  },
  {
    id: "whitespread", name: "White spread", note: "Bodoni Moda + Alex Brush · clean white edges, a small framed photo on a big one", bg: "#ffffff",
    variants: [
      { id: "whitespread-t", photos: 4, title: true, make: c => [
        img(0, "l", 0, 0, 50, 100),
        img(1, "p", 33, 18, 11, 42, { bd: thin("#ffffff", 0.7) }),
        txt("name", c.title ?? "Adorned", 24, 64, 25, 10, FONTS.alex, "#ffffff", { shadow: true }),
        img(2, "p", 50.6, 0, 30, 100), img(3, "p", 81.2, 0, 18.8, 100),
      ] },
      { id: "whitespread-f", photos: 3, title: true, make: c => [
        img(0, "l", 0, 0, 50, 66),
        txt("title", c.title ?? "Forever us", 4, 74, 42, 7, FONTS.bodoni, "#17151F", { up: true, align: "center" }),
        txt("quote", c.quote, 10, 86, 30, 2.2, FONTS.corm, "#5a5a5a", { align: "center", italic: true }),
        box(92, 0, 8, 14, { fill: "#e5e7ea" }),
        img(1, "l", 58, 16, 32, 44), img(2, "l", 50, 66, 50, 34),
      ] },
      { id: "whitespread-s", photos: 4, title: true, make: c => [
        img(0, "l", 0, 0, 50, 100),
        img(1, "l", 50.6, 0, 49.4, 52), img(2, "p", 60, 10, 8.5, 30, { bd: thin("#ffffff", 0.7) }),
        box(50.6, 52.6, 12, 6, { fill: "#d9dee2" }),
        txt("label", "Two glowing", 51, 64, 17, 1.9, FONTS.mont, "#17151F", { align: "center", up: true, ls: 0.3 }),
        txt("title", c.title ?? "Souls", 51, 69, 17, 6, FONTS.bodoni, "#17151F", { align: "center", up: true }),
        img(3, "l", 69, 61, 31, 39),
      ] },
    ],
  },
  {
    id: "fairytale", name: "Fairytale", note: "Bodoni Moda · colour on the left, black and white on the right, softly cut corners", bg: "#e4e4e4",
    variants: [
      { id: "fairytale-t", photos: 4, title: true, make: c => [
        img(0, "p", 0, 0, 50, 100),
        img(1, "l", 50, 0, 50, 100, { bw: true, o: 0.45 }),
        txt("title", c.title ?? "Fairytale bliss", 45, 30, 22, 5, FONTS.bodoni, "#2a2a2a", { up: true, rot: -90, align: "center" }),
        img(2, "p", 64, 26, 14, 42, { r: [0, 9, 0, 9], bd: thin("#ffffff", 0.6) }),
        img(3, "l", 56, 64, 20, 32, { r: [9, 0, 9, 0], bd: thin("#ffffff", 0.6) }),
        txt("quote", `“${c.quote}”`, 79, 62, 18, 2.8, FONTS.mont, "#2a2a2a", { lh: 1.4 }),
      ] },
      { id: "fairytale-4", photos: 4, make: () => [
        img(0, "p", 6, 10, 18, 80, { r: [0, 9, 0, 9], bd: thin("#ffffff", 0.6) }), img(1, "p", 26, 10, 18, 80, { r: [9, 0, 9, 0], bd: thin("#ffffff", 0.6) }),
        img(2, "p", 56, 10, 18, 80, { r: [0, 9, 0, 9], bd: thin("#ffffff", 0.6) }), img(3, "p", 76, 10, 18, 80, { r: [9, 0, 9, 0], bd: thin("#ffffff", 0.6) }),
      ] },
      { id: "fairytale-3", photos: 3, make: () => [
        img(0, "p", 0, 0, 50, 100),
        img(1, "p", 60, 8, 16, 50, { r: [0, 9, 0, 9], bd: thin("#ffffff", 0.6) }), img(2, "l", 66, 60, 26, 34, { r: [9, 0, 9, 0], bd: thin("#ffffff", 0.6) }),
      ] },
    ],
  },
  {
    id: "elegant", name: "Elegant white", note: "Cinzel · white page, side title, a small framed photo and blush blocks", bg: "#ffffff",
    variants: [
      { id: "elegant-t", photos: 5, title: true, make: c => [
        img(0, "l", 0, 0, 50, 55, { bw: true, tint: T(0.18, "#f2c48d") }),
        img(1, "p", 17, 60, 10, 34, { bd: thin("#d9d2c7", 0.4) }),
        txt("title", c.title ?? "Elegant bride", 21, 75, 22, 4.4, FONTS.cinzel, "#17151F", { up: true, rot: -90, align: "center" }),
        txt("quote", c.quote, 34, 62, 13, 1.9, FONTS.corm, "#6b6680", { italic: true, lh: 1.4 }),
        img(2, "l", 6, 84, 7, 12, { bd: thin("#d9d2c7", 0.4) }),
        box(4, 82, 11, 16, { line: thin("#e3dbd8", 0.4) }),
        img(3, "p", 51.5, 16, 23, 84, { bd: thin("#ffffff", 0.8) }), img(4, "p", 76, 16, 24, 84),
      ] },
      { id: "elegant-m", photos: 5, title: true, make: c => [
        img(0, "p", 3, 10, 18, 72),
        box(23, 6, 25, 82, { fill: "#f3e6e3" }), box(44, 6, 0.25, 82, { fill: "#c9b4ae" }),
        img(1, "p", 26, 13, 15, 50, { bd: thin("#ffffff", 0.6) }),
        img(2, "p", 41.5, 52, 6, 16), img(3, "l", 33, 64, 8, 10),
        txt("name", c.title ?? one(c.names), 26, 72, 18, 4, FONTS.cinzel, "#8a7a78", { up: true }),
        img(4, "a", 52, 4, 46, 92),
      ] },
      { id: "elegant-2", photos: 3, make: () => [
        img(0, "a", 2, 4, 46, 92),
        box(52, 6, 25, 82, { fill: "#f3e6e3" }),
        img(1, "p", 56, 13, 17, 56, { bd: thin("#ffffff", 0.6) }), img(2, "p", 80, 10, 17, 80),
      ] },
    ],
  },
];
LOOKS.push(...MORE);

// ── More layouts for every design (same frames, borders and colours as the design) ──
type Frame = Partial<ImgItem>;
const STYLE: Record<LookId, { frame: Frame; ink: string; soft: string; bgPhoto?: boolean; titleFont: string }> = {
  mono: { frame: { bd: WHITE, sh: true }, ink: "#ffffff", soft: "#d8d4cc", bgPhoto: true, titleFont: FONTS.pinyon },
  inset: { frame: { bd: WHITE, sh: true }, ink: "#ffffff", soft: "#e9efe6", titleFont: FONTS.bodoni },
  couple: { frame: { sh: true }, ink: "#17151F", soft: "#6B6680", titleFont: FONTS.playfair },
  arch: { frame: { r: [30, 30, 0, 0] }, ink: "#ffffff", soft: "#fff7ea", titleFont: FONTS.bodoni },
  strips: { frame: {}, ink: "#E9D6C8", soft: "#bfae9f", titleFont: FONTS.mont },
  band: { frame: { sh: true }, ink: "#ffffff", soft: "#d8d4cc", titleFont: FONTS.vibes },
  blush: { frame: { bd: { w: 1.9, c: "#B8C3A8" } }, ink: "#C9959B", soft: "#6E4A50", titleFont: FONTS.italiana },
  bride: { frame: { bd: { w: 0.8, c: "#D9D2C7" } }, ink: "#17151F", soft: "#6B6680", titleFont: FONTS.cinzel },
  candid: { frame: { bd: { w: 0.5, c: "#ffffff" } }, ink: "#ffffff", soft: "#e6e2dc", bgPhoto: true, titleFont: FONTS.italiana },
  majestic: { frame: { sh: true }, ink: "#E8C4C0", soft: "#cfaeb0", titleFont: FONTS.bodoni },
  triptych: { frame: {}, ink: "#17151F", soft: "#6B6680", titleFont: FONTS.bodoni },
  gallery: { frame: { bd: { w: 0.35, c: "#ffffff" } }, ink: "#F0D2C4", soft: "#d9cfc9", titleFont: FONTS.bodoni },
  centre: { frame: {}, ink: "#ffffff", soft: "#e8dede", titleFont: FONTS.mont },
  diagonal: { frame: {}, ink: "#17151F", soft: "#6B6680", titleFont: FONTS.vibes },
  polaroid: { frame: { bd: { w: 1.2, c: "#ffffff" }, sh: true }, ink: "#ffffff", soft: "#d6cdc4", titleFont: FONTS.alex },
  grid: { frame: {}, ink: "#ffffff", soft: "#bdbdbd", titleFont: FONTS.cinzel },
  golden: { frame: { bd: { w: 0.9, c: "#ffffff" } }, ink: "#2b1d0e", soft: "#6b5a44", titleFont: FONTS.alex },
  olive: { frame: { bd: { w: 0.5, c: "#ffffff" } }, ink: "#e9e4c9", soft: "#cfc9a5", bgPhoto: true, titleFont: FONTS.bodoni },
  heartbeat: { frame: { bd: { w: 0.5, c: "#ffffff" } }, ink: "#ffffff", soft: "#d0d0d0", bgPhoto: true, titleFont: FONTS.mont },
  pill: { frame: { r: [16, 16, 16, 16], bd: { w: 0.4, c: "#ffffff" } }, ink: "#ffffff", soft: "#ddd8cf", bgPhoto: true, titleFont: FONTS.sacra },
  peach: { frame: { r: [40, 40, 40, 40] }, ink: "#ffffff", soft: "#fff3e6", titleFont: FONTS.bodoni },
  whitespread: { frame: {}, ink: "#17151F", soft: "#6B6680", titleFont: FONTS.bodoni },
  fairytale: { frame: { r: [0, 9, 0, 9], bd: { w: 0.6, c: "#ffffff" } }, ink: "#2a2a2a", soft: "#555555", titleFont: FONTS.bodoni },
  elegant: { frame: { bd: { w: 0.6, c: "#ffffff" } }, ink: "#17151F", soft: "#8a7a78", titleFont: FONTS.cinzel },
};

function extras(id: LookId): Variant[] {
  const st = STYLE[id], f = st.frame;
  const back = (c: Ctx, slot: number): Draft[] => (st.bgPhoto ? [img(slot, "l", 0, 0, 100, 100, { bw: true, o: 0.7, bg: true })] : []);
  return [
    { id: `${id}-6`, photos: st.bgPhoto ? 7 : 6, make: c => [
      ...back(c, 6),
      img(0, "p", 4, 9, 13.5, 82, f), img(1, "p", 18.5, 9, 13.5, 82, f), img(2, "p", 33, 9, 13.5, 82, f),
      img(3, "p", 53.5, 9, 13.5, 82, f), img(4, "p", 68, 9, 13.5, 82, f), img(5, "p", 82.5, 9, 13.5, 82, f),
    ] },
    { id: `${id}-5`, photos: st.bgPhoto ? 6 : 5, make: c => [
      ...back(c, 5),
      img(0, "a", 4, 8, 42, 84, f),
      img(1, "l", 54, 8, 20, 40, f), img(2, "l", 76, 8, 20, 40, f), img(3, "l", 54, 52, 20, 40, f), img(4, "l", 76, 52, 20, 40, f),
    ] },
    { id: `${id}-2`, photos: st.bgPhoto ? 3 : 2, make: c => [
      ...back(c, 2),
      img(0, "p", 12, 8, 28, 84, f), img(1, "p", 60, 8, 28, 84, f),
    ] },
    { id: `${id}-1`, photos: 1, title: true, make: c => [
      img(0, "l", 52, 0, 48, 100),
      txt("title", c.title ?? one(c.names), 6, 34, 40, 13, st.titleFont, st.ink, { align: "center" }),
      txt("quote", c.quote, 10, 56, 32, 3.8, FONTS.corm, st.soft, { italic: true, align: "center" }),
    ] },
    { id: `${id}-end`, photos: 1, end: true, title: true, make: c => [
      img(0, "a", 0, 0, 50, 100, { fy: 35 }),
      { k: "logo", x: 66, y: 22, w: 18, h: 26 } as Omit<LogoItem, "id">,
      txt("title", "Thank you", 55, 54, 40, 9, st.titleFont === FONTS.mont ? FONTS.vibes : st.titleFont, st.ink, { align: "center" }),
      txt("quote", both(c.names) + (c.names.date ? ` · ${c.names.date}` : ""), 55, 70, 40, 3.6, FONTS.mont, st.soft, { align: "center", ls: 0.12, up: true }),
    ] },
  ];
}
for (const l of LOOKS) l.variants.push(...extras(l.id));

export const lookOf = (id: string) => LOOKS.find(l => l.id === id) ?? LOOKS[0];
export const variantOf = (look: Look, v: string) => look.variants.find(x => x.id === v) ?? look.variants[0];
