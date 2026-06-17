// Shared formatting utilities — single source of truth for currency and dates.

const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: "৳",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

/**
 * Format a monetary amount with the correct currency symbol.
 * Supports BDT, USD, EUR, GBP, INR. Falls back to the currency code for others.
 */
export function formatCurrency(amount: number | string | null | undefined, currency = "BDT"): string {
  const num = Number(amount);
  if (isNaN(num)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  return symbol + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Compact currency format for dashboard stats (e.g. $12.5K, $1.2M).
 * Uses K / M for thousands / millions — internationally standard.
 */
export function formatCurrencyCompact(amount: number | string | null | undefined, currency = "BDT"): string {
  const num = Number(amount);
  if (isNaN(num)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  if (num >= 1_000_000) return symbol + (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return symbol + (num / 1_000).toFixed(1) + "K";
  return symbol + num.toLocaleString("en-US");
}

/**
 * Format a date as "DD-MON-YYYY" (e.g. "10-JUN-2026").
 * Single source of truth — replaces all inline MONTHS array implementations.
 */
export function fmtDate(d: string | Date | undefined | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(dt);
  const day   = parts.find(p => p.type === "day")?.value ?? "";
  const month = (parts.find(p => p.type === "month")?.value ?? "").toUpperCase();
  const year  = parts.find(p => p.type === "year")?.value ?? "";
  return `${day}-${month}-${year}`;
}

/**
 * Format a date for display in month-year context (e.g. "Jun 2026").
 */
export function fmtMonthYear(d: string | Date | undefined | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(dt);
}
