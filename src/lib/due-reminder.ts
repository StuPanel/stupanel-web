/**
 * The WhatsApp payment reminder for one client: each program on its own (date, number,
 * total, paid, due now — overdue marked), then a summary of all programs and how to pay.
 * WhatsApp formatting: *bold*, _italic_.
 */
import { fmtDate, formatCurrency } from "@/lib/format";

export type ReminderProgram = { name: string; number: string; date: string | null; total: number; paid: number; due: number; overdue: boolean };
export type PayTo = { bkash?: string | null; nagad?: string | null; phone?: string | null };

export function dueReminderText(o: {
  firstName: string; studio: string; programs: ReminderProgram[]; currency?: string; payTo?: PayTo | null;
}) {
  const m = (n: number) => formatCurrency(n, o.currency);
  const ps = o.programs.filter(p => p.due > 0);
  const total = ps.reduce((s, p) => s + p.total, 0);
  const paid = ps.reduce((s, p) => s + p.paid, 0);
  const due = ps.reduce((s, p) => s + p.due, 0);
  const overdue = ps.filter(p => p.overdue).reduce((s, p) => s + p.due, 0);
  const many = ps.length > 1;

  const lines: string[] = [
    `Hi ${o.firstName} 👋`,
    "",
    `A friendly payment reminder from *${o.studio}*.`,
  ];
  ps.forEach((p, i) => {
    lines.push(
      "",
      `*${many ? `${i + 1}. ` : ""}${p.name}*`,
      `🗓 ${p.date ? fmtDate(p.date) : "Date to be set"} · ${p.number}`,
      `Total: ${m(p.total)}`,
      `Paid: ${m(p.paid)}`,
      `*Due now: ${m(p.due)}*${p.overdue ? " ⚠️ _overdue_" : ""}`,
    );
  });
  if (many) {
    lines.push(
      "",
      "━━━━━━━━━━━━━━",
      "*Summary*",
      `Total of all programs: ${m(total)}`,
      `Paid so far: ${m(paid)}`,
      `*Total due now: ${m(due)}*`,
    );
    if (overdue > 0 && overdue < due) lines.push(`_(${m(overdue)} of it is overdue)_`);
  }
  const ways = [o.payTo?.bkash && `bKash: ${o.payTo.bkash}`, o.payTo?.nagad && `Nagad: ${o.payTo.nagad}`].filter(Boolean) as string[];
  if (ways.length) lines.push("", "💳 *How to pay*", ...ways);
  lines.push("", "Please send us a message after you pay.", "Thank you! 🙏", `— ${o.studio}`);
  return lines.join("\n");
}
