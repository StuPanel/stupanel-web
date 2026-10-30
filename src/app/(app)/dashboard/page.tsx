"use client";

/**
 * Dashboard — Apple style (DESIGN_SYSTEM §11): page header with tile, number
 * cards with tiles, grouped white cards with rows.
 */
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Camera, Banknote, Users, Clock, TrendingUp, TrendingDown, CalendarDays, Eye, EyeOff,
  LayoutDashboard, Plus, UserPlus, CreditCard, BarChart3, ChevronDown, ChevronRight,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtDate as sharedFmtDate, formatCurrencyCompact, formatCurrency } from "@/lib/format";
import { CARD_SHADOW, Group, ListRow, PageHeader, Tile } from "@/components/ui/apple";

type Period = "this_month" | "last_month" | "last_3_months" | "this_year" | "last_year";

interface Stats {
  totalPrograms: number; totalRevenue: number; pendingAmount: number; totalClients: number;
  changes: { programs: number; revenue: number; clients: number };
}
interface Booking {
  id: string; bookingNumber: string; eventName?: string; eventDate?: string; eventTime?: string;
  status: string; grandTotal: number; paidAmount: number; currency: string;
  client: { id: string; firstName: string; lastName?: string };
}
interface MonthData { month: number; total: number }

const fmt = (n: number, c = "BDT") => formatCurrencyCompact(n, c);
const fmtFull = (n: number, c = "BDT") => formatCurrency(n, c);
const clientName = (c: { firstName: string; lastName?: string }) => [c.firstName, c.lastName].filter(Boolean).join(" ");

function dayBox(d?: string) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return {
    day: dt.getDate(),
    mon: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(dt).toUpperCase(),
    week: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(dt),
  };
}

const PERIODS: { label: string; value: Period }[] = [
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "Last 3 months", value: "last_3_months" },
  { label: "This year", value: "this_year" },
  { label: "Last year", value: "last_year" },
];

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  inquiry: { label: "Inquiry", bg: "#FDECEF", text: "#C2304F" },
  quote_sent: { label: "Quote sent", bg: "#FBF2FA", text: "#9E3A8C" },
  confirmed: { label: "Confirmed", bg: "#EEE8FD", text: "#5B3FD0" },
  advance_received: { label: "Advance", bg: "#EEE8FD", text: "#5B3FD0" },
  in_progress: { label: "Shooting", bg: "#E0F2F1", text: "#126B66" },
  editing: { label: "Editing", bg: "#E6F0FB", text: "#1F5C99" },
  ready_for_delivery: { label: "Ready", bg: "#7D5CEF", text: "#FFFFFF" },
  delivered: { label: "Delivered", bg: "#EEEDF2", text: "#4A4658" },
  completed: { label: "Completed", bg: "#EEEDF2", text: "#4A4658" },
  cancelled: { label: "Cancelled", bg: "#F3E3E3", text: "#8A2E2E" },
  refunded: { label: "Refunded", bg: "#F3E3E3", text: "#8A2E2E" },
};
function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.inquiry;
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: s.bg, color: s.text }}>{s.label}</span>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardPage() {
  const [showAmounts, setShowAmounts] = useState(true);
  const [period, setPeriod] = useState<Period>("this_month");
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<Booking[] | null>(null);
  const [recent, setRecent] = useState<Booking[] | null>(null);
  const [chart, setChart] = useState<MonthData[] | null>(null);

  // Remember hide/show amounts on this device.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (localStorage.getItem("sp_hide_amounts") === "1") setShowAmounts(false); } catch { /* ignore */ }
  }, []);
  function toggleAmounts() {
    setShowAmounts(v => {
      try { localStorage.setItem("sp_hide_amounts", v ? "1" : "0"); } catch { /* ignore */ }
      return !v;
    });
  }

  const load = useCallback(async <T,>(path: string, set: (v: T) => void, fallback: T) => {
    try {
      const r = await apiFetch(`${API}${path}`);
      set(r.ok ? await r.json() : fallback);
    } catch { set(fallback); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setStats(null); load<Stats | null>(`/dashboard/stats?period=${period}`, setStats, null); }, [period, load]);
  useEffect(() => {
    load<Booking[]>("/dashboard/upcoming", setUpcoming, []);
    load<Booking[]>("/dashboard/recent", setRecent, []);
  }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setChart(null); load<MonthData[]>(`/dashboard/revenue-chart?year=${chartYear}`, setChart, []); }, [chartYear, load]);

  const money = (v: string) => (showAmounts ? v : "••••••");
  const periodLabel = PERIODS.find(p => p.value === period)?.label.toLowerCase() ?? "";

  const cards = stats ? [
    { label: "Programs", value: String(stats.totalPrograms), change: stats.changes.programs, icon: Camera, color: "deep", href: "/programs", amount: false },
    { label: "Money received", value: fmtFull(stats.totalRevenue), change: stats.changes.revenue, icon: Banknote, color: "green", href: "/payments", amount: true },
    { label: "Still due", value: fmtFull(stats.pendingAmount), change: null, icon: Clock, color: "red", href: "/payments", amount: true },
    { label: "Clients", value: String(stats.totalClients), change: stats.changes.clients, icon: Users, color: "blue", href: "/clients", amount: false },
  ] : null;

  const chartMax = Math.max(...(chart ?? []).map(d => d.total), 1);
  const chartTotal = (chart ?? []).reduce((s, d) => s + d.total, 0);
  const now = new Date();

  return (
    <div>
      <PageHeader icon={LayoutDashboard} color="violet" title="Dashboard" sub="Here's what's happening in your studio.">
        <button onClick={toggleAmounts} aria-pressed={!showAmounts}
          className="h-10 px-4 rounded-full bg-white text-sm font-semibold text-[#17151F] inline-flex items-center gap-2 shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]">
          {showAmounts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showAmounts ? "Hide amounts" : "Show amounts"}
        </button>
        <PillSelect label="Period" value={period} onChange={v => setPeriod(v as Period)} options={PERIODS} />
      </PageHeader>

      {/* Numbers */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-7">
        {!cards ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn("bg-white rounded-[20px] p-4 space-y-3", CARD_SHADOW)}>
            <div className="flex items-center gap-2.5"><div className="sp-skel w-7 h-7 rounded-[8px]" /><div className="sp-skel h-3.5 w-20 rounded-full" /></div>
            <div className="sp-skel h-7 w-28 rounded-full" /><div className="sp-skel h-3 w-16 rounded-full" />
          </div>
        )) : cards.map(c => (
          <Link key={c.label} href={c.href}
            className={cn("block bg-white rounded-[20px] p-4 transition-transform duration-200 hover:-translate-y-0.5", CARD_SHADOW)}>
            <div className="flex items-center gap-2.5">
              <Tile icon={c.icon} color={c.color} size={28} />
              <p className="text-[13px] font-semibold text-[#4A4658] truncate">{c.label}</p>
            </div>
            <p className={cn("mt-3 text-[22px] sm:text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums leading-none truncate",
              c.amount && !showAmounts && "select-none")}>
              {c.amount ? money(c.value) : c.value}
            </p>
            {c.change !== null && c.change !== undefined ? (
              <p className={cn("mt-2 text-xs font-semibold inline-flex items-center gap-1", c.change >= 0 ? "text-[#1F8A5B]" : "text-[#C2304F]")}>
                {c.change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {c.change > 0 ? "+" : ""}{c.change}% <span className="text-[#6B6680] font-medium">vs before</span>
              </p>
            ) : <p className="mt-2 text-xs text-[#6B6680]">On all open programs</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-x-5">
        {/* Upcoming */}
        <div className="xl:col-span-2">
          <Group title="Coming up" action={<SeeAll href="/calendar" label="Calendar" />}>
            {upcoming === null ? <RowsSkeleton n={4} /> : upcoming.length === 0 ? (
              <Empty icon={CalendarDays} title="Nothing coming up" text="New programs will show here by date." cta={{ href: "/programs", label: "Add program" }} />
            ) : upcoming.map(b => {
              const d = dayBox(b.eventDate);
              return (
                <Link key={b.id} href={`/programs?view=${b.id}`}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[64px] hover:bg-[#F7F5FB] transition-colors">
                  <span className="w-12 flex-shrink-0 rounded-[12px] bg-[#FDECEF] text-center py-1.5">
                    <span className="block text-[11px] font-bold text-[#C2304F] leading-none">{d?.mon ?? "—"}</span>
                    <span className="block text-lg font-extrabold text-[#17151F] leading-tight tabular-nums">{d?.day ?? ""}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[#17151F] truncate">{b.eventName || "Untitled program"}</span>
                    <span className="block text-xs text-[#6B6680] truncate">{clientName(b.client)}{d ? ` · ${d.week}` : ""}{b.eventTime ? ` · ${b.eventTime}` : ""}</span>
                  </span>
                  <StatusPill status={b.status} />
                </Link>
              );
            })}
          </Group>
        </div>

        {/* Money chart */}
        <div className="xl:col-span-3">
          <Group title="Money received" action={
            <PillSelect label="Year" small value={String(chartYear)} onChange={v => setChartYear(Number(v))}
              options={[now.getFullYear(), now.getFullYear() - 1].map(y => ({ value: String(y), label: String(y) }))} />
          }>
            <div className="px-4 sm:px-5 pt-5 pb-4">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
                <p className="text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums leading-none">{money(fmtFull(chartTotal))}</p>
                <p className="text-xs text-[#6B6680]">Collected in {chartYear}</p>
              </div>
              <div className="flex items-end gap-1.5 sm:gap-2 h-44" role="img" aria-label={`Money received each month in ${chartYear}`}>
                {(chart ?? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }))).map((d, i) => {
                  const h = chart ? Math.max(3, (d.total / chartMax) * 100) : 30 + ((i * 37) % 50);
                  const current = i === now.getMonth() && chartYear === now.getFullYear();
                  return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group" title={`${MONTHS[i]}: ${showAmounts ? fmtFull(d.total) : "hidden"}`}>
                      <div className={cn("w-full rounded-[6px] transition-colors", !chart ? "sp-skel" : current ? "bg-[#7D5CEF]" : "bg-[#CFC2F8] group-hover:bg-[#B29DF8]")}
                        style={{ height: `${h}%` }} />
                      <span className={cn("text-xs", current ? "font-bold text-[#5B3FD0]" : "text-[#6B6680]")}>{MONTHS[i][0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <ListRow href="/reports" icon={BarChart3} color="blue" title="See full reports" sub="Income, dues, programs and team" />
          </Group>
        </div>
      </div>

      {/* Recent */}
      <Group title="Recent programs" action={<SeeAll href="/programs" label="All programs" />}>
        {recent === null ? <RowsSkeleton n={5} /> : recent.length === 0 ? (
          <Empty icon={Camera} title="No programs yet" text="Add your first program to see it here." cta={{ href: "/programs", label: "Add program" }} />
        ) : recent.map(b => {
          const due = Math.max(0, b.grandTotal - b.paidAmount);
          return (
            <Link key={b.id} href={`/programs?view=${b.id}`}
              className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[64px] hover:bg-[#F7F5FB] transition-colors">
              <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-sm font-bold flex items-center justify-center flex-shrink-0">
                {b.client.firstName?.[0]?.toUpperCase() ?? "?"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[#17151F] truncate">{clientName(b.client)}</span>
                <span className="block text-xs text-[#6B6680] truncate">{b.eventName || b.bookingNumber}{b.eventDate ? ` · ${sharedFmtDate(b.eventDate)}` : ""}</span>
              </span>
              <span className="text-right flex-shrink-0 hidden sm:block">
                <span className="block text-sm font-bold text-[#17151F] tabular-nums">{money(fmtFull(b.grandTotal, b.currency))}</span>
                {due > 0 && <span className="block text-xs font-semibold text-[#C2304F] tabular-nums">{money(`${fmtFull(due, b.currency)} due`)}</span>}
              </span>
              <span className="text-right flex-shrink-0 sm:hidden">
                <span className="block text-sm font-bold text-[#17151F] tabular-nums">{money(fmt(b.grandTotal, b.currency))}</span>
                {due > 0 && showAmounts && <span className="block text-xs font-semibold text-[#C2304F]">Due</span>}
              </span>
              <span className="hidden md:block"><StatusPill status={b.status} /></span>
              <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />
            </Link>
          );
        })}
      </Group>

      {/* Quick actions */}
      <Group title="Quick actions" flush>
        <div className="grid grid-cols-3 divide-x divide-[#EEEBF4]">
          {[
            { label: "New program", icon: Plus, color: "deep", href: "/programs" },
            { label: "Add client", icon: UserPlus, color: "blue", href: "/clients" },
            { label: "Record payment", icon: CreditCard, color: "green", href: "/payments" },
          ].map(a => (
            <Link key={a.label} href={a.href} className="flex flex-col items-center gap-2 py-4 px-2 hover:bg-[#F7F5FB] transition-colors">
              <Tile icon={a.icon} color={a.color} size={36} />
              <span className="text-xs sm:text-sm font-semibold text-[#17151F] text-center leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </Group>

      <p className="sr-only" aria-live="polite">Showing numbers for {periodLabel}</p>
    </div>
  );
}

// ─── small pieces ─────────────────────────────────────────────────────────────
function PillSelect({ value, onChange, options, label, small }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; small?: boolean;
}) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}
        className={cn("appearance-none rounded-full bg-white font-semibold text-[#17151F] pl-4 pr-9 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40",
          "shadow-[0_1px_2px_rgba(22,18,40,.06)]", small ? "h-8 text-xs" : "h-10 text-sm")}
        style={{ WebkitAppearance: "none" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680] pointer-events-none" />
    </div>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-xs font-semibold text-[#5B3FD0] hover:underline inline-flex items-center gap-0.5">
      {label} <ChevronRight className="w-3.5 h-3.5" />
    </Link>
  );
}

function RowsSkeleton({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[64px]">
          <div className="sp-skel w-10 h-10 rounded-[12px]" />
          <div className="flex-1 space-y-2"><div className="sp-skel h-3.5 w-40 rounded-full" /><div className="sp-skel h-3 w-24 rounded-full" /></div>
          <div className="sp-skel h-6 w-20 rounded-full" />
        </div>
      ))}
    </>
  );
}

function Empty({ icon: Icon, title, text, cta }: { icon: React.ElementType; title: string; text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="py-10 px-4 text-center">
      <span className="w-12 h-12 rounded-full bg-[#EEE8FD] flex items-center justify-center mx-auto"><Icon className="w-5 h-5 text-[#5B3FD0]" /></span>
      <p className="mt-3 text-sm font-bold text-[#17151F]">{title}</p>
      <p className="text-xs text-[#6B6680] mt-1">{text}</p>
      {cta && (
        <Link href={cta.href} className="mt-4 inline-flex h-10 px-4 rounded-full bg-[#16141D] text-white text-sm font-semibold items-center gap-1.5">
          <Plus className="w-4 h-4" /> {cta.label}
        </Link>
      )}
    </div>
  );
}
