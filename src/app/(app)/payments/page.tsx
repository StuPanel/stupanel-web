"use client";

import { apiFetch } from "@/lib/api";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Search, CreditCard, Loader2, AlertTriangle, MoreHorizontal,
  Edit3, Trash2, Banknote, Clock, Smartphone, Receipt as ReceiptIcon,
  Building2, CheckCircle2, TrendingUp, Calendar, FileText, Wallet,
} from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField, StatCard, Tile } from "@/components/ui/apple";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { DuesView, type DueProgram } from "./_components/dues";
import { AccountPicker } from "@/components/account-picker";
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
  wallet?: { id: string; name: string; type: string } | null;
  receiptNumber?: string | null;
  receiptToken?: string | null;
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

import { CURRENCY_OPTIONS, currencyPad, currencySymbol, formatCurrency, getStudioCurrency, localDateStr, fmtDate } from "@/lib/format";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { jumpToField } from "@/lib/jump-to-field";
function fmt(n: number, cur?: string) { return formatCurrency(n, cur); }
function clientName(c: Client) { return [c.firstName, c.lastName].filter(Boolean).join(" "); }
function today() { return localDateStr(); }

// ─── Record Payment Drawer ────────────────────────────────────────────────

function PaymentDrawer({
  open, onClose, onSaved, editing, bookings, preset,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Payment | null;
  bookings: Booking[];
  /** From Payments → Due: this program, its due amount as a final payment. */
  preset?: { bookingId: string; amount: number } | null;
}) {
  const isEdit = !!editing;

  const blank = {
    bookingId: "", amount: "", currency: getStudioCurrency(),
    paymentMethod: "cash" as PaymentMethod,
    paymentStatus: "completed" as PaymentStatus,
    paymentDate: today(),
    paymentType: "advance",
    referenceNumber: "", transactionId: "", notes: "", walletId: "",
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
          walletId: editing.wallet?.id ?? "",
        });
      } else if (preset) {
        setForm({ ...blank, bookingId: preset.bookingId, amount: String(preset.amount), paymentType: "final" });
      } else {
        setForm(blank);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, preset]);

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
      currency: booking?.currency ?? getStudioCurrency(),
    }));
  }

  const selectedBooking = bookings.find(b => b.id === form.bookingId);
  const remaining = selectedBooking
    ? Math.max(0, selectedBooking.grandTotal - selectedBooking.paidAmount)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bookingId) { setError("Please select a booking."); jumpToField("booking"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Amount must be greater than 0."); jumpToField("amount"); return; }
    if (!form.walletId) { setError("Pick the account the money went into."); jumpToField("wallet"); return; }
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
      walletId: form.walletId,
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
  const sym = currencySymbol(form.currency).trim();

  return (
    <FormDrawer open onClose={onClose} icon={Wallet} color="green"
      title={isEdit ? "Edit payment" : "Record payment"}
      sub={isEdit ? (editing?.receiptNumber ? `Receipt ${editing.receiptNumber}` : "Change the details") : "Money received for a program"}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
          <button type="submit" form="payment-form" disabled={loading} className="flex-1 h-11 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}{isEdit ? "Save changes" : "Record payment"}
          </button>
        </>
      }>
      <form id="payment-form" onSubmit={handleSubmit} noValidate>
        {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{error}</p>}

        <FormGroup>
          <Field label="Program" required name="booking">{id => (
            <select id={id} value={form.bookingId} onChange={handleBookingChange} className={inputCls}>
              <option value="">Choose a program…</option>
              {bookings.map(b => (
                <option key={b.id} value={b.id}>{b.bookingNumber} — {b.eventName || "Untitled"} ({formatCurrency(b.grandTotal, b.currency)})</option>
              ))}
            </select>
          )}</Field>
        </FormGroup>

        {remaining !== null && remaining > 0 && (
          <div className="-mt-2 mb-5 flex items-center justify-between gap-3 rounded-[16px] bg-[#FDECEF] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#9C2340]">Still to pay</p>
              <p className="text-[17px] font-extrabold text-[#C2304F] tabular-nums">{fmt(remaining, selectedBooking!.currency)}</p>
            </div>
            <button type="button" onClick={() => setForm(prev => ({ ...prev, amount: String(remaining) }))}
              className="h-9 px-3.5 rounded-full bg-white text-[#C2304F] text-[13px] font-semibold flex-shrink-0 hover:bg-[#FFF5F7]">Use this amount</button>
          </div>
        )}
        {remaining === 0 && selectedBooking && (
          <p className="-mt-2 mb-5 rounded-[16px] bg-[#E9F5EF] px-4 py-3 text-[13px] font-semibold text-[#14613F] inline-flex items-center gap-2 w-full">
            <CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />This program is fully paid.
          </p>
        )}

        <FormGroup>
          <div className="grid grid-cols-[1fr_auto]">
            <Field label="Amount" required name="amount" className="min-w-0">{id => (
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-[15px] font-semibold">{sym}</span>
                <input id={id} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={form.amount} onChange={set("amount")}
                  className={cn(inputCls, "pl-8 text-[17px] font-bold tabular-nums")} style={{ paddingLeft: currencyPad(form.currency) }} />
              </div>
            )}</Field>
            <Field label="Currency" className="pl-0 w-[112px]">{id => (
              <select id={id} value={form.currency} onChange={set("currency")} className={inputCls}>
                {CURRENCY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
              </select>
            )}</Field>
          </div>
          <div className="grid grid-cols-2">
            <Field label="Method" className="min-w-0">{id => (
              <select id={id} value={form.paymentMethod} onChange={set("paymentMethod")} className={inputCls}>
                {Object.entries(METHOD_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            )}</Field>
            <Field label="Type" className="pl-0 min-w-0">{id => (
              <select id={id} value={form.paymentType} onChange={set("paymentType")} className={inputCls}>
                {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            )}</Field>
          </div>
          <div className="px-4 py-3.5">
            <AccountPicker key={editing?.id ?? "new"} value={form.walletId} method={form.paymentMethod}
              onChange={id => setForm(prev => ({ ...prev, walletId: id }))} />
          </div>
          <div className="grid grid-cols-2">
            <Field label="Date" required className="min-w-0">{id => <input id={id} type="date" value={form.paymentDate} onChange={set("paymentDate")} className={inputCls} />}</Field>
            <Field label="Status" className="pl-0 min-w-0">{id => (
              <select id={id} value={form.paymentStatus} onChange={set("paymentStatus")} className={inputCls}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            )}</Field>
          </div>
        </FormGroup>
        {isEdit && editing?.receiptNumber && (
          <p className="-mt-3 mb-5 px-1 text-xs text-[#6B6680] leading-relaxed">If you change the amount, date, method, account or transaction ID, receipt {editing.receiptNumber} is cancelled and a new number is given.</p>
        )}

        <FormGroup title="Optional">
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <Field label="Reference no." className="min-w-0">{id => <input id={id} placeholder="Optional" value={form.referenceNumber} onChange={set("referenceNumber")} className={inputCls} />}</Field>
            <Field label="Transaction ID" className="min-w-0 sm:pl-0">{id => <input id={id} placeholder="Optional" value={form.transactionId} onChange={set("transactionId")} className={inputCls} />}</Field>
          </div>
          <Field label="Note">{id => (
            <textarea id={id} value={form.notes} onChange={set("notes")} rows={2} placeholder="Anything to remember about this payment"
              className={cn(inputCls, "h-auto py-3 resize-none leading-relaxed")} />
          )}</Field>
        </FormGroup>
      </form>
    </FormDrawer>
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
          <div className="w-14 h-14 rounded-full bg-[#FDECEF] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-[#C2304F]" />
          </div>
          <h3 className="font-extrabold text-[#17151F] text-lg">Delete this payment?</h3>
          <p className="text-[#6B6680] text-sm mt-2">
            {fmt(payment.amount, payment.currency)} payment for{" "}
            <span className="font-semibold text-[#33303F]">{payment.booking.bookingNumber}</span> will be removed.
          </p>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
            <button type="button" onClick={doDelete} disabled={loading}
              className="flex-1 h-11 rounded-full bg-[#C2304F] hover:bg-[#A82642] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
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
          {payment.receiptNumber && <span className="font-semibold text-[#4A4658]">{payment.receiptNumber} · </span>}
          {clientName(payment.client)} · {payment.wallet ? payment.wallet.name : M.label} · <span className="capitalize">{type}</span>
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
            {payment.receiptToken && <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px]" onClick={() => window.open(`/r/${payment.receiptToken}`, "_blank")}><ReceiptIcon className="w-4 h-4" /> Money receipt</DropdownMenuItem>}
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
  return <Suspense fallback={<RowsSkeleton n={6} />}><Payments /></Suspense>;
}

function Payments() {
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
  // Received (payments in) or Due (who still owes). Kept in the address: /payments?view=due
  const params = useSearchParams();
  const [view, setView] = useState<"received" | "due">(params.get("view") === "due" ? "due" : "received");
  const [preset, setPreset] = useState<{ bookingId: string; amount: number } | null>(null);
  const [duesKey, setDuesKey] = useState(0);
  const { companyName } = useAuth();

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

  function openNew() { setEditTarget(null); setPreset(null); setDrawer(true); }
  function openEdit(p: Payment) { setEditTarget(p); setPreset(null); setDrawer(true); }
  function onSaved() { fetchPayments(); fetchBookings(); setDuesKey(k => k + 1); }
  function recordFor(p: DueProgram) { setEditTarget(null); setPreset({ bookingId: p.id, amount: p.due }); setDrawer(true); }
  function switchView(v: "received" | "due") {
    setView(v);
    window.history.replaceState(null, "", v === "due" ? "?view=due" : window.location.pathname);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <PageHeader icon={CreditCard} color="green" title="Payments"
        sub={view === "due" ? "Clients with money due" : total ? `${total} payment${total === 1 ? "" : "s"}` : "Money you received"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder={view === "due" ? "Search client or program" : "Search payments"} />
        <MainButton icon={Plus} onClick={openNew}>Record payment</MainButton>
      </PageHeader>

      <div role="tablist" aria-label="Payments" className="mb-6 inline-flex p-1 rounded-full bg-white/80 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
        {([["received", "Received", Banknote], ["due", "Due", Clock]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => switchView(id)}
            className={cn("h-9 px-4 sm:px-5 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5 transition-colors",
              view === id ? (id === "due" ? "bg-[#C2304F] text-white" : "bg-[#1F8A5B] text-white") : "text-[#4A4658] hover:text-[#17151F]")}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {view === "due" ? (
        <DuesView search={search} refreshKey={duesKey} studioName={companyName} onRecord={recordFor} />
      ) : (<>
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
      </>)}

      {/* Drawers */}
      <PaymentDrawer
        open={drawer}
        onClose={() => { setDrawer(false); setEditTarget(null); setPreset(null); }}
        onSaved={onSaved}
        editing={editTarget}
        bookings={bookings}
        preset={preset}
      />
      <DeleteDialog
        payment={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={fetchPayments}
      />
    </div>
  );
}
