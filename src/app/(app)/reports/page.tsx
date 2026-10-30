"use client";

import { BarChart3 as HeaderIcon } from "lucide-react";
import { CARD_SHADOW, PageHeader, StatCard as AStat, Tile } from "@/components/ui/apple";
import { PillSelect } from "@/components/ui/pill-select";

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
  inquiry: "bg-[#C2304F]", quote_sent: "bg-[#9E3A8C]", confirmed: "bg-[#7D5CEF]",
  advance_received: "bg-[#5B3FD0]", in_progress: "bg-[#126B66]", editing: "bg-[#1F5C99]",
  ready_for_delivery: "bg-[#7D5CEF]", delivered: "bg-[#4A4658]", completed: "bg-[#1F8A5B]",
  cancelled: "bg-[#8A2E2E]", refunded: "bg-[#8A2E2E]",
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


export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusItem[]>([]);
  const [teamEarnings, setTeamEarnings] = useState<TeamEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chartMetric, setChartMetric] = useState<"revenue" | "profit" | "programs">("revenue");
  const [costsOpen, setCostsOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
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
    } catch {
      setError(true);
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <p className="text-slate-500">Failed to load reports. Please try again.</p>
      <button onClick={fetchAll} className="text-sm text-indigo-600 underline">Retry</button>
    </div>
  );

  const chartData = monthly.map(m => ({ ...m, value: m[chartMetric] }));
  const chartMax = Math.max(...chartData.map(d => d.value), 1);
  const totalStatusCount = statusBreakdown.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader icon={HeaderIcon} color="blue" title="Reports" sub={<>Money, programs, clients and team for the year</>}>
        <PillSelect label="Year" value={String(year)} onChange={v => setYear(Number(v))}
          options={[currentYear, currentYear - 1, currentYear - 2].map(y => ({ value: String(y), label: String(y) }))} />
      </PageHeader>

      {summary && (
        <>
          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <AStat label="Programs" value={String(summary.totalPrograms)} icon={Camera} color="deep" />
            <AStat label="Total contracts" value={fmt(summary.contractValue)} icon={Layers} color="blue" sub={`${fmtFull(summary.totalDiscount)} discount given`} />
            <AStat label="Received" value={fmt(summary.collected)} icon={CreditCard} color="green" />
            <AStat label="Still due" value={fmt(summary.outstanding)} icon={DollarSign} color="red" sub="From clients" />
          </div>

          {/* Profit & loss */}
          <section>
            <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Profit &amp; loss — {year}</h2>
            <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { label: "Money in", value: fmt(summary.netRevenue), cls: "text-[#17151F]" },
                  { label: "Costs", value: fmt(summary.totalCost), cls: "text-[#C2304F]" },
                  { label: "Profit", value: fmt(summary.netProfit), cls: summary.netProfit >= 0 ? "text-[#1F8A5B]" : "text-[#C2304F]" },
                  { label: "Margin", value: `${summary.margin}%`, cls: summary.margin >= 0 ? "text-[#1F8A5B]" : "text-[#C2304F]" },
                ].map(x => (
                  <div key={x.label}>
                    <p className="text-[13px] font-semibold text-[#4A4658]">{x.label}</p>
                    <p className={cn("text-[22px] font-extrabold tracking-[-0.02em] tabular-nums mt-1", x.cls)}>{x.value}</p>
                  </div>
                ))}
              </div>
              {summary.netRevenue > 0 && (
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-[#EEEBF4] rounded-full overflow-hidden">
                    <div className="h-full bg-[#1F8A5B] rounded-full transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, (summary.netProfit / summary.netRevenue) * 100))}%` }} />
                  </div>
                  <p className="text-xs text-[#6B6680]">You keep {summary.margin}% of the money that comes in</p>
                </div>
              )}
              <button onClick={() => setCostsOpen(o => !o)} aria-expanded={costsOpen}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5B3FD0]">
                {costsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Where the costs went
              </button>
            </div>
            {costsOpen && (
              <div className={cn("mt-3 bg-white rounded-[20px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
                {[
                  { label: "Team", value: summary.teamCost, icon: Users, color: "blue" },
                  { label: "Transport", value: summary.transportCost, icon: Truck, color: "teal" },
                  { label: "Album & print", value: summary.albumCost, icon: Image, color: "orchid" },
                  { label: "Equipment", value: summary.equipCost, icon: Wrench, color: "ink" },
                  { label: "Other", value: summary.otherCost, icon: Package, color: "violet" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                    <Tile icon={icon} color={color} size={32} />
                    <span className="flex-1 text-sm font-semibold text-[#17151F]">{label}</span>
                    <span className="text-xs text-[#6B6680] tabular-nums">{summary.totalCost > 0 ? Math.round((value / summary.totalCost) * 100) : 0}%</span>
                    <span className="text-sm font-bold text-[#17151F] tabular-nums w-28 text-right">{fmtFull(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Monthly chart */}
          <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold text-[#17151F] text-[15px]">Monthly Breakdown — {year}</h2>
              <div className="flex gap-1">
                {(["revenue", "profit", "programs"] as const).map(m => (
                  <button key={m} onClick={() => setChartMetric(m)}
                    className={cn("h-8 px-3.5 rounded-full text-xs font-semibold capitalize transition-all",
                      chartMetric === m ? "bg-[#16141D] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:text-[#17151F]")}>
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
                    <div className={cn("w-full rounded-[6px] transition-colors",
                      isNeg ? "bg-red-300 group-hover:bg-red-400"
                      : isCurrent ? "bg-[#7D5CEF]"
                      : chartMetric === "profit" ? "bg-emerald-300 group-hover:bg-emerald-400"
                      : "bg-[#CFC2F8] group-hover:bg-[#B29DF8]")}
                      style={{ height: `${h}%` }} />
                    <span className="text-xs text-slate-400">{MONTHS_SHORT[i][0]}</span>
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
        <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}>
          <h2 className="font-bold text-[#17151F] text-[15px] mb-4">Programs by Status</h2>
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
        <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}>
          <h2 className="font-bold text-[#17151F] text-[15px] mb-4">Top Clients — {year}</h2>
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
                          <span className="text-xs text-slate-400">{tc.programs}p</span>
                          <span className="text-xs font-bold text-slate-900">{fmtFull(tc.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#7D5CEF] rounded-full" style={{ width: `${pct}%` }} />
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
        <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}>
          <h2 className="font-bold text-[#17151F] text-[15px] mb-4">Team Earnings — {year}</h2>
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
                        <span className="text-xs text-slate-400">{te.programs} program{te.programs > 1 ? "s" : ""}</span>
                        <span className="text-xs font-bold text-slate-900">{fmtFull(te.totalEarned)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1F5C99] rounded-full" style={{ width: `${pct}%` }} />
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
