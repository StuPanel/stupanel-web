"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, MapPin, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

interface Booking {
  id: string; bookingNumber: string; eventName: string; eventDate?: string;
  eventLocation?: string; status: string; clientName?: string;
  client?: { firstName: string; lastName: string };
}

const STATUS_COLORS: Record<string, { dot: string; badge: string; label: string }> = {
  inquiry:             { dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600",     label: "Inquiry" },
  quote_sent:          { dot: "bg-blue-400",    badge: "bg-blue-100 text-blue-700",       label: "Quote Sent" },
  confirmed:           { dot: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-700",   label: "Confirmed" },
  advance_received:    { dot: "bg-violet-500",  badge: "bg-violet-100 text-violet-700",   label: "Advance Rcvd" },
  in_progress:         { dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700",     label: "In Progress" },
  editing:             { dot: "bg-orange-400",  badge: "bg-orange-100 text-orange-700",   label: "Editing" },
  ready_for_delivery:  { dot: "bg-cyan-500",    badge: "bg-cyan-100 text-cyan-700",       label: "Ready" },
  delivered:           { dot: "bg-teal-500",    badge: "bg-teal-100 text-teal-700",       label: "Delivered" },
  completed:           { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", label: "Completed" },
  cancelled:           { dot: "bg-red-400",     badge: "bg-red-100 text-red-600",         label: "Cancelled" },
  refunded:            { dot: "bg-rose-400",    badge: "bg-rose-100 text-rose-600",       label: "Refunded" },
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTime(dateStr?: string) {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return null; }
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayPanel({ date, bookings, onClose }: { date: Date; bookings: Booking[]; onClose: () => void }) {
  const label = `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-900">{label}</p>
            <p className="text-xs text-slate-400">{bookings.length} {bookings.length === 1 ? "program" : "programs"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 text-lg">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {bookings.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No programs on this day</p>
          ) : bookings.map(b => {
            const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry;
            const clientName = b.client ? `${b.client.firstName} ${b.client.lastName}`.trim() : b.clientName ?? "";
            const time = formatTime(b.eventDate);
            return (
              <Link key={b.id} href="/programs"
                className="block p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{b.eventName}</p>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0", sc.badge)}>{sc.label}</span>
                </div>
                <p className="text-xs text-slate-400 mb-1">{b.bookingNumber}</p>
                {clientName && <p className="text-xs text-slate-500">Client: {clientName}</p>}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {time && <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="w-3 h-3" />{time}</span>}
                  {b.eventLocation && <span className="flex items-center gap-1 text-xs text-slate-400"><MapPin className="w-3 h-3" />{b.eventLocation}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Date | null>(null);

  // Map: "YYYY-MM-DD" → Booking[]
  const dayMap = new Map<string, Booking[]>();
  bookings.forEach(b => {
    if (!b.eventDate) return;
    const key = b.eventDate.split("T")[0];
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(b);
  });

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    // Fetch all bookings for the visible month range (plus buffer)
    const startDate = new Date(year, month, 1).toISOString().split("T")[0];
    const endDate   = new Date(year, month + 1, 0).toISOString().split("T")[0];
    try {
      const res = await apiFetch(`${API}/bookings?limit=200&startDate=${startDate}&endDate=${endDate}`, { headers: { "Content-Type": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.data ?? data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()); }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells: { day: number; currentMonth: boolean; date: Date }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, currentMonth: false, date: new Date(year, month - 1, prevDays - i) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, currentMonth: false, date: new Date(year, month + 1, d) });
  }

  const selectedBookings = selected
    ? dayMap.get(`${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,"0")}-${String(selected.getDate()).padStart(2,"0")}`) ?? []
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-400 text-xs mt-0.5">Program schedule</p>
        </div>
        <button onClick={goToday} className="text-xs px-3 h-8 rounded-lg border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 transition-colors">
          Today
        </button>
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 border border-slate-200">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <h2 className="font-bold text-slate-900 text-base">{MONTH_NAMES[month]} {year}</h2>
        <button onClick={next} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 border border-slate-200">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const key = `${cell.date.getFullYear()}-${String(cell.date.getMonth()+1).padStart(2,"0")}-${String(cell.date.getDate()).padStart(2,"0")}`;
              const cellBookings = dayMap.get(key) ?? [];
              const isToday = cell.currentMonth &&
                cell.day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();
              const isSelected = selected &&
                selected.getDate() === cell.date.getDate() &&
                selected.getMonth() === cell.date.getMonth() &&
                selected.getFullYear() === cell.date.getFullYear();
              const hasBookings = cellBookings.length > 0;

              return (
                <button
                  key={i}
                  onClick={() => { if (cell.currentMonth) setSelected(cell.date); }}
                  className={cn(
                    "min-h-[60px] sm:min-h-[80px] p-1.5 sm:p-2 text-left border-b border-r border-slate-100 transition-colors",
                    !cell.currentMonth && "bg-slate-50/50",
                    cell.currentMonth && "hover:bg-indigo-50/50 cursor-pointer",
                    isSelected && "bg-indigo-50 ring-1 ring-inset ring-indigo-300",
                    i % 7 === 6 && "border-r-0",
                    i >= 35 && "border-b-0",
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mx-auto mb-1",
                    !cell.currentMonth && "text-slate-300",
                    cell.currentMonth && !isToday && "text-slate-600",
                    isToday && "bg-indigo-600 text-white",
                  )}>
                    {cell.day}
                  </span>

                  {/* Dots on mobile */}
                  {hasBookings && (
                    <div className="flex flex-wrap gap-0.5 justify-center sm:hidden">
                      {cellBookings.slice(0, 3).map((b, j) => {
                        const dot = (STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry).dot;
                        return <span key={j} className={cn("w-1.5 h-1.5 rounded-full", dot)} />;
                      })}
                    </div>
                  )}

                  {/* Labels on desktop */}
                  <div className="hidden sm:block space-y-0.5">
                    {cellBookings.slice(0, 2).map(b => {
                      const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry;
                      return (
                        <div key={b.id} className={cn("text-[9px] px-1 py-0.5 rounded font-medium truncate leading-tight", sc.badge)}>
                          {b.eventName}
                        </div>
                      );
                    })}
                    {cellBookings.length > 2 && (
                      <div className="text-[9px] text-slate-400 pl-1">+{cellBookings.length - 2} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).filter(([, v]) => v).map(([key, v]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", v.dot)} />
            <span className="text-xs text-slate-400">{v.label}</span>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {!loading && bookings.length === 0 && (
        <div className="text-center py-8">
          <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No programs this month</p>
          <Link href="/programs" className="inline-block mt-3 text-xs px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            Add Programs
          </Link>
        </div>
      )}

      {/* Day panel */}
      {selected && (
        <DayPanel
          date={selected}
          bookings={selectedBookings}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
