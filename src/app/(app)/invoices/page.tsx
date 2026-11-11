"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, Loader2, Search, Eye, Trash2, Send, CheckCircle2,
  FileText, Link2, Copy, AlertCircle,
  DollarSign, Clock, TrendingUp, ChevronRight,
  BookOpen, Bell, Receipt, Wallet, CalendarDays,
} from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField, StatCard, Tile } from "@/components/ui/apple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { CURRENCY_OPTIONS, currencyPad, currencySymbol, getStudioCurrency, fmtDate, formatCurrency, localDateStr } from "@/lib/format";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { DocCard, DocDrawer, DocLine, PillButton, StatusChip } from "@/components/ui/doc-drawer";
import { InvoicePreview, type InvoicePreviewData } from "@/components/invoice-preview";
import { askConfirm } from "@/components/feedback";
import { AccountPicker } from "@/components/account-picker";

const SITE = typeof window !== "undefined" ? window.location.origin : "";
const sym = (cur?: string) => currencySymbol(cur || getStudioCurrency());

const UNITS = ["service", "hour", "day", "piece", "album", "copy", "session", "package", "item", "GB"];
const CATEGORIES = ["Photography", "Cinematography", "Drone", "Editing", "Album", "Printing", "Other"];
// Values must match the API's PaymentMethodType enum (bKash/Nagad/Rocket are "mobile_banking").
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile_banking", label: "Mobile wallet" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit_card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];
const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", mobile_banking: "Mobile wallet", bank_transfer: "Bank transfer",
  credit_card: "Card", debit_card: "Card", cheque: "Cheque", online_gateway: "Online", other: "Other",
};

const STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  draft:          { label: "Draft",         badge: "bg-[#F1EFF6] text-[#4A4658]",   dot: "bg-[#8A8599]"   },
  sent:           { label: "Sent",          badge: "bg-[#E8F0FA] text-[#1F5C99]",     dot: "bg-[#2F6FB3]"    },
  viewed:         { label: "Viewed",        badge: "bg-[#EEE8FD] text-[#5B3FD0]", dot: "bg-[#7D5CEF]"  },
  paid:           { label: "Paid",          badge: "bg-[#E7F5EE] text-[#1F8A5B]",dot:"bg-[#1F8A5B]" },
  partially_paid: { label: "Part. Paid",    badge: "bg-[#FFF3E0] text-[#9A5B00]",   dot: "bg-[#D88A12]"   },
  overdue:        { label: "Overdue",       badge: "bg-[#FDECEF] text-[#C2304F]",       dot: "bg-[#C2304F]"     },
  void:           { label: "Void",          badge: "bg-[#F1EFF6] text-[#8A8599]",   dot: "bg-[#B5B0C4]"   },
};

function calcItemTotal(qty: number, unitPrice: number, discountType?: string, discountValue?: number): number {
  const base = qty * unitPrice;
  if (!discountType || discountType === "none" || !discountValue) return base;
  const disc = discountType === "percent" ? (base * discountValue) / 100 : discountValue;
  return Math.max(0, base - disc);
}

interface Client { id: string; firstName: string; lastName?: string; phone?: string; email?: string; }
interface Booking { id: string; bookingNumber: string; eventName?: string; }
interface InvoiceItem {
  id: string; name: string; description?: string;
  category?: string; unit?: string;
  quantity: number; unitPrice: number;
  discountType?: string; discountValue?: number;
  itemNotes?: string; total: number;
}
interface InvoicePayment {
  id: string; amount: number; paymentMethod: string; paymentDate: string;
  referenceNumber?: string; transactionId?: string; notes?: string;
}
interface ServiceCatalogItem {
  id: string; name: string; description?: string; category?: string;
  unit: string; defaultPrice: number; currency: string;
}
/** Status everyone sees — worked out by the API from payments and the due date. */
const STATE: Record<string, { label: string; bg: string; text: string }> = {
  unpaid: { label: "Unpaid", bg: "#FBF2FA", text: "#9E3A8C" },
  partly_paid: { label: "Partly paid", bg: "#FBF2FA", text: "#823072" },
  paid: { label: "Paid", bg: "#E9F5EF", text: "#1F8A5B" },
  overdue: { label: "Overdue", bg: "#FDECEF", text: "#C2304F" },
  cancelled: { label: "Cancelled", bg: "#EEEDF2", text: "#6B6680" },
};

interface Invoice {
  id: string; invoiceNumber: string; status: string; publicToken: string; state?: string; docType?: string;
  subtotal: number; discountAmount: number; taxLabel?: string; taxPercent: number;
  taxAmount: number; grandTotal: number; paidAmount: number; balanceDue: number;
  currency: string; issueDate: string; dueDate?: string;
  notes?: string; termsConditions?: string;
  sentAt?: string; viewedAt?: string; paidAt?: string;
  client: Client; booking?: Booking; items: InvoiceItem[];
  payments?: InvoicePayment[];
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: "success"|"error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={cn("sp-toast",
      type === "success" ? "" : "sp-toast--err")}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Service Catalog Modal ─────────────────────────────────────────────────────
function CatalogModal({ onSelect, onClose, currency }: {
  onSelect: (item: ServiceCatalogItem) => void; onClose: () => void; currency: string;
}) {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "100", ...(search && { search }), ...(cat && { category: cat }) });
    apiFetch(`${API}/service-catalog?${p}`).then(r => r.json()).then(d => {
      setItems(d.data ?? []);
    }).catch(() => setItems([])).finally(() => setLoading(false));
  }, [search, cat]);

  return (
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Service catalog"
          className="pointer-events-auto w-full sm:max-w-lg sp-modal !bg-[#F5F3FA] rounded-b-none sm:rounded-[24px] flex flex-col max-h-[85dvh]">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <Tile icon={BookOpen} color="orchid" size={40} />
            <div className="flex-1 min-w-0">
              <h3 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">Service catalog</h3>
              <p className="text-[13px] text-[#6B6680] mt-0.5">Tap a service to add it</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-[#EEEBF4] text-[#6B6680]"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-4 sm:px-5 pb-3 space-y-3">
            <SearchField value={search} onChange={setSearch} placeholder="Search services" />
            <Chips label="Category" value={cat || "all"} onChange={v => setCat(v === "all" ? "" : v)}
              options={[{ value: "all", label: "All" }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} />
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-5">
            {loading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" aria-label="Loading" /></div>
            ) : items.length === 0 ? (
              <div className="bg-white rounded-[20px] text-center py-10 px-6">
                <span className="w-12 h-12 rounded-full bg-[#EEE8FD] flex items-center justify-center mx-auto"><BookOpen className="w-5 h-5 text-[#5B3FD0]" /></span>
                <p className="mt-3 text-[15px] font-bold text-[#17151F]">{search || cat ? "Nothing matches" : "No services yet"}</p>
                <p className="text-[13px] text-[#6B6680] mt-1">{search || cat ? "Try another word or category." : "Add them in Settings → Money → Service catalog."}</p>
              </div>
            ) : (
              <div className="bg-white rounded-[20px] divide-y divide-[#EEEBF4] overflow-hidden">
                {items.map(item => (
                  <button key={item.id} type="button" onClick={() => onSelect(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F5FB] transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{item.name}</span>
                      <span className="block text-[12.5px] text-[#6B6680] truncate mt-0.5">{[item.category, item.unit, item.description].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="text-[14px] font-bold text-[#17151F] tabular-nums flex-shrink-0">{formatCurrency(Number(item.defaultPrice), currency)}</span>
                    <Plus className="w-4 h-4 text-[#7D5CEF] flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, onChange, onRemove, canRemove, currency }: {
  item: InvoiceItem; onChange: (i: InvoiceItem) => void; onRemove: () => void; canRemove: boolean; currency: string;
}) {
  const s = sym(currency);
  const discType = item.discountType ?? "none";

  function recalc(updates: Partial<InvoiceItem>) {
    const merged = { ...item, ...updates };
    const total = calcItemTotal(merged.quantity, merged.unitPrice, merged.discountType, merged.discountValue);
    onChange({ ...merged, total });
  }

  return (
    <div className="p-3 bg-[#F7F5FB] rounded-[16px] space-y-2">
      {/* Row 1: Name + Description */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={item.name} onChange={e => onChange({ ...item, name: e.target.value })}
              placeholder="Item name *" className="flex-1 h-9 px-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
            <input value={item.description ?? ""} onChange={e => onChange({ ...item, description: e.target.value })}
              placeholder="Description" className="flex-1 h-9 px-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          {/* Row 2: Category + Unit */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 relative">
              <input value={item.category ?? ""} onChange={e => onChange({ ...item, category: e.target.value })}
                list={`cat-list-${item.id}`} placeholder="Category"
                className="w-full h-8 px-3 rounded-lg border border-[#E4E0EC] text-xs focus:outline-none focus:border-indigo-400 bg-white" />
              <datalist id={`cat-list-${item.id}`}>
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <select value={item.unit ?? "service"} onChange={e => onChange({ ...item, unit: e.target.value })}
              className="h-8 px-2 rounded-lg border border-[#E4E0EC] bg-white text-xs focus:outline-none focus:border-indigo-400">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {/* Row 3: Qty + Price + Discount */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#6B6680]">Qty</span>
              <input type="number" min="0.01" step="0.01" value={item.quantity}
                onChange={e => recalc({ quantity: Number(e.target.value) || 0 })}
                className="w-16 h-8 px-2 text-center rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-24">
              <span className="text-xs text-[#6B6680]">Price</span>
              <input type="number" min="0" value={item.unitPrice}
                onChange={e => recalc({ unitPrice: Number(e.target.value) || 0 })}
                className="flex-1 h-8 px-2 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
            </div>
            {/* Discount toggle */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#6B6680]">Disc</span>
              <select value={discType} onChange={e => recalc({ discountType: e.target.value === "none" ? undefined : e.target.value, discountValue: undefined })}
                className="h-8 px-1.5 rounded-lg border border-[#E4E0EC] bg-white text-xs focus:outline-none focus:border-indigo-400">
                <option value="none">—</option>
                <option value="percent">%</option>
                <option value="fixed">{s}</option>
              </select>
              {discType !== "none" && (
                <input type="number" min="0" value={item.discountValue ?? ""}
                  onChange={e => recalc({ discountValue: Number(e.target.value) || 0 })}
                  placeholder={discType === "percent" ? "%" : s}
                  className="w-16 h-8 px-2 rounded-lg border border-[#F3C979] text-sm focus:outline-none focus:border-[#E9A63A] bg-white" />
              )}
            </div>
          </div>
        </div>
        {canRemove && (
          <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#FEF5F7] text-[#8A8599] hover:text-[#C2304F] mt-1 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* Item total */}
      <div className="flex items-center justify-between pt-1 border-t border-[#E4E0EC]">
        <div className="flex gap-2 text-xs text-[#8A8599]">
          <span>{item.quantity} {item.unit || "service"} × {s}{Number(item.unitPrice).toLocaleString()}</span>
          {discType !== "none" && item.discountValue && (
            <span className="text-[#D88A12]">
              − {discType === "percent" ? `${item.discountValue}%` : `${s}${item.discountValue.toLocaleString()}`}
            </span>
          )}
        </div>
        <span className="font-bold text-sm text-[#17151F]">{s}{item.total.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Record Payment ───────────────────────────────────────────────────────────
function RecordPaymentForm({ inv, onDone, onClose }: { inv: Invoice; onDone: () => void; onClose: () => void }) {
  const balance = Number(inv.balanceDue);
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const [method, setMethod] = useState("cash");
  const [payDate, setPayDate] = useState(localDateStr());
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [walletId, setWalletId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    if (amt > balance) { setError(`That's more than what's still due (${formatCurrency(balance, inv.currency)}).`); return; }
    if (!walletId) { setError("Pick the account the money went into."); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/studio-invoices/${inv.id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt, paymentMethod: method,
          paymentDate: payDate,
          referenceNumber: ref || undefined,
          notes: notes || undefined,
          walletId,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't record the payment."); return; }
      onDone();
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  return (
    <FormDrawer open onClose={onClose} onTop icon={Wallet} color="green" title="Record payment" sub={`${inv.invoiceNumber} · ${inv.client.firstName} ${inv.client.lastName ?? ""}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 h-11 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}Record payment
          </button>
        </>
      }>
      <div className="mb-4 flex items-center justify-between rounded-[16px] bg-[#FDECEF] px-4 py-3">
        <span className="text-[13px] font-semibold text-[#9C2340]">Still to pay</span>
        <span className="text-[17px] font-extrabold text-[#C2304F] tabular-nums">{formatCurrency(balance, inv.currency)}</span>
      </div>
      {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{error}</p>}

      <FormGroup>
        <Field label="Amount" required>{id => (
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-[15px] font-semibold">{currencySymbol(inv.currency).trim()}</span>
            <input id={id} type="number" inputMode="decimal" min="0" max={balance} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus
              className={cn(inputCls, "pl-8 text-[17px] font-bold tabular-nums")} style={{ paddingLeft: currencyPad(inv.currency) }} />
          </div>
        )}</Field>
        <div className="grid grid-cols-2">
          <Field label="Method">{id => (
            <select id={id} value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}</Field>
          <Field label="Date" className="pl-0">{id => <input id={id} type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls} />}</Field>
        </div>
        <div className="px-4 py-3.5"><AccountPicker value={walletId} onChange={setWalletId} method={method} /></div>
      </FormGroup>

      <FormGroup>
        <Field label="Reference / transaction ID">{id => <input id={id} value={ref} onChange={e => setRef(e.target.value)} placeholder="Optional" className={inputCls} />}</Field>
        <Field label="Note">{id => <input id={id} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className={inputCls} />}</Field>
      </FormGroup>
    </FormDrawer>
  );
}

// ─── Create Drawer ─────────────────────────────────────────────────────────────
function CreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (inv: Invoice) => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdown, setClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [currency, setCurrency] = useState(getStudioCurrency());
  const [issueDate, setIssueDate] = useState(localDateStr());
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate()+7); return localDateStr(d); });
  const [items, setItems] = useState<InvoiceItem[]>([{ id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [taxLabel, setTaxLabel] = useState("VAT");
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [companyData, setCompanyData] = useState<any>({});
  const [catalogOpen, setCatalogOpen] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const afterDisc = Math.max(0, subtotal - discountAmount);
  const taxAmt = afterDisc * (taxPercent / 100);
  const grand = afterDisc + taxAmt;
  const s = sym(currency);

  useEffect(() => {
    apiFetch(`${API}/clients?limit=200`).then(r => r.json()).then(d => setClients(d.data ?? []));
    apiFetch(`${API}/bookings?limit=200`).then(r => r.json()).then(d => setBookings(d.data ?? []));
    apiFetch(`${API}/companies/me`).then(r => r.json()).then(d => {
      if (d.taxLabel) setTaxLabel(d.taxLabel);
      if (d.defaultTaxPercent) setTaxPercent(Number(d.defaultTaxPercent));
      if (d.defaultTerms) setTerms(d.defaultTerms);
      if (d.currency) setCurrency(d.currency);
      if (d.invoiceDueDays) {
        const dd = new Date();
        dd.setDate(dd.getDate() + Number(d.invoiceDueDays));
        setDueDate(localDateStr(dd));
      }
      setCompanyData(d);
    }).catch(() => {});
  }, []);

  const filteredClients = clients.filter(c =>
    `${c.firstName} ${c.lastName ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const clientBookings = bookings.filter(b => selectedClient && (b as any).clientId === selectedClient.id);

  function addFromCatalog(cat: ServiceCatalogItem) {
    const newItem: InvoiceItem = {
      id: crypto.randomUUID(),
      name: cat.name, description: cat.description,
      category: cat.category, unit: cat.unit,
      quantity: 1, unitPrice: cat.defaultPrice,
      total: cat.defaultPrice,
    };
    setItems(its => [...its, newItem]);
    setCatalogOpen(false);
  }

  async function save() {
    if (!selectedClient) { setError("Select a client."); return; }
    if (items.every(i => !i.name.trim())) { setError("Add at least one item."); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/studio-invoices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id, bookingId: selectedBookingId || undefined,
          currency, issueDate, dueDate: dueDate || undefined,
          taxLabel, taxPercent, discountAmount,
          notes: notes || undefined, termsConditions: terms || undefined,
          items: items.filter(i => i.name.trim()).map(i => ({
            name: i.name, description: i.description,
            category: i.category, unit: i.unit,
            quantity: i.quantity, unitPrice: i.unitPrice,
            discountType: i.discountType, discountValue: i.discountValue,
            itemNotes: i.itemNotes, total: i.total,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed."); return; }
      onSaved(d);
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  const linkedBooking = bookings.find(b => b.id === selectedBookingId) as any;
  const previewData: InvoicePreviewData = {
    company: {
      name: companyData?.name || "Your Studio",
      email: companyData?.email, phone: companyData?.phone,
      address: companyData?.address, city: companyData?.city,
      logoUrl: companyData?.logoUrl, primaryColor: companyData?.primaryColor,
      invoiceHeaderStyle: companyData?.invoiceHeaderStyle,
      invoiceShowPayment: companyData?.invoiceShowPayment,
      invoiceShowLogo: companyData?.invoiceShowLogo,
      invoiceShowSignature: companyData?.invoiceShowSignature,
      invoiceSignatureText: companyData?.invoiceSignatureText,
      invoiceFooter: companyData?.invoiceFooter,
      bankName: companyData?.bankName, bankBranch: companyData?.bankBranch,
      bankAccountName: companyData?.bankAccountName,
      bankAccountNumber: companyData?.bankAccountNumber,
      bkashNumber: companyData?.bkashNumber, nagadNumber: companyData?.nagadNumber,
    },
    invoiceNumber: `${companyData?.invoicePrefix || "INV"}-###`,
    issueDate, dueDate: dueDate || undefined, currency,
    clientName: selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName ?? ""}`.trim() : "Client Name",
    clientPhone: selectedClient?.phone, clientEmail: selectedClient?.email,
    bookingName: linkedBooking?.eventName, bookingRef: linkedBooking?.bookingNumber,
    items: items.filter(i => i.name.trim()).length
      ? items.filter(i => i.name.trim()).map(i => ({ name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total }))
      : [{ name: "Photography Service", quantity: 1, unitPrice: 0, total: 0 }],
    subtotal, discountAmount, taxLabel, taxPercent,
    taxAmount: Math.round(taxAmt * 100) / 100,
    grandTotal: Math.round(grand * 100) / 100,
    paidAmount: 0, balanceDue: Math.round(grand * 100) / 100,
    notes: notes || undefined, termsConditions: terms || undefined,
  };

  return (
    <>
      {catalogOpen && <CatalogModal currency={currency} onSelect={addFromCatalog} onClose={() => setCatalogOpen(false)} />}
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-stretch justify-end">
        <div className="w-full max-w-[1160px] bg-white shadow-[-16px_0_48px_rgba(22,18,40,.22)] flex sm:rounded-l-[24px] overflow-hidden">

          {/* ── LEFT: Form panel ── */}
          <div className="sp-form w-full lg:w-[460px] flex-shrink-0 flex flex-col border-r border-[#EEEBF4] overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#EEEBF4] flex-shrink-0">
              <Tile icon={Receipt} color="orchid" size={40} />
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">New invoice</h2>
                <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">The preview on the right updates as you type</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#6B6680]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && <p className="text-xs text-[#C2304F] bg-[#FEF5F7] border border-[#FDECEF] px-3 py-2 rounded-lg">{error}</p>}

              {/* Client */}
              <div className="space-y-1.5 relative">
                <Label className="text-[13px] font-semibold text-[#4A4658]">Client *</Label>
                {selectedClient ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-[#F7F4FE] border border-indigo-200 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-[#5B3FD0] font-bold text-sm">{selectedClient.firstName[0]}</div>
                    <div className="flex-1"><p className="font-semibold text-[#17151F] text-sm">{selectedClient.firstName} {selectedClient.lastName ?? ""}</p><p className="text-xs text-[#8A8599]">{selectedClient.phone}</p></div>
                    <button onClick={() => { setSelectedClient(null); setSelectedBookingId(""); }} className="text-[#8A8599] hover:text-[#C2304F]"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599]" />
                    <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setClientDropdown(true); }}
                      onFocus={() => setClientDropdown(true)}
                      placeholder="Search client…"
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400" />
                    {clientDropdown && filteredClients.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E4E0EC] rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                        {filteredClients.slice(0,8).map(c => (
                          <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(""); setClientDropdown(false); }}
                            className="w-full px-4 py-2.5 text-left hover:bg-[#F7F4FE] text-sm flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#E4E0EC] flex items-center justify-center text-xs font-bold">{c.firstName[0]}</div>
                            <div><p className="font-medium text-[#17151F]">{c.firstName} {c.lastName ?? ""}</p><p className="text-xs text-[#8A8599]">{c.phone}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Booking link */}
              {selectedClient && clientBookings.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#4A4658]">Link to Booking <span className="text-[#8A8599] font-normal normal-case">(optional)</span></Label>
                  <select value={selectedBookingId} onChange={e => setSelectedBookingId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#E4E0EC] bg-white text-sm focus:outline-none focus:border-indigo-400">
                    <option value="">No booking linked</option>
                    {clientBookings.map(b => <option key={b.id} value={b.id}>{b.bookingNumber} — {b.eventName || "Untitled"}</option>)}
                  </select>
                </div>
              )}

              {/* Dates + Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#4A4658]">Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="h-10 border-[#E4E0EC] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#4A4658]">Due Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-10 border-[#E4E0EC] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#4A4658]">Currency</Label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] bg-white text-sm focus:outline-none focus:border-indigo-400">
                    {CURRENCY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px] font-semibold text-[#4A4658]">Line Items *</Label>
                  <div className="flex gap-2">
                    <button onClick={() => setCatalogOpen(true)}
                      className="text-xs text-[#7D5CEF] hover:text-[#5B3FD0] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#F7F4FE]">
                      <BookOpen className="w-3.5 h-3.5" />Catalog
                    </button>
                    <button onClick={() => setItems(its => [...its, { id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 }])}
                      className="text-xs text-[#7D5CEF] hover:text-[#5B3FD0] font-semibold flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />Add Item
                    </button>
                  </div>
                </div>
                {items.map((item, i) => (
                  <ItemRow key={item.id} item={item} currency={currency}
                    onChange={upd => setItems(its => its.map((x, j) => j === i ? upd : x))}
                    onRemove={() => setItems(its => its.filter((_, j) => j !== i))}
                    canRemove={items.length > 1} />
                ))}
              </div>

              {/* Pricing */}
              <div className="bg-[#F7F5FB] border border-[#E4E0EC] rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-[#6B6680]">Discount ({s})</Label>
                    <input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[#6B6680]">Tax Label</Label>
                    <input value={taxLabel} onChange={e => setTaxLabel(e.target.value)} maxLength={10}
                      className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[#6B6680]">Tax %</Label>
                    <input type="number" min="0" max="30" step="0.5" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
                  </div>
                </div>
                <div className="border-t border-[#E4E0EC] pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-[#6B6680]"><span>Subtotal</span><span>{s}{subtotal.toLocaleString()}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-[#1F8A5B]"><span>Discount</span><span>−{s}{discountAmount.toLocaleString()}</span></div>}
                  {taxAmt > 0 && <div className="flex justify-between text-[#6B6680]"><span>{taxLabel} ({taxPercent}%)</span><span>+{s}{Math.round(taxAmt).toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold text-[#17151F] text-base border-t border-[#E4E0EC] pt-2"><span>Grand Total</span><span>{s}{Math.round(grand).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Notes + Terms */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#4A4658]">Notes</Label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any notes for the client…"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#4A4658]">Terms & Conditions</Label>
                  <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} placeholder="Payment terms…"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 resize-none" />
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-[#E4E0EC] flex gap-3 flex-shrink-0">
              <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-[#E4E0EC] text-[#4A4658]">Cancel</Button>
              <Button disabled={saving} onClick={save} className="flex-1 h-11 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : <><FileText className="w-4 h-4" />Create Invoice</>}
              </Button>
            </div>
          </div>

          {/* ── RIGHT: Live preview ── */}
          <div className="hidden lg:flex flex-1 flex-col bg-[#F1EFF6] overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex-shrink-0 border-b border-[#E4E0EC] bg-white">
              <p className="text-xs font-semibold text-[#8A8599] uppercase tracking-widest">Live Preview</p>
            </div>
            <div className="flex-1 overflow-y-auto py-6 px-4">
              <div className="max-w-[680px] mx-auto rounded-xl overflow-hidden shadow-lg">
                <InvoicePreview data={previewData} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── View Drawer ─────────────────────────────────────────────────────────────
function ViewDrawer({ inv: initialInv, onClose, onRefresh }: { inv: Invoice; onClose: () => void; onRefresh: () => void }) {
  const [inv, setInv] = useState<Invoice>(initialInv);
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [acting, setActing] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [payments, setPayments] = useState<InvoicePayment[]>(initialInv.payments ?? []);
  const [payLoading, setPayLoading] = useState(false);
  const s = STATUS[inv.status] ?? STATUS.draft;
  const url = `${SITE}/inv/${inv.publicToken}`;

  async function loadPayments() {
    setPayLoading(true);
    try {
      const r = await apiFetch(`${API}/studio-invoices/${inv.id}/payments`);
      const d = await r.json();
      setPayments(d ?? []);
    } finally { setPayLoading(false); }
  }

  useEffect(() => { loadPayments(); }, [inv.id]);

  async function doAction(path: string, msg: string, method: string = "PATCH") {
    setActing(true);
    try {
      const r = await apiFetch(`${API}/studio-invoices/${inv.id}/${path}`, { method, headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error();
      if (method === "POST") {
        setToast({ msg, type: "success" });
      } else {
        const updated = await apiFetch(`${API}/studio-invoices/${inv.id}`).then(rr => rr.json());
        setInv(updated);
        setToast({ msg, type: "success" });
        onRefresh();
      }
    } catch { setToast({ msg: "Action failed.", type: "error" }); }
    finally { setActing(false); }
  }

  async function doDelete() {
    if (!(await askConfirm({ message: `Delete invoice ${inv.invoiceNumber}?`, danger: true }))) return;
    setActing(true);
    try {
      await apiFetch(`${API}/studio-invoices/${inv.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      onClose(); onRefresh();
    } catch { setToast({ msg: "Delete failed.", type: "error" }); }
    finally { setActing(false); }
  }

  async function onPaymentDone() {
    setRecordingPayment(false);
    setToast({ msg: "Payment recorded!", type: "success" });
    const updated = await apiFetch(`${API}/studio-invoices/${inv.id}`).then(r => r.json());
    setInv(updated);
    loadPayments();
    onRefresh();
  }

  const balance = Number(inv.balanceDue);
  const grand = Number(inv.grandTotal);
  const paid = Number(inv.paidAmount);
  const isQuote = inv.docType === "quotation";
  const money = (n: number | string) => formatCurrency(Number(n), inv.currency);
  const chip = isQuote ? { label: "Quotation", bg: "#EEE8FD", text: "#5B3FD0" }
    : STATE[inv.state ?? ""] ?? { label: s.label, ...(STATUS_HEX[inv.status] ?? STATUS_HEX.draft) };
  const pct = grand > 0 ? Math.min(100, Math.round((paid / grand) * 100)) : 0;
  const canPay = balance > 0 && inv.status !== "void" && !isQuote && (inv.booking || ["sent","viewed","partially_paid","overdue"].includes(inv.status));
  const copy = (msg: string) => { navigator.clipboard.writeText(url); setToast({ msg, type: "success" }); };
  const timeline = [
    { label: "Issued", date: inv.issueDate, dot: "#8A8599" },
    { label: "Pay by", date: inv.dueDate, dot: "#D88A12" },
    { label: "Sent", date: inv.sentAt, dot: "#2F6FB3" },
    { label: "Viewed", date: inv.viewedAt, dot: "#7D5CEF" },
    { label: "Paid", date: inv.paidAt, dot: "#1F8A5B" },
  ].filter(x => x.date);

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <DocDrawer onClose={onClose} icon={Receipt} color="orchid" title={inv.invoiceNumber} label={`Invoice ${inv.invoiceNumber}`}
        badge={<StatusChip {...chip} />}
        sub={[`${inv.client.firstName} ${inv.client.lastName ?? ""}`.trim(), inv.client.phone].filter(Boolean).join(" · ")}>

        {/* Money at a glance */}
        <DocCard>
          <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">{isQuote ? "Quoted total" : "Total"}</p>
          <p className="text-[30px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums leading-tight mt-0.5">{money(grand)}</p>
          {!isQuote && (
            <>
              <div className="mt-3 h-2 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-label="Paid so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[#1F8A5B] transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[14px] bg-[#E9F5EF] px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-[#14613F]">Received</p>
                  <p className="text-[16px] font-extrabold text-[#1F8A5B] tabular-nums">{money(paid)}</p>
                </div>
                <div className={cn("rounded-[14px] px-3 py-2.5", balance > 0 ? "bg-[#FDECEF]" : "bg-[#F5F3FA]")}>
                  <p className={cn("text-[12px] font-semibold", balance > 0 ? "text-[#9C2340]" : "text-[#6B6680]")}>{balance > 0 ? "Still due" : "Nothing due"}</p>
                  <p className={cn("text-[16px] font-extrabold tabular-nums", balance > 0 ? "text-[#C2304F]" : "text-[#4A4658]")}>{money(balance)}</p>
                </div>
              </div>
              {inv.dueDate && balance > 0 && <p className="mt-2.5 text-[12.5px] text-[#6B6680] inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Pay by {fmtDate(inv.dueDate)}</p>}
            </>
          )}
        </DocCard>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {canPay && <PillButton tone="green" icon={Wallet} onClick={() => setRecordingPayment(true)} disabled={acting}>Record payment</PillButton>}
          {inv.status === "draft" && <PillButton tone="primary" icon={Send} onClick={() => doAction("send", "Marked as sent")} disabled={acting}>Mark as sent</PillButton>}
          {!inv.booking && ["sent","viewed","partially_paid"].includes(inv.status) && (
            <PillButton icon={CheckCircle2} onClick={() => doAction("paid", "Marked as paid")} disabled={acting}>Mark paid</PillButton>
          )}
          {["sent","viewed","partially_paid","overdue"].includes(inv.status) && inv.client.email && (
            <PillButton icon={Bell} onClick={() => doAction("reminder", "Reminder sent", "POST")} disabled={acting}>Send reminder</PillButton>
          )}
          <PillButton icon={Eye} href={url} external>Preview</PillButton>
          {!inv.booking && ["draft","void"].includes(inv.status) && (
            <PillButton tone="danger" icon={Trash2} onClick={doDelete} disabled={acting}>Delete</PillButton>
          )}
        </div>

        {/* Client link */}
        <DocCard title="Client link" flush>
          <div className="flex items-center gap-3 px-4 py-3">
            <Link2 className="w-4 h-4 text-[#8A8599] flex-shrink-0" />
            <p className="text-[13px] text-[#4A4658] truncate flex-1 min-w-0">{url}</p>
            <button type="button" onClick={() => copy("Link copied")} className="h-8 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1 flex-shrink-0">
              <Copy className="w-3.5 h-3.5" />Copy
            </button>
          </div>
        </DocCard>

        {inv.booking && (
          <DocCard>
            <div className="flex items-start gap-3">
              <Tile icon={CalendarDays} color="violet" size={36} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#17151F] truncate">{inv.booking.eventName || "Untitled program"}</p>
                <p className="text-[12.5px] text-[#6B6680] font-mono">{inv.booking.bookingNumber}</p>
                <p className="text-[12.5px] text-[#6B6680] mt-1.5 leading-relaxed">This invoice follows its program. Change the price, payments and pay-by date from the program.</p>
              </div>
            </div>
          </DocCard>
        )}

        {/* Items */}
        <DocCard title="Items" flush>
          {inv.items.map(item => {
            const disc = item.discountType && item.discountType !== "none" && item.discountValue
              ? (item.discountType === "percent" ? `${item.discountValue}% off` : `${money(item.discountValue)} off`) : null;
            return (
              <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#17151F]">{item.name}</p>
                  {item.description && <p className="text-[12.5px] text-[#6B6680] mt-0.5">{item.description}</p>}
                  <p className="text-[12.5px] text-[#8A8599] mt-0.5 tabular-nums">
                    {[item.category, `${item.quantity} ${item.unit || "service"} × ${money(item.unitPrice)}`].filter(Boolean).join(" · ")}
                    {disc && <span className="text-[#9A5B00]"> · {disc}</span>}
                  </p>
                </div>
                <p className="text-[14px] font-bold text-[#17151F] tabular-nums flex-shrink-0">{money(item.total)}</p>
              </div>
            );
          })}
          <div className="px-4 py-3.5 space-y-1.5 bg-[#FAF9FC]">
            <DocLine label="Subtotal" value={money(inv.subtotal)} />
            {Number(inv.discountAmount) > 0 && <DocLine label="Discount" value={`−${money(inv.discountAmount)}`} tone="green" />}
            {Number(inv.taxAmount) > 0 && <DocLine label={`${inv.taxLabel || "Tax"} (${inv.taxPercent}%)`} value={`+${money(inv.taxAmount)}`} />}
            <DocLine label="Total" value={money(grand)} strong className="pt-1.5 border-t border-[#EEEBF4]" />
          </div>
        </DocCard>

        {/* Payments */}
        {!isQuote && (payments.length > 0 || payLoading) && (
          <DocCard title="Payments" flush>
            {payLoading ? (
              <div className="flex items-center justify-center py-5"><Loader2 className="w-4 h-4 animate-spin text-[#8A8599]" aria-label="Loading" /></div>
            ) : (
              <>
                {payments.map(pay => (
                  <div key={pay.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[#E9F5EF] text-[#1F8A5B] flex items-center justify-center flex-shrink-0"><Wallet className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#17151F]">{METHOD_LABEL[pay.paymentMethod] ?? pay.paymentMethod.replace("_", " ")}</p>
                      <p className="text-[12.5px] text-[#6B6680] truncate">{fmtDate(pay.paymentDate)}{pay.referenceNumber ? ` · ${pay.referenceNumber}` : ""}</p>
                    </div>
                    <p className="text-[14px] font-bold text-[#1F8A5B] tabular-nums flex-shrink-0">+{money(pay.amount)}</p>
                  </div>
                ))}
                <div className="px-4 py-3 bg-[#FAF9FC]">
                  <DocLine label="Received in total" value={money(payments.reduce((a, p) => a + Number(p.amount), 0))} tone="green" className="font-bold" />
                </div>
              </>
            )}
          </DocCard>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <DocCard title="Timeline">
            <ol className="space-y-2.5">
              {timeline.map(x => (
                <li key={x.label} className="flex items-center gap-3 text-[13.5px]">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: x.dot }} />
                  <span className="text-[#6B6680] w-14">{x.label}</span>
                  <span className="font-semibold text-[#17151F] tabular-nums">{fmtDate(x.date!)}</span>
                </li>
              ))}
            </ol>
          </DocCard>
        )}

        {inv.notes && (
          <DocCard title="Notes"><p className="text-[13.5px] text-[#4A4658] leading-relaxed whitespace-pre-line">{inv.notes}</p></DocCard>
        )}
      </DocDrawer>

      {recordingPayment && <RecordPaymentForm inv={inv} onDone={onPaymentDone} onClose={() => setRecordingPayment(false)} />}
    </>
  );
}

// ─── Invoice row (Apple style) ───────────────────────────────────────────────
const STATUS_HEX: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#EEEDF2", text: "#4A4658" }, sent: { bg: "#E6F0FB", text: "#1F5C99" }, viewed: { bg: "#EEE8FD", text: "#5B3FD0" },
  paid: { bg: "#E9F5EF", text: "#1F8A5B" }, partially_paid: { bg: "#FBF2FA", text: "#9E3A8C" },
  overdue: { bg: "#FDECEF", text: "#C2304F" }, void: { bg: "#EEEDF2", text: "#6B6680" },
};
function InvoiceRow({ inv, onClick }: { inv: Invoice; onClick: () => void }) {
  const quote = inv.docType === "quotation";
  const st = STATE[inv.state ?? ""] ?? null;
  const s = quote ? { label: "Quotation" } : st ? { label: st.label } : (STATUS[inv.status] ?? STATUS.draft);
  const h = quote ? { bg: "#EEE8FD", text: "#5B3FD0" } : st ? { bg: st.bg, text: st.text } : (STATUS_HEX[inv.status] ?? STATUS_HEX.draft);
  const c = sym(inv.currency);
  const due = Number(inv.balanceDue);
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] text-left hover:bg-[#F7F5FB] transition-colors">
      <Tile icon={FileText} color="orchid" size={36} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-[#17151F] truncate">{inv.client.firstName} {inv.client.lastName ?? ""}</span>
        <span className="block text-xs text-[#6B6680] truncate mt-0.5">
          <span className="font-mono">{inv.invoiceNumber}</span>{inv.booking?.eventName ? ` · ${inv.booking.eventName}` : ""} · {fmtDate(inv.issueDate)}{inv.dueDate && !quote ? ` · pay by ${fmtDate(inv.dueDate)}` : ""}
        </span>
      </span>
      <span className="text-right flex-shrink-0">
        <span className="block text-sm font-bold text-[#17151F] tabular-nums">{c}{Number(inv.grandTotal).toLocaleString()}</span>
        {due > 0
          ? <span className="block text-xs font-semibold text-[#C2304F] tabular-nums">{c}{due.toLocaleString()} due</span>
          : inv.state === "paid" ? <span className="block text-xs font-semibold text-[#1F8A5B]">Paid</span> : null}
      </span>
      <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: h.bg, color: h.text }}>{s.label}</span>
      <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState({ total: 0, totalValue: 0, totalCollected: 0, totalDue: 0, paid: 0, draft: 0, overdue: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error" } | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20", ...(search && { search }),
        ...(statusFilter === "quotation" ? { kind: "quotation" } : statusFilter ? { state: statusFilter } : {}) });
      const r = await apiFetch(`${API}/studio-invoices?${params}`, { headers: { "Content-Type": "application/json" } });
      const d = await r.json();
      setInvoices(d.data ?? []);
      setTotal(d.meta?.total ?? 0);
      if (d.meta?.stats) setStats(d.meta.stats);
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <PageHeader icon={Receipt} color="orchid" title="Invoices" sub={total ? `${total} invoice${total === 1 ? "" : "s"}` : "Bills you send to clients"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search invoice or client" />
        <MainButton icon={Plus} onClick={() => setCreateOpen(true)}>New invoice</MainButton>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <StatCard icon={FileText} color="orchid" label="Total billed" value={formatCurrency(Number(stats.totalValue))} />
        <StatCard icon={TrendingUp} color="green" label="Received" value={formatCurrency(Number(stats.totalCollected))} />
        <StatCard icon={DollarSign} color="red" label="Still due" value={formatCurrency(Number(stats.totalDue))} />
        <StatCard icon={Clock} color="red" label="Overdue" value={String(stats.overdue ?? 0)} sub="Past the pay-by date" />
      </div>

      <Chips label="Filter by status" value={statusFilter || "all"} onChange={v => setStatusFilter(v === "all" ? "" : v)}
        options={[{ value: "all", label: "All" }, ...Object.entries(STATE).map(([k, v]) => ({ value: k, label: v.label, dot: v.text })), { value: "quotation", label: "Quotations", dot: "#5B3FD0" }]} />

      {loading ? (
        <RowsSkeleton n={6} />
      ) : invoices.length === 0 ? (
        search || statusFilter ? (
          <EmptyState icon={Search} title={search ? `No invoices match "${search}"` : "No invoices with this status"} text="Try another word or filter." />
        ) : (
          <EmptyState icon={FileText} title="No invoices yet" text="Create one, or make it from a program."
            action={<MainButton icon={Plus} onClick={() => setCreateOpen(true)}>New invoice</MainButton>} />
        )
      ) : (
        <Group>
          {invoices.map(inv => (
            <InvoiceRow key={inv.id} inv={inv} onClick={async () => {
              setViewLoading(true);
              try {
                const r = await apiFetch(`${API}/studio-invoices/${inv.id}`);
                const full = await r.json();
                setViewing(full);
              } catch { setViewing(inv); }
              finally { setViewLoading(false); }
            }} />
          ))}
        </Group>
      )}

      {viewLoading && (
        <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="bg-white rounded-[20px] p-5 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" />
            <p className="text-sm font-medium text-[#33303F]">Loading invoice…</p>
          </div>
        </div>
      )}

      <Pager page={page} pages={totalPages} onChange={setPage} />

      {createOpen && <CreateDrawer onClose={() => setCreateOpen(false)} onSaved={inv => { setCreateOpen(false); setViewing(inv); fetch_(); setToast({ msg: "Invoice created!", type: "success" }); }} />}
      {viewing && <ViewDrawer inv={viewing} onClose={() => setViewing(null)} onRefresh={() => { fetch_(); setViewing(null); }} />}
    </div>
  );
}
