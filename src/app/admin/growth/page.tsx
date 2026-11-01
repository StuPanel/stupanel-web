"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, Repeat, TrendingUp, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Page, Panel, fmtWhen } from "../_components/staff-kit";

interface Month { month: string; mrr: number; paying: number; newStudios: number; newPaying: number; churned: number; revenue: number }
interface Growth {
  now: { mrr: number; paying: number; mrrChange: number; studios: number; activeLast7: number; conversion: number | null; convertedOf: { converted: number; total: number }; churnedThisMonth: number };
  series: Month[];
  atRisk: { id: string; name: string; access: { state: string; daysLeft: number | null }; lastActiveAt: string | null; programsLast30: number; reasons: string[] }[];
}

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const monthLabel = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
const STATE: Record<string, string> = { paid: "text-emerald-300", trial: "text-amber-300", ending: "text-orange-300", expired: "text-red-300", suspended: "text-slate-400" };

function Card({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: React.ReactNode; tone: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2"><span className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tone)}><Icon className="w-4 h-4" /></span><span className="text-xs text-slate-400">{label}</span></div>
      <p className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

/** Simple bar chart, one bar per month. */
function Bars({ data, pick, fmt = (n: number) => String(n), color }: { data: Month[]; pick: (m: Month) => number; fmt?: (n: number) => string; color: string }) {
  const max = Math.max(1, ...data.map(pick));
  return (
    <div className="flex items-end gap-1.5 h-36">
      {data.map(m => {
        const v = pick(m);
        return (
          <div key={m.month} className="flex-1 h-full flex flex-col items-center gap-1 min-w-0 group">
            <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums whitespace-nowrap">{fmt(v)}</span>
            <div className="w-full flex-1 flex items-end">
              <div className={cn("w-full rounded-t-md transition-all", color, v === 0 && "opacity-20")} style={{ height: `${Math.max(3, (v / max) * 100)}%` }} title={`${m.month}: ${fmt(v)}`} />
            </div>
            <span className="text-[10px] text-slate-500">{monthLabel(m.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function GrowthPage() {
  const [g, setG] = useState<Growth | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`${API}/admin/growth`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setG).catch(() => setErr("Couldn't load the report."));
  }, []);

  if (err) return <Page title="Growth"><p className="text-sm text-red-400">{err}</p></Page>;
  if (!g) return <Page title="Growth"><p className="text-sm text-slate-500">Loading…</p></Page>;
  const n = g.now;

  return (
    <Page title="Growth" sub="How StuPanel is doing — worked out from approved plan payments and app use (Bangladesh time).">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={TrendingUp} tone="bg-emerald-600/20 text-emerald-300" label="Monthly recurring (MRR)" value={taka(n.mrr)}
          sub={<span className={cn("inline-flex items-center gap-0.5", n.mrrChange >= 0 ? "text-emerald-400" : "text-red-400")}>{n.mrrChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{taka(Math.abs(n.mrrChange))} vs last month</span>} />
        <Card icon={Building2} tone="bg-indigo-600/20 text-indigo-300" label="Paying studios" value={n.paying} sub={`${n.studios} studios in total`} />
        <Card icon={Repeat} tone="bg-amber-600/20 text-amber-300" label="Trial → paid" value={n.conversion == null ? "—" : `${n.conversion}%`} sub={`${n.convertedOf.converted} of ${n.convertedOf.total} finished trials paid`} />
        <Card icon={Activity} tone="bg-sky-600/20 text-sky-300" label="Active in last 7 days" value={n.activeLast7} sub={`${n.churnedThisMonth} stopped paying this month`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="MRR by month"><Bars data={g.series} pick={m => m.mrr} fmt={taka} color="bg-emerald-500/70" /></Panel>
        <Panel title="Money received by month"><Bars data={g.series} pick={m => m.revenue} fmt={taka} color="bg-indigo-500/70" /></Panel>
        <Panel title="New studios by month"><Bars data={g.series} pick={m => m.newStudios} color="bg-sky-500/70" /></Panel>
        <Panel title="Started paying vs stopped paying">
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {[...g.series].reverse().map(m => (
              <div key={m.month} className="flex items-center gap-3 text-xs">
                <span className="w-16 text-slate-400">{monthLabel(m.month)} {m.month.slice(0, 4)}</span>
                <span className="text-emerald-300 w-20">+{m.newPaying} started</span>
                <span className={cn("w-20 inline-flex items-center gap-1", m.churned ? "text-red-300" : "text-slate-500")}><UserMinus className="w-3 h-3" />{m.churned} stopped</span>
                <span className="text-slate-500">{m.paying} paying</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Studios that need attention" sub="Trials ending soon, plans that just ended, and paying studios that stopped using the app.">
        {g.atRisk.length === 0 ? <p className="text-sm text-slate-500">All good — nobody needs a nudge right now.</p> : (
          <div className="-m-5 divide-y divide-slate-700/60">
            {g.atRisk.map(s => (
              <Link key={s.id} href={`/admin/studios/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-700/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.name} <span className={cn("text-xs capitalize", STATE[s.access.state])}>· {s.access.state}</span></p>
                  <p className="text-xs text-slate-400 truncate">{s.reasons.join(" · ")}</p>
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:block">last active {fmtWhen(s.lastActiveAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
