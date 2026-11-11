"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle, ArrowRight, BadgeDollarSign, Camera, CalendarDays, CheckCircle2, Clock, HardDrive, Hourglass,
  LayoutDashboard, MapPin, MessageCircle, Package, Play, TrendingUp, Video, Wallet,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate } from "@/lib/format";
import { DateBox, EmptyState, Group, ListRow, PageHeader, StatCard, type TileColor } from "@/components/ui/apple";
import { Chip, List, Row, Section, card, linkBtn } from "@/components/ui/profile-page";
import { cn } from "@/lib/utils";
import { NextUp, Spinner, StatusBadge, daysUntil } from "../_components/kit";
import { GearRow, RatePrice, rateSub, roleInfo, type MyRates } from "../_components/rates";
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
interface EarningStats { totalEarned: number; pendingAmount: number; thisMonthEarned: number; totalPaid: number; upcomingAmount?: number; }

type Todo = { kind: "changes" | "complete" | "late" | "start" | "soon"; assignmentId: string; program: string; role: string; deadline: string | null; days: number | null };
interface Home {
  todos: Todo[];
  editing: { active: number; notStarted: number; inProgress: number; waiting: number; changes: number; approved: number; nextDeadline: { date: string; assignmentId: string; program: string } | null };
  messages: { unread: number; last: { content: string; createdAt: string; unread: boolean } | null };
}
type RawTodo = { id: string; program: string; date: string };

const ACTIVE = ["confirmed", "advance_received", "in_progress", "editing", "ready_for_delivery"];
const editKind = (role: string) => (role === "photo_editor" ? "Photo editing" : "Video editing");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** What one to-do line says. Each line opens the place where it is done. */
function todoText(t: Todo): { icon: React.ElementType; color: string; title: string; sub: string } {
  const due = t.deadline ? `due ${fmtDate(t.deadline)}` : "";
  switch (t.kind) {
    case "changes": return { icon: AlertTriangle, color: "red", title: `Changes asked — ${t.program}`, sub: `${editKind(t.role)} · fix them and send a new version` };
    case "late": return { icon: Clock, color: "red", title: `Late — ${t.program}`, sub: `${editKind(t.role)} · was ${due}${t.days !== null ? ` (${plural(-t.days, "day")} late)` : ""}` };
    case "complete": return { icon: CheckCircle2, color: "green", title: `Ready to finish — ${t.program}`, sub: "Everything is approved. Open it and press Editing complete." };
    case "soon": return { icon: Hourglass, color: "orchid", title: `${t.days === 0 ? "Due today" : t.days === 1 ? "Due tomorrow" : `Due in ${t.days} days`} — ${t.program}`, sub: `${editKind(t.role)} · ${due}` };
    default: return { icon: Play, color: "violet", title: `Start editing — ${t.program}`, sub: [editKind(t.role), due].filter(Boolean).join(" · ") };
  }
}

export default function MemberDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [earnings, setEarnings] = useState<EarningStats | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [rates, setRates] = useState<MyRates | null>(null);
  const [rawTodos, setRawTodos] = useState<RawTodo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const get = (path: string) => apiFetch(`${API}${path}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("/member/dashboard"), get("/member/earnings"), get("/member/home"), get("/member/rates")])
      .then(([dash, earn, hm, rt]) => {
        if (dash) setData(dash);
        if (earn?.stats) setEarnings(earn.stats);
        if (hm?.editing) setHome(hm);
        if (rt?.rates) setRates(rt);
      }).finally(() => setLoading(false));
    // Asks Google Drive, so it comes on its own and never holds the page back.
    get("/member/home/raw").then(d => { if (Array.isArray(d?.todos)) setRawTodos(d.todos); });
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState icon={LayoutDashboard} title="Couldn't load your dashboard" text="Check your internet and refresh the page." />;

  const activeCount = ACTIVE.reduce((s, k) => s + (data.statusCounts[k] ?? 0), 0);
  const next = data.recentUpcoming[0] ?? null;
  const nextDays = next ? daysUntil(next.eventDate) : null;
  const todos = home?.todos ?? [];
  const todoCount = todos.length + rawTodos.length;
  const ed = home?.editing;
  const msg = home?.messages;
  const prices = rates?.rates ?? [];
  const gear = rates?.setup ?? [];

  return (
    <div>
      <PageHeader icon={LayoutDashboard} color="violet" title="My dashboard" sub="What to do now, your programs and your pay" />

      {next && nextDays !== null && nextDays >= 0 && (
        <NextUp days={nextDays} title={next.eventName || "Program"} href={`/member/programs/${next.id}`}
          sub={`${next.client.firstName} ${next.client.lastName ?? ""} · ${fmtDate(next.eventDate)}${next.eventLocation ? ` · ${next.eventLocation}` : ""}`} />
      )}

      {todoCount > 0 && (
        <Section title={`To do now · ${todoCount}`}>
          <List>
            {todos.map(t => { const x = todoText(t); return <Row key={t.assignmentId} href={`/member/editing/${t.assignmentId}`} icon={x.icon} color={x.color as TileColor} title={x.title} sub={x.sub} />; })}
            {rawTodos.map(t => (
              <Row key={`raw-${t.id}`} href={`/member/programs/${t.id}?tab=raw`} icon={HardDrive} color="blue" title={`Upload your raw files — ${t.program}`} sub={`You worked on ${fmtDate(t.date)} · nothing uploaded yet`} />
            ))}
          </List>
        </Section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <StatCard icon={Camera} color="deep" label="All programs" value={data.total} href="/member/programs" />
        <StatCard icon={CalendarDays} color="red" label="Next 30 days" value={data.upcoming} href="/member/schedule" />
        <div className="col-span-2 lg:col-span-1"><StatCard icon={Clock} color="teal" label="Active" value={activeCount} /></div>
      </div>

      {earnings && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-7">
          <StatCard icon={TrendingUp} color="green" label="Earned this month" value={formatCurrency(earnings.thisMonthEarned)} href="/member/earnings" />
          <StatCard icon={Wallet} color="blue" label="Total earned" value={formatCurrency(earnings.totalEarned)} sub={`Paid ${formatCurrency(earnings.totalPaid)}${earnings.upcomingAmount ? ` · ${formatCurrency(earnings.upcomingAmount)} coming` : ""}`} href="/member/earnings" />
          <div className="col-span-2 lg:col-span-1"><StatCard icon={Hourglass} color="orchid" label="Still to get" value={formatCurrency(earnings.pendingAmount)} href="/member/earnings" /></div>
        </div>
      )}

      {(ed && ed.active > 0 || msg?.last) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 [&>*]:min-w-0">
          {ed && ed.active > 0 && (
            <Section title="My editing work" action={<Link href="/member/editing" className={linkBtn}>Open editing <ArrowRight className="w-3.5 h-3.5" /></Link>}>
              <div className={cn(card, "p-4")}>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([["Not started", ed.notStarted, "text-[#17151F]"], ["In progress", ed.inProgress, "text-[#1F5C99]"], ["In review", ed.waiting + ed.approved, "text-[#823072]"], ["Changes", ed.changes, ed.changes ? "text-[#C2304F]" : "text-[#17151F]"]] as const).map(([label, n, tone]) => (
                    <div key={label} className="rounded-[14px] bg-[#F7F5FB] px-1 py-2.5 min-w-0">
                      <p className={cn("text-[22px] font-extrabold tabular-nums leading-none", tone)}>{n}</p>
                      <p className="text-[11.5px] font-semibold text-[#6B6680] mt-1.5 truncate">{label}</p>
                    </div>
                  ))}
                </div>
                {ed.nextDeadline && (
                  <Link href={`/member/editing/${ed.nextDeadline.assignmentId}`} className="mt-3 flex items-center gap-2 rounded-[14px] bg-[#F7F5FB] hover:bg-[#EEE8FD] px-3.5 py-2.5 text-[13px]">
                    <Video className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[#4A4658]">Next deadline <b className="text-[#17151F]">{fmtDate(ed.nextDeadline.date)}</b> · {ed.nextDeadline.program}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#8A8599] flex-shrink-0" />
                  </Link>
                )}
              </div>
            </Section>
          )}
          {msg?.last && (
            <Section title="Studio messages" action={<Link href="/member/chat" className={linkBtn}>Open chat <ArrowRight className="w-3.5 h-3.5" /></Link>}>
              <List>
                <Row href="/member/chat" icon={MessageCircle} color="teal"
                  title={msg.unread > 0 ? `${plural(msg.unread, "new message")} from the studio` : "Latest from the studio"}
                  sub={msg.last.content} right={msg.unread > 0 ? <Chip tone="violet">New</Chip> : <span className="text-[12px] text-[#8A8599] whitespace-nowrap">{fmtDate(msg.last.createdAt)}</span>} />
              </List>
            </Section>
          )}
        </div>
      )}

      {rates && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 [&>*]:min-w-0">
          <Section title="My rates" action={<Link href="/member/rates" className={linkBtn}>{prices.length > 4 ? `See all ${prices.length}` : "Open"} <ArrowRight className="w-3.5 h-3.5" /></Link>}>
            {!rates.monthly && prices.length === 0 ? (
              <div className={cn(card, "px-4 py-4 text-[13.5px] text-[#6B6680]")}>The studio hasn&apos;t set your prices yet.</div>
            ) : (
              <List>
                {rates.monthly > 0 && <Row icon={Wallet} color="green" title="Monthly salary" sub="Every month" right={<span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(rates.monthly)}</span>} />}
                {prices.slice(0, 4).map((r, i) => { const rc = roleInfo(r.roleId); return <Row key={`${r.roleId}-${r.rateType}-${r.workType ?? ""}-${i}`} icon={rc.icon} color={rc.tile as TileColor} title={rc.label} sub={rateSub(r, rates.workTypes)} right={<RatePrice r={r} />} />; })}
              </List>
            )}
          </Section>
          <Section title={`My gear${gear.length ? ` · ${gear.length}` : ""}`} action={<Link href="/member/rates" className={linkBtn}>{gear.length ? "Edit" : "Add my gear"} <ArrowRight className="w-3.5 h-3.5" /></Link>}>
            {gear.length === 0 ? (
              <Link href="/member/rates" className={cn(card, "flex items-center gap-3 px-4 py-4 text-[13.5px] text-[#6B6680] hover:bg-[#FBFAFE]")}>
                <Package className="w-5 h-5 text-[#8A8599] flex-shrink-0" />Add your own camera, lens or drone, so the studio knows what you can bring.
              </Link>
            ) : (
              <List>
                {gear.slice(0, 4).map(g => <GearRow key={g.id} g={g} />)}
                {gear.length > 4 && <Row href="/member/rates" icon={BadgeDollarSign} color="ink" title={`${gear.length - 4} more`} sub="See all your gear" />}
              </List>
            )}
          </Section>
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
