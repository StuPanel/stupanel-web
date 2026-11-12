/**
 * The WhatsApp payment reminder for one client (all their programs with money due).
 * Studios can change the wording: a WhatsApp template of kind "due_reminder"
 * (Payments → Due → Edit message, or Settings → WhatsApp templates). The fields below
 * fill in by themselves; {{programs}}, {{summary}} and {{howToPay}} are ready-made blocks.
 * WhatsApp formatting: *bold*, _italic_.
 */
import { fmtDate, formatCurrency } from "@/lib/format";

export type ReminderProgram = { name: string; number: string; date: string | null; total: number; paid: number; due: number; overdue: boolean };
export type PayTo = { bkash?: string | null; nagad?: string | null; phone?: string | null };

export const DUE_CATEGORY = "due_reminder";

export const DUE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "{{firstName}}", label: "First name", hint: "Akash" },
  { key: "{{clientName}}", label: "Client name", hint: "Akash Bappy" },
  { key: "{{companyName}}", label: "Studio name", hint: "your studio" },
  { key: "{{programs}}", label: "Programs (block)", hint: "each program: date, total, paid, due now" },
  { key: "{{summary}}", label: "Summary (block)", hint: "only when there is more than one program" },
  { key: "{{dueAmount}}", label: "Total due", hint: "all programs" },
  { key: "{{overdueAmount}}", label: "Overdue", hint: "programs already done" },
  { key: "{{totalAmount}}", label: "Total", hint: "all programs" },
  { key: "{{paidAmount}}", label: "Paid", hint: "all programs" },
  { key: "{{howToPay}}", label: "How to pay (block)", hint: "bKash / Nagad numbers" },
  { key: "{{bkash}}", label: "bKash number", hint: "" },
  { key: "{{nagad}}", label: "Nagad number", hint: "" },
];

export const DEFAULT_DUE_TEMPLATE = [
  "Hi {{firstName}} 👋",
  "",
  "A friendly payment reminder from *{{companyName}}*.",
  "",
  "{{programs}}",
  "",
  "{{summary}}",
  "",
  "{{howToPay}}",
  "",
  "Please send us a message after you pay.",
  "Thank you! 🙏",
  "— {{companyName}}",
].join("\n");

export function dueReminderText(o: {
  firstName: string; clientName?: string; studio: string; programs: ReminderProgram[]; currency?: string; payTo?: PayTo | null;
  /** The studio's own wording; empty = the default. */
  template?: string | null;
}) {
  const m = (n: number) => formatCurrency(n, o.currency);
  const ps = o.programs.filter(p => p.due > 0);
  const total = ps.reduce((s, p) => s + p.total, 0);
  const paid = ps.reduce((s, p) => s + p.paid, 0);
  const due = ps.reduce((s, p) => s + p.due, 0);
  const overdue = ps.filter(p => p.overdue).reduce((s, p) => s + p.due, 0);
  const many = ps.length > 1;

  const programs = ps.map((p, i) => [
    `*${many ? `${i + 1}. ` : ""}${p.name}*`,
    `🗓 ${p.date ? fmtDate(p.date) : "Date to be set"} · ${p.number}`,
    `Total: ${m(p.total)}`,
    `Paid: ${m(p.paid)}`,
    `*Due now: ${m(p.due)}*${p.overdue ? " ⚠️ _overdue_" : ""}`,
  ].join("\n")).join("\n\n");

  const summary = many ? [
    "━━━━━━━━━━━━━━",
    "*Summary*",
    `Total of all programs: ${m(total)}`,
    `Paid so far: ${m(paid)}`,
    `*Total due now: ${m(due)}*`,
    ...(overdue > 0 && overdue < due ? [`_(${m(overdue)} of it is overdue)_`] : []),
  ].join("\n") : "";

  const ways = [o.payTo?.bkash && `bKash: ${o.payTo.bkash}`, o.payTo?.nagad && `Nagad: ${o.payTo.nagad}`].filter(Boolean) as string[];
  const howToPay = ways.length ? ["💳 *How to pay*", ...ways].join("\n") : "";

  const vars: Record<string, string> = {
    "{{firstName}}": o.firstName,
    "{{clientName}}": o.clientName ?? o.firstName,
    "{{companyName}}": o.studio,
    "{{programs}}": programs,
    "{{summary}}": summary,
    "{{dueAmount}}": m(due),
    "{{overdueAmount}}": m(overdue),
    "{{totalAmount}}": m(total),
    "{{paidAmount}}": m(paid),
    "{{howToPay}}": howToPay,
    "{{bkash}}": o.payTo?.bkash ?? "",
    "{{nagad}}": o.payTo?.nagad ?? "",
  };
  const body = (o.template?.trim() ? o.template : DEFAULT_DUE_TEMPLATE)
    .replace(/\{\{\w+\}\}/g, k => (k in vars ? vars[k] : k));
  // A block that is empty (one program → no summary) must not leave a gap.
  return body.split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
