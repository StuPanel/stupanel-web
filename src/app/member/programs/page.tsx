"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Camera, CalendarDays, MapPin, Phone,
  ChevronLeft, ChevronRight, ArrowRight, ChevronRight as NavArrow,
} from "lucide-react";
import { useRouter } from "next/navigation";
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

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "Shooting" },
  { value: "editing", label: "Editing" },
  { value: "ready_for_delivery", label: "Ready" },
  { value: "completed", label: "Completed" },
];

export default function MemberProgramsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
                {/* Clickable top → Program Hub page */}
                <button className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                  onClick={() => router.push(`/member/programs/${b.id}`)}>
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
                      <NavArrow className="w-3.5 h-3.5 text-slate-300" />
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
    </div>
  );
}
