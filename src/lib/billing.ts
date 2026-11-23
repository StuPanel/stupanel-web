/**
 * Plan & billing: shared types and small helpers for the billing page, the checkout and the
 * "trial / plan has ended" screen.
 */
import { fmtMoney } from "@/lib/format";
import type { BillingAccess } from "@/components/billing/billing-banner";

export type Interval = "monthly" | "yearly";
export type Method = "bkash" | "nagad" | "rocket";

export interface Plan {
  id: string; name: string; slug: string; description: string | null; tagline: string | null; isPopular: boolean;
  priceMonthly: number; priceYearly: number; currency: string;
  maxClients: number; maxTeamMembers: number; maxStorageGb: number; maxBookingsPerMonth: number;
  features?: { featureKey: string; featureLabel: string; featureValue: string | null }[];
}
export interface Account { method: Method; number: string }
export interface PayRequest {
  id: string; number: string; state: "pending" | "approved" | "rejected"; amount: number; currency: string;
  method: Method; trxId: string; senderNumber: string | null; planName: string | null; interval: Interval | null;
  rejectReason: string | null; submittedAt: string; approvedAt: string | null; periodEnd: string | null;
}
export type Use = { used: number; max: number | null };
export interface BillingStatus {
  status: string; plan: { id: string; name: string; slug?: string } | null; interval: Interval | null;
  access: BillingAccess; pendingRequest: PayRequest | null; history: PayRequest[];
  /** Win-back offer: percent off the first monthly payment, until a date. */
  offer?: { percent: number; until: string } | null;
  usage?: { planName: string | null; trial: boolean; clients: Use; programsThisMonth: Use; team: Use };
  made?: { clients: number; programs: number; quotes: number; payments: number; paid: number; galleries: number };
}
export interface TrialState { canExtend: boolean; extendedAt: string | null; extendDays: number }

export const METHOD_LABEL: Record<Method, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };
export const METHOD_COLOR: Record<Method, string> = { bkash: "#E2136E", nagad: "#EC1C24", rocket: "#8C3494" };

export const money = (n: number, cur = "BDT") => fmtMoney(n, cur);
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Unlimited is stored as 9999 (or 0). */
export const unlimited = (n: number) => !n || n >= 9999;
export const limitText = (n: number, what: string) => (unlimited(n) ? `Unlimited ${what}` : `${n.toLocaleString("en-US")} ${what}`);

/** The price for a plan and length; the win-back offer takes its percent off the first monthly payment (the server does the same). */
export function priceOf(p: Plan, iv: Interval, offer?: { percent: number } | null) {
  if (iv === "yearly") return p.priceYearly;
  return offer ? Math.round((p.priceMonthly * (100 - offer.percent)) / 100) : p.priceMonthly;
}
/** How much a year costs less than 12 months, in % (0 when it doesn't). */
export const yearlySavePercent = (p: Plan) => (p.priceMonthly > 0 ? Math.max(0, Math.round((1 - p.priceYearly / (p.priceMonthly * 12)) * 100)) : 0);

/** The lines every plan card and the checkout summary show. */
export function planLines(p: Plan, n = 6) {
  return [
    limitText(p.maxClients, "clients"),
    `${unlimited(p.maxBookingsPerMonth) ? "Unlimited" : p.maxBookingsPerMonth} programs a month`,
    limitText(p.maxTeamMembers, "team members"),
    ...(p.features ?? []).map(f => f.featureLabel),
  ].slice(0, n);
}

/** Where "Choose <plan>" goes. */
export const checkoutHref = (slug: string, iv: Interval) => `/billing/checkout?plan=${encodeURIComponent(slug)}&cycle=${iv}`;
