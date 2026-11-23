/**
 * "Make it yours" for studio websites: a few chosen fonts, colours, corners, buttons, headings and logo
 * placements on top of the look, so studios in one town don't end up with the same website. Every choice is
 * a CSS variable or a class on the site's root; "theme" (or missing) keeps what the look does.
 * Collected from wedding photographers' sites Faisal likes (23-NOV-2026), with free Google fonts.
 */
import type { CSSProperties } from "react";

export type SiteStyle = {
  font?: string; accent?: string; bg?: string; corners?: string; button?: string; heading?: string; logo?: string; logoSize?: string;
};

type Pair = { id: string; name: string; like: string; q: string; fd: string; fp: string; fb: string; fs?: string; fdw?: number; tt?: "none" | "uppercase"; ls?: string };
export const FONT_PAIRS: Pair[] = [
  { id: "classic", name: "Classic", like: "Cormorant + Montserrat", q: "family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Montserrat:wght@400;500;600", fd: "'Cormorant Garamond',serif", fp: "'Cormorant Garamond',serif", fb: "'Montserrat',sans-serif", fdw: 400, tt: "none" },
  { id: "editorial", name: "Editorial", like: "Bodoni + Source Sans", q: "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Source+Sans+3:wght@400;600", fd: "'Bodoni Moda',serif", fp: "'Bodoni Moda',serif", fb: "'Source Sans 3',sans-serif", fdw: 400, tt: "none" },
  { id: "timeless", name: "Timeless", like: "Playfair + Lato", q: "family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Lato:wght@400;700", fd: "'Playfair Display',serif", fp: "'Playfair Display',serif", fb: "'Lato',sans-serif", fdw: 400, tt: "none" },
  { id: "soft", name: "Soft", like: "Playfair + Mulish", q: "family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Mulish:wght@400;600", fd: "'Playfair Display',serif", fp: "'Playfair Display',serif", fb: "'Mulish',sans-serif", fdw: 400, tt: "none" },
  { id: "royal", name: "Royal", like: "Cinzel + Bad Script", q: "family=Cinzel:wght@400;500&family=Bad+Script&family=Playfair+Display:ital,wght@0,400;1,400&family=Montserrat:wght@400;500;600", fd: "'Cinzel',serif", fp: "'Playfair Display',serif", fb: "'Montserrat',sans-serif", fs: "'Bad Script',cursive", fdw: 400, tt: "uppercase" },
  { id: "modern", name: "Modern classic", like: "Jost + Old Standard", q: "family=Jost:wght@300;400;500&family=Old+Standard+TT:ital,wght@0,400;1,400", fd: "'Jost',sans-serif", fp: "'Old Standard TT',serif", fb: "'Jost',sans-serif", fdw: 300, tt: "uppercase", ls: ".08em" },
  { id: "film", name: "Film house", like: "Montserrat bold + Crimson", q: "family=Montserrat:wght@400;500;700&family=Crimson+Text:ital,wght@0,400;1,400", fd: "'Montserrat',sans-serif", fp: "'Crimson Text',serif", fb: "'Montserrat',sans-serif", fdw: 700, tt: "uppercase", ls: ".16em" },
  { id: "clean", name: "Clean", like: "Hanken Grotesk", q: "family=Hanken+Grotesk:wght@300;400;500;600", fd: "'Hanken Grotesk',sans-serif", fp: "'Hanken Grotesk',sans-serif", fb: "'Hanken Grotesk',sans-serif", fdw: 500, tt: "none" },
];

export const ACCENTS: { id: string; name: string; hex: string }[] = [
  { id: "ink", name: "Black", hex: "#1D1D1D" },
  { id: "forest", name: "Forest green", hex: "#132F23" },
  { id: "antique", name: "Antique gold", hex: "#B18006" },
  { id: "gold", name: "Bright gold", hex: "#D4AF37" },
  { id: "rose", name: "Terracotta rose", hex: "#CA786C" },
  { id: "slate", name: "Slate", hex: "#707070" },
  { id: "navy", name: "Navy", hex: "#1B2A4A" },
  { id: "maroon", name: "Maroon", hex: "#6E1F2B" },
];

type Bg = { id: string; name: string; swatch: string; vars: Record<string, string> };
export const BACKGROUNDS: Bg[] = [
  { id: "white", name: "White", swatch: "#FFFFFF", vars: { "--bg": "#FFFFFF", "--ink": "#1D1D1D", "--card": "#FFFFFF", "--panel": "#F5F4F1", "--ph": "#EEEDEA", "--line": "#E3E2DE", "--sh": "0,0,0" } },
  { id: "soft", name: "Soft white", swatch: "#F7F8FA", vars: { "--bg": "#F7F8FA", "--ink": "#1A202C", "--card": "#FFFFFF", "--panel": "#EEF1F5", "--ph": "#E7EAEF", "--line": "#DFE3EA", "--sh": "26,32,44" } },
  { id: "cream", name: "Cream", swatch: "#FEF1E4", vars: { "--bg": "#FEF1E4", "--ink": "#2A211B", "--card": "#FFFFFF", "--panel": "#F8E3CF", "--ph": "#E9DCCD", "--line": "#E6D2B8", "--sh": "84,56,20" } },
  { id: "night", name: "Night", swatch: "#1B1D27", vars: { "--bg": "#1B1D27", "--ink": "#F2EEE6", "--card": "#232634", "--panel": "#232634", "--ph": "#2A2D3B", "--line": "#353A4E", "--sh": "0,0,0", "--mut": "#C9C3B6", "--ond2": "#F2EEE6" } },
];

export const CORNERS = [["square", "Sharp"], ["soft", "Slightly round"]] as const;
export const BUTTONS = [["solid", "Filled"], ["outline", "Outline"], ["line", "Underline"]] as const;
export const HEADINGS = [["normal", "Normal letters"], ["caps", "CAPITALS"]] as const;
export const LOGOS = [["center", "Middle, menu on both sides"], ["left", "Left, menu on the right"]] as const;
export const LOGO_SIZES = [["s", "Small", 40], ["m", "Medium", 54], ["l", "Large", 74]] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Black or white text on a colour, whichever reads better. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  return L > 0.4 ? "#141414" : "#FFFFFF";
}
/** Contrast ratio of two colours (for the "hard to read" warning). */
export function contrast(a: string, b: string) {
  const L = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0); };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const accentHex = (s?: SiteStyle) => (s?.accent ? (HEX.test(s.accent) ? s.accent : ACCENTS.find(a => a.id === s.accent)?.hex) : undefined);

/** Root class names, CSS variables and the extra Google Fonts query for a site's own style. */
export function styleOf(s: SiteStyle | undefined) {
  const cls: string[] = [];
  const vars: Record<string, string> = {};
  let fontQuery: string | null = null;
  if (!s) return { cls: "", style: undefined as CSSProperties | undefined, fontQuery };
  const pair = FONT_PAIRS.find(p => p.id === s.font);
  if (pair) {
    fontQuery = pair.q;
    Object.assign(vars, { "--fd": pair.fd, "--fp": pair.fp, "--fb": pair.fb, "--fdw": String(pair.fdw ?? 400), "--tt": pair.tt ?? "none" });
    if (pair.fs) vars["--fs"] = pair.fs;
    if (pair.ls) { vars["--hls"] = pair.ls; cls.push("st-ls"); }
    cls.push("st-font");
  }
  const bg = BACKGROUNDS.find(b => b.id === s.bg);
  if (bg) { Object.assign(vars, bg.vars); cls.push(`st-bg-${bg.id}`); }
  const ac = accentHex(s);
  if (ac) Object.assign(vars, { "--ac": ac, "--btn": ac, "--btnt": textOn(ac), "--badge": ac, "--badget": textOn(ac), "--sc": ac });
  if (s.corners === "square" || s.corners === "soft") cls.push(`st-r-${s.corners}`);
  if (s.button === "solid" || s.button === "outline" || s.button === "line") cls.push(`st-b-${s.button}`);
  if (s.heading === "normal") { vars["--tt"] = "none"; cls.push("st-h-normal"); }
  if (s.heading === "caps") { vars["--tt"] = "uppercase"; cls.push("st-h-caps"); }
  if (s.logo === "center" || s.logo === "left") cls.push(`st-l-${s.logo}`);
  const size = LOGO_SIZES.find(x => x[0] === s.logoSize);
  if (size) vars["--logoh"] = `${size[2]}px`;
  return { cls: cls.length ? ` ${cls.join(" ")}` : "", style: (Object.keys(vars).length ? vars : undefined) as CSSProperties | undefined, fontQuery };
}

const pickOne = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
/** "Make one for me": a random mix that still looks right (light backgrounds most of the time). */
export function randomStyle(prev?: SiteStyle): SiteStyle {
  for (let i = 0; i < 6; i++) {
    const s: SiteStyle = {
      font: pickOne(FONT_PAIRS).id,
      accent: pickOne(ACCENTS).id,
      bg: pickOne(["", "", "white", "cream", "soft", "night"]),
      corners: pickOne(["square", "square", "soft"]),
      button: pickOne(["solid", "solid", "outline", "line"]),
      heading: pickOne(["", "normal", "caps"]),
      logo: pickOne(["center", "center", "left"]),
      logoSize: prev?.logoSize,
    };
    const bg = BACKGROUNDS.find(b => b.id === s.bg)?.vars["--bg"] ?? "#FFFFFF";
    // The accent must stand out from the background (buttons and lines).
    if (contrast(accentHex(s)!, bg) < 2.2) continue;
    if (JSON.stringify(s) !== JSON.stringify(prev)) return Object.fromEntries(Object.entries(s).filter(([, v]) => v)) as SiteStyle;
  }
  return { font: "classic", accent: "ink", corners: "square", button: "solid", logo: "center" };
}
