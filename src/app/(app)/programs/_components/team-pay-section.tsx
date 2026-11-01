"use client";

/**
 * Team pay on a program: each person's bill, what they've been paid, what's left,
 * and a Pay button. Payments are saved on the program (costEntries[].payments),
 * so the member's profile, salary page and reports see them too.
 */
import { useState } from "react";
import { AccountPicker } from "@/components/account-picker";
import { Check, Loader2, Lock, Trash2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { notify } from "@/components/feedback";
import { CARD_SHADOW } from "@/components/ui/apple";
import { FormDrawer, FormGroup, Field, inputCls } from "@/components/ui/form-kit";
import { fmtDate } from "./constants";
import { BILL_LOCKED_STATUSES, type Booking, type CostEntry } from "./types";

const METHODS = [{ v: "cash", l: "Cash" }, { v: "mobile_banking", l: "bKash / Nagad" }, { v: "bank_transfer", l: "Bank" }, { v: "other", l: "Other" }];
const methodName = (v: string) => METHODS.find(m => m.v === v)?.l ?? v;

export function TeamPaySection({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const entries = (booking.costEntries ?? []) as CostEntry[];
  const [paying, setPaying] = useState<CostEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!entries.length) return null;
  const locked = BILL_LOCKED_STATUSES.includes(booking.status);
  const total = entries.reduce((s, e) => s + Number(e.totalBill || 0), 0);
  const paid = entries.reduce((s, e) => s + Number(e.paidAmount || 0), 0);

  async function undo(e: CostEntry, pid: string) {
    if (!e.memberId) return;
    setBusy(pid);
    try {
      const r = await apiFetch(`${API}/bookings/${booking.id}/team-pay/${e.memberId}/${pid}`, { method: "DELETE" });
      if (r.ok) { notify("Payment removed"); onSaved(); } else notify("Couldn't remove it", { error: true });
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 px-1 text-[13px] font-bold text-[#4A4658]">Team pay</h2>
        {locked && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><Lock className="w-3 h-3" />Bill locked</span>}
      </div>
      <div className={cn("bg-white rounded-[20px] divide-y divide-[#EEEBF4] overflow-hidden", CARD_SHADOW)}>
        {entries.map(e => {
          const bill = Number(e.totalBill || 0), p = Number(e.paidAmount || 0), due = Math.max(0, bill - p);
          return (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#17151F] truncate">{e.memberName}</p>
                  <p className="text-xs text-slate-500 truncate">
                    Bill {formatCurrency(bill, booking.currency)}{p > 0 && <> · paid {formatCurrency(p, booking.currency)}</>}
                  </p>
                </div>
                {due > 0 ? (
                  <>
                    <span className="text-sm font-bold text-red-600 tabular-nums">{formatCurrency(due, booking.currency)}</span>
                    {e.memberId && (
                      <button type="button" onClick={() => setPaying(e)}
                        className="h-8 px-3 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] text-white text-xs font-semibold inline-flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />Pay
                      </button>
                    )}
                  </>
                ) : bill > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"><Check className="w-3 h-3" />Paid</span>
                ) : null}
              </div>
              {(e.payments ?? []).length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {e.payments!.map(x => (
                    <div key={x.id} className="flex items-center gap-2 text-xs text-slate-500 pl-2 border-l-2 border-emerald-200">
                      <span className="flex-1 truncate">{fmtDate(x.date)} · {x.walletName ?? methodName(x.method)}{x.note ? ` · ${x.note}` : ""}</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">{formatCurrency(x.amount, booking.currency)}</span>
                      <button type="button" onClick={() => undo(e, x.id)} disabled={busy === x.id} aria-label="Remove this payment"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500">
                        {busy === x.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF9FC] text-xs">
          <span className="text-slate-500">Total {formatCurrency(total, booking.currency)} · paid {formatCurrency(paid, booking.currency)}</span>
          <span className={cn("font-bold", total - paid > 0 ? "text-red-600" : "text-emerald-700")}>Owe {formatCurrency(Math.max(0, total - paid), booking.currency)}</span>
        </div>
      </div>
      <PayMember booking={booking} entry={paying} onClose={() => setPaying(null)} onSaved={onSaved} />
    </div>
  );
}

function PayMember({ booking, entry, onClose, onSaved }: { booking: Booking; entry: CostEntry | null; onClose: () => void; onSaved: () => void }) {
  const due = entry ? Math.max(0, Number(entry.totalBill || 0) - Number(entry.paidAmount || 0)) : 0;
  const [form, setForm] = useState({ amount: "", method: "cash", date: "", note: "", walletId: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  if (entry && forId !== entry.id) {
    setForId(entry.id);
    setForm({ amount: String(due), method: "cash", date: new Date().toISOString().slice(0, 10), note: "", walletId: "" });
    setErr("");
  }
  if (!entry && forId) setForId(null);

  async function save() {
    const amount = parseFloat(form.amount) || 0;
    if (amount <= 0) { setErr("Write the amount."); return; }
    if (!form.walletId) { setErr("Pick the account the money was paid from."); return; }
    if (amount > due) { setErr(`Only ${formatCurrency(due, booking.currency)} is left to pay.`); return; }
    setSaving(true); setErr("");
    try {
      const r = await apiFetch(`${API}/bookings/${booking.id}/team-pay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: entry!.memberId, amount, method: form.method, date: form.date || undefined, note: form.note.trim() || undefined, walletId: form.walletId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save."); return; }
      notify(`Paid ${formatCurrency(amount, booking.currency)} to ${entry!.memberName}`);
      onSaved(); onClose();
    } catch { setErr("Something went wrong."); }
    finally { setSaving(false); }
  }

  return (
    <FormDrawer open={!!entry} onTop onClose={onClose} icon={Wallet} color="green" title={`Pay ${entry?.memberName ?? ""}`}
      sub={`${booking.eventName ?? booking.bookingNumber} · ${formatCurrency(due, booking.currency)} left`}
      footer={<>
        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F]">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
          className="flex-[1.4] h-12 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save payment
        </button>
      </>}>
      {err && <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{err}</div>}
      <FormGroup title="Payment">
        <Field label="Amount" required>{id => (
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">৳</span>
            <input id={id} type="number" inputMode="numeric" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={cn(inputCls, "pl-8 h-12 text-lg font-bold tabular-nums")} />
          </div>
        )}</Field>
        <Field label="Paid by">{() => (
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map(o => <button key={o.v} type="button" onClick={() => setForm(f => ({ ...f, method: o.v }))}
              className={cn("h-9 px-3 rounded-full text-[12px] font-semibold", form.method === o.v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{o.l}</button>)}
          </div>
        )}</Field>
        <div className="px-4 py-3"><AccountPicker key={entry?.id ?? "none"} label="Paid from" value={form.walletId} method={form.method} onChange={w => setForm(f => ({ ...f, walletId: w }))} /></div>
        <Field label="Date">{id => <input id={id} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />}</Field>
        <Field label="Note">{id => <input id={id} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. bKash TrxID" className={inputCls} />}</Field>
      </FormGroup>
    </FormDrawer>
  );
}
