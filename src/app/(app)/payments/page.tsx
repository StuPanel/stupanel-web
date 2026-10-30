"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, CreditCard, Loader2, X, AlertTriangle, MoreHorizontal,
  Edit3, Trash2, Banknote, Smartphone,
  Building2, CheckCircle2, TrendingUp, Calendar, FileText,
} from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField, StatCard, Tile } from "@/components/ui/apple";
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

const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: React.ElementType; tile: string }> = {
  cash:           { label: "Cash",           icon: Banknote,    tile: "green" },
  bank_transfer:  { label: "Bank transfer",  icon: Building2,   tile: "blue" },
  mobile_banking: { label: "Mobile banking", icon: Smartphone,  tile: "orchid" },
  credit_card:    { label: "Credit card",    icon: CreditCard,  tile: "deep" },
  debit_card:     { label: "Debit card",     icon: CreditCard,  tile: "violet" },
  cheque:         { label: "Cheque",         icon: FileText,    tile: "ink" },
  online_gateway: { label: "Online",         icon: TrendingUp,  tile: "teal" },
  other:          { label: "Other",          icon: CreditCard,  tile: "ink" },
};

const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; text: string }> = {
  pending:            { label: "Pending",        bg: "#FBF2FA", text: "#9E3A8C" },
  completed:          { label: "Received",       bg: "#E9F5EF", text: "#1F8A5B" },
  failed:             { label: "Failed",         bg: "#FDECEF", text: "#C2304F" },
  refunded:           { label: "Refunded",       bg: "#EEEDF2", text: "#4A4658" },
  partially_refunded: { label: "Part. refunded", bg: "#FBF2FA", text: "#9E3A8C" },
};

const PAYMENT_TYPES = [
  { value: "advance",  label: "Advance" },
  { value: "partial",  label: "Partial Payment" },
  { value: "full",     label: "Full Payment" },
  { value: "final",    label: "Final Payment" },
  { value: "refund",   label: "Refund" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { formatCurrency, localDateStr, fmtDate } from "@/lib/format";
function fmt(n: number, cur = "BDT") { return formatCurrency(n, cur); }
function clientName(c: Client) { return [c.firstName, c.lastName].filter(Boolean).join(" "); }
function today() { return localDateStr(); }

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
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="sp-drawer z-50 max-w-lg flex flex-col">
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
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="sp-modal w-full max-w-sm p-6 text-center">
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

// ─── Payment row (Apple style) ──────────────────────────────────────────────

function PaymentListRow({
  payment, onEdit, onDelete,
}: { payment: Payment; onEdit: (p: Payment) => void; onDelete: (p: Payment) => void; }) {
  const M = METHOD_CONFIG[payment.paymentMethod] ?? METHOD_CONFIG.other;
  const S = STATUS_CONFIG[payment.paymentStatus] ?? STATUS_CONFIG.completed;
  const dateStr = fmtDate(payment.paymentDate);
  const type = payment.paymentType.replace("_", " ");
  return (
    <div role="button" tabIndex={0} onClick={() => onEdit(payment)} onKeyDown={e => { if (e.key === "Enter") onEdit(payment); }}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <Tile icon={M.icon} color={M.tile} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate">{payment.booking.eventName || payment.booking.bookingNumber}</p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">
          {clientName(payment.client)} · {M.label} · <span className="capitalize">{type}</span>
          {payment.referenceNumber ? ` · Ref ${payment.referenceNumber}` : ""}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn("text-sm font-bold tabular-nums", payment.paymentType === "refund" ? "text-[#C2304F]" : "text-[#1F8A5B]")}>
          {payment.paymentType === "refund" ? "−" : "+"}{fmt(payment.amount, payment.currency)}
        </p>
        <p className="text-xs text-[#6B6680]">{dateStr}</p>
      </div>
      {payment.paymentStatus !== "completed" && (
        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: S.bg, color: S.text }}>{S.label}</span>
      )}
      <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="More" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-[16px] p-1">
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px]" onClick={() => onEdit(payment)}><Edit3 className="w-4 h-4" /> Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px] text-[#C2304F]" onClick={() => onDelete(payment)}><Trash2 className="w-4 h-4" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Numbers ──────────────────────────────────────────────────────────────────

function StatsRow({ stats, currency = "BDT" }: { stats: Stats; currency?: string }) {
  const topMethod = [...stats.methodBreakdown].sort((a, b) => b.total - a.total)[0];
  const top = topMethod ? METHOD_CONFIG[topMethod.method as PaymentMethod] : null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
      <StatCard icon={Banknote} color="green" label="Total received" value={fmt(stats.totalCollected, currency)} sub="All time" />
      <StatCard icon={Calendar} color="violet" label="This month" value={fmt(stats.thisMonth, currency)} sub={new Date().toLocaleString("en-US", { month: "long" })} />
      <StatCard icon={top?.icon ?? CreditCard} color={top?.tile ?? "ink"} label="Most used" value={top?.label ?? "—"}
        sub={topMethod ? `${topMethod.count} payment${topMethod.count === 1 ? "" : "s"}` : "No payments yet"} />
      <StatCard icon={FileText} color="blue" label="Payments" value={String(stats.methodBreakdown.reduce((a, m) => a + m.count, 0))} sub="Recorded" />
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
    <div>
      <PageHeader icon={CreditCard} color="green" title="Payments"
        sub={total ? `${total} payment${total === 1 ? "" : "s"}` : "Money you received"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search payments" />
        <MainButton icon={Plus} onClick={openNew}>Record payment</MainButton>
      </PageHeader>

      <StatsRow stats={stats} />

      <Chips label="Filter by method" value={methodFilter || "all"} onChange={v => setMethodFilter(v === "all" ? "" : v)}
        options={[{ value: "all", label: "All methods" }, ...Object.entries(METHOD_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))]} />

      {loading ? (
        <RowsSkeleton n={6} />
      ) : payments.length === 0 ? (
        search || methodFilter ? (
          <EmptyState icon={Search} title={search ? `No payments match "${search}"` : "No payments with this method"} text="Try another word or method." />
        ) : (
          <EmptyState icon={CreditCard} title="No payments yet" text="Record the first payment from a client."
            action={<MainButton icon={Plus} onClick={openNew}>Record payment</MainButton>} />
        )
      ) : (
        <Group>
          {payments.map(p => <PaymentListRow key={p.id} payment={p} onEdit={openEdit} onDelete={p => setDeleteTarget(p)} />)}
        </Group>
      )}

      <Pager page={page} pages={totalPages} onChange={setPage} />

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
