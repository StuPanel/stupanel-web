"use client";

import { useState, useEffect } from "react";
import { Loader2, CalendarDays, MapPin, Phone, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` };
}

const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDateFull(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : `${String(dt.getDate()).padStart(2,"0")} ${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`;
}

function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0); dt.setHours(0, 0, 0, 0);
  return Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_COLOR: Record<string, string> = {
  inquiry: "bg-slate-100 text-slate-600",
  confirmed: "bg-blue-100 text-blue-700",
  advance_received: "bg-cyan-100 text-cyan-700",
  in_progress: "bg-amber-100 text-amber-700",
  editing: "bg-purple-100 text-purple-700",
  ready_for_delivery: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  inquiry: "Inquiry", confirmed: "Confirmed", advance_received: "Advance Paid",
  in_progress: "Shooting", editing: "Editing", ready_for_delivery: "Ready",
  completed: "Completed", cancelled: "Cancelled",
};

interface Event {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; eventLocation?: string; status: string;
  clientName: string; clientPhone: string; days: string[];
}

function groupByMonth(events: Event[]) {
  const groups: Record<string, Event[]> = {};
  for (const e of events) {
    const dt = e.eventDate ? new Date(e.eventDate) : null;
    const key = dt && !isNaN(dt.getTime())
      ? `${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`
      : "No Date";
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

export default function SchedulePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");

  useEffect(() => {
    fetch(`${API}/member/schedule`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setEvents(d.events ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const filtered = filter === "upcoming"
    ? events.filter(e => {
        if (!e.eventDate) return false;
        const dt = new Date(e.eventDate); dt.setHours(0, 0, 0, 0);
        return dt >= now && e.status !== "completed" && e.status !== "cancelled";
      })
    : events;

  const grouped = groupByMonth(filtered);
  const nextEvent = events.find(e => {
    if (!e.eventDate) return false;
    const dt = new Date(e.eventDate); dt.setHours(0, 0, 0, 0);
    return dt >= now && e.status !== "completed" && e.status !== "cancelled";
  });
  const nextDays = nextEvent ? daysUntil(nextEvent.eventDate) : null;

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Schedule</h1>
        <p className="text-sm text-slate-500 mt-0.5">All programs you're assigned to</p>
      </div>

      {/* Next event countdown */}
      {nextEvent && nextDays !== null && (
        <div className={cn("rounded-xl p-4 flex items-center gap-4",
          nextDays === 0 ? "bg-red-50 border border-red-200" :
          nextDays <= 3 ? "bg-amber-50 border border-amber-200" :
          "bg-indigo-50 border border-indigo-200")}>
          <div className={cn("w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 font-bold",
            nextDays === 0 ? "bg-red-100 text-red-700" :
            nextDays <= 3 ? "bg-amber-100 text-amber-700" :
            "bg-indigo-100 text-indigo-700")}>
            <span className="text-xl leading-none">{nextDays === 0 ? "!" : nextDays}</span>
            <span className="text-[9px] uppercase tracking-wide mt-0.5">{nextDays === 0 ? "Today" : nextDays === 1 ? "day" : "days"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-semibold mb-0.5",
              nextDays === 0 ? "text-red-600" : nextDays <= 3 ? "text-amber-600" : "text-indigo-600")}>
              {nextDays === 0 ? "Program today!" : nextDays <= 3 ? "Coming up soon" : "Next program"}
            </p>
            <p className="font-bold text-slate-900 truncate">{nextEvent.eventName || "Event"}</p>
            <p className="text-xs text-slate-500">{nextEvent.clientName} · {fmtDateFull(nextEvent.eventDate)}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["upcoming", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300")}>
            {f === "upcoming" ? "Upcoming" : `All (${events.length})`}
          </button>
        ))}
      </div>

      {/* Events grouped by month */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-xl border border-slate-200">
          <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">{filter === "upcoming" ? "No upcoming programs" : "No programs found"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, monthEvents]) => (
            <div key={month}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{month}</p>
              <div className="space-y-3">
                {monthEvents.map(ev => {
                  const days = daysUntil(ev.eventDate);
                  const dt = ev.eventDate ? new Date(ev.eventDate) : null;
                  return (
                    <div key={ev.id} className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex gap-4">
                        {/* Date column */}
                        {dt && !isNaN(dt.getTime()) ? (
                          <div className="w-12 flex-shrink-0 flex flex-col items-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{MONTHS_SHORT[dt.getMonth()]}</p>
                            <p className="text-2xl font-extrabold text-slate-900 leading-none">{dt.getDate()}</p>
                            <p className="text-[10px] text-slate-400">{dt.getFullYear()}</p>
                          </div>
                        ) : (
                          <div className="w-12 flex-shrink-0" />
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-bold text-slate-900 truncate">{ev.eventName || "Event"}</p>
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0", STATUS_COLOR[ev.status] ?? "bg-slate-100 text-slate-600")}>
                              {STATUS_LABEL[ev.status] ?? ev.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mb-2">{ev.bookingNumber}</p>

                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            {ev.eventLocation && (
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.eventLocation}</span>
                            )}
                            {ev.clientPhone && (
                              <a href={`tel:${ev.clientPhone}`} className="flex items-center gap-1 hover:text-indigo-600">
                                <Phone className="w-3 h-3" />{ev.clientPhone}
                              </a>
                            )}
                            {ev.clientName && (
                              <span>{ev.clientName}</span>
                            )}
                          </div>

                          {/* Extra days */}
                          {ev.days.length > 1 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {ev.days.map((d, i) => {
                                const dayDt = new Date(d);
                                return (
                                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                    {!isNaN(dayDt.getTime()) ? `${dayDt.getDate()} ${MONTHS_SHORT[dayDt.getMonth()]}` : d}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Countdown pill */}
                          {days !== null && days >= 0 && ev.status !== "completed" && ev.status !== "cancelled" && (
                            <div className="mt-2">
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit",
                                days === 0 ? "bg-red-100 text-red-700" :
                                days <= 3 ? "bg-amber-100 text-amber-700" :
                                "bg-slate-100 text-slate-500")}>
                                <Clock className="w-2.5 h-2.5" />
                                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days away`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
