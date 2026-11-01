"use client";

import { Banknote as HeaderIcon } from "lucide-react";
import { EmptyState, Group, Initial, MainButton, PageHeader, RowsSkeleton, SearchField, StatCard } from "@/components/ui/apple";
import { PillSelect } from "@/components/ui/pill-select";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Banknote, Plus, Loader2, X, CheckCircle2, AlertCircle,
  Download, Printer, ChevronDown, Trash2, BadgeCheck, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency, localDateStr } from "@/lib/format";
import { askConfirm } from "@/components/feedback";
import { matches } from "@/components/list-ui";
import { AccountPicker } from "@/components/account-picker";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function fmt(n: number, currency = "BDT") { return formatCurrency(Math.round(n), currency); }

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
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ memberId: "", month: now.getMonth() + 1, year: now.getFullYear(), baseSalary: "", programBonus: "", deductions: "0", notes: "" });
  const [calcLoading, setCalcLoading] = useState(false);
  const [bonusBreakdown, setBonusBreakdown] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [paying, setPaying] = useState<SalarySlip | null>(null);
  const [pay, setPay] = useState({ walletId: "", date: localDateStr() });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        apiFetch(`${API}/salary?year=${yearFilter}${monthFilter ? "&month=" + monthFilter : ""}`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/salary/team-members`).then(r => r.ok ? r.json() : []),
      ]);
      setSlips(Array.isArray(s) ? s : []);
      setMembers(Array.isArray(m) ? m : []);
    } catch {
      setToast({ msg: "Failed to load salary data", ok: false });
    } finally {
      setLoading(false);
    }
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

  function markPaid(id: string) {
    const s = slips.find(x => x.id === id);
    if (!s) return;
    setPay({ walletId: "", date: localDateStr() });
    setPaying(s);
  }

  async function confirmPay() {
    if (!paying) return;
    if (!pay.walletId) { setToast({ msg: "Pick the account the salary was paid from.", ok: false }); return; }
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/salary/${paying.id}/pay`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: pay.walletId, date: pay.date }),
      });
      if (r.ok) { setPaying(null); loadAll(); setToast({ msg: "Salary paid.", ok: true }); }
      else {
        const d = await r.json().catch(() => ({}));
        setToast({ msg: (Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save.", ok: false });
      }
    } finally { setSaving(false); }
  }

  async function deleteSlip(id: string) {
    if (!(await askConfirm({ message: "Delete this salary slip?", danger: true }))) return;
    const r = await apiFetch(`${API}/salary/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { loadAll(); setToast({ msg: "Deleted.", ok: true }); }
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const curYear = now.getFullYear();
  const years = [curYear, curYear - 1, curYear - 2];

  const totalPaid = slips.filter(s => s.status === "paid").reduce((s, x) => s + Number(x.netSalary), 0);
  const totalDraft = slips.filter(s => s.status !== "paid").reduce((s, x) => s + Number(x.netSalary), 0);

  return (
    <div>
      {toast && (
        <div className={cn("sp-toast",
          toast.ok ? "" : "sp-toast--err")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <PageHeader icon={HeaderIcon} color="green" title="Salary" sub={<>Salary slips and payments for your team</>}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={q} onChange={setQ} placeholder="Search team member" />
        <MainButton icon={Plus} onClick={() => { setBonusBreakdown([]); setModal(true); }}>New slip</MainButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-7">
        <StatCard icon={BadgeCheck} color="green" label="Paid" value={fmt(totalPaid)} />
        <StatCard icon={Banknote} color="orchid" label="Still to pay" value={fmt(totalDraft)} sub="Slips not paid yet" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <PillSelect label="Year" value={String(yearFilter)} onChange={v => setYearFilter(+v)} options={years.map(y => ({ value: String(y), label: String(y) }))} />
        <PillSelect label="Month" value={String(monthFilter)} onChange={v => setMonthFilter(+v)}
          options={[{ value: "0", label: "All months" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))]} />
      </div>

      {loading ? (
        <RowsSkeleton n={4} />
      ) : slips.length === 0 ? (
        <EmptyState icon={Banknote} title="No salary slips yet" text="Make a slip for a team member — base pay, program bonus and deductions."
          action={<MainButton icon={Plus} onClick={() => { setBonusBreakdown([]); setModal(true); }}>New slip</MainButton>} />
      ) : slips.filter(s => matches(q, `${s.teamMember?.firstName ?? ""} ${s.teamMember?.lastName ?? ""}`, s.notes)).length === 0 ? (
        <EmptyState icon={Banknote} title={`No slips match "${q}"`} text="Try another name." />
      ) : (
        <Group>
          {slips.filter(s => matches(q, `${s.teamMember?.firstName ?? ""} ${s.teamMember?.lastName ?? ""}`, s.notes)).map(slip => {
            const net = Number(slip.netSalary);
            const base = Number(slip.baseSalary);
            const bonus = Number(slip.programBonus);
            const ded = Number(slip.deductions);
            const isPaid = slip.status === "paid";
            return (
              <div key={slip.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[72px]">
                <Initial name={slip.teamMember.firstName} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#17151F] truncate">{slip.teamMember.firstName} {slip.teamMember.lastName}</p>
                  <p className="text-xs text-[#6B6680] truncate mt-0.5">
                    {MONTHS[slip.month - 1]} {slip.year} · Base {fmt(base)}{bonus ? ` + bonus ${fmt(bonus)}` : ""}{ded ? ` − ${fmt(ded)}` : ""}
                  </p>
                  {isPaid && slip.paidAt
                    ? <p className="text-xs font-semibold text-[#1F8A5B] mt-0.5">Paid {fmtDate(slip.paidAt)}</p>
                    : slip.notes ? <p className="text-xs text-[#6B6680] italic truncate mt-0.5">{slip.notes}</p> : null}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#17151F] tabular-nums">{fmt(net)}</p>
                  <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5",
                    isPaid ? "bg-[#E9F5EF] text-[#1F8A5B]" : "bg-[#FBF2FA] text-[#9E3A8C]")}>{isPaid ? "Paid" : "Not paid"}</span>
                </div>
                {!isPaid && (
                  <button onClick={() => markPaid(slip.id)}
                    className="hidden sm:inline-flex h-9 px-3.5 rounded-full bg-[#1F8A5B] hover:opacity-90 text-white text-xs font-semibold items-center gap-1.5 flex-shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" />Mark paid
                  </button>
                )}
                <button onClick={() => window.print()} aria-label="Print"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA] flex-shrink-0"><Printer className="w-4 h-4" /></button>
                <button onClick={() => deleteSlip(slip.id)} aria-label="Delete slip"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                {!isPaid && (
                  <button onClick={() => markPaid(slip.id)} aria-label="Mark paid"
                    className="sm:hidden w-9 h-9 rounded-full flex items-center justify-center text-[#1F8A5B] hover:bg-[#E9F5EF] flex-shrink-0"><BadgeCheck className="w-4 h-4" /></button>
                )}
              </div>
            );
          })}
        </Group>
      )}

      {/* Pay salary */}
      {paying && (
        <div className="sp-backdrop z-50" onClick={e => { if (e.target === e.currentTarget) setPaying(null); }}>
          <div className="sp-drawer pointer-events-auto sm:max-w-md flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">Pay salary</h2>
                <p className="text-xs text-slate-400 mt-0.5">{paying.teamMember.firstName} {paying.teamMember.lastName} · {MONTHS[paying.month - 1]} {paying.year}</p>
              </div>
              <button onClick={() => setPaying(null)} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-xs text-emerald-700">Salary to pay</span>
                <span className="font-bold text-emerald-800">{fmt(Number(paying.netSalary))}</span>
              </div>
              <AccountPicker label="Paid from" value={pay.walletId} method="cash" onChange={w => setPay(p => ({ ...p, walletId: w }))} />
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Date</span>
                <input type="date" value={pay.date} onChange={e => setPay(p => ({ ...p, date: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </label>
            </div>
            <div className="px-6 pb-6 flex gap-3 mt-auto">
              <button onClick={() => setPaying(null)} className="flex-1 h-11 rounded-full bg-[#EEEBF4] text-sm font-semibold text-[#17151F]">Cancel</button>
              <button onClick={confirmPay} disabled={saving}
                className="flex-[1.4] h-11 rounded-full bg-[#1F8A5B] hover:opacity-90 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}Pay salary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {modal && (
        <div className="sp-backdrop z-50" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="sp-drawer pointer-events-auto sm:max-w-md flex flex-col overflow-y-auto">
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
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Base Salary</label>
                <input type="number" value={form.baseSalary} onChange={set("baseSalary")} placeholder="0"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Program Bonus</label>
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
                        <span className="font-bold text-blue-800 ml-2 flex-shrink-0">{formatCurrency(Math.round(b.amount))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Deductions</label>
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
