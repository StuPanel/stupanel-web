import { Camera, Video, Image, Film, Navigation, Briefcase } from "lucide-react";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export function fmtDate(d: string | Date | undefined | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dd}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

export function uid() { return Math.random().toString(36).slice(2, 9); }

export const EVENT_TYPES = [
  "Wedding", "Holud", "Reception", "Engagement", "Akd",
  "Birthday", "Corporate", "Party", "Naming Ceremony", "Other",
];

export const STATUS_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  inquiry:            { label: "Inquiry",       badge: "bg-slate-100 text-slate-600",     dot: "bg-slate-400" },
  quote_sent:         { label: "Quote Sent",     badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-400" },
  confirmed:          { label: "Confirmed",      badge: "bg-indigo-100 text-indigo-700",   dot: "bg-indigo-500" },
  advance_received:   { label: "Advance Rcvd",   badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-500" },
  in_progress:        { label: "Shooting",       badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  editing:            { label: "Editing",        badge: "bg-orange-100 text-orange-700",   dot: "bg-orange-400" },
  ready_for_delivery: { label: "Ready",          badge: "bg-cyan-100 text-cyan-700",       dot: "bg-cyan-500" },
  delivered:          { label: "Delivered",      badge: "bg-teal-100 text-teal-700",       dot: "bg-teal-500" },
  completed:          { label: "Completed",      badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  cancelled:          { label: "Cancelled",      badge: "bg-red-100 text-red-600",         dot: "bg-red-400" },
  refunded:           { label: "Refunded",       badge: "bg-rose-100 text-rose-600",       dot: "bg-rose-400" },
};

export const STATUS_PIPELINE = [
  "inquiry", "confirmed", "advance_received", "in_progress",
  "editing", "ready_for_delivery", "delivered", "completed",
];

export const ROLE_ICONS: Record<string, { icon: typeof Camera; color: string }> = {
  photographer:    { icon: Camera,      color: "text-blue-600" },
  cinematographer: { icon: Video,       color: "text-violet-600" },
  photo_editor:   { icon: Image,       color: "text-emerald-600" },
  video_editor:   { icon: Film,        color: "text-orange-600" },
  drone_pilot:    { icon: Navigation,  color: "text-sky-600" },
  assistant:      { icon: Briefcase,   color: "text-slate-600" },
};

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_banking", label: "bKash / Nagad" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Card" },
  { value: "other", label: "Other" },
];
