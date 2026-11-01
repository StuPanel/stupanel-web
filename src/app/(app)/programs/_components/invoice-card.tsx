"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, FileText, History, Loader2, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { notify } from "@/components/feedback";
import { Group } from "@/components/ui/apple";
import { fmtDate } from "./constants";

export interface ProgramInvoice {
  id: string; invoiceNumber: string; docType: "invoice" | "quotation"; state: string; publicToken: string;
  grandTotal: number; paidAmount: number; balanceDue: number; currency: string;
  dueDate?: string | null; dueDateManual: boolean; sentAt?: string | null; viewedAt?: string | null;
  changeLog?: { at: string; changes: string[] }[];
  payments: { id: string; amount: number; paymentDate: string; paymentStatus?: string; receiptNumber?: string | null; wallet?: { name: string } | null }[];
}

export const STATE_LABEL: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "bg-[#FBF2FA] text-[#9E3A8C]" },
  partly_paid: { label: "Partly paid", cls: "bg-[#FFF4E5] text-[#A35A00]" },
  paid: { label: "Paid", cls: "bg-[#E9F5EF] text-[#1F8A5B]" },
  overdue: { label: "Overdue", cls: "bg-[#FDECEF] text-[#C2304F]" },
  cancelled: { label: "Cancelled", cls: "bg-[#EEEBF4] text-[#6B6680]" },
};

/** The program's invoice: made by itself on confirm, always matching the program. */
export function InvoiceCard({ bookingId, version }: { bookingId: string; version: string }) {
  const [inv, setInv] = useState<ProgramInvoice | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [editDue, setEditDue] = useState(false);
  const [due, setDue] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/studio-invoices/booking/${bookingId}`);
      if (!r.ok) { setInv(null); return; }
      const text = await r.text();
      setInv(text ? JSON.parse(text) : null);
    } catch { setInv(null); }
  }, [bookingId]);
  useEffect(() => { load(); }, [load, version]);

  async function makeQuotation() {
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/studio-invoices/generate/${bookingId}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't make it.", { error: true }); return; }
      setInv(d);
    } finally { setBusy(false); }
  }

  async function saveDue(auto: boolean) {
    if (!inv) return;
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/studio-invoices/${inv.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auto ? { dueDateAuto: true } : { dueDate: due }),
      });
      if (r.ok) { setInv(await r.json()); setEditDue(false); notify("Due date saved"); }
    } finally { setBusy(false); }
  }

  async function copyLink() {
    if (!inv) return;
    const url = `${window.location.origin}/inv/${inv.publicToken}`;
    try { await navigator.clipboard.writeText(url); notify("Client link copied"); } catch { window.prompt("Copy this link", url); }
    if (!inv.sentAt) apiFetch(`${API}/studio-invoices/${inv.id}/send`, { method: "PATCH" }).then(() => load()).catch(() => {});
  }

  if (inv === undefined) {
    return <Group title="Invoice"><div className="px-4 py-4"><div className="h-10 rounded-xl bg-[#F5F3FA] animate-pulse" /></div></Group>;
  }

  if (!inv) {
    return (
      <Group title="Invoice">
        <div className="px-4 py-3.5 flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#A29DB3] flex-shrink-0" />
          <p className="flex-1 text-sm text-[#6B6680]">The invoice is made by itself when the program is confirmed or an advance comes in. You can send a quotation before that.</p>
          <button type="button" onClick={makeQuotation} disabled={busy}
            className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Make quotation
          </button>
        </div>
      </Group>
    );
  }

  const st = STATE_LABEL[inv.state] ?? STATE_LABEL.unpaid;
  const quote = inv.docType === "quotation";
  const received = inv.payments.filter(p => !p.paymentStatus || p.paymentStatus === "completed");
  return (
    <Group title={quote ? "Quotation" : "Invoice"} action={
      <span className="text-xs font-mono text-[#6B6680]">{inv.invoiceNumber}</span>
    }>
      <div className="px-4 py-3.5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {!quote && <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", st.cls)}>{st.label}</span>}
          {quote && <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#EEE8FD] text-[#5B3FD0]">Quotation — becomes the invoice on confirm</span>}
          <span className="text-xs text-[#6B6680]">{inv.viewedAt ? `Client opened ${fmtDate(inv.viewedAt)}` : inv.sentAt ? `Sent ${fmtDate(inv.sentAt)}` : "Not sent yet"}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-[#F7F5FB] py-2"><p className="text-[11px] text-[#6B6680]">Total</p><p className="text-sm font-bold tabular-nums">{formatCurrency(Number(inv.grandTotal), inv.currency)}</p></div>
          <div className="rounded-xl bg-[#F7F5FB] py-2"><p className="text-[11px] text-[#6B6680]">Paid</p><p className="text-sm font-bold tabular-nums text-[#1F8A5B]">{formatCurrency(Number(inv.paidAmount), inv.currency)}</p></div>
          <div className="rounded-xl bg-[#F7F5FB] py-2"><p className="text-[11px] text-[#6B6680]">Due</p><p className={cn("text-sm font-bold tabular-nums", Number(inv.balanceDue) > 0 ? "text-[#C2304F]" : "text-[#1F8A5B]")}>{formatCurrency(Number(inv.balanceDue), inv.currency)}</p></div>
        </div>
        {!quote && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#6B6680]">Pay by</span>
            {editDue ? (
              <>
                <input type="date" value={due} onChange={e => setDue(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 text-sm" />
                <button type="button" disabled={!due || busy} onClick={() => saveDue(false)} className="text-[13px] font-semibold text-[#5B3FD0]">Save</button>
                {inv.dueDateManual && <button type="button" disabled={busy} onClick={() => saveDue(true)} className="text-[13px] font-semibold text-[#6B6680]">Use automatic</button>}
                <button type="button" onClick={() => setEditDue(false)} className="text-[13px] text-[#6B6680]">Cancel</button>
              </>
            ) : (
              <>
                <span className="font-semibold">{inv.dueDate ? fmtDate(inv.dueDate) : "—"}</span>
                {!inv.dueDateManual && <span className="text-[11px] text-[#A29DB3]">(from the last event day)</span>}
                <button type="button" onClick={() => { setDue(inv.dueDate?.slice(0, 10) ?? ""); setEditDue(true); }} className="ml-auto text-[13px] font-semibold text-[#5B3FD0]">Change</button>
              </>
            )}
          </div>
        )}
        {received.length > 0 && (
          <div className="space-y-1">
            {received.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-[13px]">
                <Receipt className="w-3.5 h-3.5 text-[#6B6680]" />
                <span className="font-semibold">{p.receiptNumber ?? "—"}</span>
                <span className="text-[#6B6680] truncate flex-1">{fmtDate(p.paymentDate)}{p.wallet ? ` · ${p.wallet.name}` : ""}</span>
                <span className="font-semibold tabular-nums text-[#1F8A5B]">{formatCurrency(Number(p.amount), inv.currency)}</span>
              </div>
            ))}
          </div>
        )}
        {(inv.changeLog?.length ?? 0) > 0 && (
          <details className="text-[12px] text-[#6B6680]">
            <summary className="cursor-pointer inline-flex items-center gap-1"><History className="w-3.5 h-3.5" />Changed after sending ({inv.changeLog!.length}) — only you see this</summary>
            <ul className="mt-1.5 space-y-0.5 pl-5">
              {[...inv.changeLog!].reverse().map((c, i) => <li key={i}>{fmtDate(c.at)}: {c.changes.join(", ")}</li>)}
            </ul>
          </details>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={copyLink} className="flex-1 h-10 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><Copy className="w-3.5 h-3.5" />Copy client link</button>
          <a href={`/inv/${inv.publicToken}`} target="_blank" rel="noreferrer" className="flex-1 h-10 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Open</a>
        </div>
      </div>
    </Group>
  );
}
