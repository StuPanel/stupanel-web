"use client";

import { CalendarDays as HeaderIcon } from "lucide-react";
import { EmptyState, Group, PageHeader } from "@/components/ui/apple";
import { EntryRow, MONTH_NAMES, MonthCalendar, monthRange, type CalEntry } from "@/components/month-calendar";

import { apiFetch } from "@/lib/api";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
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


type Day = { date?: string; eventType?: string; location?: string; shifts?: { label?: string; start?: string; end?: string; assignments?: unknown[] }[] };
const fmtT = (t?: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? ""); if (!m) return ""; const h = Number(m[1]); return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`; };

/** One calendar entry per day of a program (a program without days shows on its date). */
function toEntries(b: Booking & { eventDays?: Day[] }): CalEntry[] {
  const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry;
  const client = b.client ? `${b.client.firstName} ${b.client.lastName ?? ""}`.trim() : b.clientName ?? "";
  const name = b.eventName || b.bookingNumber;
  const days = (Array.isArray(b.eventDays) ? b.eventDays : []).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d.date ?? ""));
  const base = { dot: sc.dot, chip: sc.badge, badge: { label: sc.label, cls: sc.badge }, href: `/programs?view=${b.id}` };
  if (!days.length) return b.eventDate ? [{ ...base, key: b.id, date: b.eventDate.slice(0, 10), title: name, sub: [client, b.eventLocation].filter(Boolean).join(" · ") }] : [];
  return days.map((d, i) => {
    const shifts = (d.shifts ?? []).map(s => [s.label, s.start && s.end ? `${fmtT(s.start)}–${fmtT(s.end)}` : ""].filter(Boolean).join(" ")).filter(Boolean);
    const people = new Set((d.shifts ?? []).flatMap(s => (s.assignments ?? []) as { id?: string }[]).map(a => a?.id).filter(Boolean)).size;
    return {
      ...base, key: `${b.id}-${i}`, date: d.date!.slice(0, 10),
      title: d.eventType && d.eventType.toLowerCase() !== name.toLowerCase() ? `${name} · ${d.eventType}` : name,
      sub: [client, shifts.join(", "), d.location || b.eventLocation, people ? `${people} on the team` : ""].filter(Boolean).join(" · "),
    };
  });
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // From a month earlier: a program that starts last month can have days in this one.
    const [, end] = monthRange(year, month);
    const from = localDateStr(new Date(year, month - 1, 1));
    apiFetch(`${API}/bookings?limit=300&startDate=${from}&endDate=${end}`).then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d) setBookings(d.data ?? d); }).catch(() => {}).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [year, month]);

  const entries = useMemo(() => bookings.flatMap(toEntries), [bookings]);
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  const thisMonth = entries.filter(e => e.date.startsWith(ym)).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <PageHeader icon={HeaderIcon} color="red" title="Calendar" sub="Every day of every program — swipe the month to go back and forth" />
      <MonthCalendar year={year} month={month} onMonth={(y, m) => { setYear(y); setMonth(m); }} entries={entries} loading={loading}
        emptyDay={() => <Link href="/programs" className="mt-4 inline-flex h-10 px-4 rounded-full bg-[#16141D] text-white text-sm font-semibold items-center">Add program</Link>} />
      {!loading && (thisMonth.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No programs this month" text="Swipe to another month, or add a program."
          action={<Link href="/programs" className="inline-flex h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold items-center">Add program</Link>} />
      ) : (
        <Group title={`${MONTH_NAMES[month]} — every program day`}>
          {thisMonth.map(e => <EntryRow key={e.key} e={e} withDate />)}
        </Group>
      ))}
    </div>
  );
}
