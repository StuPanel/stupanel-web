/** What a team member sets for themselves (API: users.memberPrefs). Shared by the member panel and the studio. */
import { fmtDate } from "@/lib/format";

export type DayOff = { id: string; from: string; to: string; note?: string };
export type PayoutMethod = "bkash" | "nagad" | "rocket" | "bank" | "cash" | "other";
export type Payout = { method: PayoutMethod; number?: string; accountName?: string; bankName?: string; branch?: string; note?: string; updatedAt?: string };
export type RateRequest = { id: string; message: string; status: "pending" | "done" | "dismissed"; createdAt: string; answeredAt?: string; answer?: string };
export type MemberPrefs = { daysOff: DayOff[]; payout: Payout | null; rateRequests: RateRequest[] };

export const PAYOUT_METHODS: { v: PayoutMethod; l: string; wallet?: boolean }[] = [
  { v: "bkash", l: "bKash", wallet: true }, { v: "nagad", l: "Nagad", wallet: true }, { v: "rocket", l: "Rocket", wallet: true },
  { v: "bank", l: "Bank" }, { v: "cash", l: "Cash" }, { v: "other", l: "Other" },
];
export const payoutLabel = (m?: string) => PAYOUT_METHODS.find(x => x.v === m)?.l ?? "—";

/** "bKash · 017…" / "Bank · DBBL · 1234…" — one line for lists. */
export function payoutLine(p: Payout | null | undefined) {
  if (!p) return "";
  return [payoutLabel(p.method), p.bankName, p.number, p.accountName && p.method === "bank" ? p.accountName : ""].filter(Boolean).join(" · ");
}

export const dayRange = (d: DayOff) => (d.from === d.to ? fmtDate(d.from) : `${fmtDate(d.from)} – ${fmtDate(d.to)}`);

/** Days off that touch any of these dates (YYYY-MM-DD). */
export const offOn = (daysOff: DayOff[] | undefined, dates: string[]) =>
  (daysOff ?? []).filter(d => dates.some(x => x >= d.from && x <= d.to));

export function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
