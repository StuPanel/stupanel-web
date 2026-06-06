"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, X, Loader2, Search, Eye, Edit2, Copy, Trash2, Send,
  CalendarDays, MapPin, DollarSign, Check, ChevronRight,
  Link2, MessageCircle, FileText, MoreVertical, ArrowRight,
  Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Monitor, Smartphone, Tablet, Globe, Package,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
const SITE = typeof window !== "undefined" ? window.location.origin : "";
function jsonH() { return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` }; }
function authH() { return { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` }; }

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}
function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const h = dt.getHours(), m = dt.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${fmtDate(dt)}  ${hh}:${String(m).padStart(2,"0")} ${ampm}`;
}
function currSym(c: string) { return c === "BDT" ? "৳" : "$"; }

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; badge: string; dot: string; icon: typeof Clock }> = {
  draft:     { label: "Draft",    badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-400",   icon: FileText },
  sent:      { label: "Sent",     badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-500",    icon: Send },
  viewed:    { label: "Viewed",   badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500",  icon: Eye },
  accepted:  { label: "Accepted", badge: "bg-emerald-100 text-emerald-700",dot:"bg-emerald-500", icon: CheckCircle2 },
  rejected:  { label: "Rejected", badge: "bg-red-100 text-red-600",       dot: "bg-red-500",     icon: XCircle },
  expired:   { label: "Expired",  badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500",   icon: AlertTriangle },
  converted: { label: "Converted",badge: "bg-teal-100 text-teal-700",     dot: "bg-teal-500",    icon: CheckCircle2 },
};

const EVENT_TYPES = ["Wedding","Pre-Wedding","Reception","Engagement","Birthday","Corporate","Product","Fashion","Other"];
const CURRENCIES  = ["BDT","USD"];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Client { id: string; firstName: string; lastName?: string; phone?: string; }
interface Program { id: string; name: string; category?: string; basePrice: number; deliverablesDescription?: string; }
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
    <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <input value={item.name} onChange={e => onChange({ ...item, name: e.target.value })}
            placeholder="Item name" className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          <input value={item.description ?? ""} onChange={e => onChange({ ...item, description: e.target.value })}
            placeholder="Description (optional)" className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-slate-500 w-6">Qty</span>
            <input type="number" min="1" value={item.qty}
              onChange={e => { const q = Number(e.target.value)||1; onChange({ ...item, qty: q, total: q * item.unitPrice }); }}
              className="w-16 h-8 px-2 text-center rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-slate-500 w-10">Price</span>
            <input type="number" min="0" value={item.unitPrice}
              onChange={e => { const p = Number(e.target.value)||0; onChange({ ...item, unitPrice: p, total: item.qty * p }); }}
              className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-slate-500 w-8">Total</span>
            <span className="font-bold text-sm text-slate-800">{item.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
      {canRemove && (
        <button onClick={onRemove} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 mt-1">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Create/Edit Drawer ────────────────────────────────────────────────────────
function QuoteDrawer({ quote, onClose, onSaved }: {
  quote: Quote | null; onClose: () => void; onSaved: (q: Quote) => void;
}) {
  const isEdit = !!quote;

  const [clients, setClients] = useState<Client[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdown, setClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(quote?.client ?? null);
  const [eventType, setEventType] = useState(quote?.eventType ?? "");
  const [eventDate, setEventDate] = useState(quote?.eventDate ? new Date(quote.eventDate).toISOString().slice(0,10) : "");
  const [venue, setVenue] = useState(quote?.venue ?? "");
  const [selectedProgramId, setSelectedProgramId] = useState(quote?.program ? "" : "");
  const [currency, setCurrency] = useState(quote?.currency ?? "BDT");
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
    fetch(`${API}/clients?limit=100`, { headers: authH() }).then(r => r.json()).then(d => setClients(d.data ?? []));
    fetch(`${API}/packages?limit=100`, { headers: authH() }).then(r => r.json()).then(d => setPrograms(Array.isArray(d) ? d : (d.data ?? [])));
    // fetch company defaults for new quotes only
    if (!isEdit) {
      fetch(`${API}/companies/me`, { headers: authH() }).then(r => r.json()).then(d => {
        if (d.defaultTerms) setTerms(d.defaultTerms);
        if (d.defaultValidityDays) {
          const dt = new Date();
          dt.setDate(dt.getDate() + Number(d.defaultValidityDays));
          setValidUntil(dt.toISOString().slice(0, 10));
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
    setItems([{ id: crypto.randomUUID(), name: p.name, description: p.deliverablesDescription ?? "", qty: 1, unitPrice: Number(p.basePrice), total: Number(p.basePrice), isPackageBase: true }]);
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
      const r = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: jsonH(), body: JSON.stringify(body) });
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
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{isEdit ? "Edit Quote" : "New Quote"}</h2>
            {isEdit && <p className="text-xs text-slate-400 mt-0.5">{quote.quoteNumber} · v{quote.version}</p>}
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

          {/* Client */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Client *</Label>
            {selectedClient ? (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">{selectedClient.firstName[0]}</div>
                <div className="flex-1"><p className="font-semibold text-slate-800 text-sm">{selectedClient.firstName} {selectedClient.lastName ?? ""}</p><p className="text-xs text-slate-400">{selectedClient.phone}</p></div>
                <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setClientDropdown(true); }}
                  onFocus={() => setClientDropdown(true)}
                  placeholder="Search client by name or phone…"
                  className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                {clientDropdown && filteredClients.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredClients.slice(0, 8).map(c => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(""); setClientDropdown(false); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-indigo-50 text-left">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">{c.firstName[0]}</div>
                        <div><p className="font-medium text-slate-800">{c.firstName} {c.lastName ?? ""}</p><p className="text-xs text-slate-400">{c.phone}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Event Info */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Event Info</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Event Type</Label>
                <select value={eventType} onChange={e => setEventType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white">
                  <option value="">Select type…</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Event Date</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-slate-500">Venue</Label>
                <Input value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Radisson Blu, Dhaka" className="h-10 border-slate-200 text-sm" />
              </div>
            </div>
          </div>

          {/* Package auto-fill */}
          {programs.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Auto-fill from Package</Label>
              <select value={selectedProgramId} onChange={e => pickProgram(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white">
                <option value="">Pick a package to auto-fill items…</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name} — {currSym(currency)}{Number(p.basePrice).toLocaleString()}</option>)}
              </select>
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Line Items *</Label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
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
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pricing</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Currency</Label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Discount</Label>
                <div className="flex gap-1.5">
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as any)}
                    className="w-24 h-10 px-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-400 bg-white">
                    <option value="">None</option>
                    <option value="percent">%</option>
                    <option value="fixed">{sym}</option>
                  </select>
                  {discountType && <input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Tax (%)</Label>
                <input type="number" min="0" step="0.5" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Advance Required {grand > 0 && <span className="text-indigo-400">({Math.round(advanceRequired / grand * 100)}%)</span>}</Label>
                <input type="number" min="0" value={advanceRequired} onChange={e => setAdvanceRequired(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-medium">{sym}{subtotal.toLocaleString()}</span></div>
              {discAmt > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{sym}{discAmt.toLocaleString()}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between text-slate-500"><span>Tax ({taxPercent}%)</span><span>+{sym}{taxAmt.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2"><span>Grand Total</span><span>{sym}{grand.toLocaleString()}</span></div>
              <div className="flex justify-between text-orange-600 font-semibold"><span>Advance Required</span><span>{sym}{advanceRequired.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Valid Until + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Valid Until</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-10 border-slate-200 text-sm" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Notes for Client</Label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any special notes for the client…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Terms & Conditions</Label>
              <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-indigo-400 resize-y text-xs" />
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12 border-slate-200">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
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
    fetch(`${API}/quotes/${quote.id}`, { headers: authH() })
      .then(r => r.json()).then(setDetail).finally(() => setLoading(false));
  }, [quote]);

  if (!quote) return null;
  const q = detail ?? quote;
  const sc = STATUS[q.status] ?? STATUS.draft;
  const StatusIcon = sc.icon;
  const sym = currSym(q.currency);
  const publicUrl = `${SITE}/q/${q.publicToken}`;

  async function sendQuote() {
    setSending(true);
    await fetch(`${API}/quotes/${q.id}/send`, { method: "POST", headers: authH() });
    setSending(false); onRefresh();
    setDetail(d => d ? { ...d, status: "sent", sentAt: new Date().toISOString() } : d);
  }

  async function convertToBooking() {
    setConverting(true);
    const r = await fetch(`${API}/quotes/${q.id}/convert`, { method: "POST", headers: authH() });
    const d = await r.json();
    setConverting(false);
    if (r.ok) { onRefresh(); setDetail(prev => prev ? { ...prev, status: "converted" } : prev); }
    else alert(d.message);
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  }

  function shareWA() {
    const msg = `Assalamu Alaikum ${q.client.firstName} bhai/apu,\n\nApnar quotation ready.\n\nQuote: ${q.quoteNumber}\nAmount: ${sym}${Number(q.grandTotal).toLocaleString()}\n\nView here:\n${publicUrl}`;
    window.open(`https://wa.me?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const DevIcon = { mobile: Smartphone, tablet: Tablet, desktop: Monitor }[q.viewLogs?.[0]?.deviceType ?? "desktop"] ?? Monitor;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{q.quoteNumber}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1", sc.badge)}>
                <StatusIcon className="w-2.5 h-2.5" />{sc.label}
              </span>
              <span className="text-xs text-slate-400">v{q.version} · {q.viewCount} views</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {["draft","rejected"].includes(q.status) && (
              <button onClick={onEdit} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5" />Edit
              </button>
            )}
            {q.status === "draft" && (
              <button onClick={sendQuote} disabled={sending} className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Send
              </button>
            )}
            {q.status === "accepted" && !q.convertedBookingId && (
              <button onClick={convertToBooking} disabled={converting} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5">
                {converting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Confirm Booking
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* View Tracking Banner */}
            {q.viewedAt && (
              <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                <p className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Client Viewed Quote</p>
                <p className="text-sm font-bold text-violet-900">{fmtDateTime(q.lastViewedAt ?? q.viewedAt)}</p>
                <p className="text-xs text-violet-500 mt-0.5">{q.viewCount} total view{q.viewCount !== 1 ? "s" : ""}</p>
                {q.viewLogs && q.viewLogs.filter(l => l.action === "viewed").slice(0, 3).map(log => (
                  <div key={log.id} className="flex items-center gap-2 mt-2 text-xs text-violet-600">
                    {log.deviceType === "mobile" ? <Smartphone className="w-3 h-3" /> : log.deviceType === "tablet" ? <Tablet className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                    {fmtDateTime(log.viewedAt)} · {log.browser ?? "—"} · {log.ipAddress ?? "—"}
                  </div>
                ))}
              </div>
            )}

            {/* Accepted banner */}
            {q.status === "accepted" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" />Client Accepted!</p>
                <p className="text-xs text-emerald-600 mt-0.5">Accepted on {fmtDateTime(q.acceptedAt)}</p>
                {!q.convertedBookingId && (
                  <p className="text-xs text-emerald-700 mt-2 font-medium">⚠️ Click "Confirm Booking" above after receiving advance payment.</p>
                )}
                {q.convertedBookingId && (
                  <p className="text-xs text-teal-700 mt-2 font-medium">✅ Converted to Booking</p>
                )}
              </div>
            )}

            {/* Rejected banner */}
            {q.status === "rejected" && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-red-700 flex items-center gap-2"><XCircle className="w-5 h-5" />Client Rejected</p>
                <p className="text-xs text-red-500 mt-0.5">{fmtDateTime(q.rejectedAt)}</p>
              </div>
            )}

            {/* Share */}
            {!["draft","converted"].includes(q.status) && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Share Quote</p>
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                  <Link2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  <span className="flex-1 text-xs text-slate-500 truncate">{publicUrl}</span>
                  <button onClick={copyLink} className="flex-shrink-0 text-slate-400 hover:text-indigo-600">
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-slate-400 hover:text-indigo-600">
                    <Eye className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <button onClick={shareWA} className="flex-1 h-9 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                  </button>
                  <button onClick={copyLink} className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                    <Copy className="w-3.5 h-3.5" />{copiedLink ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            )}

            {/* Client */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Client</p>
              <p className="font-bold text-slate-900">{q.client.firstName} {q.client.lastName ?? ""}</p>
              {q.client.phone && <p className="text-sm text-slate-500">{q.client.phone}</p>}
            </div>

            {/* Event */}
            {(q.eventType || q.eventDate || q.venue) && (
              <div className="grid grid-cols-2 gap-3">
                {q.eventType && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-400">Event</p><p className="font-semibold text-slate-800 text-sm">{q.eventType}</p></div>}
                {q.eventDate && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-400">Date</p><p className="font-semibold text-slate-800 text-sm">{fmtDate(q.eventDate)}</p></div>}
                {q.venue && <div className="bg-slate-50 rounded-xl p-3 col-span-2"><p className="text-xs text-slate-400">Venue</p><p className="font-semibold text-slate-800 text-sm">{q.venue}</p></div>}
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Quote Items</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {q.items.map((item, i) => (
                  <div key={item.id} className={cn("flex items-center justify-between px-4 py-3 text-sm", i > 0 && "border-t border-slate-100")}>
                    <div>
                      <span className="font-medium text-slate-800">{item.name}</span>
                      {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                      <span className="text-xs text-slate-400 ml-1">× {item.qty}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{sym}{item.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{sym}{Number(q.subtotal).toLocaleString()}</span></div>
              {Number(q.discountAmount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{sym}{Number(q.discountAmount).toLocaleString()}</span></div>}
              {Number(q.taxAmount) > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>+{sym}{Number(q.taxAmount).toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2"><span>Grand Total</span><span>{sym}{Number(q.grandTotal).toLocaleString()}</span></div>
              <div className="flex justify-between text-orange-600 font-semibold"><span>Advance Required</span><span>{sym}{Number(q.advanceRequired).toLocaleString()}</span></div>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Timeline</p>
              <div className="space-y-1.5">
                {[
                  { label: "Created", time: q.viewLogs?.[0] ? undefined : undefined, at: (detail as any)?.createdAt, color: "text-slate-500" },
                  { label: "Sent",     at: q.sentAt,      color: "text-blue-600" },
                  { label: "Viewed",   at: q.viewedAt,    color: "text-violet-600" },
                  { label: "Accepted", at: q.acceptedAt,  color: "text-emerald-600" },
                  { label: "Rejected", at: q.rejectedAt,  color: "text-red-600" },
                  { label: "Converted",at: q.convertedAt, color: "text-teal-600" },
                ].filter(t => t.at).map(t => (
                  <div key={t.label} className={cn("flex items-center gap-2 text-xs", t.color)}>
                    <span className="w-16 font-medium">{t.label}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>{fmtDateTime(t.at)}</span>
                  </div>
                ))}
              </div>
            </div>

            {q.validUntil && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5" />Valid until {fmtDate(q.validUntil)}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Quote Card ────────────────────────────────────────────────────────────────
function QuoteCard({ q, onView, onEdit, onDuplicate, onDelete, onSend }: {
  q: Quote;
  onView: () => void; onEdit: () => void; onDuplicate: () => void;
  onDelete: () => void; onSend: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sc = STATUS[q.status] ?? STATUS.draft;
  const StatusIcon = sc.icon;
  const sym = currSym(q.currency);

  useEffect(() => {
    if (!menuOpen) return;
    function h(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1", sc.badge)}>
              <StatusIcon className="w-2.5 h-2.5" />{sc.label}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{q.quoteNumber}</span>
            {q.viewCount > 0 && <span className="text-[10px] text-violet-500 flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{q.viewCount}</span>}
          </div>
          <p className="font-bold text-slate-900 text-sm truncate">{q.client.firstName} {q.client.lastName ?? ""}</p>
          {q.eventType && <p className="text-xs text-slate-500">{q.eventType}{q.venue && ` · ${q.venue}`}</p>}
        </div>
        <div className="relative flex-shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { onView(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Eye className="w-4 h-4 text-slate-400" />View</button>
              {["draft","rejected"].includes(q.status) && <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Edit2 className="w-4 h-4 text-slate-400" />Edit</button>}
              {q.status === "draft" && <button onClick={() => { onSend(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-blue-700 hover:bg-blue-50"><Send className="w-4 h-4 text-blue-400" />Send Quote</button>}
              <button onClick={() => { onDuplicate(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Copy className="w-4 h-4 text-slate-400" />Duplicate</button>
              {["draft","rejected","expired"].includes(q.status) && <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" />Delete</button>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          {q.eventDate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(q.eventDate)}</span>}
          {q.validUntil && new Date(q.validUntil) < new Date() && q.status !== "converted" && (
            <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-3 h-3" />Expired</span>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900 text-sm">{sym}{Number(q.grandTotal).toLocaleString()}</p>
          {Number(q.advanceRequired) > 0 && <p className="text-[10px] text-orange-500">Adv: {sym}{Number(q.advanceRequired).toLocaleString()}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, statusCounts: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Quote | null>(null);
  const [viewTarget, setViewTarget] = useState<Quote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) p.set("search", search);
      if (statusFilter !== "all") p.set("status", statusFilter);
      const r = await fetch(`${API}/quotes?${p}`, { headers: authH() });
      if (r.ok) { const d = await r.json(); setQuotes(d.data ?? []); setMeta(d.meta); }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function sendQuote(q: Quote) {
    await fetch(`${API}/quotes/${q.id}/send`, { method: "POST", headers: authH() });
    load();
  }

  async function duplicateQuote(q: Quote) {
    const r = await fetch(`${API}/quotes/${q.id}/duplicate`, { method: "POST", headers: authH() });
    if (r.ok) load();
  }

  async function deleteQuote(q: Quote) {
    if (!confirm(`Delete ${q.quoteNumber}?`)) return;
    await fetch(`${API}/quotes/${q.id}`, { method: "DELETE", headers: authH() });
    load();
  }

  function onSaved(saved: Quote) {
    setShowCreate(false); setEditTarget(null);
    load();
    setViewTarget(saved);
  }

  const sc = meta.statusCounts;
  const stats = [
    { label: "Total",     value: meta.total,          color: "text-slate-900", bg: "bg-slate-50" },
    { label: "Sent",      value: (sc.sent ?? 0) + (sc.viewed ?? 0), color: "text-blue-700", bg: "bg-blue-50" },
    { label: "Accepted",  value: sc.accepted ?? 0,    color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Converted", value: sc.converted ?? 0,   color: "text-teal-700",    bg: "bg-teal-50" },
    { label: "Rejected",  value: sc.rejected ?? 0,    color: "text-red-600",     bg: "bg-red-50" },
  ];

  const conversionRate = meta.total > 0 ? Math.round(((sc.converted ?? 0) / meta.total) * 100) : 0;

  const TABS = [
    { key: "all",      label: "All" },
    { key: "draft",    label: "Draft" },
    { key: "sent",     label: "Sent" },
    { key: "viewed",   label: "Viewed" },
    { key: "accepted", label: "Accepted" },
    { key: "converted",label: "Converted" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quotes</h1>
          <p className="text-xs text-slate-400 mt-0.5">{conversionRate}% conversion rate · {meta.total} total quotes</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-sm">
          <Plus className="w-4 h-4" />New Quote
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {stats.map(s => (
          <div key={s.label} className={cn("rounded-2xl p-3 border border-slate-200 shadow-sm", s.bg)}>
            <p className="text-[10px] text-slate-500">{s.label}</p>
            <p className={cn("text-2xl font-extrabold mt-0.5", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by client, event type…" className="pl-9 h-10 border-slate-200" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(1); }}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                statusFilter === t.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {t.label}{t.key !== "all" && sc[t.key] ? ` · ${sc[t.key]}` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">No quotes yet</p>
          <p className="text-sm text-slate-400 mb-4">Create your first quotation to share with clients</p>
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-sm"><Plus className="w-4 h-4" />Create Quote</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quotes.map(q => (
            <QuoteCard key={q.id} q={q}
              onView={() => setViewTarget(q)}
              onEdit={() => { setViewTarget(null); setEditTarget(q); }}
              onDuplicate={() => duplicateQuote(q)}
              onDelete={() => deleteQuote(q)}
              onSend={() => sendQuote(q)}
            />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">← Prev</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.totalPages} className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">Next →</button>
        </div>
      )}

      {(showCreate || editTarget) && (
        <QuoteDrawer quote={editTarget} onClose={() => { setShowCreate(false); setEditTarget(null); }} onSaved={onSaved} />
      )}
      <ViewDrawer quote={viewTarget} onClose={() => setViewTarget(null)} onEdit={() => { setEditTarget(viewTarget); setViewTarget(null); }} onRefresh={load} />
    </div>
  );
}
