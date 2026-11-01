import type { DocData, DocStudio } from "./invoice-document";

/** Made-up program used by the designer preview. */
export function sampleInvoice(studio: DocStudio, opts: { vatOn: boolean; vatPercent: number; vatLabel: string; dueDays: number; terms?: string | null; currency?: string }): DocData {
  const today = new Date();
  const ev = (d: number) => new Date(today.getTime() + d * 864e5).toISOString().slice(0, 10);
  const subtotal = 85000, discount = 5000;
  const taxAmount = opts.vatOn ? Math.round((subtotal - discount) * opts.vatPercent) / 100 : 0;
  const total = subtotal - discount + taxAmount;
  const paid = 30000;
  return {
    kind: "invoice", number: "PRG-0042", issueDate: today.toISOString(),
    dueDate: new Date(new Date(ev(23)).getTime() + opts.dueDays * 864e5).toISOString(),
    state: "partly_paid", currency: opts.currency ?? "BDT", studio,
    client: { name: "Nusrat Jahan & Arif Hossain", phone: "01711-000000", email: "nusrat@example.com" },
    programName: "Wedding — Gold package", programRef: "PRG-0042",
    eventDays: [
      { label: "Gaye Holud", date: ev(20), place: "Bashundhara Convention Hall" },
      { label: "Wedding", date: ev(22), place: "Radisson Blu, Dhaka" },
      { label: "Reception", date: ev(23), place: "Senakunja, Dhaka Cantonment" },
    ],
    items: [
      { name: "Gold wedding package", description: "3 events · 2 photographers · 1 cinematographer", qty: 1, rate: 70000, total: 70000 },
      { name: "Premium album (40 pages)", qty: 1, rate: 10000, total: 10000 },
      { name: "Drone coverage", description: "Wedding day", qty: 1, rate: 5000, total: 5000 },
    ],
    subtotal, discount, taxLabel: opts.vatLabel, taxPercent: opts.vatOn ? opts.vatPercent : 0, taxAmount, total, paid, due: total - paid,
    payments: [{ date: today.toISOString(), amount: paid, method: "mobile_banking", receiptNumber: "MR-0007" }],
    terms: opts.terms || "50% advance confirms the date. The rest is due by the pay-by date. Edited photos are delivered within 30 days of the last event.",
  };
}

export function sampleReceipt(base: DocData): DocData {
  return {
    ...base, kind: "receipt", number: "MR-0007", state: undefined,
    receipt: { amount: 30000, method: "mobile_banking", trxId: "BK7X9Q2M1A", account: "bKash (Studio)", paidSoFar: 30000, dueAfter: base.total - 30000, forText: `${base.programName} (${base.programRef})` },
  };
}
