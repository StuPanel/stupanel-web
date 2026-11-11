/**
 * Extras — paid add-ons a studio sells on top of a package (extra photographer, drone, album…).
 * Saved in the service catalog (/service-catalog); set in Packages → Extras, picked in quotes and invoices.
 */
import { Aperture, BookOpen, Camera, Clapperboard, Package, Plane, Printer, Sparkles, Video, type LucideIcon } from "lucide-react";
import type { TileColor } from "@/components/ui/apple";

export type Extra = {
  id: string; name: string; description?: string | null; category?: string | null;
  unit: string; defaultPrice: number | string; currency: string; isActive: boolean; sortOrder: number;
};

export const EXTRA_CATEGORIES = ["Photography", "Cinematography", "Drone", "Editing", "Album", "Printing", "Other"] as const;

/** How it is counted. `days` = it can be tied to the program's days (price × days picked). */
export const EXTRA_UNITS: { id: string; label: string; days?: boolean }[] = [
  { id: "day", label: "per day", days: true },
  { id: "service", label: "per program" },
  { id: "hour", label: "per hour" },
  { id: "piece", label: "per piece" },
  { id: "album", label: "per album" },
  { id: "copy", label: "per copy" },
  { id: "session", label: "per session" },
  { id: "item", label: "per item" },
];
export const unitLabel = (u?: string | null) => EXTRA_UNITS.find(x => x.id === u)?.label ?? (u ? `per ${u}` : "");
export const countsDays = (u?: string | null) => !!EXTRA_UNITS.find(x => x.id === u)?.days;

/** Ready ideas for an empty list — the studio sets the price. */
export const EXTRA_IDEAS: { name: string; category: string; unit: string; description?: string }[] = [
  { name: "Extra photographer", category: "Photography", unit: "day" },
  { name: "Extra cinematographer", category: "Cinematography", unit: "day" },
  { name: "Drone", category: "Drone", unit: "day", description: "Aerial photos and video" },
  { name: "Photo album", category: "Album", unit: "album" },
  { name: "Same-day edit", category: "Editing", unit: "service", description: "A short film shown on the day" },
  { name: "Extra edited photos", category: "Editing", unit: "piece" },
  { name: "Printed photos", category: "Printing", unit: "copy" },
];

const LOOK: Record<string, { icon: LucideIcon; color: TileColor }> = {
  Photography: { icon: Camera, color: "blue" },
  Cinematography: { icon: Video, color: "violet" },
  Drone: { icon: Plane, color: "teal" },
  Editing: { icon: Clapperboard, color: "deep" },
  Album: { icon: BookOpen, color: "orchid" },
  Printing: { icon: Printer, color: "red" },
  Other: { icon: Sparkles, color: "ink" },
};
export const extraLook = (category?: string | null) =>
  LOOK[category ?? ""] ?? { icon: category ? Aperture : Package, color: "ink" as TileColor };
