"use client";

import { CalendarDays as HeaderIcon } from "lucide-react";
import { CARD_SHADOW, DateBox, EmptyState, Group, PageHeader } from "@/components/ui/apple";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { localDateStr } from "@/lib/format";


interface Booking {
  id: string; bookingNumber: string; eventName: string; eventDate?: string;
  eventLocation?: string; status: string; clientName?: string;
  client?: { firstName: string; lastName: string };
}

const STATUS_COLORS: Record<string, { dot: string; badge: string; label: string }> = {
  inquiry:             { dot: "bg-[#C2304F]",   badge: "bg-[#FDECEF] text-[#C2304F]",     label: "Inquiry" },
  quote_sent:          { dot: "bg-[#9E3A8C]",    badge: "bg-[#FBF2FA] text-[#9E3A8C]",       label: "Quote Sent" },
  confirmed:           { dot: "bg-[#7D5CEF]",  badge: "bg-[#EEE8FD] text-[#5B3FD0]",   label: "Confirmed" },
  advance_received:    { dot: "bg-[#5B3FD0]",  badge: "bg-[#EEE8FD] text-[#5B3FD0]",   label: "Advance Rcvd" },
  in_progress:         { dot: "bg-[#126B66]",   badge: "bg-[#E0F2F1] text-[#126B66]",     label: "Shooting" },
  editing:             { dot: "bg-[#1F5C99]",  badge: "bg-[#E6F0FB] text-[#1F5C99]",   label: "Editing" },
  ready_for_delivery:  { dot: "bg-[#7D5CEF]",    badge: "bg-[#7D5CEF] text-white",       label: "Ready" },
  delivered:           { dot: "bg-[#4A4658]",    badge: "bg-[#EEEDF2] text-[#4A4658]",       label: "Delivered" },
  completed:           { dot: "bg-[#1F8A5B]", badge: "bg-[#EEEDF2] text-[#4A4658]", label: "Completed" },
  cancelled:           { dot: "bg-[#8A2E2E]",     badge: "bg-[#F3E3E3] text-[#8A2E2E]",         label: "Cancelled" },
  refunded:            { dot: "bg-[#8A2E2E]",    badge: "bg-[#F3E3E3] text-[#8A2E2E]",       label: "Refunded" },
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
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  return (
    <>
      <div className="sp-backdrop" onClick={onClose} />
      <aside className="sp-drawer flex flex-col" role="dialog" aria-modal="true" aria-label={label}>
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3 border-b border-[#EEEBF4]">
          <div>
            <p className="text-xs font-semibold text-[#6B6680]">{bookings.length} {bookings.length === 1 ? "program" : "programs"}</p>
            <h2 className="text-lg font-bold text-[#17151F]">{label}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {bookings.length === 0 ? (
            <div className="py-12 text-center">
              <span className="w-12 h-12 rounded-full bg-[#EEE8FD] flex items-center justify-center mx-auto"><CalendarDays className="w-5 h-5 text-[#5B3FD0]" /></span>
              <p className="mt-3 text-sm font-bold text-[#17151F]">Free day</p>
              <p className="text-xs text-[#6B6680] mt-1">No programs on this date.</p>
              <Link href="/programs" className="mt-4 inline-flex h-10 px-4 rounded-full bg-[#16141D] text-white text-sm font-semibold items-center">Add program</Link>
            </div>
          ) : (
            <Group>
              {bookings.map(b => <EventRow key={b.id} b={b} />)}
            </Group>
          )}
        </div>
      </aside>
    </>
  );
}

function EventRow({ b, withDate }: { b: Booking; withDate?: boolean }) {
  const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry;
  const clientName = b.client ? `${b.client.firstName} ${b.client.lastName ?? ""}`.trim() : b.clientName ?? "";
  const time = formatTime(b.eventDate);
  return (
    <Link href={`/programs?view=${b.id}`} className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-[#F7F5FB] transition-colors">
      {withDate ? <DateBox date={b.eventDate} /> : <span className={cn("w-1.5 self-stretch rounded-full flex-shrink-0", sc.dot)} />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-[#17151F] truncate">{b.eventName || b.bookingNumber}</span>
        <span className="block text-xs text-[#6B6680] truncate mt-0.5">
          {[clientName, time && time !== "12:00 AM" && time !== "00:00" ? time : null, b.eventLocation].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0", sc.badge)}>{sc.label}</span>
    </Link>
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
    const startDate = localDateStr(new Date(year, month, 1));
    const endDate   = localDateStr(new Date(year, month + 1, 0));
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
    <div>
      <PageHeader icon={HeaderIcon} color="red" title={`${MONTH_NAMES[month]} ${year}`}
        sub={loading ? "Loading…" : `${bookings.length} program${bookings.length === 1 ? "" : "s"} this month`}>
        <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <button onClick={prev} aria-label="Previous month" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F3FA] text-[#4A4658]">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="h-8 px-3 rounded-full text-sm font-semibold text-[#17151F] hover:bg-[#F5F3FA]">Today</button>
          <button onClick={next} aria-label="Next month" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F3FA] text-[#4A4658]">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </PageHeader>

      {/* Month grid */}
      <div className={cn("bg-white rounded-[20px] overflow-hidden mb-7", CARD_SHADOW)}>
        <div className="grid grid-cols-7 border-b border-[#EEEBF4]">
          {DAY_NAMES.map((d, i) => (
            <div key={d} className={cn("py-2.5 text-center text-xs font-bold", i === 5 ? "text-[#C2304F]" : "text-[#6B6680]")}>{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const key = `${cell.date.getFullYear()}-${String(cell.date.getMonth()+1).padStart(2,"0")}-${String(cell.date.getDate()).padStart(2,"0")}`;
              const cellBookings = dayMap.get(key) ?? [];
              const isToday = cell.currentMonth && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = selected && selected.getDate() === cell.date.getDate() && selected.getMonth() === cell.date.getMonth() && selected.getFullYear() === cell.date.getFullYear();
              return (
                <button key={i} onClick={() => { if (cell.currentMonth) setSelected(cell.date); }} disabled={!cell.currentMonth}
                  aria-label={`${cell.day} ${MONTH_NAMES[cell.date.getMonth()]}${cellBookings.length ? `, ${cellBookings.length} program${cellBookings.length > 1 ? "s" : ""}` : ""}`}
                  className={cn(
                    "min-h-[64px] sm:min-h-[104px] p-1.5 sm:p-2 text-left border-b border-r border-[#EEEBF4] transition-colors flex flex-col",
                    cell.currentMonth ? "hover:bg-[#F7F5FB]" : "bg-[#FBFAFD]",
                    isSelected && "bg-[#EEE8FD] hover:bg-[#EEE8FD]",
                    i % 7 === 6 && "border-r-0",
                  )}>
                  <span className={cn("w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-semibold mx-auto sm:mx-0 sm:ml-auto tabular-nums",
                    !cell.currentMonth && "text-[#CFC8DC]",
                    cell.currentMonth && !isToday && "text-[#17151F]",
                    isToday && "bg-[#C2304F] text-white")}>
                    {cell.day}
                  </span>
                  {cellBookings.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 justify-center mt-1 sm:hidden">
                      {cellBookings.slice(0, 3).map((b, j) => (
                        <span key={j} className={cn("w-1.5 h-1.5 rounded-full", (STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry).dot)} />
                      ))}
                    </div>
                  )}
                  <div className="hidden sm:block space-y-1 mt-1 w-full">
                    {cellBookings.slice(0, 2).map(b => {
                      const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry;
                      return <div key={b.id} className={cn("text-xs px-1.5 py-0.5 rounded-[6px] font-semibold truncate leading-tight", sc.badge)}>{b.eventName || b.bookingNumber}</div>;
                    })}
                    {cellBookings.length > 2 && <div className="text-xs font-semibold text-[#6B6680] pl-1">+{cellBookings.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* This month as a list */}
      {!loading && (
        bookings.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No programs this month" text="Pick another month, or add a program."
            action={<Link href="/programs" className="inline-flex h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold items-center">Add program</Link>} />
        ) : (
          <Group title={`${MONTH_NAMES[month]} programs`}>
            {[...bookings].sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? "")).map(b => <EventRow key={b.id} b={b} withDate />)}
          </Group>
        )
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
