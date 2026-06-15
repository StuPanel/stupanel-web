"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Camera, CalendarDays, MapPin, Phone,
  ChevronLeft, ChevronRight, ArrowRight, X, Users,
  Banknote, Info, Link2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function getToken() { return localStorage.getItem("access_token") ?? ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  inquiry:            { label: "Inquiry",      color: "bg-slate-100 text-slate-600" },
  confirmed:          { label: "Confirmed",    color: "bg-blue-100 text-blue-700" },
  advance_received:   { label: "Advance Paid", color: "bg-cyan-100 text-cyan-700" },
  in_progress:        { label: "Shooting",     color: "bg-amber-100 text-amber-700" },
  editing:            { label: "Editing",      color: "bg-purple-100 text-purple-700" },
  ready_for_delivery: { label: "Ready",        color: "bg-indigo-100 text-indigo-700" },
  completed:          { label: "Completed",    color: "bg-emerald-100 text-emerald-700" },
  cancelled:          { label: "Cancelled",    color: "bg-red-100 text-red-600" },
};

const NEXT_TRANSITIONS: Record<string, string> = {
  confirmed: "editing", advance_received: "editing", in_progress: "editing", editing: "ready_for_delivery",
};
const TRANSITION_LABELS: Record<string, string> = {
  editing: "Mark as Editing", ready_for_delivery: "Mark Ready",
};

interface Booking {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; eventLocation?: string; status: string;
  deliveryLink?: string;
  client: { id: string; firstName: string; lastName?: string; phone?: string };
  program?: { id: string; name: string; category?: string };
}

interface BookingDetail {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; eventLocation?: string; status: string;
  deliveryLink?: string;
  currency?: string; myRole: string; myBill: number; myNote: string;
  costEntries?: any[]; eventDays?: any[];
  deliveryNote?: string; deliveryMethod?: string; deliveryDate?: string;
  client: { id?: string; firstName: string; lastName?: string; phone?: string; email?: string };
  program?: { name: string; category?: string };
  team?: { userId: string; roleInBooking: string; notes?: string; user: { firstName: string; lastName?: string; memberRoles?: string[] } }[];
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "Shooting" },
  { value: "editing", label: "Editing" },
  { value: "ready_for_delivery", label: "Ready" },
  { value: "completed", label: "Completed" },
];

function DetailModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/member/programs/${bookingId}/detail`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setDetail(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            {detail ? (
              <>
                <p className="font-bold text-slate-900">{detail.eventName || "Event"}</p>
                <p className="text-xs text-slate-400 font-mono">{detail.bookingNumber}</p>
              </>
            ) : <p className="font-bold text-slate-900">Program Detail</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : !detail ? (
            <p className="text-center text-slate-400 text-sm py-8">Could not load details.</p>
          ) : (
            <>
              {/* Status + Program */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", STATUS_CFG[detail.status]?.color ?? "bg-slate-100 text-slate-600")}>
                  {STATUS_CFG[detail.status]?.label ?? detail.status}
                </span>
                {detail.program?.name && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">{detail.program.name}</span>
                )}
              </div>

              {/* Details grid */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Date</span>
                  <span className="font-semibold text-slate-900">{fmtDate(detail.eventDate)}</span>
                </div>
                {detail.eventLocation && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Location</span>
                    <span className="font-semibold text-slate-900 text-right max-w-[60%]">{detail.eventLocation}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Client</span>
                  <span className="font-semibold text-slate-900">{detail.client.firstName} {detail.client.lastName ?? ""}</span>
                </div>
                {detail.client.phone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Phone</span>
                    <a href={`tel:${detail.client.phone}`} className="font-semibold text-indigo-600">{detail.client.phone}</a>
                  </div>
                )}
                {detail.client.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Email</span>
                    <span className="font-semibold text-slate-900 text-right max-w-[60%] truncate">{detail.client.email}</span>
                  </div>
                )}
              </div>

              {/* My assignment */}
              {(detail.myRole || detail.myBill > 0) && (
                <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">My Assignment</p>
                  {detail.myRole && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Role</span>
                      <span className="font-semibold text-slate-900 capitalize">{detail.myRole}</span>
                    </div>
                  )}
                  {detail.myBill > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">My Bill</span>
                      <span className="font-extrabold text-emerald-700">{detail.myBill.toLocaleString()} {detail.currency ?? "BDT"}</span>
                    </div>
                  )}
                  {detail.myNote && (
                    <p className="text-xs text-slate-500 bg-white rounded-lg p-2 mt-1">{detail.myNote}</p>
                  )}
                </div>
              )}

              {/* Team */}
              {detail.team && detail.team.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Team ({detail.team.length})
                  </p>
                  <div className="space-y-2">
                    {detail.team.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-sm text-indigo-700 flex-shrink-0">
                          {(t.user.firstName?.[0] ?? "?").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{t.user.firstName} {t.user.lastName ?? ""}</p>
                          <p className="text-xs text-slate-400 capitalize">{t.roleInBooking.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery */}
              {detail.deliveryLink && (
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Delivery</p>
                  <a href={detail.deliveryLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:underline">
                    <Link2 className="w-4 h-4" /> Open Delivery Link <ExternalLink className="w-3 h-3" />
                  </a>
                  {detail.deliveryDate && (
                    <p className="text-xs text-slate-500 mt-1">Delivery Date: {fmtDate(detail.deliveryDate)}</p>
                  )}
                  {detail.deliveryNote && (
                    <p className="text-xs text-slate-500 mt-1">{detail.deliveryNote}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MemberProgramsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "15" });
    if (statusFilter !== "all") qs.set("status", statusFilter);
    const res = await fetch(`${API}/member/programs?${qs}`, { headers: authHeaders() });
    if (res.ok) {
      const d = await res.json();
      setBookings(d.data ?? []);
      setTotalPages(d.meta?.totalPages ?? 1);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(bookingId: string, newStatus: string) {
    setUpdatingId(bookingId);
    const res = await fetch(`${API}/member/programs/${bookingId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    }
    setUpdatingId(null);
  }

  return (
    <div className="p-5 md:p-7 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Programs</h1>
        <p className="text-sm text-slate-500 mt-0.5">All programs assigned to you</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors",
              statusFilter === f.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Camera className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No programs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const cfg = STATUS_CFG[b.status] ?? { label: b.status, color: "bg-slate-100 text-slate-600" };
            const nextStatus = NEXT_TRANSITIONS[b.status];
            const nextLabel = nextStatus ? TRANSITION_LABELS[nextStatus] : null;
            const isUpdating = updatingId === b.id;

            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Clickable top area → detail modal */}
                <button className="w-full text-left p-4 hover:bg-slate-50 transition-colors" onClick={() => setDetailId(b.id)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold text-slate-900">{b.eventName || "Event"}</p>
                      <p className="text-xs text-slate-400 font-mono">{b.bookingNumber}</p>
                      {b.program && (
                        <p className="text-xs text-slate-400 mt-0.5">{b.program.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", cfg.color)}>{cfg.label}</span>
                      <Info className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />{fmtDate(b.eventDate)}
                    </span>
                    {b.eventLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{b.eventLocation}
                      </span>
                    )}
                  </div>
                </button>

                {/* Bottom action row */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                      {b.client.firstName[0]}
                    </div>
                    {b.client.firstName} {b.client.lastName ?? ""}
                    {b.client.phone && (
                      <a href={`tel:${b.client.phone}`} onClick={e => e.stopPropagation()}
                        className="flex items-center gap-0.5 text-slate-400 hover:text-indigo-600 ml-1">
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {b.deliveryLink && (
                      <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="text-xs text-indigo-600 font-semibold flex items-center gap-1 hover:underline">
                        Delivery <ArrowRight className="w-3 h-3" />
                      </a>
                    )}
                    {nextLabel && (
                      <button
                        onClick={e => { e.stopPropagation(); updateStatus(b.id, nextStatus!); }}
                        disabled={isUpdating}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-1">
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail modal */}
      {detailId && <DetailModal bookingId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
