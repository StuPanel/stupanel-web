"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, Loader2, Search, Eye, Trash2, Send, CheckCircle2,
  FileText, Link2, Copy, MoreVertical, AlertCircle, Zap,
  DollarSign, Clock, TrendingUp, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

const SITE = typeof window !== "undefined" ? window.location.origin : "";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}
function sym(cur = "BDT") { return cur === "BDT" ? "৳" : "$"; }

const STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  draft:          { label: "Draft",         badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-400"   },
  sent:           { label: "Sent",          badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-500"    },
  viewed:         { label: "Viewed",        badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500"  },
  paid:           { label: "Paid",          badge: "bg-emerald-100 text-emerald-700",dot:"bg-emerald-500" },
  partially_paid: { label: "Part. Paid",    badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500"   },
  overdue:        { label: "Overdue",       badge: "bg-red-100 text-red-600",       dot: "bg-red-500"     },
  void:           { label: "Void",          badge: "bg-slate-100 text-slate-400",   dot: "bg-slate-300"   },
};

interface Client { id: string; firstName: string; lastName?: string; phone?: string; email?: string; }
interface Booking { id: string; bookingNumber: string; eventName?: string; }
interface InvoiceItem { id: string; name: string; description?: string; quantity: number; unitPrice: number; total: number; }
interface Invoice {
  id: string; invoiceNumber: string; status: string; publicToken: string;
  subtotal: number; discountAmount: number; taxLabel?: string; taxPercent: number;
  taxAmount: number; grandTotal: number; paidAmount: number; balanceDue: number;
  currency: string; issueDate: string; dueDate?: string;
  notes?: string; termsConditions?: string;
  sentAt?: string; viewedAt?: string; paidAt?: string;
  client: Client; booking?: Booking; items: InvoiceItem[];
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: "success"|"error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2",
      type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, onChange, onRemove, canRemove }: {
  item: InvoiceItem; onChange: (i: InvoiceItem) => void; onRemove: () => void; canRemove: boolean;
}) {
  return (
    <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <input value={item.name} onChange={e => onChange({ ...item, name: e.target.value })}
            placeholder="Item name" className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          <input value={item.description ?? ""} onChange={e => onChange({ ...item, description: e.target.value })}
            placeholder="Description" className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Qty</span>
            <input type="number" min="1" value={item.quantity}
              onChange={e => { const q = Number(e.target.value)||1; onChange({ ...item, quantity: q, total: q * item.unitPrice }); }}
              className="w-16 h-8 px-2 text-center rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-slate-500">Price</span>
            <input type="number" min="0" value={item.unitPrice}
              onChange={e => { const p = Number(e.target.value)||0; onChange({ ...item, unitPrice: p, total: item.quantity * p }); }}
              className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Total</span>
            <span className="font-bold text-sm text-slate-800 w-20 text-right">{item.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
      {canRemove && (
        <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 mt-1">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
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
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0,10));
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10); });
  const [items, setItems] = useState<InvoiceItem[]>([{ id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [taxLabel, setTaxLabel] = useState("VAT");
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const afterDisc = Math.max(0, subtotal - discountAmount);
  const taxAmt = afterDisc * (taxPercent / 100);
  const grand = afterDisc + taxAmt;
  const s = sym(currency);

  useEffect(() => {
    fetch(`${API}/clients?limit=200`, { headers: { "Content-Type": "application/json" } }).then(r => r.json()).then(d => setClients(d.data ?? []));
    fetch(`${API}/bookings?limit=200`, { headers: { "Content-Type": "application/json" } }).then(r => r.json()).then(d => setBookings(d.data ?? []));
    fetch(`${API}/companies/me`, { headers: { "Content-Type": "application/json" } }).then(r => r.json()).then(d => {
      if (d.taxLabel) setTaxLabel(d.taxLabel);
      if (d.defaultTaxPercent) setTaxPercent(Number(d.defaultTaxPercent));
      if (d.defaultTerms) setTerms(d.defaultTerms);
      if (d.currency) setCurrency(d.currency);
    }).catch(() => {});
  }, []);

  const filteredClients = clients.filter(c =>
    `${c.firstName} ${c.lastName ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const clientBookings = bookings.filter(b => selectedClient && (b as any).clientId === selectedClient.id);

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
          items: items.filter(i => i.name.trim()),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed."); return; }
      onSaved(d);
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">New Invoice</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

          {/* Client */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Client *</Label>
            {selectedClient ? (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">{selectedClient.firstName[0]}</div>
                <div className="flex-1"><p className="font-semibold text-slate-800 text-sm">{selectedClient.firstName} {selectedClient.lastName ?? ""}</p><p className="text-xs text-slate-400">{selectedClient.phone}</p></div>
                <button onClick={() => { setSelectedClient(null); setSelectedBookingId(""); }} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setClientDropdown(true); }}
                  onFocus={() => setClientDropdown(true)}
                  placeholder="Search client…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                {clientDropdown && filteredClients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredClients.slice(0,8).map(c => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(""); setClientDropdown(false); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 text-sm flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">{c.firstName[0]}</div>
                        <div><p className="font-medium text-slate-800">{c.firstName} {c.lastName ?? ""}</p><p className="text-xs text-slate-400">{c.phone}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Booking link (optional) */}
          {selectedClient && clientBookings.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Link to Booking <span className="text-slate-400 font-normal normal-case">(optional)</span></Label>
              <select value={selectedBookingId} onChange={e => setSelectedBookingId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
                <option value="">No booking linked</option>
                {clientBookings.map(b => <option key={b.id} value={b.id}>{b.bookingNumber} — {b.eventName || "Untitled"}</option>)}
              </select>
            </div>
          )}

          {/* Dates + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Issue Date</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Currency</Label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
                {["BDT","USD","INR","GBP"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Line Items *</Label>
              <button onClick={() => setItems(its => [...its, { id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 }])}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />Add Item
              </button>
            </div>
            {items.map((item, i) => (
              <ItemRow key={item.id} item={item}
                onChange={upd => setItems(its => its.map((x, j) => j === i ? upd : x))}
                onRemove={() => setItems(its => its.filter((_, j) => j !== i))}
                canRemove={items.length > 1} />
            ))}
          </div>

          {/* Pricing */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Discount ({s})</Label>
                <input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Tax Label</Label>
                <input value={taxLabel} onChange={e => setTaxLabel(e.target.value)} maxLength={10}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Tax %</Label>
                <input type="number" min="0" max="30" step="0.5" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{s}{subtotal.toLocaleString()}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{s}{discountAmount.toLocaleString()}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between text-slate-500"><span>{taxLabel} ({taxPercent}%)</span><span>+{s}{Math.round(taxAmt).toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2"><span>Grand Total</span><span>{s}{Math.round(grand).toLocaleString()}</span></div>
            </div>
          </div>

          {/* Notes + Terms */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Notes</Label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any notes for the client…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Terms & Conditions</Label>
              <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} placeholder="Payment terms…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200 text-slate-600">Cancel</Button>
          <Button disabled={saving} onClick={save} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : <><FileText className="w-4 h-4" />Create Invoice</>}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── View Drawer ─────────────────────────────────────────────────────────────
function ViewDrawer({ inv, onClose, onRefresh }: { inv: Invoice; onClose: () => void; onRefresh: () => void }) {
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [acting, setActing] = useState(false);
  const s = STATUS[inv.status] ?? STATUS.draft;
  const c = sym(inv.currency);
  const url = `${SITE}/inv/${inv.publicToken}`;

  async function doAction(path: string, msg: string) {
    setActing(true);
    try {
      const r = await apiFetch(`${API}/studio-invoices/${inv.id}/${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error();
      setToast({ msg, type: "success" });
      onRefresh();
    } catch { setToast({ msg: "Action failed.", type: "error" }); }
    finally { setActing(false); }
  }

  async function doDelete() {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}?`)) return;
    setActing(true);
    try {
      await apiFetch(`${API}/studio-invoices/${inv.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      onClose(); onRefresh();
    } catch { setToast({ msg: "Delete failed.", type: "error" }); }
    finally { setActing(false); }
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900">{inv.invoiceNumber}</h2>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", s.badge)}>{s.label}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{inv.client.firstName} {inv.client.lastName ?? ""} · {inv.client.phone ?? ""}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {inv.status === "draft" && (
              <Button size="sm" onClick={() => doAction("send", "Invoice marked as sent!")} disabled={acting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Send className="w-3.5 h-3.5" />Mark as Sent
              </Button>
            )}
            {["sent","viewed","partially_paid"].includes(inv.status) && (
              <Button size="sm" onClick={() => doAction("paid", "Invoice marked as paid!")} disabled={acting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />Mark as Paid
              </Button>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="border-slate-200 text-slate-600 gap-1.5">
                <Eye className="w-3.5 h-3.5" />Preview
              </Button>
            </a>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); setToast({ msg: "Link copied!", type: "success" }); }}
              className="border-slate-200 text-slate-600 gap-1.5">
              <Copy className="w-3.5 h-3.5" />Copy Link
            </Button>
            {["draft","void"].includes(inv.status) && (
              <Button size="sm" variant="outline" onClick={doDelete} disabled={acting}
                className="border-red-200 text-red-500 hover:bg-red-50 gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />Delete
              </Button>
            )}
          </div>

          {/* Share link */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
            <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-600 truncate flex-1">{url}</p>
            <button onClick={() => { navigator.clipboard.writeText(url); setToast({ msg: "Copied!", type: "success" }); }}
              className="text-xs text-indigo-600 font-semibold flex-shrink-0 hover:text-indigo-700">Copy</button>
          </div>

          {/* Booking link */}
          {inv.booking && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              <FileText className="w-4 h-4 text-indigo-500" />
              <p className="text-xs text-indigo-700 font-medium">{inv.booking.bookingNumber} — {inv.booking.eventName || "Untitled"}</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Line Items</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {inv.items.map((item, i) => (
                <div key={item.id} className={cn("px-4 py-3 flex items-start justify-between gap-2", i > 0 && "border-t border-slate-100")}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                    <p className="text-xs text-slate-400">{item.quantity} × {sym(inv.currency)}{Number(item.unitPrice).toLocaleString()}</p>
                  </div>
                  <p className="font-bold text-sm text-slate-900 flex-shrink-0">{sym(inv.currency)}{Number(item.total).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{c}{Number(inv.subtotal).toLocaleString()}</span></div>
            {Number(inv.discountAmount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{c}{Number(inv.discountAmount).toLocaleString()}</span></div>}
            {Number(inv.taxAmount) > 0 && <div className="flex justify-between text-slate-500"><span>{inv.taxLabel} ({inv.taxPercent}%)</span><span>+{c}{Number(inv.taxAmount).toLocaleString()}</span></div>}
            <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2"><span>Grand Total</span><span>{c}{Number(inv.grandTotal).toLocaleString()}</span></div>
            {Number(inv.paidAmount) > 0 && <div className="flex justify-between text-emerald-600 font-semibold"><span>Paid</span><span>−{c}{Number(inv.paidAmount).toLocaleString()}</span></div>}
            <div className={cn("flex justify-between font-bold text-base", Number(inv.balanceDue) > 0 ? "text-red-600" : "text-emerald-600")}>
              <span>Balance Due</span><span>{c}{Number(inv.balanceDue).toLocaleString()}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Timeline</p>
            {[
              { label: "Issued", date: inv.issueDate, dot: "bg-slate-400" },
              { label: "Due", date: inv.dueDate, dot: "bg-amber-400" },
              { label: "Sent", date: inv.sentAt, dot: "bg-blue-400" },
              { label: "Viewed", date: inv.viewedAt, dot: "bg-violet-400" },
              { label: "Paid", date: inv.paidAt, dot: "bg-emerald-500" },
            ].filter(x => x.date).map(x => (
              <div key={x.label} className="flex items-center gap-3">
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", x.dot)} />
                <span className="text-xs text-slate-500 w-12">{x.label}</span>
                <span className="text-xs font-medium text-slate-700">{fmtDate(x.date!)}</span>
              </div>
            ))}
          </div>

          {inv.notes && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
              <p className="text-xs text-slate-600">{inv.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────
function InvoiceCard({ inv, onClick }: { inv: Invoice; onClick: () => void }) {
  const s = STATUS[inv.status] ?? STATUS.draft;
  const c = sym(inv.currency);
  const due = Number(inv.balanceDue);
  return (
    <button onClick={onClick}
      className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all text-left">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-bold text-slate-900 text-sm">{inv.invoiceNumber}</p>
          <p className="text-xs text-slate-500 mt-0.5">{inv.client.firstName} {inv.client.lastName ?? ""}</p>
        </div>
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0", s.badge)}>{s.label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-extrabold text-slate-900">{c}{Number(inv.grandTotal).toLocaleString()}</p>
          {due > 0 && <p className="text-xs text-red-500 font-medium">Due: {c}{due.toLocaleString()}</p>}
          {due === 0 && inv.status === "paid" && <p className="text-xs text-emerald-600 font-medium">Fully Paid ✓</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">{fmtDate(inv.issueDate)}</p>
          {inv.dueDate && <p className="text-xs text-slate-400">Due {fmtDate(inv.dueDate)}</p>}
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState({ total: 0, totalValue: 0, totalCollected: 0, totalDue: 0, paid: 0, draft: 0 });
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
      const params = new URLSearchParams({ page: String(page), limit: "20", ...(search && { search }), ...(statusFilter && { status: statusFilter }) });
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
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          <p className="text-xs text-slate-400 mt-0.5">{total} invoices</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Invoice</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Value",    val: `৳${Number(stats.totalValue).toLocaleString()}`,     icon: FileText,   color: "bg-indigo-50 text-indigo-600" },
          { label: "Collected",      val: `৳${Number(stats.totalCollected).toLocaleString()}`,  icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
          { label: "Balance Due",    val: `৳${Number(stats.totalDue).toLocaleString()}`,        icon: DollarSign, color: "bg-red-50 text-red-500" },
          { label: "Pending",        val: String(stats.draft),                                  icon: Clock,      color: "bg-amber-50 text-amber-600" },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 font-medium">{label}</p>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", color)}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-slate-900">{val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or client…" className="pl-9 h-10 border-slate-200" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
          <option value="">All Status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No invoices yet</p>
          <p className="text-xs text-slate-400 mt-1">Create your first invoice or generate from a booking</p>
          <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" />New Invoice
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {invoices.map(inv => (
            <InvoiceCard key={inv.id} inv={inv} onClick={async () => {
              setViewLoading(true);
              try {
                const r = await apiFetch(`${API}/studio-invoices/${inv.id}`);
                const full = await r.json();
                setViewing(full);
              } catch { setViewing(inv); }
              finally { setViewLoading(false); }
            }} />
          ))}
        </div>
      )}

      {viewLoading && (
        <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-5 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-slate-700">Loading invoice…</p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p-1)} className="h-8 w-8 p-0 border-slate-200">
            <ChevronRight className="w-4 h-4 rotate-180" />
          </Button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)} className="h-8 w-8 p-0 border-slate-200">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {createOpen && <CreateDrawer onClose={() => setCreateOpen(false)} onSaved={inv => { setCreateOpen(false); setViewing(inv); fetch_(); setToast({ msg: "Invoice created!", type: "success" }); }} />}
      {viewing && <ViewDrawer inv={viewing} onClose={() => setViewing(null)} onRefresh={() => { fetch_(); setViewing(null); }} />}
    </div>
  );
}
