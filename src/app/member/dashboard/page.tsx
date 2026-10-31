"use client";

import { useState, useEffect } from "react";
import { Camera, CalendarDays, Clock, LayoutDashboard, Wallet, TrendingUp, Hourglass, ArrowRight, MapPin } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate } from "@/lib/format";
import { DateBox, EmptyState, Group, ListRow, PageHeader, StatCard } from "@/components/ui/apple";
import { NextUp, Spinner, StatusBadge, daysUntil } from "../_components/kit";
import Link from "next/link";

interface DashData {
  total: number;
  upcoming: number;
  statusCounts: Record<string, number>;
  recentUpcoming: {
    id: string; bookingNumber: string; eventName?: string;
    eventDate?: string; eventLocation?: string; status: string;
    deliveryLink?: string;
    client: { firstName: string; lastName?: string; phone?: string };
  }[];
}
interface EarningStats { totalEarned: number; pendingAmount: number; thisMonthEarned: number; totalPaid: number; }

const ACTIVE = ["confirmed", "advance_received", "in_progress", "editing", "ready_for_delivery"];

export default function MemberDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [earnings, setEarnings] = useState<EarningStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/member/dashboard`).then(r => r.ok ? r.json() : null),
      apiFetch(`${API}/member/earnings`).then(r => r.ok ? r.json() : null),
    ]).then(([dash, earn]) => {
      if (dash) setData(dash);
      if (earn?.stats) setEarnings(earn.stats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState icon={LayoutDashboard} title="Couldn't load your dashboard" text="Check your internet and refresh the page." />;

  const activeCount = ACTIVE.reduce((s, k) => s + (data.statusCounts[k] ?? 0), 0);
  const next = data.recentUpcoming[0] ?? null;
  const nextDays = next ? daysUntil(next.eventDate) : null;

  return (
    <div>
      <PageHeader icon={LayoutDashboard} color="violet" title="My dashboard" sub="Your programs and pay at a glance" />

      {next && nextDays !== null && nextDays >= 0 && (
        <NextUp days={nextDays} title={next.eventName || "Program"} href={`/member/programs/${next.id}`}
          sub={`${next.client.firstName} ${next.client.lastName ?? ""} · ${fmtDate(next.eventDate)}${next.eventLocation ? ` · ${next.eventLocation}` : ""}`} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <StatCard icon={Camera} color="deep" label="All programs" value={data.total} href="/member/programs" />
        <StatCard icon={CalendarDays} color="red" label="Next 30 days" value={data.upcoming} href="/member/schedule" />
        <div className="col-span-2 lg:col-span-1"><StatCard icon={Clock} color="teal" label="In progress" value={activeCount} /></div>
      </div>

      {earnings && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-7">
          <StatCard icon={TrendingUp} color="green" label="Earned this month" value={formatCurrency(earnings.thisMonthEarned)} href="/member/earnings" />
          <StatCard icon={Wallet} color="blue" label="Total earned" value={formatCurrency(earnings.totalEarned)} sub={`Paid ${formatCurrency(earnings.totalPaid)}`} href="/member/earnings" />
          <div className="col-span-2 lg:col-span-1"><StatCard icon={Hourglass} color="orchid" label="Still to get" value={formatCurrency(earnings.pendingAmount)} href="/member/earnings" /></div>
        </div>
      )}

      <Group title="Coming up" action={<Link href="/member/programs" className="text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1">All programs <ArrowRight className="w-3.5 h-3.5" /></Link>}>
        {data.recentUpcoming.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#A29DB3]">No programs coming up.</p>
        ) : data.recentUpcoming.map(b => (
          <ListRow key={b.id} href={`/member/programs/${b.id}`}
            title={<span className="flex items-center gap-3"><DateBox date={b.eventDate} /><span className="min-w-0"><span className="block truncate">{b.eventName || "Program"}</span>
              <span className="block text-xs font-normal text-[#6B6680] truncate">{b.client.firstName} {b.client.lastName ?? ""}{b.eventLocation ? <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {b.eventLocation}</> : null}</span></span></span>}
            right={<StatusBadge status={b.status} />} />
        ))}
      </Group>
    </div>
  );
}
