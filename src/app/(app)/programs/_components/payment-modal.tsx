"use client";

import { useState, useEffect } from "react";
import { Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { PAYMENT_METHODS } from "./constants";
import type { Booking } from "./types";
import { currencyPad, currencySymbol, formatCurrency, getStudioCurrency, localDateStr } from "@/lib/format";
import { AccountPicker } from "@/components/account-picker";
import { jumpToField } from "@/lib/jump-to-field";

export function PaymentModal({ booking, onClose, onSaved }: {
  booking: Booking | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(localDateStr());
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [walletId, setWalletId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (booking) {
      const due = Number(booking.grandTotal) - Number(booking.paidAmount);
      setAmount(due > 0 ? String(due) : "");
      setMethod("cash"); setRef(""); setNote(""); setError("");
      setDate(localDateStr());
    }
  }, [booking]);

  if (!booking) return null;
  const bk = booking;
  const sym = currencySymbol(bk.currency).trim();
  const due = Number(bk.grandTotal) - Number(bk.paidAmount);

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); jumpToField("amount"); return; }
    if (!walletId) { setError("Pick the account the money went into."); jumpToField("wallet"); return; }
    setError(""); setLoading(true);
    try {
      const r = await apiFetch(`${API}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: bk.id,
          amount: amt,
          currency: bk.currency || getStudioCurrency(),
          paymentMethod: method,
          paymentDate: date,
          referenceNumber: ref || undefined,
          notes: note || undefined,
          paymentStatus: "completed",
          walletId,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to record payment."); return; }
      onSaved(); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <FormDrawer open onClose={onClose} onTop icon={Wallet} color="green" title="Record payment" sub={booking.eventName ?? booking.bookingNumber}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
          <button type="button" onClick={submit} disabled={loading} className="flex-1 h-11 rounded-full bg-[#1F8A5B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}Record payment
          </button>
        </>
      }>
      {due > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-[16px] bg-[#FDECEF] px-4 py-3">
          <span className="text-[13px] font-semibold text-[#9C2340]">Still to pay</span>
          <span className="text-[17px] font-extrabold text-[#C2304F] tabular-nums">{formatCurrency(due, bk.currency)}</span>
        </div>
      )}
      {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{error}</p>}

      <FormGroup>
        <Field label="Amount" required name="amount">{id => (
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-[15px] font-semibold">{sym}</span>
            <input id={id} type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus
              className={cn(inputCls, "pl-8 text-[17px] font-bold tabular-nums")} style={{ paddingLeft: currencyPad(bk.currency) }} />
          </div>
        )}</Field>
        <div className="grid grid-cols-2">
          <Field label="Method">{id => (
            <select id={id} value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}</Field>
          <Field label="Date" className="pl-0">{id => <input id={id} type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />}</Field>
        </div>
        <div className="px-4 py-3.5"><AccountPicker value={walletId} onChange={setWalletId} method={method} /></div>
      </FormGroup>

      <FormGroup>
        <Field label="Reference / transaction ID">{id => <input id={id} value={ref} onChange={e => setRef(e.target.value)} placeholder="Optional" className={inputCls} />}</Field>
        <Field label="Note">{id => <input id={id} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" className={inputCls} />}</Field>
      </FormGroup>
    </FormDrawer>
  );
}
