import { Camera, Video, Image, Film, Navigation, Briefcase } from "lucide-react";
export { fmtDate } from "@/lib/format";

export function uid() { return Math.random().toString(36).slice(2, 9); }

export const EVENT_TYPES = [
  "Wedding", "Holud", "Reception", "Engagement", "Akd",
  "Birthday", "Corporate", "Party", "Naming Ceremony", "Other",
];

export const STATUS_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  inquiry:            { label: "Inquiry",       badge: "bg-[#FDECEF] text-[#C2304F]",     dot: "bg-[#C2304F]" },
  quote_sent:         { label: "Quote Sent",     badge: "bg-[#FBF2FA] text-[#9E3A8C]",       dot: "bg-[#9E3A8C]" },
  confirmed:          { label: "Confirmed",      badge: "bg-[#EEE8FD] text-[#5B3FD0]",   dot: "bg-[#7D5CEF]" },
  advance_received:   { label: "Advance Rcvd",   badge: "bg-[#EEE8FD] text-[#5B3FD0]",   dot: "bg-[#5B3FD0]" },
  in_progress:        { label: "Shooting",       badge: "bg-[#E0F2F1] text-[#126B66]",     dot: "bg-[#126B66]" },
  editing:            { label: "Editing",        badge: "bg-[#E6F0FB] text-[#1F5C99]",   dot: "bg-[#1F5C99]" },
  ready_for_delivery: { label: "Ready",          badge: "bg-[#7D5CEF] text-white",       dot: "bg-[#7D5CEF]" },
  delivered:          { label: "Delivered",      badge: "bg-[#EEEDF2] text-[#4A4658]",       dot: "bg-[#4A4658]" },
  completed:          { label: "Completed",      badge: "bg-[#EEEDF2] text-[#4A4658]", dot: "bg-[#1F8A5B]" },
  cancelled:          { label: "Cancelled",      badge: "bg-[#F3E3E3] text-[#8A2E2E]",         dot: "bg-[#8A2E2E]" },
  refunded:           { label: "Refunded",       badge: "bg-[#F3E3E3] text-[#8A2E2E]",       dot: "bg-[#8A2E2E]" },
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
