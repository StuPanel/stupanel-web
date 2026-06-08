"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Banknote, Plus, Loader2, X, CheckCircle2, AlertCircle,
  Download, Printer, ChevronDown, Trash2, BadgeCheck, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function fmt(n: number) { return "৳" + Math.round(n).toLocaleString(); }
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}-${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()]}-${d.getFullYear()}`;
}

interface SalarySlip {
  id: string; month: number; year: number;
  baseSalary: number; programBonus: number; deductions: number; netSalary: number;
  status: string; notes?: string; paidAt?: string;
  teamMember: { id: string; firstName: string; lastName: string; memberRoles: string[] };
}
interface Member { id: string; firstName: string; lastName: string; memberRoles: string[]; payRate?: number; payRateType?: string; }

export default function SalaryPage() {
  const now = new Date();
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState(0);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ memberId: "", month: now.getMonth() + 1, year: now.getFullYear(), baseSalary: "", programBonus: "", deductions: "0", notes: "" });
  const [calcLoading, setCalcLoading] = useState(false);
  const [bonusBreakdown, setBonusBreakdown] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, m] = await Promise.all([
      fetch(`${API}/salary?year=${yearFilter}${monthFilter ? "&month=" + monthFilter : ""}`, { headers: { "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/salary/team-members`, { headers: { "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : []),
    ]);
    setSlips(Array.isArray(s) ? s : []);
    setMembers(Array.isArray(m) ? m : []);
    setLoading(false);
  }, [yearFilter, monthFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  async function calcBonus() {
    if (!form.memberId) return;
    setCalcLoading(true);
    const r = await apiFetch(`${API}/salary/calc-bonus?memberId=${form.memberId}&month=${form.month}&year=${form.year}`, { headers: { "Content-Type": "application/json" } });
    if (r.ok) {
      const d = await r.json();
      setForm(p => ({ ...p, programBonus: String(d.bonus) }));
      setBonusBreakdown(d.breakdown ?? []);
    }
    setCalcLoading(false);
  }

  async function save() {
    if (!form.memberId) return;
    setSaving(true);
    const r = await apiFetch(`${API}/salary`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamMemberId: form.memberId, month: form.month, year: form.year,
        baseSalary: Number(form.baseSalary) || 0,
        programBonus: Number(form.programBonus) || 0,
        deductions: Number(form.deductions) || 0,
        notes: form.notes,
      }),
    });
    if (r.ok) { setToast({ msg: "Salary slip generated!", ok: true }); setModal(false); loadAll(); }
    else setToast({ msg: "Failed to generate.", ok: false });
    setSaving(false);
  }

  async function markPaid(id: string) {
    const r = await apiFetch(`${API}/salary/${id}/pay`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
    if (r.ok) { loadAll(); setToast({ msg: "Marked as paid!", ok: true }); }
  }

  async function deleteSlip(id: string) {
    if (!confirm("Delete this salary slip?")) return;
    const r = await apiFetch(`${API}/salary/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { loadAll(); setToast({ msg: "Deleted.", ok: true }); }
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const curYear = now.getFullYear();
  const years = [curYear, curYear - 1, curYear - 2];

  const totalPaid = slips.filter(s => s.status === "paid").reduce((s, x) => s + Number(x.netSalary), 0);
  const totalDraft = slips.filter(s => s.status !== "paid").reduce((s, x) => s + Number(x.netSalary), 0);

  return (
    <div className="space-y-5">
      {toast && (
        <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2",
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-indigo-600" />
            Salary Slips
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Generate and track team member salary payments</p>
        </div>
        <button onClick={() => { setBonusBreakdown([]); setModal(true); }}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />Generate Slip
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-xs text-emerald-600 font-medium">Total Paid</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs text-amber-600 font-medium">Pending Payment</p>
          <p className="text-xl font-extrabold text-amber-700 mt-1">{fmt(totalDraft)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select value={yearFilter} onChange={e => setYearFilter(+e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={monthFilter} onChange={e => setMonthFilter(+e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none">
          <option value={0}>All Months</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Slips */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : slips.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Banknote className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No salary slips yet</p>
          <p className="text-sm text-slate-400 mt-1">Generate slips for your team members</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slips.map(slip => {
            const net = Number(slip.netSalary);
            const base = Number(slip.baseSalary);
            const bonus = Number(slip.programBonus);
            const ded = Number(slip.deductions);
            const isPaid = slip.status === "paid";
            return (
              <div key={slip.id} className={cn("bg-white border rounded-2xl overflow-hidden", isPaid ? "border-emerald-200" : "border-slate-200")}>
                <div className="flex items-start gap-4 p-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0",
                    isPaid ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700")}>
                    {slip.teamMember.firstName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-slate-900">{slip.teamMember.firstName} {slip.teamMember.lastName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{MONTHS[slip.month - 1]} {slip.year}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-extrabold text-slate-900">{fmt(net)}</p>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5",
                          isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                          {isPaid ? "PAID" : "DRAFT"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-400">Base Salary</p>
                        <p className="font-bold text-slate-700 mt-0.5">{fmt(base)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-blue-400">Program Bonus</p>
                        <p className="font-bold text-blue-700 mt-0.5">+ {fmt(bonus)}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2">
                        <p className="text-red-400">Deductions</p>
                        <p className="font-bold text-red-700 mt-0.5">- {fmt(ded)}</p>
                      </div>
                    </div>

                    {slip.notes && <p className="text-xs text-slate-400 mt-2 italic">Note: {slip.notes}</p>}
                    {isPaid && slip.paidAt && <p className="text-xs text-emerald-500 mt-1">Paid on {fmtDate(slip.paidAt)}</p>}

                    <div className="flex items-center gap-2 mt-3">
                      {!isPaid && (
                        <button onClick={() => markPaid(slip.id)}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors">
                          <BadgeCheck className="w-3.5 h-3.5" />Mark Paid
                        </button>
                      )}
                      <button onClick={() => window.print()}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors">
                        <Printer className="w-3.5 h-3.5" />Print
                      </button>
                      <button onClick={() => deleteSlip(slip.id)}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center ml-auto">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Generate Salary Slip</h2>
              <button onClick={() => setModal(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Team Member *</label>
                <select value={form.memberId} onChange={set("memberId")}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
                  <option value="">Select member…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Month</label>
                  <select value={form.month} onChange={set("month")}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none">
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Year</label>
                  <select value={form.year} onChange={set("year")}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Base Salary (৳)</label>
                <input type="number" value={form.baseSalary} onChange={set("baseSalary")} placeholder="0"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Program Bonus (৳)</label>
                  <button onClick={calcBonus} disabled={!form.memberId || calcLoading}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50">
                    {calcLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Auto-calculate
                  </button>
                </div>
                <input type="number" value={form.programBonus} onChange={set("programBonus")} placeholder="0"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                {bonusBreakdown.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {bonusBreakdown.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-blue-50 px-3 py-1.5 rounded-lg">
                        <span className="text-blue-700 truncate">{b.eventName}</span>
                        <span className="font-bold text-blue-800 ml-2 flex-shrink-0">৳{Math.round(b.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Deductions (৳)</label>
                <input type="number" value={form.deductions} onChange={set("deductions")} placeholder="0"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>

              {/* Net total */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between">
                <span className="text-sm text-slate-300">Net Salary</span>
                <span className="text-xl font-extrabold text-white">
                  {fmt(Math.max(0, (Number(form.baseSalary) || 0) + (Number(form.programBonus) || 0) - (Number(form.deductions) || 0)))}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Notes (optional)</label>
                <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Any notes…"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving || !form.memberId}
                className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : "Generate Slip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
