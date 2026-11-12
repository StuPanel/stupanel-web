"use client";

/**
 * One program, on a full page — same layout as the client and team profiles.
 * Left: what it is + quick actions, where it stands (status), and the money at a glance.
 * Right: what to do next, then tabs — Overview, Money, Team, Editing, Delivery, Documents.
 */
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, BellRing, CalendarDays, CalendarX, Camera, Check, ChevronRight, Edit3, FileText, HardDrive, Loader2, MapPin,
  MessageCircle, MoreHorizontal, Plus, RotateCcw, Trash2, User, Users, Wallet, XCircle,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency, fmtDate } from "@/lib/format";
import { DateBox, Tile } from "@/components/ui/apple";
import { ProgramTeamCosts } from "@/components/team-costs";
import { Chip, Empty, List, MENU_CLS, MENU_ITEM, ProfileSkeleton, QuickAction, Row, Section, TabBar, card, linkBtn, softBtn, useDismiss, useTab } from "@/components/ui/profile-page";
import { askConfirm, notify } from "@/components/feedback";
import { STATUS_CFG, STATUS_PIPELINE } from "../_components/constants";
import { DeleteDialog } from "../_components/program-card";
import { ProgramDrawer } from "../_components/program-drawer";
import { PaymentModal } from "../_components/payment-modal";
import { WhatsAppModal } from "../_components/whatsapp-modal";
import { TeamPaySection } from "../_components/team-pay-section";
import { InvoiceCard } from "../_components/invoice-card";
import { ContractCard } from "../_components/contract-card";
import { RawDriveSection } from "../_components/raw-drive-section";
import { MusicSection } from "../_components/music-section";
import { CreativeBriefSection, DeliveryOverview, EditorsSection, PrivateNotes, ROLE_LABEL, SETUP_LABEL } from "../_components/sections";
import { DeliveryModal } from "../../delivery/_components/delivery-modal";
import type { Booking, Package, ShiftAssignment, TeamMember } from "../_components/types";

const TABS = ["overview", "money", "team", "raw", "editing", "delivery", "documents"] as const;
type Tab = (typeof TABS)[number];
type Pay = { id: string; amount: number | string; paymentDate?: string; paymentMethod?: string; receiptNumber?: string | null; receiptToken?: string | null; notes?: string | null };
type Todo = { tone: "red" | "amber" | "violet"; icon: React.ElementType; title: string; sub: string; run: () => void };

const METHOD: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", rocket: "Rocket", bank_transfer: "Bank", card: "Card", cheque: "Cheque", online: "Online", mobile_banking: "Mobile wallet" };
const TODO_TONE: Record<Todo["tone"], string> = { red: "bg-[#FDECEF] text-[#C2304F]", violet: "bg-[#EEE8FD] text-[#5B3FD0]", amber: "bg-[#FFF3E0] text-[#9A5B00]" };
const today = () => new Date().toISOString().slice(0, 10);

function MoneyLine({ l, v, strong, tone }: { l: React.ReactNode; v: React.ReactNode; strong?: boolean; tone?: "red" | "green" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <span className={cn("text-[14.5px]", strong ? "font-semibold text-[#17151F]" : "text-[#4A4658]")}>{l}</span>
      <span className={cn("tabular-nums", strong ? "text-[16px] font-extrabold" : "text-[14.5px] font-semibold text-[#17151F]", tone === "red" && "text-[#C2304F]", tone === "green" && "text-[#1F8A5B]")}>{v}</span>
    </div>
  );
}

export default function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useTab<Tab>(`/programs/${id}`, TABS, sp.get("tab"));

  const [b, setB] = useState<Booking | null>(null);
  const [missing, setMissing] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});
  const [musicOn, setMusicOn] = useState(false);
  const [more, setMore] = useState(false);
  const moreRef = useDismiss<HTMLDivElement>(more, () => setMore(false));
  const [statusBusy, setStatusBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [invoicing, setInvoicing] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/bookings/${id}`).catch(() => null);
    if (!r || r.status === 404) { setMissing(true); return; }
    if (r.ok) setB(await r.json());
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    apiFetch(`${API}/team`).then(r => (r.ok ? r.json() : [])).then(d => { if (Array.isArray(d)) setTeam(d); }).catch(() => {});
    apiFetch(`${API}/packages`).then(r => (r.ok ? r.json() : [])).then(d => setPackages(d?.data ?? d ?? [])).catch(() => {});
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      setMusicOn(!!d.features?.musicSelection);
      setTypeNames(Object.fromEntries((d.workTypes ?? []).map((w: { id: string; name: string }) => [w.id, w.name])));
    }).catch(() => {});
  }, [load]);

  const days = useMemo(() => [...(b?.eventDays ?? [])].sort((x, y) => (x.date || "9999").localeCompare(y.date || "9999")), [b]);

  if (missing) return (
    <div className="max-w-md mx-auto pt-16">
      <Empty icon={CalendarX} title="Program not found" text="It may have been deleted."><Link href="/programs" className={softBtn}><ArrowLeft className="w-4 h-4" />All programs</Link></Empty>
    </div>
  );
  if (!b) return <ProfileSkeleton label="Loading program" />;

  // ── Numbers ──
  const net = Number(b.grandTotal);
  const paid = Number(b.paidAmount);
  const due = Math.max(0, net - paid);
  const profit = Number(b.profitAmount);
  const pct = net > 0 ? Math.min(100, Math.round((paid / net) * 100)) : 0;
  const entries = b.costEntries ?? [];
  const teamCost = entries.reduce((s, e) => s + Number(e.totalBill || 0), 0);
  const teamOwed = entries.reduce((s, e) => s + Math.max(0, Number(e.totalBill || 0) - Number(e.paidAmount || 0)), 0);
  const costs = ([["Team pay", teamCost], ["Equipment rent", Number(b.equipCost)], ["Transport", Number(b.transportCost)], ["Album / print", Number(b.albumCost)], ["Other", Number(b.otherCost)]] as [string, number][]).filter(([, v]) => v > 0);
  const pays = ((b.payments ?? []) as Pay[]);

  // ── Who / when ──
  const clientName = `${b.client.firstName} ${b.client.lastName ?? ""}`.trim();
  const typeId = days.find(d => d.programType)?.programType;
  const typeName = typeId ? typeNames[typeId] ?? typeId.replace(/-/g, " ") : "";
  const firstDate = days[0]?.date || b.eventDate?.slice(0, 10) || "";
  const lastDate = [...days].reverse().find(d => d.date)?.date || firstDate;
  const dateText = firstDate ? `${fmtDate(firstDate)}${lastDate && lastDate !== firstDate ? ` – ${fmtDate(lastDate)}` : ""}` : "No date yet";
  const who = (mid: string, fallback?: string) => { const m = team.find(t => t.id === mid); return m ? `${m.firstName} ${m.lastName ?? ""}`.trim() : fallback ?? "Someone"; };
  const peopleOf = (day: Booking["eventDays"][number]) =>
    day.shifts.flatMap(s => (s.assignments ?? (s as unknown as { memberIds?: ShiftAssignment[] }).memberIds ?? []).map(a => ({ a, shift: s.label })));
  const crew = new Set(days.flatMap(d => peopleOf(d).map(p => p.a.id))).size;

  // ── Status ──
  const cancelled = b.status === "cancelled" || b.status === "refunded";
  const sc = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
  const step = STATUS_PIPELINE.indexOf(b.status);
  const next = step >= 0 && step < STATUS_PIPELINE.length - 1 ? STATUS_PIPELINE[step + 1] : null;
  async function setStatus(s: string) {
    if (s === b!.status || statusBusy) return;
    setStatusBusy(true);
    try {
      const r = await apiFetch(`${API}/bookings/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
      if (r.ok) { notify(`Marked ${STATUS_CFG[s]?.label ?? s}`); await load(); } else notify("Couldn't change the status. Please try again.", { error: true });
    } finally { setStatusBusy(false); }
  }
  async function cancelProgram() {
    if (await askConfirm({ title: "Cancel this program?", message: "The program will be marked as cancelled. You can reopen it later.", confirmLabel: "Mark cancelled", danger: true })) setStatus("cancelled");
  }
  async function makeInvoice() {
    setInvoicing(true);
    try {
      const r = await apiFetch(`${API}/studio-invoices/generate/${id}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.publicToken) window.open(`/inv/${d.publicToken}`, "_blank", "noopener");
      else if (!r.ok) router.push("/invoices");
    } catch { /* silent */ } finally { setInvoicing(false); }
  }

  // ── What to do next ──
  const todos: Todo[] = [];
  if (!cancelled) {
    const early = ["inquiry", "quote_sent", "confirmed", "advance_received"].includes(b.status);
    const done = ["delivered", "completed"].includes(b.status);
    const undated = days.filter(d => !d.date).length;
    const empty = days.filter(d => peopleOf(d).length === 0);
    if (days.length === 0 && !done) todos.push({ tone: "amber", icon: CalendarDays, title: "No days added yet", sub: "Add the date and place of the shoot", run: () => setEditing(true) });
    else if (undated > 0 && !done) todos.push({ tone: "amber", icon: CalendarDays, title: undated === 1 ? "One day has no date" : `${undated} days have no date`, sub: "Set the date so it shows on the calendar", run: () => setEditing(true) });
    if (empty.length > 0 && !done && b.status !== "editing" && b.status !== "ready_for_delivery")
      todos.push({ tone: "amber", icon: Users, title: empty.length === 1 ? `Nobody on ${empty[0].eventType || "one day"} yet` : `${empty.length} days have no team`, sub: "Put photographers and cinematographers on the shift", run: () => setEditing(true) });
    if (early && Number(b.advanceAmount) > 0 && paid + 0.009 < Number(b.advanceAmount))
      todos.push({ tone: "violet", icon: Wallet, title: "Advance not received yet", sub: `${formatCurrency(Number(b.advanceAmount) - paid, b.currency)} of ${formatCurrency(Number(b.advanceAmount), b.currency)} to collect`, run: () => setPaymentOpen(true) });
    if (early && lastDate && lastDate < today())
      todos.push({ tone: "violet", icon: ArrowRight, title: "The program date has passed", sub: "Move it to Shooting or Editing", run: () => setStatus("editing") });
    if (done && due > 0.009)
      todos.push({ tone: "red", icon: Wallet, title: `Balance due: ${formatCurrency(due, b.currency)}`, sub: "Delivered, but not fully paid", run: () => setPaymentOpen(true) });
    if ((done || b.status === "ready_for_delivery") && teamOwed > 0.009)
      todos.push({ tone: "amber", icon: Users, title: `Team is owed ${formatCurrency(teamOwed, b.currency)}`, sub: "Pay the people who worked on this program", run: () => setTab("team") });
  }
  const order = { red: 0, violet: 1, amber: 2 } as const;
  todos.sort((x, y) => order[x.tone] - order[y.tone]);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "money", label: "Money", count: pays.length },
    { id: "team", label: "Team", count: crew },
    { id: "raw", label: "Raw files" },
    { id: "editing", label: "Editing" },
    { id: "delivery", label: "Delivery" },
    { id: "documents", label: "Documents" },
  ];

  const dayRow = (day: Booking["eventDays"][number], i: number, full: boolean) => {
    const people = peopleOf(day);
    return (
      <div key={day.id} className="px-4 py-3.5 flex items-start gap-3">
        <DateBox date={day.date || undefined} />
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-semibold text-[#17151F] truncate">{day.eventType || `Day ${i + 1}`}</p>
          <p className="text-[12.5px] text-[#6B6680] flex flex-wrap items-center gap-x-2 mt-0.5">
            <span>{day.date ? fmtDate(day.date) : "No date yet"}</span>
            {day.location && <span className="inline-flex items-center gap-0.5 min-w-0"><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{day.location}</span></span>}
            {!full && <span>· {people.length ? `${people.length} on the team` : "nobody yet"}</span>}
          </p>
          {full && (people.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {people.map(({ a, shift }, k) => (
                <span key={`${a.id}-${a.role}-${k}`} className="inline-flex items-center gap-1.5 min-h-7 px-2.5 py-1 rounded-full bg-[#F5F3FA] text-[12px] text-[#17151F]">
                  <User className="w-3 h-3 text-[#6B6680] flex-shrink-0" />
                  <span className="font-semibold">{who(a.id, a.name)}</span>
                  <span className="text-[#6B6680]">· {ROLE_LABEL[a.role] ?? a.role.replace(/_/g, " ")}{day.shifts.length > 1 ? ` · ${shift}` : ""}{a.setup ? ` · ${SETUP_LABEL[a.setup] ?? a.setup}` : ""}</span>
                </span>
              ))}
            </div>
          ) : <p className="mt-1.5 text-[12.5px] text-[#A29DB3]">Nobody on this day yet.</p>)}
        </div>
      </div>
    );
  };
  const payRow = (p: Pay) => (
    <Row key={p.id} href={p.receiptToken ? `/r/${p.receiptToken}` : undefined} external
      lead={<span className="w-[38px] h-[38px] rounded-full bg-[#E7F5EE] text-[#1F8A5B] flex items-center justify-center flex-shrink-0"><ArrowDownLeft className="w-[18px] h-[18px]" /></span>}
      title={p.paymentDate ? fmtDate(p.paymentDate) : "Payment"}
      sub={[METHOD[p.paymentMethod ?? ""] ?? p.paymentMethod?.replace(/_/g, " "), p.receiptNumber ? `Receipt ${p.receiptNumber}` : null, p.notes].filter(Boolean).join(" · ") || "Payment"}
      right={<span className="text-[14.5px] font-bold text-[#1F8A5B] tabular-nums">+{formatCurrency(Number(p.amount), b.currency)}</span>} />
  );
  const changeBtn = <button type="button" onClick={() => setEditing(true)} className={linkBtn}><Edit3 className="w-3.5 h-3.5" />Change</button>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/programs" className="h-9 pl-2.5 pr-3.5 rounded-full bg-white hover:bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <ArrowLeft className="w-4 h-4" />Programs
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        {/* ── Left: what + where it stands + money ──────────────────────── */}
        <aside className="lg:sticky lg:top-20 space-y-4 mb-4 lg:mb-0">
          <div className={cn(card, "p-5", more && "relative z-30")}>
            <div className="flex items-center gap-4 lg:flex-col lg:text-center lg:gap-3">
              <Tile icon={Camera} color="deep" size={64} className="rounded-[20px]" />
              <div className="flex-1 min-w-0 lg:flex-none lg:w-full">
                <h1 className="text-[21px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight break-words">{b.eventName || b.bookingNumber}</h1>
                <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">
                  <Link href={`/clients/${b.client.id}`} className="font-semibold text-[#5B3FD0] hover:underline">{clientName}</Link> · {dateText}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2 lg:justify-center">
                  {typeName && <Chip tone="grey">{typeName}</Chip>}
                  <span className="h-6 px-2 rounded-full text-[12px] font-mono text-[#6B6680] inline-flex items-center">{b.bookingNumber}</span>
                </div>
              </div>
            </div>
            <div ref={moreRef} className="grid grid-cols-4 gap-1 mt-5 relative">
              <QuickAction icon={Wallet} label="Payment" tone="bg-[#E7F5EE] text-[#1F8A5B]" onClick={() => setPaymentOpen(true)} disabled={due <= 0} />
              <QuickAction icon={MessageCircle} label="WhatsApp" tone="bg-[#E7F5EE] text-[#1F8A5B]" onClick={() => setWaOpen(true)} disabled={!b.client.phone} />
              <QuickAction icon={Edit3} label="Edit" tone="bg-[#EEE8FD] text-[#5B3FD0]" onClick={() => setEditing(true)} />
              <QuickAction icon={MoreHorizontal} label="Options" tone="bg-[#F1EFF6] text-[#17151F]" onClick={() => setMore(v => !v)} />
              {more && (
                <>
                  <div role="menu" className={cn("absolute right-0 top-[76px] w-56", MENU_CLS)}>
                    <button role="menuitem" type="button" disabled={invoicing} onClick={() => { setMore(false); makeInvoice(); }} className={MENU_ITEM}><FileText className="w-4 h-4 text-[#6B6680]" />Open invoice</button>
                    <button role="menuitem" type="button" onClick={() => { setMore(false); router.push(`/clients/${b.client.id}`); }} className={MENU_ITEM}><User className="w-4 h-4 text-[#6B6680]" />Client profile</button>
                    <div className="my-1 border-t border-[#EEEBF4]" />
                    {cancelled
                      ? <button role="menuitem" type="button" onClick={() => { setMore(false); setStatus("confirmed"); }} className={MENU_ITEM}><RotateCcw className="w-4 h-4 text-[#6B6680]" />Reopen program</button>
                      : <button role="menuitem" type="button" onClick={() => { setMore(false); cancelProgram(); }} className={cn(MENU_ITEM, "!text-[#823072]")}><XCircle className="w-4 h-4" />Mark cancelled</button>}
                    <button role="menuitem" type="button" onClick={() => { setMore(false); setDeleting(true); }} className={cn(MENU_ITEM, "!text-[#C2304F] hover:!bg-[#FDECEF]")}><Trash2 className="w-4 h-4" />Delete program</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status */}
          <div className={cn(card, "p-5")}>
            {cancelled ? (
              <>
                <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">Status</p>
                <p className="text-[22px] font-extrabold tracking-[-0.02em] text-[#8A2E2E] leading-tight mt-0.5">{sc.label}</p>
                <button type="button" disabled={statusBusy} onClick={() => setStatus("confirmed")} className="mt-3 w-full h-11 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-sm font-semibold inline-flex items-center justify-center gap-2">
                  {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}Reopen program
                </button>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">Status</p>
                  <p className="text-[12.5px] text-[#6B6680]">Step {Math.max(1, step + 1)} of {STATUS_PIPELINE.length}</p>
                </div>
                <p className="text-[22px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight mt-0.5">{sc.label}</p>
                <div className="mt-3 flex gap-1" role="group" aria-label="Program steps">
                  {STATUS_PIPELINE.map((s, i) => (
                    <button key={s} type="button" disabled={statusBusy} onClick={() => setStatus(s)} title={STATUS_CFG[s]?.label} aria-label={`${STATUS_CFG[s]?.label}${i === step ? " (now)" : ""}`} aria-current={i === step ? "step" : undefined}
                      className="group flex-1 py-2 -my-2">
                      <span className={cn("block h-2 rounded-full transition-colors", i < step ? "bg-[#7D5CEF]" : i === step ? "bg-[#17151F]" : "bg-[#E9E6F0] group-hover:bg-[#D4CEE4]")} />
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[11.5px] text-[#8A8599]"><span>{STATUS_CFG[STATUS_PIPELINE[0]].label}</span><span>{STATUS_CFG[STATUS_PIPELINE[STATUS_PIPELINE.length - 1]].label}</span></div>
                <div className="mt-3 flex gap-2">
                  {next && (
                    <button type="button" disabled={statusBusy} onClick={() => setStatus(next)} className="flex-1 min-w-0 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 px-3">
                      {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 flex-shrink-0" />}<span className="truncate">Move to {STATUS_CFG[next].label}</span>
                    </button>
                  )}
                  <select aria-label="Change status" value="" disabled={statusBusy} onChange={e => { if (e.target.value) setStatus(e.target.value); }}
                    className={cn("h-11 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-sm font-semibold pl-4 pr-2 cursor-pointer", next ? "w-[108px] flex-shrink-0" : "flex-1")}>
                    <option value="" disabled hidden>Change</option>
                    {STATUS_PIPELINE.map(s => <option key={s} value={s} disabled={s === b.status}>{STATUS_CFG[s].label}{s === b.status ? " (now)" : ""}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Money at a glance */}
          {(net > 0 || paid > 0) && <div className={cn(card, "p-5")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">{due > 0 ? "Client owes" : "Money"}</p>
              <p className="text-[12.5px] text-[#6B6680]">Profit <span className={cn("font-bold tabular-nums", profit >= 0 ? "text-[#1F8A5B]" : "text-[#C2304F]")}>{formatCurrency(profit, b.currency)}</span></p>
            </div>
            <p className={cn("text-[30px] font-extrabold tracking-[-0.02em] tabular-nums leading-tight mt-0.5", due > 0 ? "text-[#C2304F]" : "text-[#17151F]")}>
              {due > 0 ? formatCurrency(due, b.currency) : net > 0 ? "All paid" : formatCurrency(0, b.currency)}
            </p>
            <div className="mt-3 h-2 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-label="Paid so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[#1F8A5B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2.5 flex justify-between text-[13px]">
              <span className="text-[#6B6680]">Paid <span className="font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(paid, b.currency)}</span></span>
              <span className="text-[#6B6680]">of <span className="font-bold text-[#17151F] tabular-nums">{formatCurrency(net, b.currency)}</span></span>
            </div>
            {due > 0 && (
              <button type="button" onClick={() => setPaymentOpen(true)} className="mt-4 w-full h-11 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Wallet className="w-4 h-4" />Record payment
              </button>
            )}
          </div>}
        </aside>

        {/* ── Right: next step + tabs ───────────────────────────────────── */}
        <div className="min-w-0">
          {todos.length > 0 && (
            <Section title={<span className="inline-flex items-center gap-1.5"><BellRing className="w-3.5 h-3.5" />Next step</span>}>
              <List>
                {todos.map((t, i) => (
                  <Row key={i} onClick={t.run} title={t.title} sub={t.sub}
                    lead={<span className={cn("w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0", TODO_TONE[t.tone])}><t.icon className="w-[18px] h-[18px]" /></span>} />
                ))}
              </List>
            </Section>
          )}

          <TabBar tabs={tabs} value={tab} onChange={setTab} label="Program sections" />

          {tab === "overview" && (
            <>
              <Section title="Days" action={days.length ? <button type="button" onClick={() => setTab("team")} className={linkBtn}>Team<ChevronRight className="w-3.5 h-3.5" /></button> : undefined}>
                {days.length ? <div className={cn(card, "divide-y divide-[#EEEBF4]")}>{days.map((d, i) => dayRow(d, i, false))}</div> : (
                  <Empty icon={CalendarDays} title="No days added yet" text="Add the date and place of the shoot.">
                    <button type="button" onClick={() => setEditing(true)} className={softBtn}><Plus className="w-4 h-4" />Add days</button>
                  </Empty>
                )}
              </Section>
              {pays.length > 0 && (
                <Section title="Latest payments" action={<button type="button" onClick={() => setTab("money")} className={linkBtn}>See all<ChevronRight className="w-3.5 h-3.5" /></button>}>
                  <List>{pays.slice(0, 3).map(payRow)}</List>
                </Section>
              )}
              <PrivateNotes key={b.id} booking={b} onSaved={notes => setB(cur => (cur ? { ...cur, internalNotes: notes } : cur))} />
            </>
          )}

          {tab === "money" && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                {[
                  { label: "Contract", value: net, cls: "text-[#17151F]" },
                  { label: "Paid", value: paid, cls: "text-[#1F8A5B]" },
                  { label: "Owes", value: due, cls: due > 0 ? "text-[#C2304F]" : "text-[#17151F]" },
                ].map(x => (
                  <div key={x.label} className={cn(card, "!rounded-[18px] px-3 sm:px-4 py-3 min-w-0")}>
                    <p className="text-[12px] font-semibold text-[#6B6680]">{x.label}</p>
                    <p className={cn("text-[15px] sm:text-[18px] font-extrabold tabular-nums truncate", x.cls)}>{formatCurrency(x.value, b.currency)}</p>
                  </div>
                ))}
              </div>
              <Section title="Payments from the client" action={due > 0 ? <button type="button" onClick={() => setPaymentOpen(true)} className={linkBtn}><Plus className="w-3.5 h-3.5" />Record payment</button> : undefined}>
                {pays.length ? <List>{pays.map(payRow)}</List> : <Empty icon={Wallet} title="No payments yet" text="Money the client pays shows here, newest first." />}
              </Section>
              <Section title="Costs and profit" action={changeBtn}>
                <div className={cn(card, "divide-y divide-[#EEEBF4]")}>
                  <MoneyLine l="Price" v={formatCurrency(Number(b.totalAmount), b.currency)} />
                  {Number(b.discountAmount) > 0 && <MoneyLine l="Discount" v={`− ${formatCurrency(Number(b.discountAmount), b.currency)}`} />}
                  <MoneyLine l="Contract" v={formatCurrency(net, b.currency)} strong />
                  {costs.map(([l, v]) => <MoneyLine key={l} l={l} v={`− ${formatCurrency(v, b.currency)}`} />)}
                  {costs.length === 0 && <MoneyLine l="Costs" v={<span className="text-[#8A8599] font-medium">None yet</span>} />}
                  <MoneyLine l={net > 0 ? `Profit · ${Math.round((profit / net) * 100)}%` : "Profit"} v={formatCurrency(profit, b.currency)} strong tone={profit >= 0 ? "green" : "red"} />
                </div>
              </Section>
              <ProgramTeamCosts bookingId={b.id} onChanged={load} />
            </>
          )}

          {tab === "team" && (
            <>
              <Section title="Days and team" action={changeBtn}>
                {days.length ? <div className={cn(card, "divide-y divide-[#EEEBF4]")}>{days.map((d, i) => dayRow(d, i, true))}</div> : (
                  <Empty icon={Users} title="No days added yet" text="Add a day, then put your team on it.">
                    <button type="button" onClick={() => setEditing(true)} className={softBtn}><Plus className="w-4 h-4" />Add days</button>
                  </Empty>
                )}
              </Section>
              <div className="mb-6"><TeamPaySection booking={b} onSaved={load} /></div>
            </>
          )}

          {tab === "raw" && <RawDriveSection booking={b} teamMembers={team} />}

          {tab === "editing" && (
            <Section>
              <div className={cn(card, "p-3 space-y-3")}>
                <EditorsSection booking={b} teamMembers={team} onSaved={load} />
                <button type="button" onClick={() => setTab("raw")} className="w-full rounded-2xl border border-[#E6E2EE] p-3 flex items-center gap-3 text-left hover:border-[#CFC8DD] transition-colors">
                  <Tile icon={HardDrive} color="green" size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-[#17151F]">Raw files</span>
                    <span className="block text-[12px] text-[#6B6680] truncate">Upload cards and manage copies in the Raw files tab</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#A29DB3] flex-shrink-0" />
                </button>
                {musicOn && <MusicSection booking={b} />}
                <CreativeBriefSection booking={b} onSaved={load} />
              </div>
            </Section>
          )}

          {tab === "delivery" && (
            <Section>
              <div className={cn(card, "p-3 space-y-3")}>
                <DeliveryOverview booking={b} />
                <button type="button" onClick={() => setDeliveryOpen(true)} className="w-full h-11 rounded-full bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0] text-sm font-semibold">Manage delivery</button>
              </div>
            </Section>
          )}

          {tab === "documents" && (
            <>
              <InvoiceCard bookingId={b.id} version={`${b.status}|${b.paidAmount}|${b.grandTotal}|${days.map(d => d.date).join(",")}`} />
              <ContractCard key={b.id} bookingId={b.id} />
            </>
          )}
        </div>
      </div>

      {/* Drawers */}
      <PaymentModal booking={paymentOpen ? b : null} onClose={() => setPaymentOpen(false)} onSaved={load} />
      <WhatsAppModal booking={waOpen ? b : null} onClose={() => setWaOpen(false)} />
      <DeliveryModal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        booking={deliveryOpen ? (b as any) : null}
        onClose={() => setDeliveryOpen(false)} onSaved={() => { load(); setDeliveryOpen(false); }} />
      <ProgramDrawer open={editing} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} packages={packages} teamMembers={team} initialBooking={editing ? b : null} />
      <DeleteDialog booking={deleting ? b : null} onClose={() => setDeleting(false)} onDeleted={() => router.replace("/programs")} />
    </div>
  );
}
