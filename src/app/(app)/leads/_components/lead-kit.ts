import { localDateStr } from "@/lib/format";

export type LeadStage = "new" | "contacted" | "quote_sent" | "negotiation" | "booked" | "lost";

export interface LeadActivity { at: string; by?: string; byName?: string; kind: string; text: string }

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  eventType: string | null;
  eventDates: string[];
  venue: string | null;
  budget: string | number | null;
  source: string | null;
  referredBy: string | null;
  stage: LeadStage;
  position: number;
  lostReason: string | null;
  followUpAt: string | null;
  lastContactAt: string | null;
  notes: string | null;
  activity: LeadActivity[];
  clientId: string | null;
  bookingId: string | null;
  quoteId: string | null;
  createdAt: string;
  quote?: { id: string; quoteNumber: string; status: string; grandTotal: string } | null;
  booking?: { id: string; bookingNumber: string; eventName: string | null; grandTotal: string } | null;
}

export interface LeadStats {
  open: number; openValue: number; newThisWeek: number; won: number; lost: number;
  winRate: number | null; followUpsDue: number; overdue: number;
  perStage: Record<string, { count: number; value: number }>;
  sources: { source: string; total: number; won: number }[];
  lostReasons: { reason: string; count: number }[];
}

export const STAGES: { key: LeadStage; label: string; color: string; soft: string }[] = [
  { key: "new", label: "New", color: "#7D5CEF", soft: "#EEE8FD" },
  { key: "contacted", label: "Contacted", color: "#1F5C99", soft: "#E3EEF9" },
  { key: "quote_sent", label: "Quote sent", color: "#9E3A8C", soft: "#F7E6F3" },
  { key: "negotiation", label: "Negotiation", color: "#B4690E", soft: "#FCF0DE" },
  { key: "booked", label: "Booked", color: "#1F8A5B", soft: "#E2F4EA" },
  { key: "lost", label: "Lost", color: "#6B6680", soft: "#EEEBF4" },
];
export const stageOf = (k: string) => STAGES.find(s => s.key === k) ?? STAGES[0];

export const LOST_REASONS = [
  { value: "price", label: "Price too high" },
  { value: "date_taken", label: "Date not free" },
  { value: "other_studio", label: "Chose another studio" },
  { value: "no_reply", label: "Stopped replying" },
  { value: "postponed", label: "Event cancelled / postponed" },
  { value: "other", label: "Other" },
];
export const lostLabel = (v?: string | null) => LOST_REASONS.find(r => r.value === v)?.label ?? (v ? v.replace(/_/g, " ") : "Other");

export const money = (v: unknown) => {
  const n = Number(v);
  return v == null || v === "" || isNaN(n) ? 0 : n;
};

const DAY = 86400000;
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Follow-up badge: overdue / today / tomorrow / a date. */
export function followUpInfo(at: string | null, now = new Date()) {
  if (!at) return null;
  const d = new Date(at);
  if (isNaN(d.getTime())) return null;
  const diff = Math.round((startOf(d).getTime() - startOf(now).getTime()) / DAY);
  if (diff < 0) return { tone: "late" as const, text: diff === -1 ? "Overdue 1 day" : `Overdue ${-diff} days` };
  if (diff === 0) return { tone: "today" as const, text: "Follow up today" };
  if (diff === 1) return { tone: "soon" as const, text: "Tomorrow" };
  return { tone: "later" as const, text: new Intl.DateTimeFormat("en-GB", { weekday: diff < 7 ? "short" : undefined, day: "numeric", month: "short" }).format(d) };
}

export function ago(at: string | null, now = new Date()) {
  if (!at) return null;
  const ms = now.getTime() - new Date(at).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(at));
}

/** "12 Dec" for "2026-12-12". */
export function shortDay(day: string) {
  const d = new Date(`${day}T12:00:00`);
  return isNaN(d.getTime()) ? day : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}
export function longDay(day: string) {
  const d = new Date(`${day}T12:00:00`);
  return isNaN(d.getTime()) ? day : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** Quick follow-up choices → ISO at 10:00 local. */
export function followUpChoices(now = new Date()) {
  const at = (days: number) => {
    const d = startOf(now); d.setDate(d.getDate() + days); d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };
  return [
    { label: "Today", value: at(0) },
    { label: "Tomorrow", value: at(1) },
    { label: "In 3 days", value: at(3) },
    { label: "Next week", value: at(7) },
  ];
}

export const todayStr = () => localDateStr();
