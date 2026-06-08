"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, DollarSign, Building2, BarChart3 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { Authorization: `Bearer ${getToken()}` }; }

interface RevenueData {
  monthly: { month: string; total: number }[];
  topStudios: { companyId: string; name: string; total: number; payments: number }[];
  summary: { totalRevenue: number; totalStudios: number; activeStudios: number; mrr: number };
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function MonthLabel(raw: string) {
  const [y, m] = raw.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export default function AdminRevenuePage() {
  const router = useRouter();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/admin/revenue`, { headers: authH() })
      .then(r => { if (r.status === 401 || r.status === 403) { router.replace("/admin/login"); return null; } return r.ok ? r.json() : null; })
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;
  if (!data) return <div className="p-8 text-red-400">Failed to load revenue data</div>;

  const maxMonthly = Math.max(...data.monthly.map(m => m.total), 1);
  const maxStudio = Math.max(...data.topStudios.map(s => s.total), 1);
  const f = (v: number) => `৳${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Revenue Reports</h1>
        <p className="text-sm text-slate-400 mt-0.5">Platform-wide payment analytics</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Revenue" value={f(data.summary.totalRevenue)} color="bg-emerald-600" />
        <StatCard icon={TrendingUp} label="Avg Monthly" value={f(data.summary.mrr)} sub="Last 12 months avg" color="bg-indigo-600" />
        <StatCard icon={Building2} label="Total Studios" value={data.summary.totalStudios} color="bg-purple-600" />
        <StatCard icon={BarChart3} label="Active Studios" value={data.summary.activeStudios} sub="Paid subscriptions" color="bg-teal-600" />
      </div>

      {/* Monthly bar chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-5">Monthly Revenue — Last 12 Months</h2>
        <div className="flex items-end gap-2 h-40">
          {data.monthly.map(m => {
            const pct = maxMonthly > 0 ? (m.total / maxMonthly) * 100 : 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="relative w-full flex items-end justify-center" style={{ height: "112px" }}>
                  <div
                    className="w-full bg-indigo-500 group-hover:bg-indigo-400 rounded-t transition-all duration-200"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {f(m.total)}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">{MonthLabel(m.month)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top studios */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4">Top Studios by Revenue</h2>
        {data.topStudios.length === 0 ? (
          <p className="text-slate-500 text-sm">No payment data yet</p>
        ) : (
          <div className="space-y-3">
            {data.topStudios.map((studio, i) => {
              const pct = maxStudio > 0 ? (studio.total / maxStudio) * 100 : 0;
              return (
                <div key={studio.companyId}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono w-5">#{i + 1}</span>
                      <span className="text-sm text-white font-medium">{studio.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{studio.payments} payments</span>
                      <span className="text-sm font-bold text-emerald-400">{f(studio.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
