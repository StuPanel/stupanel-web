/**
 * Package helpers shared by the Packages page and the quote form:
 * the package shape and its "what you get" lines.
 */
import { TEAM_ROLES } from "../../team/_components/rate-card";

export interface StaffingLine { role: string; level?: string; count: number; }

export interface Pkg {
  id: string; name: string; description?: string; category?: string;
  basePrice: number; currency: string; priceIsNegotiable: boolean;
  durationHours?: number; durationDays?: number; durationUnit?: "hours" | "days";
  deliveryDays?: number; deliverablesDescription?: string;
  eventTypesIncluded?: string[]; staffing?: StaffingLine[];
  photoEditCount?: number; trailerCount?: number; fullVideoCount?: number;
  ritualsIncluded?: string[]; deliveryMethod?: string;
  isActive: boolean; isVisibleInPortal: boolean; sortOrder: number;
}

export const DELIVERY_METHODS = [
  { value: "google_drive", label: "Online (Google Drive)" },
  { value: "pendrive", label: "USB drive" },
  { value: "both", label: "Online + USB drive" },
  { value: "other", label: "Other" },
];
export const DELIVERY_LABELS: Record<string, string> = Object.fromEntries(DELIVERY_METHODS.map(d => [d.value, d.value === "other" ? "Custom delivery" : d.label]));

/** Old packages saved day keys like "pre_wedding"; show them readable. */
export const dayLabel = (v: string) => (/^[a-z_]+$/.test(v) ? v.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ") : v);
export const roleLabel = (r: string) => TEAM_ROLES.find(x => x.id === r)?.label ?? r;
/** Levels were dropped (the team has none); old ones still show. */
export const LEVEL_LABELS: Record<string, string> = { junior: "Junior", associate: "Associate", senior: "Senior", lead: "Lead", top_senior: "Top Senior" };

/** "What you get" lines — shared by the card and the drawer preview. */
export function summaryLines(p: Partial<Pkg>): string[] {
  const lines: string[] = [];
  (p.staffing ?? []).forEach(s => {
    const level = s.level ? `${LEVEL_LABELS[s.level] ?? s.level} ` : "";
    lines.push(`${s.count} ${level}${roleLabel(s.role)}${s.count > 1 ? "s" : ""}`);
  });
  if (p.durationUnit === "days" && p.durationDays) lines.push(`${p.durationDays} day${p.durationDays > 1 ? "s" : ""} coverage`);
  else if (p.durationHours) lines.push(`${p.durationHours} hours coverage`);
  if (p.photoEditCount) lines.push(`${p.photoEditCount} edited photo${p.photoEditCount > 1 ? "s" : ""}`);
  if (p.trailerCount || p.fullVideoCount) {
    lines.push([
      p.trailerCount ? `${p.trailerCount} trailer${p.trailerCount > 1 ? "s" : ""}` : null,
      p.fullVideoCount ? `${p.fullVideoCount} full video${p.fullVideoCount > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" + "));
  }
  if (p.ritualsIncluded?.length) lines.push(`Also: ${p.ritualsIncluded.join(", ")}`);
  if (p.deliveryMethod) lines.push(`Delivered via ${DELIVERY_LABELS[p.deliveryMethod] ?? p.deliveryMethod}`);
  return lines;
}

