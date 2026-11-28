/**
 * The eight page designs (Faisal's references, 28-NOV-2026). Each design has a few page layouts:
 * one with a title (names, a heading, a quote) and some with photos only. Frames never cross the
 * fold in the middle, except dimmed background photos, so no face is lost in the binding.
 */
import type { BoxItem, Faces, ImgItem, LookId, Names, TextItem, TextRole } from "./types";

export const FONTS = {
  bodoni: "'Bodoni Moda', serif",
  playfair: "'Playfair Display', serif",
  italiana: "'Italiana', serif",
  pinyon: "'Pinyon Script', cursive",
  vibes: "'Great Vibes', cursive",
  mont: "'Montserrat', sans-serif",
  corm: "'Cormorant Garamond', serif",
  cinzel: "'Cinzel', serif",
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
];
export const fontLabel = (css: string) => FONT_CHOICES.find(f => f.css === css)?.label ?? "Font";

export const FONT_HREF = "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Playfair+Display:ital@0;1&family=Italiana&family=Pinyon+Script&family=Great+Vibes&family=Montserrat:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Cinzel:wght@400;500&display=swap";

export type Ctx = { ar: number; names: Names; title: string | null; quote: string; faces?: Faces };
type Draft = Omit<ImgItem, "id"> | Omit<BoxItem, "id"> | Omit<TextItem, "id">;
export type Variant = { id: string; photos: number; title?: boolean; make: (c: Ctx) => Draft[] };
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

export const lookOf = (id: string) => LOOKS.find(l => l.id === id) ?? LOOKS[0];
export const variantOf = (look: Look, v: string) => look.variants.find(x => x.id === v) ?? look.variants[0];
