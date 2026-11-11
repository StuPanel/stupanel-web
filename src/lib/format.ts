// Shared formatting utilities — single source of truth for currency and dates.

const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: "৳",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

/** Currencies a studio can work in (Settings, packages…). */
export const CURRENCY_OPTIONS = [
  { value: "BDT", label: "৳ BDT — Taka" },
  { value: "USD", label: "$ USD — US Dollar" },
  { value: "INR", label: "₹ INR — Indian Rupee" },
  { value: "GBP", label: "£ GBP — British Pound" },
  { value: "EUR", label: "€ EUR — Euro" },
  { value: "AED", label: "AED — UAE Dirham" },
];

/**
 * The signed-in studio's currency (Settings → General → Currency).
 * Set by AuthProvider once the studio loads; money shown without its own currency uses it.
 */
let studioCurrency = "BDT";
export function setStudioCurrency(c: string | null | undefined) { studioCurrency = c || "BDT"; }
export function getStudioCurrency() { return studioCurrency; }

/** "৳", "$", "€"… or "AED " for currencies without a symbol. */
export function currencySymbol(currency = studioCurrency): string {
  return CURRENCY_SYMBOLS[currency] ?? currency + " ";
}

/** Taka and rupee use 1,00,000 grouping; everything else 100,000. */
function groupLocale(currency: string) { return currency === "BDT" || currency === "INR" ? "en-IN" : "en-US"; }

/** Whole amount with the studio's currency, e.g. "৳12,500" or "$12,500". */
export function fmtMoney(amount: number | string | null | undefined, currency = studioCurrency): string {
  const n = Number(amount);
  if (amount == null || amount === "" || isNaN(n)) return "—";
  return currencySymbol(currency) + Math.round(n).toLocaleString(groupLocale(currency));
}

/** Short amount: lakh for taka/rupee (৳1.5L), K / M for others ($12K, $1.2M). */
export function fmtMoneyShort(amount: number, currency = studioCurrency): string {
  const s = currencySymbol(currency);
  const n = Math.round(amount);
  if (currency === "BDT" || currency === "INR") {
    if (n >= 100000) return `${s}${(n / 100000).toFixed(n >= 1000000 ? 0 : 1).replace(/\.0$/, "")}L`;
  } else if (n >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${s}${Math.round(n / 1000)}K`;
  return fmtMoney(n, currency);
}

/**
 * Format a monetary amount with the correct currency symbol.
 * Supports BDT, USD, EUR, GBP, INR. Falls back to the currency code for others.
 */
export function formatCurrency(amount: number | string | null | undefined, currency = studioCurrency): string {
  const num = Number(amount);
  if (isNaN(num)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  return symbol + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Compact currency format for dashboard stats (e.g. $12.5K, $1.2M).
 * Uses K / M for thousands / millions — internationally standard.
 */
export function formatCurrencyCompact(amount: number | string | null | undefined, currency = studioCurrency): string {
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

/**
 * "YYYY-MM-DD" in the viewer's own time zone (for <input type="date"> defaults
 * and date filters). `toISOString()` uses UTC, which in Bangladesh gives
 * yesterday's date between midnight and 6 AM.
 */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Left padding for a money box with the currency sign inside it (wider for codes like "AED"). */
export function currencyPad(currency = studioCurrency): string | undefined {
  return currencySymbol(currency).trim().length > 1 ? "3.25rem" : undefined;
}
