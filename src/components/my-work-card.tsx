"use client";
/**
 * On the studio dashboard, for a manager: their own work as a team member
 * (next program, editing to do, pay still to get). Opens the "My work" panel.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Film, Wallet } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { API_URL as API, apiFetch } from "@/lib/api";
import { fmtDate, formatCurrency, localDateStr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";
import { rememberPanel } from "@/components/layout/panel-switch";

type Mine = {
  next: { id: string; name: string; date?: string } | null;
  programs: number; todo: number; due: number;
};

export function MyWorkCard({ hideAmounts }: { hideAmounts?: boolean }) {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const [mine, setMine] = useState<Mine | null>(null);

  useEffect(() => {
    if (!isManager) return;
    let live = true;
    const get = (p: string) => apiFetch(`${API}${p}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("/member/dashboard"), get("/member/home"), get("/member/earnings")]).then(([dash, home, earn]) => {
      if (!live) return;
      const today = localDateStr();
      const up = (dash?.recentUpcoming ?? [])
        .filter((b: { status: string; eventDate?: string }) => b.status !== "cancelled" && (b.eventDate ?? "").slice(0, 10) >= today)
        .sort((a: { eventDate?: string }, b: { eventDate?: string }) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))[0];
      setMine({
        next: up ? { id: up.id, name: up.eventName || up.bookingNumber, date: up.eventDate } : null,
        programs: Number(dash?.total ?? 0),
        todo: Array.isArray(home?.todos) ? home.todos.length : 0,
        due: Number(earn?.stats?.pendingAmount ?? 0),
      });
    });
    return () => { live = false; };
  }, [isManager]);

  // Nothing of their own yet → no card.
  if (!isManager || !mine || (!mine.programs && !mine.todo && !mine.due)) return null;

  const cells = [
    { icon: CalendarDays, tone: "bg-[#EEE8FD] text-[#5B3FD0]", label: "My next program", href: mine.next ? `/member/programs/${mine.next.id}` : "/member/programs",
      value: mine.next ? mine.next.name : "Nothing coming up", sub: mine.next?.date ? fmtDate(mine.next.date) : `${mine.programs} in all` },
    { icon: Film, tone: mine.todo ? "bg-[#FDECEF] text-[#C2304F]" : "bg-[#E7F6EE] text-[#1F8A5B]", label: "My editing", href: "/member/editing",
      value: mine.todo ? `${mine.todo} to do` : "Nothing waiting", sub: "Editing work given to you" },
    { icon: Wallet, tone: "bg-[#FFF3E0] text-[#9A5B00]", label: "Still to get", href: "/member/earnings",
      value: hideAmounts ? "••••" : formatCurrency(mine.due), sub: "Your pay from this studio" },
  ];
  return (
    <section aria-label="My own work" className={cn("bg-white rounded-[20px] mb-7 overflow-hidden", CARD_SHADOW)}>
      <div className="px-4 sm:px-5 pt-3.5 pb-1 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold text-[#4A4658]">My own work</h2>
        <Link href="/member/dashboard" onClick={() => rememberPanel("member")} className="text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-0.5 hover:underline">
          Open My work<ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x divide-y sm:divide-y-0 divide-[#F0EDF6]">
        {cells.map(c => (
          <Link key={c.label} href={c.href} onClick={() => rememberPanel("member")} className="px-4 sm:px-5 py-3 flex items-center gap-3 min-w-0 hover:bg-[#FAF9FC]">
            <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", c.tone)}><c.icon className="w-[18px] h-[18px]" /></span>
            <span className="min-w-0">
              <span className="block text-xs text-[#6B6680]">{c.label}</span>
              <span className="block text-[14.5px] font-bold text-[#17151F] truncate">{c.value}</span>
              <span className="block text-xs text-[#8A8599] truncate">{c.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
