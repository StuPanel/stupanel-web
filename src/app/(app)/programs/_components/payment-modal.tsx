"use client";

import { useState, useEffect } from "react";
import { X, Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { PAYMENT_METHODS } from "./constants";
import type { Booking } from "./types";

export function PaymentModal({ booking, onClose, onSaved }: {
  booking: Booking | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (booking) {
      const due = Number(booking.grandTotal) - Number(booking.paidAmount);
      setAmount(due > 0 ? String(due) : "");
      setMethod("cash"); setRef(""); setNote(""); setError("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [booking]);

  if (!booking) return null;
  const bk = booking;
  const sym = bk.currency === "BDT" ? "৳" : "$";
  const due = Number(bk.grandTotal) - Number(bk.paidAmount);

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    setError(""); setLoading(true);
    try {
      const r = await apiFetch(`${API}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: bk.id,
          amount: amt,
          currency: bk.currency ?? "BDT",
          paymentMethod: method,
          paymentDate: date,
          referenceNumber: ref || undefined,
          notes: note || undefined,
          paymentStatus: "completed",
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to record payment."); return; }
      onSaved(); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Record Payment</h3>
              <p className="text-xs text-slate-400 mt-0.5">{booking.eventName ?? booking.bookingNumber}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {due > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                <span className="text-xs text-red-600">Outstanding Due</span>
                <span className="font-bold text-red-700 text-sm">{sym}{due.toLocaleString()}</span>
              </div>
            )}
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{sym}</span>
                <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" className="pl-7 h-11 border-slate-200 text-base font-semibold" autoFocus />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Method</Label>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Reference / TrxID</Label>
              <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="bKash TrxID, bank ref..." className="h-10 border-slate-200 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Note</Label>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" className="h-10 border-slate-200 text-sm" />
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={submit} disabled={loading} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Record Payment
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
