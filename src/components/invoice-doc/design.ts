/**
 * Invoice designer choices — mirrors the API's normalizeDesign (studio-invoices/invoice-design.ts).
 */
export type TemplateId = "twotone" | "bold" | "minimal" | "botanical";
export type FontId = "modern" | "elegant" | "bold" | "classic" | "clean" | "friendly" | "editorial" | "mono";
export type PaperId = "a4" | "a5" | "letter" | "pos80";
export type LogoPos = "left" | "center" | "right" | "title";
export type SectionKey = "client" | "eventDays" | "items" | "totals" | "payments" | "paymentInfo" | "terms" | "note" | "signature" | "thanks" | "footer";

export interface InvoiceDesign {
  template: TemplateId;
  primary: string | null;
  secondary: string | null;
  font: FontId;
  logo: { position: LogoPos; size: number; showName: boolean };
  sections: { key: SectionKey; on: boolean }[];
  columns: { no: boolean; qty: boolean; rate: boolean };
  signature: { imageUrl: string | null; name: string; title: string; handwritten: boolean };
  paper: PaperId;
  vat: { on: boolean; percent: number; label: string };
  thanksText: string;
  footerText: string;
}

export const SECTION_LABEL: Record<SectionKey, string> = {
  client: "Client details",
  eventDays: "Event days & places",
  items: "Items table",
  totals: "Totals (discount, VAT)",
  payments: "Payments received",
  paymentInfo: "How to pay (bank, bKash…)",
  terms: "Terms & conditions",
  note: "Note",
  signature: "Signature",
  thanks: "Thank-you line",
  footer: "Footer (phone, email, website)",
};

export const TEMPLATES: { id: TemplateId; name: string; sub: string; primary: string; secondary: string }[] = [
  { id: "twotone", name: "Two-tone", sub: "Colour bars top and bottom", primary: "#1F3A5F", secondary: "#E3A93B" },
  { id: "bold", name: "Bold", sub: "Dark header, big total bar", primary: "#141217", secondary: "#F2C94C" },
  { id: "minimal", name: "Minimal", sub: "Soft band, lots of white", primary: "#2D2A32", secondary: "#EFEAF5" },
  { id: "botanical", name: "Botanical", sub: "Soft paper, leaf corners", primary: "#3E6B4E", secondary: "#F6F1E7" },
];

/** Heading + text font pairs. `bn` keeps Bangla names readable. */
export const FONTS: { id: FontId; name: string; head: string; body: string; headWeight: number }[] = [
  { id: "modern", name: "Modern", head: "Plus Jakarta Sans", body: "Inter", headWeight: 800 },
  { id: "elegant", name: "Elegant", head: "Playfair Display", body: "Lato", headWeight: 700 },
  { id: "bold", name: "Bold", head: "Archivo Black", body: "Archivo", headWeight: 400 },
  { id: "classic", name: "Classic", head: "Libre Baskerville", body: "Source Sans 3", headWeight: 700 },
  { id: "clean", name: "Clean", head: "Manrope", body: "Manrope", headWeight: 800 },
  { id: "friendly", name: "Friendly", head: "Nunito", body: "Nunito", headWeight: 800 },
  { id: "editorial", name: "Editorial", head: "Cormorant Garamond", body: "Montserrat", headWeight: 700 },
  { id: "mono", name: "Studio", head: "Space Grotesk", body: "IBM Plex Sans", headWeight: 700 },
];
export const HAND_FONT = "Great Vibes";
export const BN_FONT = "Hind Siliguri";

export function fontHref(ids: FontId[]) {
  const fams = new Set<string>([HAND_FONT, BN_FONT]);
  for (const id of ids) {
    const f = FONTS.find(x => x.id === id) ?? FONTS[0];
    fams.add(f.head); fams.add(f.body);
  }
  const q = [...fams].map(f => {
    const n = f.replace(/ /g, "+");
    if (f === HAND_FONT || f === "Archivo Black") return `family=${n}`;
    if (f === BN_FONT) return `family=${n}:wght@400;600;700`;
    return `family=${n}:wght@400;500;600;700;800`;
  }).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/** Paper width / min height in CSS px at 96 dpi. */
export const PAPER: Record<PaperId, { name: string; w: number; h: number | null; pad: number; mm: string }> = {
  a4: { name: "A4", w: 794, h: 1123, pad: 48, mm: "210mm 297mm" },
  a5: { name: "A5", w: 559, h: 794, pad: 30, mm: "148mm 210mm" },
  letter: { name: "Letter", w: 816, h: 1056, pad: 48, mm: "8.5in 11in" },
  pos80: { name: "POS 80mm", w: 302, h: null, pad: 14, mm: "80mm auto" },
};

export const ALL_SECTIONS: SectionKey[] = ["client", "eventDays", "items", "totals", "payments", "paymentInfo", "terms", "note", "signature", "thanks", "footer"];

export const DEFAULT_DESIGN: InvoiceDesign = {
  template: "twotone",
  primary: null,
  secondary: null,
  font: "modern",
  logo: { position: "left", size: 64, showName: true },
  sections: ALL_SECTIONS.map(key => ({ key, on: true })),
  columns: { no: true, qty: true, rate: true },
  signature: { imageUrl: null, name: "", title: "", handwritten: true },
  paper: "a4",
  vat: { on: false, percent: 5, label: "VAT" },
  thanksText: "Thank you for choosing us!",
  footerText: "",
};

/** Fill gaps from the defaults (the API already cleans what it stores). */
export function withDefaults(d?: Partial<InvoiceDesign> | null): InvoiceDesign {
  const x = d ?? {};
  const seen = new Set<string>();
  const sections = [...(x.sections ?? []).filter(s => ALL_SECTIONS.includes(s.key) && !seen.has(s.key) && seen.add(s.key))];
  for (const k of ALL_SECTIONS) if (!seen.has(k)) sections.push({ key: k, on: true });
  return {
    ...DEFAULT_DESIGN, ...x,
    logo: { ...DEFAULT_DESIGN.logo, ...(x.logo ?? {}) },
    columns: { ...DEFAULT_DESIGN.columns, ...(x.columns ?? {}) },
    signature: { ...DEFAULT_DESIGN.signature, ...(x.signature ?? {}) },
    vat: { ...DEFAULT_DESIGN.vat, ...(x.vat ?? {}) },
    sections,
  };
}

export function colorsOf(d: InvoiceDesign) {
  const t = TEMPLATES.find(x => x.id === d.template) ?? TEMPLATES[0];
  return { primary: d.primary ?? t.primary, secondary: d.secondary ?? t.secondary };
}
