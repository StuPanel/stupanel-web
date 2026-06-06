"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, X, Loader2, Link2, Check, ExternalLink, Copy,
  CalendarDays, MapPin, AlertTriangle, ChevronDown, Image,
  Video, Package, CheckCircle2, Clock, Send, MoreVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function token() { return localStorage.getItem("access_token") ?? ""; }
function authH() { return { Authorization: `Bearer ${token()}` }; }
function jsonH() { return { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }; }

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}
function daysFromNow(d: string | Date): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: string; bookingNumber: string; eventName?: string; status: string;
  eventDate?: string; eventLocation?: string; currency: string;
  grandTotal: number; paidAmount: number;
  deliveryLink?: string; deliveryNote?: string; deliveryDate?: string;
  client: { id: string; firstName: string; lastName?: string; phone?: string };
}

// ─── Delivery status config ────────────────────────────────────────────────
const DEL_STATUS: Record<string, { label: string; badge: string; dot: string; icon: typeof Clock }> = {
  confirmed:          { label: "Not Started",  badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-300",   icon: Clock },
  advance_received:   { label: "Not Started",  badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-300",   icon: Clock },
  in_progress:        { label: "Shooting",     badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-400",   icon: Clock },
  editing:            { label: "Editing",      badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400",  icon: Clock },
  ready_for_delivery: { label: "Ready",        badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500",  icon: Send  },
  delivered:          { label: "Delivered",    badge: "bg-teal-100 text-teal-700",     dot: "bg-teal-500",    icon: CheckCircle2 },
  completed:          { label: "Completed",    badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
};

const FILTER_TABS = [
  { key: "all",              label: "All" },
  { key: "editing",          label: "Editing" },
  { key: "ready_for_delivery", label: "Ready" },
  { key: "delivered",        label: "Delivered" },
  { key: "completed",        label: "Completed" },
];

// ─── Delivery Modal ────────────────────────────────────────────────────────────
function DeliveryModal({ booking, onClose, onSaved }: {
  booking: Booking | null; onClose: () => void; onSaved: (updated: Booking) => void;
}) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (booking) {
      setLink(booking.deliveryLink ?? "");
      setNote(booking.deliveryNote ?? "");
      setDate(booking.deliveryDate ? booking.deliveryDate.slice(0, 10) : "");
      setStatus(booking.status);
      setError("");
    }
  }, [booking]);

  if (!booking) return null;

  async function save() {
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/bookings/${booking!.id}/delivery`, {
        method: "PATCH", headers: jsonH(),
        body: JSON.stringify({ deliveryLink: link || undefined, deliveryNote: note || undefined, deliveryDate: date || undefined, status }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to save."); return; }
      onSaved(d); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const DELIVERY_STATUSES = [
    { value: "editing", label: "Editing" },
    { value: "ready_for_delivery", label: "Ready for Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Delivery Details</h3>
              <p className="text-xs text-slate-400 mt-0.5">{booking.eventName ?? booking.bookingNumber} · {booking.client.firstName} {booking.client.lastName ?? ""}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Status</Label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 text-slate-700">
                {DELIVERY_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Delivery Link</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={link} onChange={e => setLink(e.target.value)}
                  placeholder="https://drive.google.com/... or WeTransfer..."
                  className="pl-9 h-11 border-slate-200 text-sm pr-16" />
                {link && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                    <button onClick={copyLink} title="Copy link"
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400">Google Drive, Dropbox, WeTransfer, etc.</p>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Delivered On</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Note</Label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="e.g. 500 photos + highlight video, password: abc123..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={save} disabled={loading} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Delivery Card ─────────────────────────────────────────────────────────────
function DeliveryCard({ b, onEdit }: { b: Booking; onEdit: () => void }) {
  const cfg = DEL_STATUS[b.status] ?? DEL_STATUS.confirmed;
  const StatusIcon = cfg.icon;
  const due = Number(b.grandTotal) - Number(b.paidAmount);
  const sym = b.currency === "BDT" ? "৳" : "$";
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  function copyLink() {
    if (!b.deliveryLink) return;
    navigator.clipboard.writeText(b.deliveryLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const daysLeft = b.eventDate ? daysFromNow(b.eventDate) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1", cfg.badge)}>
              <StatusIcon className="w-2.5 h-2.5" />{cfg.label}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{b.bookingNumber}</span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm truncate">{b.eventName ?? "—"}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{b.client.firstName} {b.client.lastName ?? ""}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <Link2 className="w-4 h-4 text-slate-400" />Update Delivery
              </button>
              {b.deliveryLink && (
                <>
                  <button onClick={() => { copyLink(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <Copy className="w-4 h-4 text-slate-400" />Copy Link
                  </button>
                  <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <ExternalLink className="w-4 h-4 text-slate-400" />Open Link
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event info */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-3">
        {b.eventDate && (
          <span className={cn("flex items-center gap-1", daysLeft !== null && daysLeft < 0 ? "text-red-500" : daysLeft !== null && daysLeft <= 7 ? "text-amber-500" : "")}>
            <CalendarDays className="w-3 h-3" />{fmtDate(b.eventDate)}
            {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && <span className="font-semibold">· {daysLeft}d</span>}
          </span>
        )}
        {b.eventLocation && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.eventLocation}</span>}
      </div>

      {/* Delivery link */}
      {b.deliveryLink ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl mb-3">
          <Link2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-xs text-indigo-700 truncate font-medium hover:underline">
            {b.deliveryLink}
          </a>
          <button onClick={copyLink} className="flex-shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        <button onClick={onEdit}
          className="w-full flex items-center justify-center gap-1.5 h-9 mb-3 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
          <Link2 className="w-3.5 h-3.5" />Add delivery link
        </button>
      )}

      {/* Note */}
      {b.deliveryNote && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3 line-clamp-2">{b.deliveryNote}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {b.deliveryDate && (
            <span className="flex items-center gap-1 text-teal-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />Delivered {fmtDate(b.deliveryDate)}
            </span>
          )}
        </div>
        {due > 0 && (
          <span className="text-xs font-bold text-red-600">{sym}{due.toLocaleString()} due</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DeliveryPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (search) params.set("search", search);
      // Exclude inquiry/cancelled/refunded — only programs past "confirmed"
      const targetStatus = statusFilter !== "all" ? statusFilter : undefined;
      if (targetStatus) params.set("status", targetStatus);
      const r = await fetch(`${API}/bookings?${params}`, { headers: authH() });
      if (r.ok) {
        const d = await r.json();
        // If "all", filter out inquiry-only statuses
        const items = (d.data ?? []).filter((b: Booking) =>
          !["inquiry", "quote_sent", "cancelled", "refunded"].includes(b.status)
        );
        setBookings(items);
        setMeta(d.meta);
      }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function onSaved(updated: Booking) {
    setBookings(bs => bs.map(b => b.id === updated.id ? { ...b, ...updated } : b));
  }

  // Stats
  const delivered   = bookings.filter(b => b.status === "delivered" || b.status === "completed").length;
  const withLink    = bookings.filter(b => !!b.deliveryLink).length;
  const readyCount  = bookings.filter(b => b.status === "ready_for_delivery").length;
  const editingCount = bookings.filter(b => b.status === "editing" || b.status === "in_progress").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Delivery</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track photo & video delivery for each program</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Editing",          value: editingCount,  icon: Video,         color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Ready to Deliver", value: readyCount,    icon: Package,       color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Links Added",      value: withLink,      icon: Link2,         color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Delivered",        value: delivered,     icon: CheckCircle2,  color: "text-emerald-600",bg: "bg-emerald-50"},
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{s.value}</p>
              </div>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-4 h-4", s.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search programs or clients..." className="pl-9 h-10 border-slate-200" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                statusFilter === tab.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No programs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map(b => (
            <DeliveryCard key={b.id} b={b} onEdit={() => setEditTarget(b)} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">← Prev</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.totalPages}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">Next →</button>
        </div>
      )}

      <DeliveryModal booking={editTarget} onClose={() => setEditTarget(null)} onSaved={onSaved} />
    </div>
  );
}
