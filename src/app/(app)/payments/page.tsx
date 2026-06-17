"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Filter, CreditCard, Loader2, X, AlertTriangle,
  Edit3, Trash2, ChevronLeft, ChevronRight, Banknote, Smartphone,
  Building2, CheckCircle2, TrendingUp, Calendar, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────────

type PaymentMethod = "cash" | "bank_transfer" | "mobile_banking" | "credit_card" | "debit_card" | "cheque" | "online_gateway" | "other";
type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "partially_refunded";

interface Client { id: string; firstName: string; lastName?: string; phone?: string; }
interface Booking { id: string; bookingNumber: string; eventName?: string; grandTotal: number; paidAmount: number; currency: string; }

interface Payment {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDate: string;
  paymentType: string;
  referenceNumber?: string;
  transactionId?: string;
  notes?: string;
  booking: Booking;
  client: Client;
}

interface Stats {
  totalCollected: number;
  thisMonth: number;
  methodBreakdown: { method: string; total: number; count: number }[];
}

// ─── Config ─────────────────────────────────────────────────────────────────

const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  cash:           { label: "Cash",           icon: Banknote,    bg: "bg-emerald-100", text: "text-emerald-700" },
  bank_transfer:  { label: "Bank Transfer",  icon: Building2,   bg: "bg-blue-100",    text: "text-blue-700" },
  mobile_banking: { label: "Mobile Banking", icon: Smartphone,  bg: "bg-violet-100",  text: "text-violet-700" },
  credit_card:    { label: "Credit Card",    icon: CreditCard,  bg: "bg-pink-100",    text: "text-pink-700" },
  debit_card:     { label: "Debit Card",     icon: CreditCard,  bg: "bg-indigo-100",  text: "text-indigo-700" },
  cheque:         { label: "Cheque",         icon: FileText,    bg: "bg-orange-100",  text: "text-orange-700" },
  online_gateway: { label: "Online",         icon: TrendingUp,  bg: "bg-cyan-100",    text: "text-cyan-700" },
  other:          { label: "Other",          icon: CreditCard,  bg: "bg-slate-100",   text: "text-slate-600" },
};

const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; text: string }> = {
  pending:              { label: "Pending",    bg: "bg-yellow-100", text: "text-yellow-700" },
  completed:            { label: "Completed",  bg: "bg-emerald-100",text: "text-emerald-700" },
  failed:               { label: "Failed",     bg: "bg-red-100",    text: "text-red-700" },
  refunded:             { label: "Refunded",   bg: "bg-slate-100",  text: "text-slate-600" },
  partially_refunded:   { label: "Part. Refunded", bg: "bg-orange-100", text: "text-orange-700" },
};

const PAYMENT_TYPES = [
  { value: "advance",  label: "Advance" },
  { value: "partial",  label: "Partial Payment" },
  { value: "full",     label: "Full Payment" },
  { value: "final",    label: "Final Payment" },
  { value: "refund",   label: "Refund" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { formatCurrency } from "@/lib/format";
function fmt(n: number, cur = "BDT") { return formatCurrency(n, cur); }
function clientName(c: Client) { return [c.firstName, c.lastName].filter(Boolean).join(" "); }
function today() { return new Date().toISOString().split("T")[0]; }

// ─── Record Payment Drawer ────────────────────────────────────────────────

function PaymentDrawer({
  open, onClose, onSaved, editing, bookings,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Payment | null;
  bookings: Booking[];
}) {
  const isEdit = !!editing;

  const blank = {
    bookingId: "", amount: "", currency: "BDT",
    paymentMethod: "cash" as PaymentMethod,
    paymentStatus: "completed" as PaymentStatus,
    paymentDate: today(),
    paymentType: "advance",
    referenceNumber: "", transactionId: "", notes: "",
  };

  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      if (editing) {
        setForm({
          bookingId: editing.booking.id,
          amount: String(editing.amount),
          currency: editing.currency,
          paymentMethod: editing.paymentMethod,
          paymentStatus: editing.paymentStatus,
          paymentDate: editing.paymentDate.split("T")[0],
          paymentType: editing.paymentType,
          referenceNumber: editing.referenceNumber ?? "",
          transactionId: editing.transactionId ?? "",
          notes: editing.notes ?? "",
        });
      } else {
        setForm(blank);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  // Auto-fill currency when booking changes
  function handleBookingChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const bookingId = e.target.value;
    const booking = bookings.find(b => b.id === bookingId);
    setForm(prev => ({
      ...prev,
      bookingId,
      currency: booking?.currency ?? "BDT",
    }));
  }

  const selectedBooking = bookings.find(b => b.id === form.bookingId);
  const remaining = selectedBooking
    ? Math.max(0, selectedBooking.grandTotal - selectedBooking.paidAmount)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bookingId) { setError("Please select a booking."); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Amount must be greater than 0."); return; }
    setError("");
    setLoading(true);

    const body = {
      bookingId: form.bookingId,
      amount: parseFloat(form.amount),
      currency: form.currency,
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentStatus,
      paymentDate: form.paymentDate,
      paymentType: form.paymentType,
      referenceNumber: form.referenceNumber || undefined,
      transactionId: form.transactionId || undefined,
      notes: form.notes || undefined,
    };

    try {
      const url = isEdit ? `${API}/payments/${editing!.id}` : `${API}/payments`;
      const res = await apiFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save."); return; }
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{isEdit ? "Edit Payment" : "Record Payment"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? "Update payment details" : "Record a new payment"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            {/* Booking */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Booking / Program *</Label>
              <select value={form.bookingId} onChange={handleBookingChange}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-400 cursor-pointer"
                required>
                <option value="">Select a booking...</option>
                {bookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bookingNumber} — {b.eventName || "Untitled"} ({formatCurrency(b.grandTotal, b.currency)})
                  </option>
                ))}
              </select>
              {remaining !== null && remaining > 0 && (
                <p className="text-xs text-orange-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Outstanding: {fmt(remaining, selectedBooking!.currency)}
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, amount: String(remaining) }))}
                    className="ml-1 text-indigo-600 hover:underline font-medium">
                    Use this amount
                  </button>
                </p>
              )}
              {remaining === 0 && selectedBooking && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> This booking is fully paid.
                </p>
              )}
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Amount *</Label>
                <Input type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={form.amount} onChange={set("amount")}
                  className="h-11 border-slate-200 focus:border-indigo-400" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Currency</Label>
                <select value={form.currency} onChange={set("currency")}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-400 cursor-pointer">
                  <option value="BDT">৳ BDT</option>
                  <option value="USD">$ USD</option>
                  <option value="INR">₹ INR</option>
                  <option value="GBP">£ GBP</option>
                </select>
              </div>
            </div>

            {/* Method + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Payment Method *</Label>
                <select value={form.paymentMethod} onChange={set("paymentMethod")}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-400 cursor-pointer">
                  {Object.entries(METHOD_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Payment Type</Label>
                <select value={form.paymentType} onChange={set("paymentType")}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-400 cursor-pointer">
                  {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Date + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Payment Date *</Label>
                <Input type="date" value={form.paymentDate} onChange={set("paymentDate")}
                  className="h-11 border-slate-200 focus:border-indigo-400" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Status</Label>
                <select value={form.paymentStatus} onChange={set("paymentStatus")}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-400 cursor-pointer">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Reference No. <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input placeholder="TXN-12345" value={form.referenceNumber} onChange={set("referenceNumber")}
                  className="h-11 border-slate-200 focus:border-indigo-400" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Transaction ID <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input placeholder="Transaction ID" value={form.transactionId} onChange={set("transactionId")}
                  className="h-11 border-slate-200 focus:border-indigo-400" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
              <textarea value={form.notes} onChange={set("notes")} rows={2}
                placeholder="Any notes about this payment..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200 text-slate-600">
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={loading}
            className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isEdit ? "Saving..." : "Recording..."}</>
              : isEdit ? "Save Changes" : "Record Payment"
            }
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  payment, onClose, onDeleted,
}: { payment: Payment | null; onClose: () => void; onDeleted: () => void; }) {
  const [loading, setLoading] = useState(false);
  if (!payment) return null;

  async function doDelete() {
    setLoading(true);
    try {
      await apiFetch(`${API}/payments/${payment!.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      onDeleted();
      onClose();
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Delete Payment?</h3>
          <p className="text-slate-500 text-sm mt-2">
            {fmt(payment.amount, payment.currency)} payment for{" "}
            <span className="font-semibold text-slate-700">{payment.booking.bookingNumber}</span> will be removed.
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={doDelete} disabled={loading}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Payment Row (Table) ─────────────────────────────────────────────────────

function PaymentRow({
  payment, onEdit, onDelete,
}: { payment: Payment; onEdit: (p: Payment) => void; onDelete: (p: Payment) => void; }) {
  const M = METHOD_CONFIG[payment.paymentMethod];
  const S = STATUS_CONFIG[payment.paymentStatus];
  const MIcon = M.icon;
  const dateStr = new Date(payment.paymentDate).toLocaleDateString("en-US", { dateStyle: "medium" });

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className="py-3 px-4">
        <p className="text-sm font-semibold text-slate-900">{fmt(payment.amount, payment.currency)}</p>
        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium mt-1", S.bg, S.text)}>
          {S.label}
        </span>
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        <div>
          <p className="text-xs font-mono text-slate-400">{payment.booking.bookingNumber}</p>
          <p className="text-sm text-slate-700 truncate max-w-[160px]">{payment.booking.eventName || "Untitled"}</p>
          <p className="text-xs text-slate-400">{clientName(payment.client)}</p>
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium", M.bg, M.text)}>
          <MIcon className="w-3.5 h-3.5" />{M.label}
        </span>
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />{dateStr}
        </div>
        {payment.referenceNumber && (
          <p className="text-[10px] text-slate-400 mt-0.5">Ref: {payment.referenceNumber}</p>
        )}
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <span className="text-xs text-slate-500 capitalize">{payment.paymentType.replace("_", " ")}</span>
      </td>
      <td className="py-3 px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem className="gap-2 text-sm" onClick={() => onEdit(payment)}>
              <Edit3 className="w-4 h-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-sm text-red-600" onClick={() => onDelete(payment)}>
              <Trash2 className="w-4 h-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Payment Card (Mobile) ───────────────────────────────────────────────────

function PaymentCard({
  payment, onEdit, onDelete,
}: { payment: Payment; onEdit: (p: Payment) => void; onDelete: (p: Payment) => void; }) {
  const M = METHOD_CONFIG[payment.paymentMethod];
  const S = STATUS_CONFIG[payment.paymentStatus];
  const MIcon = M.icon;
  const dateStr = new Date(payment.paymentDate).toLocaleDateString("en-US", { dateStyle: "medium" });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-slate-900 text-lg leading-none">{fmt(payment.amount, payment.currency)}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium", M.bg, M.text)}>
              <MIcon className="w-3 h-3" />{M.label}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", S.bg, S.text)}>
              {S.label}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem className="gap-2 text-sm" onClick={() => onEdit(payment)}><Edit3 className="w-4 h-4" /> Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-sm text-red-600" onClick={() => onDelete(payment)}><Trash2 className="w-4 h-4" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-mono text-slate-400">{payment.booking.bookingNumber}</span>
          <span className="text-xs text-slate-600 truncate">{payment.booking.eventName || "Untitled"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500">{dateStr}</span>
          <span className="text-xs text-slate-400 capitalize">· {payment.paymentType.replace("_", " ")}</span>
        </div>
        {payment.referenceNumber && (
          <p className="text-xs text-slate-400">Ref: {payment.referenceNumber}</p>
        )}
      </div>
    </div>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsRow({ stats, currency = "BDT" }: { stats: Stats; currency?: string }) {
  const topMethod = stats.methodBreakdown.sort((a, b) => b.total - a.total)[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs text-slate-400 font-medium">Total Collected</p>
        <p className="text-xl font-bold text-slate-900 mt-1">{fmt(stats.totalCollected, currency)}</p>
        <p className="text-xs text-slate-400 mt-1">All time</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs text-slate-400 font-medium">This Month</p>
        <p className="text-xl font-bold text-emerald-600 mt-1">{fmt(stats.thisMonth, currency)}</p>
        <p className="text-xs text-slate-400 mt-1">{new Date().toLocaleString("en-US", { month: "long" })}</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs text-slate-400 font-medium">Top Method</p>
        {topMethod ? (
          <>
            <p className="text-base font-bold text-slate-900 mt-1 capitalize">{METHOD_CONFIG[topMethod.method as PaymentMethod]?.label ?? topMethod.method}</p>
            <p className="text-xs text-slate-400 mt-1">{topMethod.count} payments</p>
          </>
        ) : (
          <p className="text-slate-300 text-sm mt-1">—</p>
        )}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs text-slate-400 font-medium">Transactions</p>
        <p className="text-xl font-bold text-slate-900 mt-1">
          {stats.methodBreakdown.reduce((a, m) => a + m.count, 0)}
        </p>
        <p className="text-xs text-slate-400 mt-1">Recorded</p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ totalCollected: 0, thisMonth: 0, methodBreakdown: [] });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  const LIMIT = 20;

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(methodFilter && { paymentMethod: methodFilter }),
      });
      const res = await apiFetch(`${API}/payments?${params}`, { headers: { "Content-Type": "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      setPayments(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
      if (data.meta?.stats) setStats(data.meta.stats);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, search, methodFilter]);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/bookings?limit=200`, { headers: { "Content-Type": "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      setBookings((data.data ?? []).map((b: any) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        eventName: b.eventName,
        grandTotal: Number(b.grandTotal),
        paidAmount: Number(b.paidAmount),
        currency: b.currency,
      })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { setPage(1); }, [search, methodFilter]);

  function openNew() { setEditTarget(null); setDrawer(true); }
  function openEdit(p: Payment) { setEditTarget(p); setDrawer(true); }
  function onSaved() { fetchPayments(); fetchBookings(); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-400 text-xs mt-0.5">{total} total transactions</p>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Record Payment</span>
        </Button>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search booking, client, reference..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white border-slate-200" />
        </div>

        {/* Method filter */}
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:border-indigo-400 cursor-pointer flex-shrink-0">
          <option value="">All Methods</option>
          {Object.entries(METHOD_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 text-slate-600 h-9 flex-shrink-0">
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filter</span>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No payments found</p>
          <p className="text-slate-300 text-xs mt-1">
            {search ? "Try a different search" : "Record your first payment to get started"}
          </p>
          {!search && (
            <Button onClick={openNew} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
              <Plus className="w-4 h-4" /> Record Payment
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Table — sm+ */}
          <div className="hidden sm:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Booking</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Method</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Type</th>
                    <th className="py-3 px-4 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <PaymentRow key={p.id} payment={p} onEdit={openEdit} onDelete={p => setDeleteTarget(p)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards — mobile */}
          <div className="sm:hidden space-y-3">
            {payments.map(p => (
              <PaymentCard key={p.id} payment={p} onEdit={openEdit} onDelete={p => setDeleteTarget(p)} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">Page {page} of {totalPages} · {total} records</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="h-8 w-8 p-0 border-slate-200">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="h-8 w-8 p-0 border-slate-200">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawers */}
      <PaymentDrawer
        open={drawer}
        onClose={() => { setDrawer(false); setEditTarget(null); }}
        onSaved={onSaved}
        editing={editTarget}
        bookings={bookings}
      />
      <DeleteDialog
        payment={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={fetchPayments}
      />
    </div>
  );
}
