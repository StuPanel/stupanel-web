"use client";

import { useState, useEffect } from "react";
import { Wallet, TrendingUp, CheckCircle2, Hourglass, Camera, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency } from "@/lib/format";
import { Chips, EmptyState, Group, PageHeader, StatCard } from "@/components/ui/apple";
import { Spinner, StatusBadge } from "../_components/kit";
import Link from "next/link";

const METHOD: Record<string, string> = { cash: "Cash", mobile_banking: "bKash / Nagad", bank_transfer: "Bank", other: "Other" };
const fmtMonth = (m: number, y: number) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));

interface Stats { totalEarned: number; totalPaid: number; pendingAmount: number; thisMonthEarned: number; slipsPaid?: number; paidOnPrograms?: number; }
interface SalarySlip { id: string; month: number; year: number; baseSalary: number; deductions: number; netSalary: number; notes?: string; status: string; paidAt?: string; }
interface Program {
  id: string; bookingNumber: string; eventName?: string; eventDate?: string; status: string; currency?: string;
  role: string; totalBill: number; clientName: string; paid?: number; due?: number;
  payments?: { id: string; amount: number; method: string; date: string }[];
}

export default function EarningsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [tab, setTab] = useState<"programs" | "payments">("programs");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API}/member/earnings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setStats(d.stats); setSlips(d.salarySlips ?? []); setPrograms(d.programs ?? []); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!stats) return <EmptyState icon={Wallet} title="Couldn't load your earnings" text="Check your internet and refresh the page." />;

  // Every payment you got: monthly slips + money paid on programs, newest first
  const payments = [
    ...slips.filter(s => s.status === "paid").map(s => ({ key: `s-${s.id}`, date: s.paidAt ?? `${s.year}-${String(s.month).padStart(2, "0")}-01`, amount: Number(s.netSalary), what: `Salary · ${fmtMonth(s.month, s.year)}`, how: s.notes ?? "" })),
    ...programs.flatMap(p => (p.payments ?? []).map(x => ({ key: `p-${x.id}`, date: x.date, amount: x.amount, what: p.eventName || p.bookingNumber, how: METHOD[x.method] ?? x.method }))),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const pendingSlips = slips.filter(s => s.status !== "paid");

  return (
    <div>
      <PageHeader icon={Wallet} color="green" title="My earnings" sub="What you earned, got paid and still have to get" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard icon={TrendingUp} color="green" label="This month" value={formatCurrency(stats.thisMonthEarned)} />
        <StatCard icon={Wallet} color="blue" label="Total earned" value={formatCurrency(stats.totalEarned)} />
        <StatCard icon={CheckCircle2} color="teal" label="Got paid" value={formatCurrency(stats.totalPaid)}
          sub={(stats.paidOnPrograms ?? 0) > 0 ? `${formatCurrency(stats.paidOnPrograms ?? 0)} on programs` : undefined} />
        <StatCard icon={Hourglass} color="orchid" label="Still to get" value={formatCurrency(stats.pendingAmount)} />
      </div>

      <Chips label="Show" value={tab} onChange={setTab}
        options={[{ value: "programs", label: "By program", count: programs.length }, { value: "payments", label: "Payments", count: payments.length }]} />

      {tab === "programs" && (programs.length === 0 ? (
        <EmptyState icon={Camera} title="No program pay yet" text="Your bill for each program shows up here." />
      ) : (
        <Group>
          {programs.map(p => {
            const isOpen = open === p.id;
            return (
              <div key={p.id}>
                <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-[#F7F5FB] transition-colors">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-[#17151F] truncate">{p.eventName || "Program"}</span>
                    <span className="block text-xs text-[#6B6680] truncate">{p.clientName} · {fmtDate(p.eventDate)}{p.role ? ` · ${p.role.replace(/_/g, " ")}` : ""}</span>
                  </span>
                  <span className="text-right flex-shrink-0">
                    <span className="block text-[15px] font-bold text-[#17151F] tabular-nums">{formatCurrency(p.totalBill)}</span>
                    {(p.due ?? 0) > 0
                      ? <span className="block text-xs font-semibold text-[#B45309]">{formatCurrency(p.due ?? 0)} to get</span>
                      : p.totalBill > 0 && <span className="block text-xs font-semibold text-[#1F8A5B]">Paid</span>}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-[#B5B0C4] transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 -mt-1 space-y-1.5">
                    <div className="flex items-center gap-2"><StatusBadge status={p.status} /><span className="text-xs text-[#6B6680]">{p.bookingNumber}</span>
                      <Link href={`/member/programs/${p.id}`} className="ml-auto text-xs font-semibold text-[#5B3FD0]">Open program</Link></div>
                    {(p.payments ?? []).length === 0
                      ? <p className="text-xs text-[#A29DB3]">Nothing paid on this program yet.</p>
                      : p.payments!.map(x => (
                        <div key={x.id} className="flex justify-between text-sm rounded-[12px] bg-[#FAF9FC] px-3 py-2">
                          <span className="text-[#4A4658]">{fmtDate(x.date)} · {METHOD[x.method] ?? x.method}</span>
                          <span className="font-semibold text-[#1F8A5B] tabular-nums">{formatCurrency(x.amount)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </Group>
      ))}

      {tab === "payments" && (
        <>
          {payments.length === 0 ? (
            <EmptyState icon={Wallet} title="No payments yet" text="Every taka the studio pays you shows up here." />
          ) : (
            <Group>
              {payments.map(x => (
                <div key={x.key} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                  <span className="w-9 h-9 rounded-full bg-[#E9F5EF] text-[#1F8A5B] flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-4 h-4" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-[#17151F] truncate">{x.what}</span>
                    <span className="block text-xs text-[#6B6680] truncate">{fmtDate(x.date)}{x.how ? ` · ${x.how}` : ""}</span>
                  </span>
                  <span className="text-[15px] font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(x.amount)}</span>
                </div>
              ))}
            </Group>
          )}
          {pendingSlips.length > 0 && (
            <Group title="Salary not paid yet">
              {pendingSlips.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 sm:px-5 py-3.5">
                  <span className="text-[15px] font-semibold text-[#17151F]">{fmtMonth(s.month, s.year)}</span>
                  <span className="text-[15px] font-bold text-[#B45309] tabular-nums">{formatCurrency(Number(s.netSalary))}</span>
                </div>
              ))}
            </Group>
          )}
        </>
      )}
    </div>
  );
}
