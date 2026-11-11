"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, X, Loader2, Search, Eye, Edit2, Copy, Trash2, Send,
  Check,
  Link2, MessageCircle, FileText,
  Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Monitor, Smartphone, Tablet, MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/ui/apple";
import { DocCard, DocDrawer, DocLine, PillButton, StatusChip } from "@/components/ui/doc-drawer";
import { API_URL as API } from "@/lib/api";
import { CURRENCY_OPTIONS, currencySymbol, fmtDate, formatCurrency, getStudioCurrency, localDateStr } from "@/lib/format";
import { askConfirm, notify } from "@/components/feedback";
import { Chips, DateBox, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField, StatCard } from "@/components/ui/apple";

const SITE = typeof window !== "undefined" ? window.location.origin : "";

function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const h = dt.getHours(), m = dt.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${fmtDate(dt)}  ${hh}:${String(m).padStart(2,"0")} ${ampm}`;
}
const currSym = (c?: string) => currencySymbol(c || getStudioCurrency());

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; badge: string; dot: string; icon: typeof Clock }> = {
  draft:     { label: "Draft",    badge: "bg-[#F1EFF6] text-[#4A4658]",   dot: "bg-[#8A8599]",   icon: FileText },
  sent:      { label: "Sent",     badge: "bg-[#E8F0FA] text-[#1F5C99]",     dot: "bg-[#2F6FB3]",    icon: Send },
  viewed:    { label: "Viewed",   badge: "bg-[#EEE8FD] text-[#5B3FD0]", dot: "bg-[#7D5CEF]",  icon: Eye },
  accepted:  { label: "Accepted", badge: "bg-[#E7F5EE] text-[#1F8A5B]",dot:"bg-[#1F8A5B]", icon: CheckCircle2 },
  rejected:  { label: "Rejected", badge: "bg-[#FDECEF] text-[#C2304F]",       dot: "bg-[#C2304F]",     icon: XCircle },
  expired:   { label: "Expired",  badge: "bg-[#FFF3E0] text-[#9A5B00]",   dot: "bg-[#D88A12]",   icon: AlertTriangle },
  converted: { label: "Converted",badge: "bg-[#E3F2F1] text-[#126B66]",     dot: "bg-[#1A8A84]",    icon: CheckCircle2 },
};

const EVENT_TYPES = ["Wedding","Pre-Wedding","Reception","Engagement","Birthday","Corporate","Product","Fashion","Other"];
const CURRENCIES  = CURRENCY_OPTIONS.map(c => c.value);

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Client { id: string; firstName: string; lastName?: string; phone?: string; }
interface Program { id: string; name: string; category?: string; basePrice: number; currency?: string; isActive?: boolean; deliverablesDescription?: string; }
interface QuoteItem { id: string; name: string; description?: string; qty: number; unitPrice: number; total: number; isPackageBase?: boolean; }
interface ViewLog { id: string; viewedAt: string; ipAddress?: string; deviceType?: string; browser?: string; action?: string; }
interface Quote {
  id: string; quoteNumber: string; status: string; version: number;
  eventType?: string; eventDate?: string; venue?: string; currency: string;
  subtotal: number; discountAmount: number; taxAmount: number; grandTotal: number;
  advanceRequired: number; validUntil?: string; notes?: string; termsAndConditions?: string;
  publicToken: string; sentAt?: string; viewedAt?: string; lastViewedAt?: string;
  viewCount: number; acceptedAt?: string; rejectedAt?: string; convertedAt?: string;
  convertedBookingId?: string; items: QuoteItem[];
  client: Client; program?: { name: string; category?: string };
  viewLogs?: ViewLog[];
  versions?: { id: string; version: number; createdAt: string }[];
  company?: { name: string; email?: string; phone?: string; address?: string; logoUrl?: string; currency: string };
}

// ─── Quote Item Row ────────────────────────────────────────────────────────────
function ItemRow({ item, onChange, onRemove, canRemove }: {
  item: QuoteItem; onChange: (i: QuoteItem) => void; onRemove: () => void; canRemove: boolean;
}) {
  return (
    <div className="flex items-start gap-2 p-3 bg-[#F7F5FB] rounded-[16px]">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={item.name} onChange={e => onChange({ ...item, name: e.target.value })}
            placeholder="Item name" className="flex-1 h-9 px-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          <input value={item.description ?? ""} onChange={e => onChange({ ...item, description: e.target.value })}
            placeholder="Description (optional)" className="flex-1 h-9 px-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#6B6680]">Qty</span>
            <input type="number" min="1" value={item.qty}
              onChange={e => { const q = Number(e.target.value)||1; onChange({ ...item, qty: q, total: q * item.unitPrice }); }}
              className="w-16 h-8 px-2 text-center rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-[#6B6680]">Price</span>
            <input type="number" min="0" value={item.unitPrice}
              onChange={e => { const p = Number(e.target.value)||0; onChange({ ...item, unitPrice: p, total: item.qty * p }); }}
              className="flex-1 h-8 px-2 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-[#6B6680]">Total</span>
            <span className="font-bold text-sm text-[#17151F] tabular-nums">{item.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
      {canRemove && (
        <button onClick={onRemove} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-[#FEF5F7] text-[#8A8599] hover:text-[#C2304F] mt-1">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Create/Edit Drawer ────────────────────────────────────────────────────────
type QuotePrefill = { client: Client; eventType?: string; eventDate?: string; venue?: string };

function QuoteDrawer({ quote, prefill, onClose, onSaved }: {
  quote: Quote | null; prefill?: QuotePrefill | null; onClose: () => void; onSaved: (q: Quote) => void;
}) {
  const isEdit = !!quote;

  const [clients, setClients] = useState<Client[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdown, setClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(quote?.client ?? prefill?.client ?? null);
  const [eventType, setEventType] = useState(quote?.eventType ?? prefill?.eventType ?? "");
  const [eventDate, setEventDate] = useState(quote?.eventDate ? new Date(quote.eventDate).toISOString().slice(0,10) : prefill?.eventDate ?? "");
  const [venue, setVenue] = useState(quote?.venue ?? prefill?.venue ?? "");
  const [selectedProgramId, setSelectedProgramId] = useState(quote?.program ? "" : "");
  const [currency, setCurrency] = useState(quote?.currency ?? getStudioCurrency());
  const [items, setItems] = useState<QuoteItem[]>(quote?.items ?? [{ id: crypto.randomUUID(), name: "", qty: 1, unitPrice: 0, total: 0 }]);
  const [discountType, setDiscountType] = useState<"percent"|"fixed"|"">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [advanceRequired, setAdvanceRequired] = useState(Number(quote?.advanceRequired ?? 0));
  const [validUntil, setValidUntil] = useState(quote?.validUntil ? new Date(quote.validUntil).toISOString().slice(0,10) : "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.termsAndConditions ?? "1. 50% advance payment required to confirm booking.\n2. Full payment due on event day.\n3. Edited photos delivered within 30 working days.\n4. This quote is valid until the date mentioned above.");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [advancePercent, setAdvancePercent] = useState(50);
  const sym = currSym(currency);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discAmt = discountType === "percent" ? subtotal * (discountValue / 100) : (discountType === "fixed" ? discountValue : 0);
  const afterDisc = subtotal - discAmt;
  const taxAmt = afterDisc * (taxPercent / 100);
  const grand = afterDisc + taxAmt;

  // auto-recalculate advance when grand total changes (new quotes only)
  useEffect(() => {
    if (!isEdit) setAdvanceRequired(Math.round(grand * advancePercent / 100));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grand]);

  useEffect(() => {
    apiFetch(`${API}/clients?limit=100`).then(r => r.json()).then(d => setClients(d.data ?? []));
    apiFetch(`${API}/packages?limit=100`).then(r => r.json()).then(d => setPrograms(Array.isArray(d) ? d : (d.data ?? [])));
    // fetch company defaults for new quotes only
    if (!isEdit) {
      apiFetch(`${API}/companies/me`).then(r => r.json()).then(d => {
        if (d.defaultTerms) setTerms(d.defaultTerms);
        if (d.defaultValidityDays) {
          const dt = new Date();
          dt.setDate(dt.getDate() + Number(d.defaultValidityDays));
          setValidUntil(localDateStr(dt));
        }
        if (d.defaultAdvancePercent) {
          const pct = Number(d.defaultAdvancePercent);
          setAdvancePercent(pct);
          setAdvanceRequired(Math.round(grand * pct / 100));
        }
      }).catch(() => {/* silently ignore */});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickProgram(pid: string) {
    setSelectedProgramId(pid);
    const p = programs.find(x => x.id === pid);
    if (!p) return;
    // The package becomes the first line; lines the user already typed stay (an earlier package line is replaced)
    const base = { id: crypto.randomUUID(), name: p.name, description: p.deliverablesDescription ?? "", qty: 1, unitPrice: Number(p.basePrice), total: Number(p.basePrice), isPackageBase: true };
    setItems(its => [base, ...its.filter(i => !i.isPackageBase && (i.name.trim() || i.unitPrice))]);
    if (p.currency) setCurrency(p.currency);
  }

  function addItem() {
    setItems(its => [...its, { id: crypto.randomUUID(), name: "", qty: 1, unitPrice: 0, total: 0 }]);
  }

  async function save() {
    if (!selectedClient) { setError("Please select a client."); return; }
    if (items.every(i => !i.name.trim())) { setError("Add at least one item."); return; }
    setError(""); setSaving(true);
    try {
      const body = {
        clientId: selectedClient.id, eventType: eventType || undefined,
        eventDate: eventDate || undefined, venue: venue || undefined,
        programId: selectedProgramId || undefined,
        items: items.filter(i => i.name.trim()),
        subtotal, discountType: discountType || undefined, discountValue,
        taxPercent, grandTotal: grand, advanceRequired, currency,
        validUntil: validUntil || undefined, notes: notes || undefined,
        termsAndConditions: terms || undefined,
      };
      const url = isEdit ? `${API}/quotes/${quote.id}` : `${API}/quotes`;
      const r = await apiFetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to save."); return; }
      onSaved(d);
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  const filteredClients = clients.filter(c =>
    `${c.firstName} ${c.lastName ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="sp-drawer sp-form z-50 sm:max-w-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#EEEBF4] flex-shrink-0">
            <Tile icon={FileText} color="deep" size={40} />
            <div className="flex-1 min-w-0">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{isEdit ? "Edit quote" : "New quote"}</h2>
              <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">{isEdit ? `${quote.quoteNumber} · version ${quote.version}` : "Price, package and terms for a client"}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#6B6680]"><X className="w-4 h-4" /></button>
          </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {error && <p className="text-xs text-[#C2304F] bg-[#FEF5F7] border border-[#FDECEF] px-3 py-2 rounded-lg">{error}</p>}

          {/* Client */}
          <div className="space-y-1.5 relative">
            <Label className="text-[13px] font-semibold text-[#4A4658]">Client *</Label>
            {selectedClient ? (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-[#F7F4FE] border border-indigo-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-[#5B3FD0] font-bold text-sm">{selectedClient.firstName[0]}</div>
                <div className="flex-1"><p className="font-semibold text-[#17151F] text-sm">{selectedClient.firstName} {selectedClient.lastName ?? ""}</p><p className="text-xs text-[#8A8599]">{selectedClient.phone}</p></div>
                <button onClick={() => setSelectedClient(null)} className="text-[#8A8599] hover:text-[#C2304F]"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599]" />
                <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setClientDropdown(true); }}
                  onFocus={() => setClientDropdown(true)}
                  placeholder="Search client by name or phone…"
                  className="w-full h-11 pl-9 pr-4 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400" />
                {clientDropdown && filteredClients.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-[#E4E0EC] rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredClients.slice(0, 8).map(c => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(""); setClientDropdown(false); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-[#F7F4FE] text-left">
                        <div className="w-7 h-7 rounded-full bg-[#E4E0EC] flex items-center justify-center text-[#4A4658] font-bold text-xs">{c.firstName[0]}</div>
                        <div><p className="font-medium text-[#17151F]">{c.firstName} {c.lastName ?? ""}</p><p className="text-xs text-[#8A8599]">{c.phone}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Event Info */}
          <div className="space-y-3">
            <Label className="text-[13px] font-semibold text-[#4A4658]">Event Info</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6680]">Event Type</Label>
                <select value={eventType} onChange={e => setEventType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white">
                  <option value="">Select type…</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6680]">Event Date</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-10 border-[#E4E0EC] text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-[#6B6680]">Venue</Label>
                <Input value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Grand Hotel ballroom" className="h-10 border-[#E4E0EC] text-sm" />
              </div>
            </div>
          </div>

          {/* Package auto-fill */}
          {programs.some(p => p.isActive !== false) && (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-[#4A4658]">Auto-fill from Package</Label>
              <select value={selectedProgramId} onChange={e => pickProgram(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white">
                <option value="">Pick a package to auto-fill items…</option>
                {programs.filter(p => p.isActive !== false || p.id === selectedProgramId).map(p => <option key={p.id} value={p.id}>{p.name} — {currSym(p.currency || currency)}{Number(p.basePrice).toLocaleString()}</option>)}
              </select>
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-semibold text-[#4A4658]">Line Items *</Label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#7D5CEF] hover:text-[#5B3FD0] font-medium">
                <Plus className="w-3.5 h-3.5" />Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <ItemRow key={item.id} item={item}
                  onChange={updated => setItems(its => its.map((x, j) => j === i ? updated : x))}
                  onRemove={() => setItems(its => its.filter((_, j) => j !== i))}
                  canRemove={items.length > 1} />
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3 bg-[#F7F5FB] border border-[#E4E0EC] rounded-2xl p-4">
            <Label className="text-[13px] font-semibold text-[#4A4658]">Pricing</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6680]">Currency</Label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6680]">Discount</Label>
                <div className="flex gap-1.5">
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as any)}
                    className="w-24 h-10 px-2 rounded-xl border border-[#E4E0EC] text-xs focus:outline-none focus:border-indigo-400 bg-white">
                    <option value="">None</option>
                    <option value="percent">%</option>
                    <option value="fixed">{sym}</option>
                  </select>
                  {discountType && <input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))}
                    className="flex-1 h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6680]">Tax (%)</Label>
                <input type="number" min="0" step="0.5" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#6B6680]">Advance Required {grand > 0 && <span className="text-indigo-400">({Math.round(advanceRequired / grand * 100)}%)</span>}</Label>
                <input type="number" min="0" value={advanceRequired} onChange={e => setAdvanceRequired(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-[#E4E0EC] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#6B6680]"><span>Subtotal</span><span className="font-medium">{sym}{subtotal.toLocaleString()}</span></div>
              {discAmt > 0 && <div className="flex justify-between text-[#1F8A5B]"><span>Discount</span><span>−{sym}{discAmt.toLocaleString()}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between text-[#6B6680]"><span>Tax ({taxPercent}%)</span><span>+{sym}{taxAmt.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-[#17151F] text-base border-t border-[#E4E0EC] pt-2"><span>Grand Total</span><span>{sym}{grand.toLocaleString()}</span></div>
              <div className="flex justify-between text-[#B36B00] font-semibold"><span>Advance Required</span><span>{sym}{advanceRequired.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Valid Until + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-[#4A4658]">Valid Until</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-10 border-[#E4E0EC] text-sm" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[13px] font-semibold text-[#4A4658]">Notes for Client</Label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any special notes for the client…"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[13px] font-semibold text-[#4A4658]">Terms & Conditions</Label>
              <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E0EC] text-sm font-mono focus:outline-none focus:border-indigo-400 resize-y text-xs" />
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-[#F1EFF6] flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12 border-[#E4E0EC]">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1 h-12 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? "Update Quote" : "Create Quote"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── View Drawer ───────────────────────────────────────────────────────────────
function ViewDrawer({ quote, onClose, onEdit, onRefresh }: {
  quote: Quote | null; onClose: () => void; onEdit: () => void; onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!quote) return;
    setLoading(true);
    apiFetch(`${API}/quotes/${quote.id}`)
      .then(r => r.json()).then(setDetail).finally(() => setLoading(false));
  }, [quote]);

  if (!quote) return null;
  const q = detail ?? quote;
  const sc = STATUS[q.status] ?? STATUS.draft;
  const sym = currSym(q.currency);
  const publicUrl = `${SITE}/q/${q.publicToken}`;

  async function sendQuote() {
    setSending(true);
    await apiFetch(`${API}/quotes/${q.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setSending(false); onRefresh();
    setDetail(d => d ? { ...d, status: "sent", sentAt: new Date().toISOString() } : d);
  }

  async function convertToBooking() {
    setConverting(true);
    const r = await apiFetch(`${API}/quotes/${q.id}/convert`, { method: "POST", headers: { "Content-Type": "application/json" } });
    const d = await r.json();
    setConverting(false);
    if (r.ok) { onRefresh(); setDetail(prev => prev ? { ...prev, status: "converted" } : prev); }
    else notify(d.message, { error: true });
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  }

  function shareWA() {
    const msg = `Hi ${q.client.firstName},\n\nYour quotation is ready.\n\nQuote: ${q.quoteNumber}\nAmount: ${sym}${Number(q.grandTotal).toLocaleString()}\n\nView here:\n${publicUrl}`;
    window.open(`https://wa.me?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const chip = STATUS_HEX[q.status] ?? STATUS_HEX.draft;
  const money = (n: number | string) => formatCurrency(Number(n), q.currency);
  const DeviceIcon = (t?: string) => t === "mobile" ? Smartphone : t === "tablet" ? Tablet : Monitor;
  const views = (q.viewLogs ?? []).filter(l => l.action === "viewed").slice(0, 3);
  const timeline = [
    { label: "Created", at: (detail as { createdAt?: string } | null)?.createdAt, dot: "#8A8599" },
    { label: "Sent", at: q.sentAt, dot: "#2F6FB3" },
    { label: "Viewed", at: q.viewedAt, dot: "#7D5CEF" },
    { label: "Accepted", at: q.acceptedAt, dot: "#1F8A5B" },
    { label: "Declined", at: q.rejectedAt, dot: "#C2304F" },
    { label: "Booked", at: q.convertedAt, dot: "#126B66" },
  ].filter(t => t.at);
  const event = [
    q.eventType && { label: "Event", value: q.eventType },
    q.eventDate && { label: "Date", value: fmtDate(q.eventDate) },
    q.venue && { label: "Venue", value: q.venue },
    q.validUntil && { label: "Valid until", value: fmtDate(q.validUntil) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <DocDrawer onClose={onClose} icon={FileText} color="violet" title={q.quoteNumber} label={`Quote ${q.quoteNumber}`}
      badge={<StatusChip label={sc.label} bg={chip.bg} text={chip.text} />}
      sub={[`${q.client.firstName} ${q.client.lastName ?? ""}`.trim(), `Version ${q.version}`, `${q.viewCount} view${q.viewCount === 1 ? "" : "s"}`].join(" · ")}>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" aria-label="Loading" /></div>
      ) : (
        <>
          {/* Money at a glance */}
          <DocCard>
            <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">Quoted total</p>
            <p className="text-[30px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums leading-tight mt-0.5">{money(q.grandTotal)}</p>
            {Number(q.advanceRequired) > 0 && (
              <p className="mt-2 text-[13px] text-[#6B6680]">Advance to book: <span className="font-bold text-[#9A5B00] tabular-nums">{money(q.advanceRequired)}</span></p>
            )}
          </DocCard>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {q.status === "accepted" && !q.convertedBookingId && (
              <PillButton tone="green" icon={CheckCircle2} onClick={convertToBooking} disabled={converting}>{converting ? "Booking…" : "Confirm booking"}</PillButton>
            )}
            {q.status === "draft" && <PillButton tone="primary" icon={sending ? Loader2 : Send} onClick={sendQuote} disabled={sending}>Send</PillButton>}
            {["draft","rejected"].includes(q.status) && <PillButton icon={Edit2} onClick={onEdit}>Edit</PillButton>}
            {q.status !== "draft" && <PillButton icon={MessageCircle} onClick={shareWA}>WhatsApp</PillButton>}
            <PillButton icon={Eye} href={publicUrl} external>Preview</PillButton>
          </div>

          {/* Status notes */}
          {q.status === "accepted" && (
            <div className="rounded-[18px] bg-[#E9F5EF] px-4 py-3.5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#1F8A5B] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#14613F]">The client accepted</p>
                <p className="text-[12.5px] text-[#1F8A5B] mt-0.5">{fmtDateTime(q.acceptedAt)}</p>
                <p className="text-[12.5px] text-[#14613F] mt-1.5">{q.convertedBookingId ? "It's now a program." : "Tap Confirm booking once the advance is paid."}</p>
              </div>
            </div>
          )}
          {q.status === "rejected" && (
            <div className="rounded-[18px] bg-[#FDECEF] px-4 py-3.5 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-[#C2304F] flex-shrink-0 mt-0.5" />
              <div><p className="text-[14px] font-bold text-[#9C2340]">The client declined</p><p className="text-[12.5px] text-[#C2304F] mt-0.5">{fmtDateTime(q.rejectedAt)}</p></div>
            </div>
          )}

          {/* Client link */}
          {q.status !== "draft" && (
            <DocCard title="Client link" flush>
              <div className="flex items-center gap-3 px-4 py-3">
                <Link2 className="w-4 h-4 text-[#8A8599] flex-shrink-0" />
                <p className="text-[13px] text-[#4A4658] truncate flex-1 min-w-0">{publicUrl}</p>
                <button type="button" onClick={copyLink} className="h-8 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1 flex-shrink-0">
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedLink ? "Copied" : "Copy"}
                </button>
              </div>
            </DocCard>
          )}

          {/* Seen by the client */}
          {q.viewedAt && (
            <DocCard title="Seen by the client" flush>
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><Eye className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#17151F]">Last opened {fmtDateTime(q.lastViewedAt ?? q.viewedAt)}</p>
                  <p className="text-[12.5px] text-[#6B6680]">{q.viewCount} view{q.viewCount === 1 ? "" : "s"} in total</p>
                </div>
              </div>
              {views.map(log => {
                const D = DeviceIcon(log.deviceType);
                return (
                  <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 text-[12.5px] text-[#6B6680]">
                    <D className="w-4 h-4 flex-shrink-0 text-[#8A8599]" />
                    <span className="truncate">{fmtDateTime(log.viewedAt)} · {log.browser ?? "Browser"}</span>
                  </div>
                );
              })}
            </DocCard>
          )}

          {/* Event */}
          {event.length > 0 && (
            <DocCard title="Event" flush>
              {event.map(e => (
                <div key={e.label} className="px-4 py-3 flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="text-[#6B6680]">{e.label}</span>
                  <span className="font-semibold text-[#17151F] text-right min-w-0">{e.value}</span>
                </div>
              ))}
            </DocCard>
          )}

          {/* Items */}
          <DocCard title="Items" flush>
            {q.items.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#17151F]">{item.name}</p>
                  {item.description && <p className="text-[12.5px] text-[#6B6680] mt-0.5">{item.description}</p>}
                  <p className="text-[12.5px] text-[#8A8599] mt-0.5 tabular-nums">{item.qty} × {money(item.unitPrice)}</p>
                </div>
                <p className="text-[14px] font-bold text-[#17151F] tabular-nums flex-shrink-0">{money(item.total)}</p>
              </div>
            ))}
            <div className="px-4 py-3.5 space-y-1.5 bg-[#FAF9FC]">
              <DocLine label="Subtotal" value={money(q.subtotal)} />
              {Number(q.discountAmount) > 0 && <DocLine label="Discount" value={`−${money(q.discountAmount)}`} tone="green" />}
              {Number(q.taxAmount) > 0 && <DocLine label="Tax" value={`+${money(q.taxAmount)}`} />}
              <DocLine label="Total" value={money(q.grandTotal)} strong className="pt-1.5 border-t border-[#EEEBF4]" />
              {Number(q.advanceRequired) > 0 && <DocLine label="Advance to book" value={money(q.advanceRequired)} tone="amber" className="font-semibold" />}
            </div>
          </DocCard>

          {/* Timeline */}
          {timeline.length > 0 && (
            <DocCard title="Timeline">
              <ol className="space-y-2.5">
                {timeline.map(t => (
                  <li key={t.label} className="flex items-center gap-3 text-[13.5px]">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.dot }} />
                    <span className="text-[#6B6680] w-[72px] flex-shrink-0">{t.label}</span>
                    <span className="font-semibold text-[#17151F] tabular-nums">{fmtDateTime(t.at)}</span>
                  </li>
                ))}
              </ol>
            </DocCard>
          )}

          {q.notes && <DocCard title="Notes"><p className="text-[13.5px] text-[#4A4658] leading-relaxed whitespace-pre-line">{q.notes}</p></DocCard>}
        </>
      )}
    </DocDrawer>
  );
}

// ─── Quote row (Apple style) ───────────────────────────────────────────────────
const STATUS_HEX: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#EEEDF2", text: "#4A4658" }, sent: { bg: "#E6F0FB", text: "#1F5C99" }, viewed: { bg: "#EEE8FD", text: "#5B3FD0" },
  accepted: { bg: "#E9F5EF", text: "#1F8A5B" }, rejected: { bg: "#FDECEF", text: "#C2304F" },
  expired: { bg: "#FBF2FA", text: "#9E3A8C" }, converted: { bg: "#E0F2F1", text: "#126B66" },
};
function QuoteRow({ q, onView, onEdit, onDuplicate, onDelete, onSend }: {
  q: Quote;
  onView: () => void; onEdit: () => void; onDuplicate: () => void;
  onDelete: () => void; onSend: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sc = STATUS[q.status] ?? STATUS.draft;
  const h = STATUS_HEX[q.status] ?? STATUS_HEX.draft;
  const sym = currSym(q.currency);
  const expired = q.validUntil && new Date(q.validUntil) < new Date() && !["converted", "accepted"].includes(q.status);

  useEffect(() => {
    if (!menuOpen) return;
    function h(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const item = "w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]";
  return (
    <div role="button" tabIndex={0} onClick={onView} onKeyDown={e => { if (e.key === "Enter") onView(); }}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <DateBox date={q.eventDate} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate">{q.client.firstName} {q.client.lastName ?? ""}</p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">
          <span className="font-mono">{q.quoteNumber}</span>{q.eventType ? ` · ${q.eventType}` : ""}{q.venue ? ` · ${q.venue}` : ""}
          {q.viewCount > 0 && <span className="text-[#5B3FD0]"> · <Eye className="inline w-3 h-3 -mt-0.5" /> {q.viewCount}</span>}
          {expired && <span className="text-[#C2304F] font-semibold"> · Expired</span>}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-[#17151F] tabular-nums">{sym}{Number(q.grandTotal).toLocaleString()}</p>
        {Number(q.advanceRequired) > 0 && <p className="text-xs text-[#6B6680] tabular-nums">Advance {sym}{Number(q.advanceRequired).toLocaleString()}</p>}
      </div>
      <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: h.bg, color: h.text }}>{sc.label}</span>
      <div className="relative flex-shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(o => !o)} aria-label={`More for ${q.quoteNumber}`} aria-expanded={menuOpen}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-10 w-48 bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1">
            <button role="menuitem" onClick={() => { onView(); setMenuOpen(false); }} className={item}><Eye className="w-4 h-4 text-[#6B6680]" />Open</button>
            {["draft", "rejected"].includes(q.status) && <button role="menuitem" onClick={() => { onEdit(); setMenuOpen(false); }} className={item}><Edit2 className="w-4 h-4 text-[#6B6680]" />Edit</button>}
            {q.status === "draft" && <button role="menuitem" onClick={() => { onSend(); setMenuOpen(false); }} className={item}><Send className="w-4 h-4 text-[#5B3FD0]" />Send quote</button>}
            <button role="menuitem" onClick={() => { onDuplicate(); setMenuOpen(false); }} className={item}><Copy className="w-4 h-4 text-[#6B6680]" />Duplicate</button>
            {["draft", "rejected", "expired"].includes(q.status) && <button role="menuitem" onClick={() => { onDelete(); setMenuOpen(false); }} className={cn(item, "text-[#C2304F] hover:bg-[#FDECEF]")}><Trash2 className="w-4 h-4" />Delete</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function QuotesPageInner() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, statusCounts: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Quote | null>(null);
  const [viewTarget, setViewTarget] = useState<Quote | null>(null);
  const [prefill, setPrefill] = useState<QuotePrefill | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  // "Make a quote" from a lead (?newFor=clientId&lead=leadId)
  useEffect(() => {
    const clientId = params.get("newFor");
    if (!clientId) return;
    const leadId = params.get("lead");
    router.replace("/quotes", { scroll: false });
    Promise.all([
      apiFetch(`${API}/clients/${clientId}`).then(r => (r.ok ? r.json() : null)),
      leadId ? apiFetch(`${API}/leads/${leadId}`).then(r => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
    ]).then(([client, lead]) => {
      if (!client) return;
      setPrefill({ client, eventType: lead?.eventType ?? undefined, eventDate: lead?.eventDates?.[0] ?? undefined, venue: lead?.venue ?? undefined });
      setShowCreate(true);
    }).catch(() => {});
  }, [params, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) p.set("search", search);
      if (statusFilter !== "all") p.set("status", statusFilter);
      const r = await apiFetch(`${API}/quotes?${p}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) { const d = await r.json(); setQuotes(d.data ?? []); setMeta(d.meta); }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function sendQuote(q: Quote) {
    await apiFetch(`${API}/quotes/${q.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" } });
    load();
  }

  async function duplicateQuote(q: Quote) {
    const r = await apiFetch(`${API}/quotes/${q.id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" } });
    if (r.ok) load();
  }

  async function deleteQuote(q: Quote) {
    if (!(await askConfirm({ message: `Delete ${q.quoteNumber}?`, danger: true }))) return;
    await apiFetch(`${API}/quotes/${q.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    load();
  }

  function onSaved(saved: Quote) {
    setShowCreate(false); setEditTarget(null);
    load();
    setViewTarget(saved);
  }

  const sc = meta.statusCounts;
  const conversionRate = meta.total > 0 ? Math.round(((sc.converted ?? 0) / meta.total) * 100) : 0;
  const TABS = [
    { key: "all", label: "All" }, { key: "draft", label: "Draft" }, { key: "sent", label: "Sent" },
    { key: "viewed", label: "Viewed" }, { key: "accepted", label: "Accepted" },
    { key: "converted", label: "Converted" }, { key: "rejected", label: "Rejected" },
  ];

  return (
    <div>
      <PageHeader icon={FileText} color="deep" title="Quotes"
        sub={meta.total ? `${meta.total} quote${meta.total === 1 ? "" : "s"} · ${conversionRate}% became programs` : "Price offers you send to clients"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search client or event" />
        <MainButton icon={Plus} onClick={() => setShowCreate(true)}>New quote</MainButton>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <StatCard icon={Send} color="blue" label="Sent" value={String((sc.sent ?? 0) + (sc.viewed ?? 0))} sub="Waiting for an answer" />
        <StatCard icon={CheckCircle2} color="green" label="Accepted" value={String(sc.accepted ?? 0)} />
        <StatCard icon={RefreshCw} color="teal" label="Became programs" value={String(sc.converted ?? 0)} sub={`${conversionRate}% of all quotes`} />
        <StatCard icon={XCircle} color="red" label="Rejected" value={String(sc.rejected ?? 0)} />
      </div>

      <Chips label="Filter by status" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
        options={TABS.map(t => ({ value: t.key, label: t.label, count: t.key === "all" ? meta.total : sc[t.key] || undefined, dot: STATUS_HEX[t.key]?.text }))} />

      {loading ? (
        <RowsSkeleton n={6} />
      ) : quotes.length === 0 ? (
        search || statusFilter !== "all" ? (
          <EmptyState icon={Search} title={search ? `No quotes match "${search}"` : "No quotes here"} text="Try another word or filter." />
        ) : (
          <EmptyState icon={FileText} title="No quotes yet" text="Create a price offer to share with a client."
            action={<MainButton icon={Plus} onClick={() => setShowCreate(true)}>New quote</MainButton>} />
        )
      ) : (
        <Group>
          {quotes.map(q => (
            <QuoteRow key={q.id} q={q}
              onView={() => setViewTarget(q)}
              onEdit={() => { setViewTarget(null); setEditTarget(q); }}
              onDuplicate={() => duplicateQuote(q)}
              onDelete={() => deleteQuote(q)}
              onSend={() => sendQuote(q)}
            />
          ))}
        </Group>
      )}

      <Pager page={page} pages={meta.totalPages} onChange={setPage} />

      {(showCreate || editTarget) && (
        <QuoteDrawer quote={editTarget} prefill={editTarget ? null : prefill} onClose={() => { setShowCreate(false); setEditTarget(null); setPrefill(null); }} onSaved={onSaved} />
      )}
      <ViewDrawer quote={viewTarget} onClose={() => setViewTarget(null)} onEdit={() => { setEditTarget(viewTarget); setViewTarget(null); }} onRefresh={load} />
    </div>
  );
}

export default function QuotesPage() {
  return <Suspense><QuotesPageInner /></Suspense>;
}
