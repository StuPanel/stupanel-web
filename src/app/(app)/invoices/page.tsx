"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, Loader2, Search, Eye, Trash2, Send, CheckCircle2,
  FileText, Link2, Copy, MoreVertical, AlertCircle, Zap,
  DollarSign, Clock, TrendingUp, ChevronRight, CreditCard,
  BookOpen, ChevronDown, Bell, Receipt,
} from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField, StatCard, Tile } from "@/components/ui/apple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency, localDateStr } from "@/lib/format";
import { InvoicePreview, type InvoicePreviewData } from "@/components/invoice-preview";
import { askConfirm } from "@/components/feedback";
import { AccountPicker } from "@/components/account-picker";

const SITE = typeof window !== "undefined" ? window.location.origin : "";
function sym(cur = "BDT") { return cur === "BDT" ? "৳" : cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "INR" ? "₹" : cur + " "; }

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
    }).finally(() => setLoading(false));
  }, [search, cat]);

  const s = sym(currency);
  return (
    <>
      <div className="sp-backdrop z-60" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="w-full max-w-lg sp-modal flex flex-col max-h-[80vh]">
          <div className="px-5 py-4 border-b border-[#E4E0EC] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#17151F]">Service Catalog</h3>
              <p className="text-xs text-[#8A8599] mt-0.5">Select to auto-fill</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1EFF6]"><X className="w-4 h-4 text-[#6B6680]" /></button>
          </div>
          <div className="p-4 border-b border-[#F1EFF6] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8599]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services…"
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <select value={cat} onChange={e => setCat(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-[#E4E0EC] bg-white text-sm focus:outline-none focus:border-indigo-400">
              <option value="">All</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-10">
                <BookOpen className="w-8 h-8 text-[#E4E0EC] mx-auto mb-2" />
                <p className="text-sm text-[#8A8599]">No catalog items yet</p>
                <p className="text-xs text-[#B5B0C4] mt-1">Add services in Settings → Service Catalog</p>
              </div>
            ) : items.map(item => (
              <button key={item.id} onClick={() => onSelect(item)}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-[#F7F4FE] text-left transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#EEE8FD] flex items-center justify-center text-[#7D5CEF] flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#17151F] truncate">{item.name}</p>
                  {item.description && <p className="text-xs text-[#8A8599] truncate">{item.description}</p>}
                  <p className="text-xs text-[#8A8599] mt-0.5">
                    {item.category && <span className="text-[#7D5CEF] font-medium">{item.category} · </span>}
                    {item.unit}
                  </p>
                </div>
                <p className="font-bold text-sm text-[#17151F] flex-shrink-0">{s}{Number(item.defaultPrice).toLocaleString()}</p>
              </button>
            ))}
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
    <div className="p-3 bg-[#F7F5FB] border border-[#E4E0EC] rounded-xl space-y-2">
      {/* Row 1: Name + Description */}
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input value={item.name} onChange={e => onChange({ ...item, name: e.target.value })}
              placeholder="Item name *" className="flex-1 h-9 px-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
            <input value={item.description ?? ""} onChange={e => onChange({ ...item, description: e.target.value })}
              placeholder="Description" className="flex-1 h-9 px-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          {/* Row 2: Category + Unit */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
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

// ─── Record Payment Form ──────────────────────────────────────────────────────
function RecordPaymentForm({ inv, onDone, onClose }: { inv: Invoice; onDone: () => void; onClose: () => void }) {
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState("cash");
  const [payDate, setPayDate] = useState(localDateStr());
  const [ref, setRef] = useState("");
  const [txn, setTxn] = useState("");
  const [notes, setNotes] = useState("");
  const [walletId, setWalletId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const balance = Number(inv.balanceDue);
  const c = sym(inv.currency);

  async function save() {
    if (!amount || Number(amount) <= 0) { setError("Amount must be > 0"); return; }
    if (!walletId) { setError("Pick the account the money went into."); return; }
    if (Number(amount) > balance) { setError(`Cannot exceed balance (${c}${balance.toLocaleString()})`); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/studio-invoices/${inv.id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount), paymentMethod: method,
          paymentDate: payDate,
          referenceNumber: ref || undefined,
          transactionId: txn || undefined,
          notes: notes || undefined,
          walletId,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError((Array.isArray(d.message) ? d.message[0] : d.message) || "Failed."); return; }
      onDone();
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-[#E4E0EC] rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#17151F] uppercase tracking-wide">Record Payment</p>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F1EFF6]"><X className="w-3.5 h-3.5 text-[#8A8599]" /></button>
      </div>
      {error && <p className="text-xs text-[#C2304F] bg-[#FEF5F7] px-2 py-1.5 rounded-lg">{error}</p>}
      <div className="bg-[#FFF9EF] border border-[#F6E3B8] rounded-xl p-2.5 flex items-center justify-between">
        <span className="text-xs text-[#9A5B00] font-medium">Balance Due</span>
        <span className="font-bold text-[#8A5600]">{c}{balance.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-[#6B6680]">Amount *</Label>
          <input type="number" min="0" max={balance} value={amount} onChange={e => setAmount(Number(e.target.value))}
            placeholder={`Max ${c}${balance.toLocaleString()}`}
            className="w-full h-9 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#6B6680]">Method *</Label>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="w-full h-9 px-2 rounded-xl border border-[#E4E0EC] bg-white text-sm focus:outline-none focus:border-indigo-400">
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#6B6680]">Date</Label>
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <AccountPicker className="col-span-full" value={walletId} onChange={setWalletId} method={method} />
        <div className="space-y-1">
          <Label className="text-xs text-[#6B6680]">Reference</Label>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Ref / TXN ID"
            className="w-full h-9 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-[#6B6680]">Notes</Label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes"
          className="w-full h-9 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1 h-9 border-[#E4E0EC] text-[#4A4658] text-xs">Cancel</Button>
        <Button disabled={saving} onClick={save} className="flex-1 h-9 bg-[#1F8A5B] hover:bg-[#1F8A5B] text-white text-xs gap-1.5">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><CreditCard className="w-3.5 h-3.5" />Record Payment</>}
        </Button>
      </div>
    </div>
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
  const [currency, setCurrency] = useState("BDT");
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
        <div className="w-full max-w-[1140px] bg-white shadow-2xl flex">

          {/* ── LEFT: Form panel ── */}
          <div className="w-full lg:w-[440px] flex-shrink-0 flex flex-col border-r border-[#E4E0EC] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E0EC] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-bold text-[#17151F] text-lg">New Invoice</h2>
                <p className="text-xs text-[#8A8599] mt-0.5">Preview updates live on the right</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F1EFF6]"><X className="w-5 h-5 text-[#6B6680]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && <p className="text-xs text-[#C2304F] bg-[#FEF5F7] border border-[#FDECEF] px-3 py-2 rounded-lg">{error}</p>}

              {/* Client */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Client *</Label>
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
                  <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Link to Booking <span className="text-[#8A8599] font-normal normal-case">(optional)</span></Label>
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
                  <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="h-10 border-[#E4E0EC] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Due Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-10 border-[#E4E0EC] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Currency</Label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] bg-white text-sm focus:outline-none focus:border-indigo-400">
                    {["BDT","USD","INR","GBP"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Line Items *</Label>
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
                  <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Notes</Label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any notes for the client…"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Terms & Conditions</Label>
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
  const c = sym(inv.currency);
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

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="sp-drawer z-50 max-w-lg flex flex-col">
        <div className="px-5 py-4 border-b border-[#E4E0EC] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-[#17151F]">{inv.invoiceNumber}</h2>
              {inv.docType === "quotation"
                ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-[#EEE8FD] text-[#5B3FD0]">Quotation</span>
                : STATE[inv.state ?? ""]
                  ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: STATE[inv.state!].bg, color: STATE[inv.state!].text }}>{STATE[inv.state!].label}</span>
                  : <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", s.badge)}>{s.label}</span>}
            </div>
            <p className="text-xs text-[#8A8599] mt-0.5">{inv.client.firstName} {inv.client.lastName ?? ""} · {inv.client.phone ?? ""}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F1EFF6]"><X className="w-5 h-5 text-[#6B6680]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {inv.status === "draft" && (
              <Button size="sm" onClick={() => doAction("send", "Invoice marked as sent!")} disabled={acting}
                className="bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white gap-1.5">
                <Send className="w-3.5 h-3.5" />Mark as Sent
              </Button>
            )}
            {balance > 0 && inv.status !== "void" && inv.docType !== "quotation" && (inv.booking || ["sent","viewed","partially_paid","overdue"].includes(inv.status)) && (
              <Button size="sm" onClick={() => setRecordingPayment(r => !r)} disabled={acting}
                className="bg-[#1F8A5B] hover:bg-[#1F8A5B] text-white gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />Record Payment
              </Button>
            )}
            {!inv.booking && ["sent","viewed","partially_paid"].includes(inv.status) && (
              <Button size="sm" onClick={() => doAction("paid", "Invoice marked as paid!")} disabled={acting}
                variant="outline" className="border-[#9AD5B6] text-[#1F8A5B] hover:bg-[#F0FAF4] gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />Mark Paid
              </Button>
            )}
            {["sent","viewed","partially_paid","overdue"].includes(inv.status) && inv.client.email && (
              <Button size="sm" onClick={() => doAction("reminder", "Reminder sent!", "POST")} disabled={acting}
                variant="outline" className="border-[#E4E0EC] text-[#4A4658] gap-1.5">
                <Bell className="w-3.5 h-3.5" />Remind
              </Button>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="border-[#E4E0EC] text-[#4A4658] gap-1.5">
                <Eye className="w-3.5 h-3.5" />Preview
              </Button>
            </a>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); setToast({ msg: "Link copied!", type: "success" }); }}
              className="border-[#E4E0EC] text-[#4A4658] gap-1.5">
              <Copy className="w-3.5 h-3.5" />Copy Link
            </Button>
            {!inv.booking && ["draft","void"].includes(inv.status) && (
              <Button size="sm" variant="outline" onClick={doDelete} disabled={acting}
                className="border-[#F6CFD8] text-[#C2304F] hover:bg-[#FEF5F7] gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />Delete
              </Button>
            )}
          </div>

          {/* Record Payment Form (inline) */}
          {recordingPayment && (
            <RecordPaymentForm inv={inv} onDone={onPaymentDone} onClose={() => setRecordingPayment(false)} />
          )}

          {/* Share link */}
          <div className="p-3 bg-[#F7F5FB] border border-[#E4E0EC] rounded-xl flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#8A8599] flex-shrink-0" />
            <p className="text-xs text-[#4A4658] truncate flex-1">{url}</p>
            <button onClick={() => { navigator.clipboard.writeText(url); setToast({ msg: "Copied!", type: "success" }); }}
              className="text-xs text-[#7D5CEF] font-semibold flex-shrink-0 hover:text-[#5B3FD0]">Copy</button>
          </div>

          {inv.booking && (
            <p className="text-xs text-[#6B6680] bg-[#F7F5FB] rounded-xl px-3 py-2">This invoice follows its program — the price, payments and due date change there. Record payments from the program.</p>
          )}

          {/* Booking link */}
          {inv.booking && (
            <div className="flex items-center gap-2 p-3 bg-[#F7F4FE] border border-[#EEE8FD] rounded-xl">
              <FileText className="w-4 h-4 text-[#7D5CEF]" />
              <p className="text-xs text-[#5B3FD0] font-medium">{inv.booking.bookingNumber} — {inv.booking.eventName || "Untitled"}</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Line Items</p>
            <div className="rounded-xl border border-[#E4E0EC] overflow-hidden">
              {inv.items.map((item, i) => (
                <div key={item.id} className={cn("px-4 py-3 flex items-start justify-between gap-2", i > 0 && "border-t border-[#F1EFF6]")}>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {(item as any).category && (
                        <span className="text-xs px-1.5 py-0.5 bg-[#EEE8FD] text-[#7D5CEF] rounded font-medium">{(item as any).category}</span>
                      )}
                      <p className="text-sm font-semibold text-[#17151F]">{item.name}</p>
                    </div>
                    {item.description && <p className="text-xs text-[#8A8599]">{item.description}</p>}
                    <p className="text-xs text-[#8A8599] mt-0.5">
                      {item.quantity} {(item as any).unit || "service"} × {c}{Number(item.unitPrice).toLocaleString()}
                      {(item as any).discountType && (item as any).discountType !== "none" && (item as any).discountValue && (
                        <span className="text-[#D88A12] ml-1">
                          − {(item as any).discountType === "percent" ? `${(item as any).discountValue}%` : `${c}${(item as any).discountValue.toLocaleString()}`}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-bold text-sm text-[#17151F] flex-shrink-0">{c}{Number(item.total).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-[#F7F5FB] border border-[#E4E0EC] rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-[#6B6680]"><span>Subtotal</span><span>{c}{Number(inv.subtotal).toLocaleString()}</span></div>
            {Number(inv.discountAmount) > 0 && <div className="flex justify-between text-[#1F8A5B]"><span>Discount</span><span>−{c}{Number(inv.discountAmount).toLocaleString()}</span></div>}
            {Number(inv.taxAmount) > 0 && <div className="flex justify-between text-[#6B6680]"><span>{inv.taxLabel} ({inv.taxPercent}%)</span><span>+{c}{Number(inv.taxAmount).toLocaleString()}</span></div>}
            <div className="flex justify-between font-bold text-[#17151F] text-base border-t border-[#E4E0EC] pt-2"><span>Grand Total</span><span>{c}{Number(inv.grandTotal).toLocaleString()}</span></div>
            {Number(inv.paidAmount) > 0 && <div className="flex justify-between text-[#1F8A5B] font-semibold"><span>Paid</span><span>−{c}{Number(inv.paidAmount).toLocaleString()}</span></div>}
            <div className={cn("flex justify-between font-bold text-base", Number(inv.balanceDue) > 0 ? "text-[#C2304F]" : "text-[#1F8A5B]")}>
              <span>Balance Due</span><span>{c}{Number(inv.balanceDue).toLocaleString()}</span>
            </div>
          </div>

          {/* Payment History */}
          {(payments.length > 0 || payLoading) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Payment History</p>
              {payLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[#8A8599]" /></div>
              ) : (
                <div className="rounded-xl border border-[#E4E0EC] overflow-hidden">
                  {payments.map((pay, i) => (
                    <div key={pay.id} className={cn("px-4 py-3 flex items-center justify-between gap-2", i > 0 && "border-t border-[#F1EFF6]")}>
                      <div>
                        <p className="text-sm font-semibold text-[#17151F] capitalize">{METHOD_LABEL[pay.paymentMethod] ?? pay.paymentMethod.replace("_", " ")}</p>
                        <p className="text-xs text-[#8A8599]">{fmtDate(pay.paymentDate)}{pay.referenceNumber ? ` · ${pay.referenceNumber}` : ""}</p>
                      </div>
                      <p className="font-bold text-sm text-[#1F8A5B]">+{c}{Number(pay.amount).toLocaleString()}</p>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 bg-[#F7F5FB] border-t border-[#E4E0EC] flex justify-between items-center">
                    <span className="text-xs text-[#6B6680] font-medium">Total Paid</span>
                    <span className="font-bold text-sm text-[#1F8A5B]">{c}{payments.reduce((a, p) => a + Number(p.amount), 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#4A4658] uppercase tracking-wide">Timeline</p>
            {[
              { label: "Issued", date: inv.issueDate, dot: "bg-[#8A8599]" },
              { label: "Due", date: inv.dueDate, dot: "bg-[#E9A63A]" },
              { label: "Sent", date: inv.sentAt, dot: "bg-[#6C9BD0]" },
              { label: "Viewed", date: inv.viewedAt, dot: "bg-[#A28BF5]" },
              { label: "Paid", date: inv.paidAt, dot: "bg-[#1F8A5B]" },
            ].filter(x => x.date).map(x => (
              <div key={x.label} className="flex items-center gap-3">
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", x.dot)} />
                <span className="text-xs text-[#6B6680] w-12">{x.label}</span>
                <span className="text-xs font-medium text-[#33303F]">{fmtDate(x.date!)}</span>
              </div>
            ))}
          </div>

          {inv.notes && (
            <div className="p-3 bg-[#F7F5FB] border border-[#E4E0EC] rounded-xl">
              <p className="text-xs font-semibold text-[#6B6680] mb-1">Notes</p>
              <p className="text-xs text-[#4A4658]">{inv.notes}</p>
            </div>
          )}
        </div>
      </div>
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
