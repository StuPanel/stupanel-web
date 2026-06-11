import { Clock, Send, CheckCircle2, FileImage, FileVideo, FileArchive, File } from "lucide-react";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

export function daysFromNow(d: string | Date): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return FileArchive;
  return File;
}

export const DEL_STATUS: Record<string, { label: string; badge: string; dot: string; icon: typeof Clock }> = {
  confirmed:          { label: "Not Started",  badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-300",   icon: Clock },
  advance_received:   { label: "Not Started",  badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-300",   icon: Clock },
  in_progress:        { label: "Shooting",     badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-400",   icon: Clock },
  editing:            { label: "Editing",      badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400",  icon: Clock },
  ready_for_delivery: { label: "Ready",        badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500",  icon: Send  },
  delivered:          { label: "Delivered",    badge: "bg-teal-100 text-teal-700",     dot: "bg-teal-500",    icon: CheckCircle2 },
  completed:          { label: "Completed",    badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
};

export const FILTER_TABS = [
  { key: "all",              label: "All" },
  { key: "editing",          label: "Editing" },
  { key: "ready_for_delivery", label: "Ready" },
  { key: "delivered",        label: "Delivered" },
  { key: "completed",        label: "Completed" },
];

export const DELIVERY_STATUSES = [
  { value: "editing", label: "Editing" },
  { value: "ready_for_delivery", label: "Ready for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
];
