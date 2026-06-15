"use client";

import { useState, useEffect } from "react";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` };
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}
function fmtMonth(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`;
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

interface Stats { totalEarned: number; totalPaid: number; pendingAmount: number; thisMonthEarned: number; }
interface SalarySlip { id: string; month: number; year: number; baseSalary: number; deductions: number; netSalary: number; notes?: string; status: string; paidAt?: string; }
interface Program { id: string; bookingNumber: string; eventName?: string; eventDate?: string; status: string; currency?: string; role: string; totalBill: number; clientName: string; }

export default function EarningsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [tab, setTab] = useState<"slips" | "programs">("slips");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/member/earnings`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setStats(d.stats); setSlips(d.salarySlips); setPrograms(d.programs); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;

  if (!stats) return <div className="p-6 text-center text-slate-400">Could not load earnings.</div>;

  const currency = programs[0]?.currency ?? "BDT";

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Earnings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your payment history and program earnings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{stats.totalEarned.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Earned ({currency})</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
            <Wallet className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{stats.thisMonthEarned.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">This Month ({currency})</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <CheckCircle className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{stats.totalPaid.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Paid ({currency})</p>
        </div>
        <div className={cn("rounded-xl border p-4", stats.pendingAmount > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200")}>
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", stats.pendingAmount > 0 ? "bg-amber-100" : "bg-slate-100")}>
            <Clock className={cn("w-4 h-4", stats.pendingAmount > 0 ? "text-amber-600" : "text-slate-400")} />
          </div>
          <p className={cn("text-2xl font-extrabold", stats.pendingAmount > 0 ? "text-amber-700" : "text-slate-900")}>{stats.pendingAmount.toLocaleString()}</p>
          <p className={cn("text-xs mt-0.5", stats.pendingAmount > 0 ? "text-amber-600" : "text-slate-500")}>Pending ({currency})</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(["slips", "programs"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
              tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}>
            {t === "slips" ? `Payment History (${slips.length})` : `Program Earnings (${programs.length})`}
          </button>
        ))}
      </div>

      {/* Salary Slips */}
      {tab === "slips" && (
        <div className="space-y-3">
          {slips.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No payment records yet</p>
            </div>
          ) : slips.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{fmtMonth(s.month, s.year)}</p>
                    <p className="text-xs text-slate-500">{s.status === 'paid' ? `Paid · ${fmtDate(s.paidAt)}` : 'Pending'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-extrabold text-emerald-700">{Number(s.netSalary).toLocaleString()} {currency}</p>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold",
                      s.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                      {s.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  {expanded === s.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {expanded === s.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Base Amount</span>
                    <span className="font-semibold text-slate-900">{Number(s.baseSalary).toLocaleString()} {currency}</span>
                  </div>
                  {Number(s.deductions) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Deductions</span>
                      <span className="font-semibold text-red-600">- {Number(s.deductions).toLocaleString()} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                    <span className="font-bold text-slate-700">Net Payment</span>
                    <span className="font-extrabold text-emerald-700">{Number(s.netSalary).toLocaleString()} {currency}</span>
                  </div>
                  {s.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">{s.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Program Earnings */}
      {tab === "programs" && (
        <div className="space-y-3">
          {programs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <TrendingUp className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No program earnings yet</p>
            </div>
          ) : programs.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{p.eventName || "Event"}</p>
                  <p className="text-xs text-slate-400 font-mono">{p.bookingNumber}</p>
                  <p className="text-xs text-slate-500 mt-1">{p.clientName} · {fmtDate(p.eventDate)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", STATUS_COLOR[p.status] ?? "bg-slate-100 text-slate-600")}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <p className="font-extrabold text-emerald-700 text-sm">{p.totalBill.toLocaleString()} {p.currency ?? currency}</p>
                  {p.role && <p className="text-xs text-slate-400 capitalize">{p.role}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
