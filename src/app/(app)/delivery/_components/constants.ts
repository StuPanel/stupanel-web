import { Clock, Send, CheckCircle2, FileImage, FileVideo, FileArchive, File } from "lucide-react";
export { fmtDate } from "@/lib/format";

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
  confirmed:          { label: "Not Started",  badge: "bg-[#EEE8FD] text-[#5B3FD0]",   dot: "bg-[#7D5CEF]",   icon: Clock },
  advance_received:   { label: "Not Started",  badge: "bg-[#EEE8FD] text-[#5B3FD0]",   dot: "bg-[#5B3FD0]",   icon: Clock },
  in_progress:        { label: "Shooting",     badge: "bg-[#E0F2F1] text-[#126B66]",   dot: "bg-[#126B66]",   icon: Clock },
  editing:            { label: "Editing",      badge: "bg-[#E6F0FB] text-[#1F5C99]", dot: "bg-[#1F5C99]",  icon: Clock },
  ready_for_delivery: { label: "Ready",        badge: "bg-[#7D5CEF] text-white", dot: "bg-[#7D5CEF]",  icon: Send  },
  delivered:          { label: "Delivered",    badge: "bg-[#EEEDF2] text-[#4A4658]",     dot: "bg-[#4A4658]",    icon: CheckCircle2 },
  completed:          { label: "Completed",    badge: "bg-[#EEEDF2] text-[#4A4658]", dot: "bg-[#1F8A5B]", icon: CheckCircle2 },
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
