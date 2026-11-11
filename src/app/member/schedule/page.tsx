"use client";

import { useState, useEffect } from "react";
import { CalendarDays, CalendarPlus, Download, ExternalLink, MapPin, Phone } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chips, DateBox, EmptyState, Group, PageHeader } from "@/components/ui/apple";
import { FormDrawer } from "@/components/ui/form-kit";
import { downloadIcs, googleCalendarUrl, type CalDay } from "@/lib/calendar";
import { NextUp, Spinner, StatusBadge, daysUntil } from "../_components/kit";
import Link from "next/link";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Event {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; eventLocation?: string; status: string;
  clientName: string; clientPhone: string; days: string[];
  /** The days I work on this program. */
  myDays?: { date: string; part: string; location: string; shifts: string[] }[];
}

/** My work days on a program, as calendar entries (whole days). */
function calDays(e: Event): CalDay[] {
  const name = e.eventName || "Program";
  const who = [e.clientName && `Client: ${e.clientName}`, e.clientPhone].filter(Boolean).join(" · ");
  const link = typeof window !== "undefined" ? `${window.location.origin}/member/programs/${e.id}` : "";
  const mine = e.myDays?.length ? e.myDays
    : (e.days.length ? e.days : e.eventDate ? [e.eventDate] : []).map(date => ({ date, part: "", location: e.eventLocation ?? "", shifts: [] as string[] }));
  return mine.filter(d => /^\d{4}-\d{2}-\d{2}/.test(d.date)).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
    date: d.date.slice(0, 10),
    title: d.part && d.part.toLowerCase() !== name.toLowerCase() ? `${d.part} — ${name}` : name,
    location: d.location || e.eventLocation || undefined,
    details: [who, d.shifts.length ? `Shift: ${d.shifts.join(", ")}` : "", link].filter(Boolean).join("\n"),
  }));
}

const isOpen = (e: Event, now: Date) => {
  if (!e.eventDate) return false;
  const dt = new Date(e.eventDate); dt.setHours(0, 0, 0, 0);
  return dt >= now && e.status !== "completed" && e.status !== "cancelled";
};

export default function SchedulePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");
  const [cal, setCal] = useState<Event | null>(null);

  useEffect(() => {
    apiFetch(`${API}/member/schedule`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setEvents(d.events ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const shown = filter === "upcoming" ? events.filter(e => isOpen(e, now)) : events;
  const groups: Record<string, Event[]> = {};
  for (const e of shown) {
    const dt = e.eventDate ? new Date(e.eventDate) : null;
    const key = dt && !isNaN(dt.getTime()) ? `${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}` : "No date";
    (groups[key] ??= []).push(e);
  }
  const next = events.find(e => isOpen(e, now));
  const nextDays = next ? daysUntil(next.eventDate) : null;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const upcomingDays = events.filter(e => e.status !== "cancelled").flatMap(calDays).filter(d => d.date >= today);
  const softBtn = "h-10 px-4 rounded-full bg-white hover:bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)]";

  return (
    <div>
      <PageHeader icon={CalendarDays} color="red" title="My schedule" sub="Where and when you work">
        {upcomingDays.length > 0 && (
          <button type="button" onClick={() => downloadIcs(upcomingDays, "schedule", "My StuPanel schedule")} className={softBtn}
            title="Downloads a calendar file with all your coming work days. Open it to add them to your phone or computer calendar.">
            <CalendarPlus className="w-4 h-4" />Add all to my calendar
          </button>
        )}
      </PageHeader>

      {next && nextDays !== null && (
        <NextUp days={nextDays} title={next.eventName || "Program"} href={`/member/programs/${next.id}`}
          sub={`${next.clientName} · ${fmtDate(next.eventDate)}${next.eventLocation ? ` · ${next.eventLocation}` : ""}`} />
      )}

      <Chips label="Show" value={filter} onChange={setFilter}
        options={[{ value: "upcoming", label: "Coming up" }, { value: "all", label: "All", count: events.length }]} />

      {shown.length === 0 ? (
        <EmptyState icon={CalendarDays} title={filter === "upcoming" ? "Nothing coming up" : "No programs yet"} text="Your work days show up here." />
      ) : Object.entries(groups).map(([month, list]) => (
        <Group key={month} title={month}>
          {list.map(ev => {
            const d = daysUntil(ev.eventDate);
            const open = d !== null && d >= 0 && ev.status !== "completed" && ev.status !== "cancelled";
            return (
              <div key={ev.id} className="flex items-stretch">
              <Link href={`/member/programs/${ev.id}`} className="flex-1 min-w-0 flex items-start gap-3 pl-4 sm:pl-5 pr-2 py-3.5 hover:bg-[#F7F5FB] transition-colors">
                <DateBox date={ev.eventDate} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-[#17151F] truncate">{ev.eventName || "Program"}</span>
                  </span>
                  <span className="block text-xs text-[#6B6680] truncate">
                    {ev.clientName}{ev.eventLocation && <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {ev.eventLocation}</>}
                    {ev.clientPhone && <> · <Phone className="inline w-3 h-3 -mt-0.5" /> {ev.clientPhone}</>}
                  </span>
                  {(ev.days.length > 1 || open) && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {open && (
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-bold",
                          d === 0 ? "bg-[#FDECEF] text-[#C2304F]" : d! <= 3 ? "bg-[#FBF2FA] text-[#823072]" : "bg-[#F5F3FA] text-[#4A4658]")}>
                          {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`}
                        </span>
                      )}
                      {ev.days.length > 1 && ev.days.map((x, i) => {
                        const dt = new Date(x);
                        return <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#F5F3FA] text-[#4A4658]">{isNaN(dt.getTime()) ? x : `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`}</span>;
                      })}
                    </span>
                  )}
                </span>
                <StatusBadge status={ev.status} />
              </Link>
              {calDays(ev).length > 0 && (
                <button type="button" onClick={() => setCal(ev)} aria-label={`Add ${ev.eventName || "program"} to my calendar`} title="Add to my calendar"
                  className="w-12 flex-shrink-0 flex items-center justify-center text-[#6B6680] hover:bg-[#F7F5FB] hover:text-[#5B3FD0] transition-colors">
                  <CalendarPlus className="w-[18px] h-[18px]" />
                </button>
              )}
              </div>
            );
          })}
        </Group>
      ))}

      <FormDrawer open={!!cal} onClose={() => setCal(null)} icon={CalendarPlus} color="red" title="Add to my calendar" sub={cal?.eventName || "Program"}
        footer={<button type="button" onClick={() => setCal(null)} className="flex-1 h-12 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[15px] font-semibold">Close</button>}>
        {cal && (() => {
          const days = calDays(cal);
          return (
            <>
              {days.length > 1 && (
                <button type="button" onClick={() => downloadIcs(days, cal.id, cal.eventName || cal.bookingNumber)}
                  className="w-full h-12 mb-4 rounded-full bg-[#17151F] hover:bg-black text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />Add all {days.length} days (calendar file)
                </button>
              )}
              <div className="space-y-3">
                {days.map((d, i) => (
                  <div key={`${d.date}-${i}`} className="bg-white rounded-[20px] p-4 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
                    <div className="flex items-center gap-3">
                      <DateBox date={d.date} />
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[#17151F] truncate">{d.title}</p>
                        <p className="text-[12.5px] text-[#6B6680] truncate">{fmtDate(d.date)}{d.location ? ` · ${d.location}` : ""}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <a href={googleCalendarUrl(d)} target="_blank" rel="noopener noreferrer"
                        className="h-11 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />Google Calendar
                      </a>
                      <button type="button" onClick={() => downloadIcs([d], cal.id, `${d.title} ${d.date}`)}
                        className="h-11 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
                        <Download className="w-4 h-4 flex-shrink-0" />Calendar file
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="px-1 mt-4 text-xs text-[#6B6680] leading-relaxed">
                <b className="text-[#4A4658]">Google Calendar</b> opens with the day filled in — press Save there. <b className="text-[#4A4658]">Calendar file</b> downloads a file; open it to add the day to your phone, Apple or Outlook calendar. Entries are whole-day and do not change by themselves if the studio moves the date.
              </p>
            </>
          );
        })()}
      </FormDrawer>
    </div>
  );
}
