"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Camera, Users, BarChart2,
  Loader2, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight,
  Percent, Layers, CreditCard, Package, Truck, Image, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";


const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_LABEL: Record<string, string> = {
  inquiry: "Inquiry", quote_sent: "Quote Sent", confirmed: "Confirmed",
  advance_received: "Advance Rcvd", in_progress: "Shooting", editing: "Editing",
  ready_for_delivery: "Ready", delivered: "Delivered", completed: "Completed",
  cancelled: "Cancelled", refunded: "Refunded",
};
const STATUS_COLOR: Record<string, string> = {
  inquiry: "bg-slate-400", quote_sent: "bg-blue-400", confirmed: "bg-indigo-500",
  advance_received: "bg-violet-500", in_progress: "bg-amber-500", editing: "bg-orange-500",
  ready_for_delivery: "bg-cyan-500", delivered: "bg-teal-500", completed: "bg-emerald-500",
  cancelled: "bg-red-400", refunded: "bg-rose-400",
};

function fmt(n: number, currency = "BDT") { return formatCurrencyCompact(n, currency); }
function fmtFull(n: number, currency = "BDT") { return formatCurrency(Math.round(n), currency); }

interface Summary {
  year: number; totalPrograms: number; contractValue: number; netRevenue: number;
  collected: number; outstanding: number; totalDiscount: number;
  teamCost: number; transportCost: number; albumCost: number; equipCost: number;
  otherCost: number; totalCost: number; netProfit: number; margin: number;
}
interface MonthlyData { month: number; programs: number; revenue: number; costs: number; profit: number; }
interface TopClient { client: { id: string; firstName: string; lastName?: string; phone?: string }; revenue: number; programs: number; }
interface StatusItem { status: string; count: number; revenue: number; }
interface TeamEarning { memberName: string; totalEarned: number; programs: number; }

function StatCard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string; sub?: string; icon: typeof DollarSign;
  accent: string; trend?: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          {trend !== undefined && (
            <div className={cn("flex items-center gap-1 mt-1 text-xs font-semibold", trend >= 0 ? "text-emerald-600" : "text-red-500")}>
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", accent)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusItem[]>([]);
  const [teamEarnings, setTeamEarnings] = useState<TeamEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<"revenue" | "profit" | "programs">("revenue");
  const [costsOpen, setCostsOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, tc, sb, te] = await Promise.all([
        apiFetch(`${API}/dashboard/reports/summary?year=${year}`).then(r => r.json()),
        apiFetch(`${API}/dashboard/reports/monthly?year=${year}`).then(r => r.json()),
        apiFetch(`${API}/dashboard/reports/top-clients?year=${year}`).then(r => r.json()),
        apiFetch(`${API}/dashboard/reports/status-breakdown?year=${year}`).then(r => r.json()),
        apiFetch(`${API}/dashboard/reports/team-earnings?year=${year}`).then(r => r.json()),
      ]);
      setSummary(s?.year ? s : null);
      setMonthly(Array.isArray(m) ? m : []);
      setTopClients(Array.isArray(tc) ? tc : []);
      setStatusBreakdown(Array.isArray(sb) ? sb : []);
      setTeamEarnings(Array.isArray(te) ? te : []);
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    </div>
  );

  const chartData = monthly.map(m => ({ ...m, value: m[chartMetric] }));
  const chartMax = Math.max(...chartData.map(d => d.value), 1);
  const totalStatusCount = statusBreakdown.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-xs text-slate-400 mt-0.5">Financial & business overview</p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer">
          {[currentYear, currentYear - 1, currentYear - 2].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {summary && (
        <>
          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Programs"    value={String(summary.totalPrograms)}      icon={Camera}    accent="bg-indigo-50 text-indigo-600" />
            <StatCard label="Contract Value"    value={fmt(summary.contractValue)}          icon={Layers}    accent="bg-blue-50 text-blue-600"    sub={`${fmtFull(summary.totalDiscount)} discount`} />
            <StatCard label="Collected"         value={fmt(summary.collected)}              icon={CreditCard} accent="bg-emerald-50 text-emerald-600" />
            <StatCard label="Outstanding"       value={fmt(summary.outstanding)}            icon={DollarSign} accent="bg-red-50 text-red-500"    sub="Due payments" />
          </div>

          {/* P&L Summary */}
          <div className="bg-slate-900 text-white rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Profit & Loss — {year}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400">Net Revenue</p>
                <p className="text-xl font-extrabold text-white mt-1">{fmt(summary.netRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Costs</p>
                <p className="text-xl font-extrabold text-red-400 mt-1">{fmt(summary.totalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Net Profit</p>
                <p className={cn("text-xl font-extrabold mt-1", summary.netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>{fmt(summary.netProfit)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Margin</p>
                <p className={cn("text-xl font-extrabold mt-1", summary.margin >= 0 ? "text-emerald-400" : "text-red-400")}>{summary.margin}%</p>
              </div>
            </div>

            {/* Profit bar */}
            {summary.netRevenue > 0 && (
              <div className="space-y-1.5">
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, (summary.netProfit / summary.netRevenue) * 100))}%` }} />
                </div>
                <p className="text-xs text-slate-500">Profit ratio: {summary.margin}% of revenue</p>
              </div>
            )}

            {/* Cost breakdown toggle */}
            <button onClick={() => setCostsOpen(o => !o)}
              className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300">
              {costsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Cost breakdown
            </button>
            {costsOpen && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Team", value: summary.teamCost, icon: Users },
                  { label: "Transport", value: summary.transportCost, icon: Truck },
                  { label: "Album/Print", value: summary.albumCost, icon: Image },
                  { label: "Equipment", value: summary.equipCost, icon: Wrench },
                  { label: "Other", value: summary.otherCost, icon: Package },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-slate-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-400">{label}</span>
                    </div>
                    <p className="font-bold text-white text-sm">{fmtFull(value)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {summary.totalCost > 0 ? Math.round((value / summary.totalCost) * 100) : 0}% of costs
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold text-slate-900 text-sm">Monthly Breakdown — {year}</h2>
              <div className="flex gap-1">
                {(["revenue", "profit", "programs"] as const).map(m => (
                  <button key={m} onClick={() => setChartMetric(m)}
                    className={cn("h-7 px-3 rounded-lg text-xs font-medium capitalize transition-all",
                      chartMetric === m ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-1.5" style={{ height: "9rem" }}>
              {chartData.map((d, i) => {
                const h = Math.max(3, (d.value / chartMax) * 100);
                const isCurrent = i === new Date().getMonth() && year === currentYear;
                const isNeg = d.value < 0;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 h-full group"
                    title={`${MONTHS_SHORT[i]}: ${chartMetric === "programs" ? d.value : fmtFull(d.value)}`}>
                    <div className={cn("w-full rounded-t-lg transition-colors",
                      isNeg ? "bg-red-300 group-hover:bg-red-400"
                      : isCurrent ? "bg-indigo-500"
                      : chartMetric === "profit" ? "bg-emerald-300 group-hover:bg-emerald-400"
                      : "bg-indigo-200 group-hover:bg-indigo-400")}
                      style={{ height: `${h}%` }} />
                    <span className="text-[10px] text-slate-400">{MONTHS_SHORT[i][0]}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400">Total Revenue</p>
                <p className="font-bold text-slate-900">{fmtFull(monthly.reduce((s, m) => s + m.revenue, 0))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Costs</p>
                <p className="font-bold text-slate-900">{fmtFull(monthly.reduce((s, m) => s + m.costs, 0))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Net Profit</p>
                <p className={cn("font-bold", summary.netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmtFull(monthly.reduce((s, m) => s + m.profit, 0))}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-4">Programs by Status</h2>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-2.5">
              {statusBreakdown.sort((a, b) => b.count - a.count).map(item => {
                const pct = totalStatusCount > 0 ? (item.count / totalStatusCount) * 100 : 0;
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", STATUS_COLOR[item.status] ?? "bg-slate-400")} />
                        <span className="text-xs font-medium text-slate-700">{STATUS_LABEL[item.status] ?? item.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{item.count}</span>
                        <span className="text-slate-400">{fmtFull(item.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", STATUS_COLOR[item.status] ?? "bg-slate-400")}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Clients */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-4">Top Clients — {year}</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-2">
              {topClients.map((tc, i) => {
                const maxRev = topClients[0]?.revenue ?? 1;
                const pct = maxRev > 0 ? (tc.revenue / maxRev) * 100 : 0;
                return (
                  <div key={tc.client.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                      {tc.client.firstName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {tc.client.firstName} {tc.client.lastName ?? ""}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-[10px] text-slate-400">{tc.programs}p</span>
                          <span className="text-xs font-bold text-slate-900">{fmtFull(tc.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team Earnings */}
      {teamEarnings.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-4">Team Earnings — {year}</h2>
          <div className="space-y-2.5">
            {teamEarnings.map((te, i) => {
              const maxEarned = teamEarnings[0]?.totalEarned ?? 1;
              const pct = maxEarned > 0 ? (te.totalEarned / maxEarned) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                    {te.memberName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-800">{te.memberName}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{te.programs} program{te.programs > 1 ? "s" : ""}</span>
                        <span className="text-xs font-bold text-slate-900">{fmtFull(te.totalEarned)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-sm">
            <span className="text-slate-500">Total team payout</span>
            <span className="font-bold text-slate-900">{fmtFull(teamEarnings.reduce((s, t) => s + t.totalEarned, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
