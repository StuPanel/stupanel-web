/**
 * Contracts — shared shapes and small helpers (studio pages and the client's signing page).
 * A contract = details (days, package, fees) + sections of text. Section text can hold fields
 * like {client} or {total}; `fillText` swaps them for the real values when the page is shown.
 */
import { fmtMoney } from "@/lib/format";

export interface ContractSection { title: string; text: string }
export interface ContractEvent { name: string; date: string | null; venue: string }
export interface ContractDetails {
  events: ContractEvent[]; packageName: string; total: number; advance: number;
  balanceDue: string; deliveryDays: number; currency: string; showFees: boolean;
}
export interface ContractStudio { name: string; email?: string | null; phone?: string | null; address?: string | null; logoUrl?: string | null }
export interface ContractSignature { name: string | null; kind: "drawn" | "typed" | null; image: string | null; signedAt: string | null; device?: string | null }
export interface ContractTemplate { id: string; name: string; description?: string | null; category?: string | null; sections: ContractSection[] }
export type ContractStatus = "draft" | "sent" | "viewed" | "signed";
export interface ContractRow {
  id: string; contractNumber: string; title: string; status: ContractStatus; publicToken: string; bookingId: string | null; clientId: string;
  details: ContractDetails; sentAt: string | null; viewedAt: string | null; lastViewedAt: string | null; viewCount: number;
  signedAt: string | null; signerName: string | null; createdAt: string; updatedAt: string;
  /** Last time the studio reminded the client to sign */
  lastRemindedAt?: string | null;
  /** Sent a few days ago (or since the last reminder) and still not signed */
  needsReminder?: boolean;
  client: { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null };
  booking: { id: string; bookingNumber: string; eventName: string | null; eventDate: string | null } | null;
}

export const EMPTY_DETAILS: ContractDetails = { events: [], packageName: "", total: 0, advance: 0, balanceDue: "event_day", deliveryDays: 30, currency: "", showFees: true };

export const STATUS_META: Record<ContractStatus, { label: string; cls: string; dot: string; hint: string }> = {
  draft: { label: "Draft", cls: "bg-[#F1EFF6] text-[#4A4658]", dot: "#9893A8", hint: "Not sent yet" },
  sent: { label: "Sent", cls: "bg-[#E8F0FA] text-[#1F5C99]", dot: "#1F5C99", hint: "Waiting for the client to open it" },
  viewed: { label: "Opened", cls: "bg-[#F7E9F4] text-[#9E3A8C]", dot: "#9E3A8C", hint: "The client opened it, not signed yet" },
  signed: { label: "Signed", cls: "bg-[#E7F5EE] text-[#1F8A5B]", dot: "#1F8A5B", hint: "Signed by the client" },
};

export const BALANCE_OPTIONS = [
  { value: "event_day", label: "On the event day" },
  { value: "before_event", label: "Before the first event" },
  { value: "on_delivery", label: "On delivery" },
  { value: "before_delivery", label: "Before delivery" },
];
export const balanceLabel = (v: string) => BALANCE_OPTIONS.find(o => o.value === v)?.label ?? v;

/** Fields a studio can drop into the text. */
export const FIELDS: { key: string; label: string }[] = [
  { key: "client", label: "Client name" }, { key: "studio", label: "Studio name" }, { key: "package", label: "Package" },
  { key: "total", label: "Total" }, { key: "advance", label: "Advance" }, { key: "balance", label: "Balance" },
  { key: "delivery_days", label: "Delivery days" }, { key: "first_date", label: "First event date" }, { key: "today", label: "Today's date" },
];

export const fmtDay = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
export const fmtDayTime = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
};

/** The values behind each field. Empty ones show as a soft placeholder like "[Client name]". */
export function fieldValues(d: ContractDetails, studioName: string, clientName: string, madeOn?: string | null): Record<string, string> {
  const first = d.events.map(e => e.date).filter(Boolean).sort()[0];
  return {
    client: clientName, studio: studioName, package: d.packageName,
    total: d.total > 0 ? fmtMoney(d.total, d.currency || undefined) : "",
    advance: d.advance > 0 ? fmtMoney(d.advance, d.currency || undefined) : "",
    balance: d.total > 0 ? fmtMoney(Math.max(0, d.total - d.advance), d.currency || undefined) : "",
    delivery_days: String(d.deliveryDays || 30), first_date: fmtDay(first), today: fmtDay(madeOn ?? new Date().toISOString()),
  };
}

/** Split a text into plain parts and filled fields (so the page can style missing ones). */
export function fillText(text: string, values: Record<string, string>): { text: string; missing?: boolean }[] {
  const out: { text: string; missing?: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    if (!(m[1] in values)) continue;
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    const v = values[m[1]];
    out.push(v ? { text: v } : { text: `[${FIELDS.find(f => f.key === m[1])?.label ?? m[1]}]`, missing: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export const clientFull = (c?: { firstName?: string | null; lastName?: string | null } | null) => [c?.firstName, c?.lastName].filter(Boolean).join(" ");
export const contractLink = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/c/${token}`;

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function ago(iso?: string | null, now = Date.now()) {
  if (!iso) return "";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (isNaN(s)) return "";
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) { const d = Math.floor(s / 86400); return `${d} day${d === 1 ? "" : "s"} ago`; }
  return `on ${fmtDay(iso)}`;
}
