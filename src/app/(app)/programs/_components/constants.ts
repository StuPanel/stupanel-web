import { Camera, Video, Image, Film, Navigation, Briefcase } from "lucide-react";
export { fmtDate } from "@/lib/format";

export function uid() { return Math.random().toString(36).slice(2, 9); }

export const EVENT_TYPES = [
  "Wedding", "Holud", "Reception", "Engagement", "Pre-wedding",
  "Birthday", "Corporate", "Party", "Portrait", "Other",
];

export const STATUS_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  inquiry:            { label: "Inquiry",       badge: "bg-[#FDECEF] text-[#C2304F]",     dot: "bg-[#C2304F]" },
  quote_sent:         { label: "Quote Sent",     badge: "bg-[#FBF2FA] text-[#9E3A8C]",       dot: "bg-[#9E3A8C]" },
  confirmed:          { label: "Confirmed",      badge: "bg-[#EEE8FD] text-[#5B3FD0]",   dot: "bg-[#7D5CEF]" },
  // Old: money is shown as a badge now (moneyState); kept so an old row still reads right.
  advance_received:   { label: "Confirmed",      badge: "bg-[#EEE8FD] text-[#5B3FD0]",   dot: "bg-[#7D5CEF]" },
  in_progress:        { label: "Shooting",       badge: "bg-[#E0F2F1] text-[#126B66]",     dot: "bg-[#126B66]" },
  editing:            { label: "Editing",        badge: "bg-[#E6F0FB] text-[#1F5C99]",   dot: "bg-[#1F5C99]" },
  ready_for_delivery: { label: "Ready",          badge: "bg-[#7D5CEF] text-white",       dot: "bg-[#7D5CEF]" },
  delivered:          { label: "Delivered",      badge: "bg-[#EEEDF2] text-[#4A4658]",       dot: "bg-[#4A4658]" },
  completed:          { label: "Completed",      badge: "bg-[#EEEDF2] text-[#4A4658]", dot: "bg-[#1F8A5B]" },
  cancelled:          { label: "Cancelled",      badge: "bg-[#F3E3E3] text-[#8A2E2E]",         dot: "bg-[#8A2E2E]" },
  refunded:           { label: "Cancelled",      badge: "bg-[#F3E3E3] text-[#8A2E2E]",       dot: "bg-[#8A2E2E]" },
};

/** The steps of a program. Money is not a step: see moneyState. */
export const STATUS_PIPELINE = [
  "inquiry", "quote_sent", "confirmed", "in_progress",
  "editing", "ready_for_delivery", "delivered", "completed",
];

/** Old statuses read as the new ones. */
export const normalStatus = (s: string) => (s === "advance_received" ? "confirmed" : s === "refunded" ? "cancelled" : s);

export type MoneyTone = "green" | "amber" | "red" | "gray";
export const MONEY_TONE: Record<MoneyTone, string> = {
  green: "bg-[#E7F5EE] text-[#1F7A50]", amber: "bg-[#FDF3E1] text-[#8A5A00]", red: "bg-[#FDECEF] text-[#B42347]", gray: "bg-[#F1EFF6] text-[#5E5970]",
};
/** The money next to the status: No advance · ৳X paid · Fully paid · Refunded · ৳X kept. */
export function moneyState(b: { status: string; grandTotal: number | string; paidAmount: number | string; payments?: { amount: number | string; paymentStatus?: string }[] }, fmt: (n: number) => string): { label: string; tone: MoneyTone } | null {
  const s = normalStatus(b.status), total = Number(b.grandTotal) || 0, paid = Number(b.paidAmount) || 0;
  if (s === "cancelled") {
    if (paid > 0.009) return { label: `${fmt(paid)} kept`, tone: "gray" };
    return (b.payments ?? []).some(p => p.paymentStatus === "refunded" || p.paymentStatus === "partially_refunded") ? { label: "Refunded", tone: "gray" } : null;
  }
  if (s === "inquiry" || s === "quote_sent") return paid > 0.009 ? { label: `${fmt(paid)} paid`, tone: "green" } : null;
  if (total > 0 && paid >= total - 0.009) return { label: "Fully paid", tone: "green" };
  if (paid > 0.009) return { label: `${fmt(paid)} paid`, tone: "amber" };
  return total > 0 ? { label: "No advance", tone: "red" } : null;
}

export const ROLE_ICONS: Record<string, { icon: typeof Camera; color: string }> = {
  photographer:    { icon: Camera,      color: "text-blue-600" },
  cinematographer: { icon: Video,       color: "text-violet-600" },
  photo_editor:   { icon: Image,       color: "text-emerald-600" },
  video_editor:   { icon: Film,        color: "text-orange-600" },
  drone_pilot:    { icon: Navigation,  color: "text-sky-600" },
  assistant:      { icon: Briefcase,   color: "text-slate-600" },
};

export const ROLE_LABELS: Record<string, string> = {
  photographer: "Photographer",
  cinematographer: "Cinematographer",
  drone_pilot: "Drone Pilot",
  assistant: "Assistant",
  photo_editor: "Photo Editor",
  video_editor: "Video Editor",
  other: "Other",
};

// Display order for the shoot-day member picker
export const SHOOT_ROLE_ORDER = ["photographer", "cinematographer", "drone_pilot", "assistant"];
// Display order for the editing assignment picker
export const EDITOR_ROLE_ORDER = ["photo_editor", "video_editor"];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Card" },
  { value: "other", label: "Other" },
];
