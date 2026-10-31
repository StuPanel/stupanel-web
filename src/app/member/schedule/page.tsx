"use client";

import { useState, useEffect } from "react";
import { CalendarDays, MapPin, Phone } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chips, DateBox, EmptyState, Group, PageHeader } from "@/components/ui/apple";
import { NextUp, Spinner, StatusBadge, daysUntil } from "../_components/kit";
import Link from "next/link";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Event {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; eventLocation?: string; status: string;
  clientName: string; clientPhone: string; days: string[];
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

  return (
    <div>
      <PageHeader icon={CalendarDays} color="red" title="My schedule" sub="Where and when you work" />

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
              <Link key={ev.id} href={`/member/programs/${ev.id}`} className="flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-[#F7F5FB] transition-colors">
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
                          d === 0 ? "bg-[#FDECEF] text-[#C2304F]" : d! <= 3 ? "bg-[#FFF4E5] text-[#B45309]" : "bg-[#F5F3FA] text-[#4A4658]")}>
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
            );
          })}
        </Group>
      ))}
    </div>
  );
}
