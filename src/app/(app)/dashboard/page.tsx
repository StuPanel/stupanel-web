"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import {
  Camera, DollarSign, Users, Clock, TrendingUp, TrendingDown,
  ArrowRight, CalendarDays, Eye, EyeOff, Loader2, Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = "this_month" | "last_month" | "last_3_months" | "this_year" | "last_year";

interface Stats {
  totalPrograms: number;
  totalRevenue: number;
  pendingAmount: number;
  totalClients: number;
  changes: { programs: number; revenue: number; clients: number };
}

interface Booking {
  id: string;
  bookingNumber: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  status: string;
  grandTotal: number;
  paidAmount: number;
  currency: string;
  client: { id: string; firstName: string; lastName?: string };
}

interface MonthData { month: number; total: number }

// ─── Config ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

function fmt(n: number, currency = "BDT") {
  if (n >= 100000) return (currency === "BDT" ? "৳" : "$") + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return (currency === "BDT" ? "৳" : "$") + (n / 1000).toFixed(1) + "K";
  return (currency === "BDT" ? "৳" : "$") + n.toLocaleString();
}

function fmtDate(d: string | Date | null | undefined, short = false): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const dd = String(dt.getDate()).padStart(2, "0");
  return short ? `${dd}-${MONTHS[dt.getMonth()]}` : `${dd}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

function fmtFull(n: number, currency = "BDT") {
  return (currency === "BDT" ? "৳" : "$") + Number(n).toLocaleString();
}

function clientName(c: { firstName: string; lastName?: string }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

const DATE_FILTERS: { label: string; value: Period }[] = [
  { label: "This Month",    value: "this_month" },
  { label: "Last Month",    value: "last_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "This Year",     value: "this_year" },
  { label: "Last Year",     value: "last_year" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  inquiry:            { label: "Inquiry",     bg: "bg-slate-100",   text: "text-slate-600" },
  quote_sent:         { label: "Quote Sent",  bg: "bg-sky-100",     text: "text-sky-700" },
  confirmed:          { label: "Confirmed",   bg: "bg-blue-100",    text: "text-blue-700" },
  advance_received:   { label: "Advance",     bg: "bg-indigo-100",  text: "text-indigo-700" },
  in_progress:        { label: "In Progress", bg: "bg-yellow-100",  text: "text-yellow-700" },
  editing:            { label: "Editing",     bg: "bg-orange-100",  text: "text-orange-700" },
  ready_for_delivery: { label: "Ready",       bg: "bg-purple-100",  text: "text-purple-700" },
  delivered:          { label: "Delivered",   bg: "bg-cyan-100",    text: "text-cyan-700" },
  completed:          { label: "Completed",   bg: "bg-emerald-100", text: "text-emerald-700" },
  cancelled:          { label: "Cancelled",   bg: "bg-red-100",     text: "text-red-700" },
  refunded:           { label: "Refunded",    bg: "bg-rose-100",    text: "text-rose-700" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("bg-slate-100 animate-pulse rounded", className)} style={style} />;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [showAmounts, setShowAmounts] = useState(true);
  const [period, setPeriod] = useState<Period>("this_month");
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [chart, setChart] = useState<MonthData[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await apiFetch(`${API}/dashboard/stats?period=${period}`, { headers: { "Content-Type": "application/json" } });
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
    finally { setLoadingStats(false); }
  }, [period]);

  const fetchUpcoming = useCallback(async () => {
    setLoadingUpcoming(true);
    try {
      const res = await apiFetch(`${API}/dashboard/upcoming`, { headers: { "Content-Type": "application/json" } });
      if (res.ok) setUpcoming(await res.json());
    } catch { /* silent */ }
    finally { setLoadingUpcoming(false); }
  }, []);

  const fetchRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await apiFetch(`${API}/dashboard/recent`, { headers: { "Content-Type": "application/json" } });
      if (res.ok) setRecent(await res.json());
    } catch { /* silent */ }
    finally { setLoadingRecent(false); }
  }, []);

  const fetchChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const res = await apiFetch(`${API}/dashboard/revenue-chart?year=${chartYear}`, { headers: { "Content-Type": "application/json" } });
      if (res.ok) setChart(await res.json());
    } catch { /* silent */ }
    finally { setLoadingChart(false); }
  }, [chartYear]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUpcoming(); fetchRecent(); }, [fetchUpcoming, fetchRecent]);
  useEffect(() => { fetchChart(); }, [fetchChart]);

  // Chart max for scaling
  const chartMax = Math.max(...chart.map(d => d.total), 1);
  const chartTotal = chart.reduce((s, d) => s + d.total, 0);

  const statCards = stats ? [
    {
      title: "Total Programs",
      value: String(stats.totalPrograms),
      isAmount: false,
      change: stats.changes.programs,
      icon: Camera,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Total Revenue",
      value: fmtFull(stats.totalRevenue),
      isAmount: true,
      change: stats.changes.revenue,
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Pending Payments",
      value: fmtFull(stats.pendingAmount),
      isAmount: true,
      change: null,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "Total Clients",
      value: String(stats.totalClients),
      isAmount: false,
      change: stats.changes.clients,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ] : null;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Overview</h1>
          <p className="text-slate-400 text-xs mt-0.5">Here&apos;s what&apos;s happening in your studio.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowAmounts(!showAmounts)}
            className="gap-1.5 text-slate-600 border-slate-200 h-9 text-xs">
            {showAmounts ? <><EyeOff className="w-3.5 h-3.5" /><span className="hidden sm:inline">Hide</span></> : <><Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline">Show</span></>}
          </Button>
          <select value={period} onChange={e => setPeriod(e.target.value as Period)}
            className="text-sm border border-slate-200 rounded-lg px-3 h-9 text-slate-700 bg-white focus:outline-none cursor-pointer">
            {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {loadingStats
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-slate-200 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))
          : statCards?.map(stat => (
              <Card key={stat.title} className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-medium truncate">{stat.title}</p>
                      <p className={cn(
                        "text-xl font-bold text-slate-900 mt-1 transition-all",
                        stat.isAmount && !showAmounts ? "blur-sm select-none" : ""
                      )}>
                        {stat.isAmount && !showAmounts ? "••••••" : stat.value}
                      </p>
                      {stat.change !== null && stat.change !== undefined ? (
                        <div className="flex items-center gap-1 mt-1">
                          {stat.change >= 0
                            ? <TrendingUp className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            : <TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0" />
                          }
                          <span className={cn("text-xs font-medium", stat.change >= 0 ? "text-emerald-600" : "text-red-500")}>
                            {stat.change > 0 ? "+" : ""}{stat.change}%
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">All active bookings</p>
                      )}
                    </div>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", stat.bg)}>
                      <stat.icon className={cn("w-4 h-4", stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        }
      </div>

      {/* Middle Row: Upcoming + Revenue Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">

        {/* Upcoming Programs */}
        <Card className="xl:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Upcoming Programs</CardTitle>
              <Link href="/programs" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
            {loadingUpcoming ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
              ))
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No upcoming programs</p>
                <Link href="/programs">
                  <Button size="sm" className="mt-3 h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
                    <Plus className="w-3 h-3" /> Add Program
                  </Button>
                </Link>
              </div>
            ) : (
              upcoming.map(b => {
                const S = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.inquiry;
                const dateStr = b.eventDate
                  ? fmtDate(b.eventDate, true)
                  : null;
                return (
                  <div key={b.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{b.eventName || "Untitled"}</p>
                      <p className="text-xs text-slate-500 truncate">{clientName(b.client)}</p>
                      {dateStr && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <CalendarDays className="w-3 h-3" />{dateStr}
                          {b.eventTime && ` · ${b.eventTime}`}
                        </p>
                      )}
                    </div>
                    <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0", S.bg, S.text)}>
                      {S.label}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card className="xl:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Revenue Overview</CardTitle>
              <select value={chartYear} onChange={e => setChartYear(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 h-7 text-slate-600 bg-white focus:outline-none cursor-pointer">
                {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingChart ? (
              <div className="flex items-end gap-1 h-40">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <Skeleton className="w-full rounded-t-sm" style={{ height: `${20 + Math.random() * 60}%` }} />
                    <Skeleton className="h-2.5 w-3 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-end gap-1" style={{ height: "10rem" }}>
                {chart.map((d, i) => {
                  const h = chartMax > 0 ? Math.max(4, (d.total / chartMax) * 100) : 4;
                  const isCurrentMonth = i === new Date().getMonth() && chartYear === new Date().getFullYear();
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 h-full group"
                      title={`${MONTHS[i]}: ${fmtFull(d.total)}`}>
                      <div
                        className={cn(
                          "w-full rounded-t-sm transition-colors",
                          isCurrentMonth ? "bg-indigo-500" : "bg-indigo-200 group-hover:bg-indigo-400"
                        )}
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{MONTHS[i][0]}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <div>
                <p className={cn("text-xl font-bold text-slate-900 transition-all", !showAmounts ? "blur-sm select-none" : "")}>
                  {showAmounts ? fmtFull(chartTotal) : "••••••"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{chartYear} total revenue collected</p>
              </div>
              {!loadingChart && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                    <span className="text-xs text-slate-500">Current month</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-indigo-200" />
                    <span className="text-xs text-slate-500">Other months</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Programs */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900">Recent Programs</CardTitle>
            <Link href="/programs" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-1">
          {loadingRecent ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-10">
              <Camera className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No programs yet</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Event</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(b => {
                      const S = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.inquiry;
                      const due = Math.max(0, b.grandTotal - b.paidAmount);
                      return (
                        <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                                {b.client.firstName[0]?.toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-900 text-sm">{clientName(b.client)}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 hidden sm:table-cell text-sm truncate max-w-[160px]">
                            {b.eventName || "—"}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 hidden md:table-cell text-xs">
                            {fmtDate(b.eventDate)}
                          </td>
                          <td className={cn("py-2.5 px-4 font-semibold text-slate-900 text-sm transition-all", !showAmounts ? "blur-sm select-none" : "")}>
                            {showAmounts
                              ? <div>
                                  <p>{fmtFull(b.grandTotal, b.currency)}</p>
                                  {due > 0 && <p className="text-xs text-orange-500 font-normal">Due: {fmtFull(due, b.currency)}</p>}
                                </div>
                              : "••••"
                            }
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", S.bg, S.text)}>
                              {S.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden p-3 space-y-2">
                {recent.map(b => {
                  const S = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.inquiry;
                  const due = Math.max(0, b.grandTotal - b.paidAmount);
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                        {b.client.firstName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{clientName(b.client)}</p>
                        <p className="text-xs text-slate-500 truncate">{b.eventName || b.bookingNumber}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={cn("text-sm font-bold text-slate-900", !showAmounts ? "blur-sm select-none" : "")}>
                          {showAmounts ? fmt(b.grandTotal, b.currency) : "••••"}
                        </p>
                        {due > 0 && showAmounts && <p className="text-[10px] text-orange-500">Due</p>}
                        <span className={cn("mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium inline-block", S.bg, S.text)}>
                          {S.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "New Program", icon: Camera, href: "/programs", color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
          { label: "Add Client",  icon: Users,  href: "/clients",  color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
          { label: "Record Payment", icon: DollarSign, href: "/payments", color: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
        ].map(a => (
          <Link key={a.label} href={a.href}>
            <button className={cn(
              "w-full rounded-xl p-3 flex flex-col items-center gap-2 transition-colors border border-transparent hover:border-slate-200",
              a.color
            )}>
              <a.icon className="w-5 h-5" />
              <span className="text-xs font-medium text-center leading-tight">{a.label}</span>
            </button>
          </Link>
        ))}
      </div>

    </div>
  );
}
