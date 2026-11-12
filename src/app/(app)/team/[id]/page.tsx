"use client";

/**
 * One team member (or freelancer), on a full page — same layout as the client profile.
 * Left: who they are + quick actions, and what the studio owes them.
 * Right: tabs — Overview, Programs, Payments, Prices & gear, About.
 */
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft, ArrowLeft, CalendarDays, Camera, ChevronRight, Edit3, HandCoins, KeyRound, Loader2, Mail, MapPin, MessageCircle,
  MoreHorizontal, Phone, Send, Trash2, UserCheck, UserX, Wallet, AtSign,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency, fmtDate } from "@/lib/format";
import { DateBox, TILE } from "@/components/ui/apple";
import { Avatar, waLink } from "@/components/ui/profile-kit";
import { Chip, Empty, List, MENU_CLS, MENU_ITEM, ProfileSkeleton, QuickAction, Row, Section, TabBar, card, linkBtn, softBtn, useDismiss, useTab } from "@/components/ui/profile-page";
import { inputCls } from "@/components/ui/form-kit";
import { askConfirm, notify } from "@/components/feedback";
import { useAuth } from "@/context/auth-context";
import { STATUS_CFG } from "../../programs/_components/constants";
import { MONTHS, PayDrawer, role, type MemberPayment, type ProfileData } from "../_components/pay-drawer";
import { DeleteDialog, MemberDrawer, ResetPassDialog, resendInvite } from "../_components/member-drawer";
import { SETUP_CATS, gearRents, unitLabel } from "../_components/rate-card";
import { DaysOffList, PastRateRequests, PayoutView, RateRequestCard, waitingRequest } from "../_components/member-prefs-view";
import { dayRange, todayStr, type MemberPrefs } from "@/lib/member-prefs";

const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const TABS = ["overview", "programs", "payments", "prices", "about"] as const;
type Tab = (typeof TABS)[number];

export default function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sp = useSearchParams();
  const isOwner = useAuth().user?.role === "owner";
  const [tab, setTab] = useTab<Tab>(`/team/${id}`, TABS, sp.get("tab"));

  const [data, setData] = useState<ProfileData | null>(null);
  const [prefsOverride, setPrefs] = useState<MemberPrefs | null>(null);
  const [pays, setPays] = useState<MemberPayment[]>([]);
  const [missing, setMissing] = useState(false);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});
  const [more, setMore] = useState(false);
  const moreRef = useDismiss<HTMLDivElement>(more, () => setMore(false));
  const [payOpen, setPayOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesState, setNotesState] = useState<"" | "saving" | "saved">("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notesLoaded = useRef(false);

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/team/${id}/profile`).catch(() => null);
    if (!r || r.status === 404) { setMissing(true); return; }
    if (r.ok) {
      const d: ProfileData = await r.json();
      setData(d);
      if (!notesLoaded.current) { setNotes(d.member.adminNotes ?? ""); notesLoaded.current = true; }
    }
    const p = await apiFetch(`${API}/team/${id}/payments`).catch(() => null);
    if (p?.ok) setPays(await p.json());
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    apiFetch(`${API}/team/custom-roles`).then(r => (r.ok ? r.json() : [])).then(d => { if (Array.isArray(d)) setCustomRoles(d); }).catch(() => {});
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (Array.isArray(d?.workTypes)) setTypeNames(Object.fromEntries(d.workTypes.map((w: { id: string; name: string }) => [w.id, w.name])));
    }).catch(() => {});
    return () => clearTimeout(notesTimer.current);
  }, [load]);

  function onNotes(v: string) {
    setNotes(v); setNotesState("");
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      setNotesState("saving");
      try {
        const r = await apiFetch(`${API}/team/${id}/admin-notes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: v }) });
        setNotesState(r.ok ? "saved" : "");
      } catch { setNotesState(""); }
    }, 1000);
  }

  if (missing) return (
    <div className="max-w-md mx-auto pt-16">
      <Empty icon={UserX} title="Team member not found" text="They may have been removed."><Link href="/team" className={softBtn}><ArrowLeft className="w-4 h-4" />All team</Link></Empty>
    </div>
  );
  if (!data) return <ProfileSkeleton label="Loading team member" />;

  const m = data.member;
  const st = data.stats;
  const name = `${m.firstName} ${m.lastName ?? ""}`.trim();
  const freelancer = m.memberType === "freelancer";
  const main = role(m.memberRoles[0] ?? "");
  const owed = Math.max(0, st.pendingAmount ?? 0);
  const earned = st.lifetimeEarned ?? 0;
  const paid = st.totalPaid ?? 0;
  const pct = earned > 0 ? Math.min(100, Math.round((paid / earned) * 100)) : 0;
  const upcoming = data.upcoming ?? [];
  const programs = data.programs ?? [];
  const slips = data.salarySlips ?? [];
  const realEmail = m.email && !m.email.includes(".internal") ? m.email : "";
  const rates = (m.roleRates ?? []).filter(r => r.rate || r.withSetup);
  const monthly = m.payRateType === "monthly" && m.payRate ? Number(m.payRate) : 0;
  const gear = m.setup ?? [];
  const prefs = prefsOverride ?? data.prefs ?? null;
  const waiting = waitingRequest(prefs);
  const today = todayStr();
  const soon = new Date(); soon.setDate(soon.getDate() + 60);
  const soonStr = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
  const offSoon = (prefs?.daysOff ?? []).filter(d => d.to >= today && d.from <= soonStr);
  const roleNames = (s: string) => s.split(", ").filter(Boolean).map(r => role(r).label).join(", ");

  async function toggleActive() {
    const r = await apiFetch(`${API}/team/${id}/toggle-status`, { method: "PATCH", headers: { "Content-Type": "application/json" } }).catch(() => null);
    if (r?.ok) { notify(m.isActive ? `${m.firstName} is now inactive` : `${m.firstName} is active again`); load(); } else notify("Couldn't change it. Please try again.", { error: true });
  }
  async function removePayment(p: MemberPayment) {
    if (!(await askConfirm({ title: "Remove this payment?", message: `${formatCurrency(p.amount)} will be taken off ${p.parts.length === 1 ? "the program" : `${p.parts.length} programs`} and put back in ${p.account ?? "the account"}.`, confirmLabel: "Remove", danger: true }))) return;
    setRemoving(p.id);
    try {
      const r = await apiFetch(`${API}/team/${id}/payments/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      if (r.ok) { notify("Payment removed"); load(); } else notify("Couldn't remove it", { error: true });
    } finally { setRemoving(null); }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "programs", label: "Programs", count: programs.length },
    { id: "payments", label: "Payments", count: pays.length },
    { id: "prices", label: "Prices & gear" },
    { id: "about", label: "About" },
  ];

  const upcomingRow = (u: NonNullable<ProfileData["upcoming"]>[number], i: number) => (
    <Row key={`${u.bookingId}-${u.date}-${i}`} href={`/programs?view=${u.bookingId}`} lead={<DateBox date={u.date} />}
      title={u.eventName || u.bookingNumber}
      sub={<>{cap(u.work.join(", ")) || "Work"}{u.location ? <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {u.location}</> : null}</>}
      right={<span className="hidden sm:block text-[12.5px] text-[#6B6680] max-w-[160px] truncate">{u.clientName}</span>} />
  );
  const programRow = (p: ProfileData["programs"][number]) => {
    const due = p.due ?? 0;
    const cfg = STATUS_CFG[p.status];
    return (
      <Row key={p.id} href={`/programs?view=${p.id}`} lead={<DateBox date={p.eventDate} />}
        title={p.eventName || p.bookingNumber}
        sub={<span className="inline-flex items-center gap-1.5"><span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg?.dot ?? "bg-[#B5B0C4]")} />{[p.role ? roleNames(p.role) : null, p.clientName].filter(Boolean).join(" · ") || p.bookingNumber}</span>}
        right={<>
          <span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(p.totalBill, p.currency)}</span>
          {p.totalBill > 0 && (due > 0
            ? <span className="text-[12px] font-semibold text-[#C2304F] tabular-nums">{formatCurrency(due, p.currency)} owed</span>
            : <span className="text-[12px] font-semibold text-[#1F8A5B]">Paid</span>)}
        </>} />
    );
  };
  const payLead = <span className="w-[38px] h-[38px] rounded-full bg-[#E7F5EE] text-[#1F8A5B] flex items-center justify-center flex-shrink-0"><ArrowDownLeft className="w-[18px] h-[18px] rotate-180" /></span>;
  const payText = (p: MemberPayment) => ({
    title: p.parts.length === 1 ? (p.parts[0].eventName || p.parts[0].bookingNumber) : `${p.parts.length} programs`,
    sub: [fmtDate(p.date), p.account, p.note].filter(Boolean).join(" · "),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/team" className="h-9 pl-2.5 pr-3.5 rounded-full bg-white hover:bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <ArrowLeft className="w-4 h-4" />Team
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        {/* ── Left: who + money ─────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 space-y-4 mb-4 lg:mb-0">
          <div className={cn(card, "p-5", !m.isActive && "opacity-90", more && "relative z-30")}>
            <div className="flex items-center gap-4 lg:flex-col lg:text-center lg:gap-3">
              <Avatar name={name} color={TILE[main.tile]} size={68} src={m.avatarUrl} />
              <div className="flex-1 min-w-0 lg:flex-none lg:w-full">
                <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight break-words">{name}</h1>
                <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">{[m.memberRoles.map(r => role(r).label).join(", ") || "No role yet", m.memberId].join(" · ")}</p>
                <div className="flex flex-wrap gap-1.5 mt-2 lg:justify-center">
                  {freelancer && <Chip tone="orchid">Freelancer</Chip>}
                  {!freelancer && (m as { role?: string }).role === "manager" && <Chip tone="violet">Manager</Chip>}
                  {m.isActive ? <Chip tone="green">Active</Chip> : <Chip tone="grey">Inactive</Chip>}
                  {m.login?.invitePending && <Chip tone="amber">{m.login.inviteExpired ? "Invite expired" : "Invite sent"}</Chip>}
                </div>
              </div>
            </div>
            <div ref={moreRef} className="grid grid-cols-4 gap-1 mt-5 relative">
              <QuickAction icon={MessageCircle} label="WhatsApp" tone="bg-[#E7F5EE] text-[#1F8A5B]" href={waLink(m.phone)} disabled={!m.phone} />
              <QuickAction icon={Phone} label="Call" tone="bg-[#E8F0FA] text-[#1F5C99]" href={m.phone ? `tel:${m.phone}` : undefined} disabled={!m.phone} />
              <QuickAction icon={HandCoins} label="Pay" tone="bg-[#EEE8FD] text-[#5B3FD0]" onClick={() => setPayOpen(true)} />
              <QuickAction icon={MoreHorizontal} label="Options" tone="bg-[#F1EFF6] text-[#17151F]" onClick={() => setMore(v => !v)} />
              {more && (
                <>
                  <div role="menu" className={cn("absolute right-0 top-[76px] w-56", MENU_CLS)}>
                    <button role="menuitem" type="button" onClick={() => { setMore(false); setEditing(true); }} className={MENU_ITEM}><Edit3 className="w-4 h-4 text-[#6B6680]" />Edit details</button>
                    {isOwner && !freelancer && (m.login?.invitePending
                      ? <button role="menuitem" type="button" onClick={() => { setMore(false); resendInvite(m).then(ok => { if (ok) load(); }); }} className={MENU_ITEM}><Send className="w-4 h-4 text-[#6B6680]" />Send invite again</button>
                      : <button role="menuitem" type="button" onClick={() => { setMore(false); setResetting(true); }} className={MENU_ITEM}><KeyRound className="w-4 h-4 text-[#6B6680]" />{m.login?.shared ? "Send reset link" : "Reset password"}</button>)}
                    <button role="menuitem" type="button" onClick={() => { setMore(false); toggleActive(); }} className={cn(MENU_ITEM, m.isActive ? "!text-[#823072]" : "!text-[#1F8A5B]")}>
                      {m.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}{m.isActive ? "Make inactive" : "Make active"}
                    </button>
                    {isOwner && <>
                      <div className="my-1 border-t border-[#EEEBF4]" />
                      <button role="menuitem" type="button" onClick={() => { setMore(false); setDeleting(true); }} className={cn(MENU_ITEM, "!text-[#C2304F] hover:!bg-[#FDECEF]")}><Trash2 className="w-4 h-4" />Remove from team</button>
                    </>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* What the studio owes them */}
          {(st.totalPrograms > 0 || earned > 0) && <div className={cn(card, "p-5")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">{owed > 0 ? `Due to ${m.firstName}` : "Pay"}</p>
              <p className="shrink-0 text-[12.5px] text-[#6B6680]">{st.totalPrograms} program{st.totalPrograms === 1 ? "" : "s"}{st.thisMonthPrograms ? ` · ${st.thisMonthPrograms} this month` : ""}</p>
            </div>
            <p className={cn("text-[30px] font-extrabold tracking-[-0.02em] tabular-nums leading-tight mt-0.5", owed > 0 ? "text-[#C2304F]" : "text-[#17151F]")}>
              {owed > 0 ? formatCurrency(owed) : earned > 0 ? "All settled" : formatCurrency(0)}
            </p>
            <div className="mt-3 h-2 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-label="Paid so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[#1F8A5B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2.5 flex justify-between text-[13px]">
              <span className="text-[#6B6680]">Paid <span className="font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(paid)}</span></span>
              <span className="text-[#6B6680]">of <span className="font-bold text-[#17151F] tabular-nums">{formatCurrency(earned)}</span> earned</span>
            </div>
            {owed > 0 && (
              <button type="button" onClick={() => setPayOpen(true)} className="mt-4 w-full h-11 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                <HandCoins className="w-4 h-4" />Pay {m.firstName}
              </button>
            )}
          </div>}
        </aside>

        {/* ── Right: tabs ───────────────────────────────────────────────── */}
        <div className="min-w-0">
          <TabBar tabs={tabs} value={tab} onChange={setTab} label="Team member sections" />

          {waiting && (tab === "overview" || tab === "prices") && (
            <div className="mb-6">
              <RateRequestCard memberId={m.id} name={m.firstName} req={waiting} onAnswered={setPrefs} onPrices={() => setEditing(true)} />
            </div>
          )}

          {tab === "overview" && (
            <>
              {offSoon.length > 0 && (
                <p role="status" className="mb-6 rounded-[14px] bg-[#FFF3E0] text-[#7A4800] text-[13.5px] px-4 py-3">
                  <b>{m.firstName} can&apos;t work</b> {offSoon.map(d => `${dayRange(d)}${d.note ? ` (${d.note})` : ""}`).join(", ")}.
                </p>
              )}
              <Section title="Coming up" action={upcoming.length > 3 ? <button type="button" onClick={() => setTab("programs")} className={linkBtn}>All {upcoming.length}<ChevronRight className="w-3.5 h-3.5" /></button> : undefined}>
                {upcoming.length ? <List>{upcoming.slice(0, 3).map(upcomingRow)}</List> : (
                  <Empty icon={CalendarDays} title="Nothing booked yet" text="Add them to a program's shift and it shows here." />
                )}
              </Section>

              {pays.length > 0 && (
                <Section title="Latest payments" action={<button type="button" onClick={() => setTab("payments")} className={linkBtn}>See all<ChevronRight className="w-3.5 h-3.5" /></button>}>
                  <List>{pays.slice(0, 3).map(p => { const t = payText(p); return (
                    <Row key={p.id} lead={payLead} title={t.title} sub={t.sub} right={<span className="text-[14.5px] font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(p.amount)}</span>} />
                  ); })}</List>
                </Section>
              )}

              <Section title="Private notes"
                action={notesState === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B6680]" /> : notesState === "saved" ? <span className="text-[12.5px] font-semibold text-[#1F8A5B]">Saved</span> : <span className="text-[12.5px] text-[#8A8599]">Only you and managers see this</span>}>
                <div className={cn(card, "p-3")}>
                  <textarea value={notes} onChange={e => onNotes(e.target.value)} rows={3} aria-label="Private notes"
                    placeholder="Attendance, behaviour, special arrangements…" className={inputCls + " h-auto py-2.5 resize-none"} />
                </div>
              </Section>
            </>
          )}

          {tab === "programs" && (
            <>
              {upcoming.length > 0 && (
                <Section title={`Coming up · ${upcoming.length}`}><List>{upcoming.map(upcomingRow)}</List></Section>
              )}
              <Section title={programs.length ? `All programs · ${programs.length}` : undefined}>
                {programs.length ? <List>{programs.map(programRow)}</List> : (
                  <Empty icon={Camera} title="No programs yet" text="Programs they work on show here with their bill." />
                )}
              </Section>
            </>
          )}

          {tab === "payments" && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                {[
                  { label: "Earned", value: earned, cls: "text-[#17151F]" },
                  { label: "Paid", value: paid, cls: "text-[#1F8A5B]" },
                  { label: "Owed", value: owed, cls: owed > 0 ? "text-[#C2304F]" : "text-[#17151F]" },
                ].map(x => (
                  <div key={x.label} className={cn(card, "!rounded-[18px] px-3 sm:px-4 py-3 min-w-0")}>
                    <p className="text-[12px] font-semibold text-[#6B6680]">{x.label}</p>
                    <p className={cn("text-[15px] sm:text-[18px] font-extrabold tabular-nums truncate", x.cls)}>{formatCurrency(x.value)}</p>
                  </div>
                ))}
              </div>
              <Section title="Payments" action={<button type="button" onClick={() => setPayOpen(true)} className={linkBtn}><HandCoins className="w-3.5 h-3.5" />Pay</button>}>
                {pays.length ? (
                  <List>{pays.map(p => { const t = payText(p); return (
                    <div key={p.id} className="flex items-center gap-3 pl-4 pr-2 py-3">
                      {payLead}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{t.title}</span>
                        <span className="block text-[12.5px] text-[#6B6680] truncate mt-0.5">{t.sub}{p.parts.length > 1 ? ` · ${p.parts.map(x => x.bookingNumber).join(", ")}` : ""}</span>
                      </span>
                      <span className="text-[14.5px] font-bold text-[#1F8A5B] tabular-nums flex-shrink-0">{formatCurrency(p.amount)}</span>
                      <button type="button" aria-label="Remove this payment" disabled={removing === p.id} onClick={() => removePayment(p)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[#A29DB3] hover:text-[#C2304F] hover:bg-[#FDECEF] flex-shrink-0">
                        {removing === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ); })}</List>
                ) : (
                  <Empty icon={Wallet} title="No payments yet" text="Money you pay them shows here, newest first.">
                    {owed > 0 && <button type="button" onClick={() => setPayOpen(true)} className={softBtn}><HandCoins className="w-4 h-4" />Pay {m.firstName}</button>}
                  </Empty>
                )}
              </Section>
              {slips.length > 0 && (
                <Section title="Monthly salary" action={<Link href="/salary" className={linkBtn}>Salary page<ChevronRight className="w-3.5 h-3.5" /></Link>}>
                  <List>{slips.map(s => (
                    <Row key={s.id} icon={Wallet} color="green" title={`${MONTHS[s.month - 1]} ${s.year}`}
                      sub={[s.paidAt ? `Paid ${fmtDate(s.paidAt)}` : s.status, s.notes, Number(s.deductions) > 0 ? `−${formatCurrency(Number(s.deductions))} cut` : null].filter(Boolean).join(" · ")}
                      right={<span className="text-[14.5px] font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(Number(s.netSalary))}</span>} />
                  ))}</List>
                </Section>
              )}
            </>
          )}

          {tab === "prices" && (
            <>
              <Section title="Prices" action={<button type="button" onClick={() => setEditing(true)} className={linkBtn}><Edit3 className="w-3.5 h-3.5" />Edit</button>}>
                {!monthly && rates.length === 0 ? (
                  <Empty icon={Wallet} title="No prices set" text="Set what they get per program, day or shift."><button type="button" onClick={() => setEditing(true)} className={softBtn}>Set prices</button></Empty>
                ) : (
                  <List>
                    {monthly > 0 && <Row icon={Wallet} color="green" title="Monthly salary" sub="Every month" right={<span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(monthly)}</span>} />}
                    {rates.map((r, i) => { const rc = role(r.roleId); return (
                      <Row key={`${r.roleId}-${r.rateType}-${r.workType ?? ""}-${i}`} icon={rc.icon} color={rc.tile} title={rc.label}
                        sub={`${unitLabel(r.roleId, r.rateType, r.label)} · ${r.workType ? (typeNames[r.workType] ?? r.workType) : "All programs"}`}
                        right={<>
                          {r.withSetup != null ? (<>
                            <span className="text-[14.5px] font-bold text-[#17151F] tabular-nums whitespace-nowrap">{formatCurrency(Number(r.withSetup))}<span className="text-[12px] font-medium text-[#6B6680]"> with setup</span></span>
                            {r.rate ? <span className="text-[12px] font-semibold text-[#6B6680] tabular-nums whitespace-nowrap">{formatCurrency(Number(r.rate))} work only</span> : null}
                          </>) : r.rate ? <span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(r.rate))}</span> : null}
                        </>} />
                    ); })}
                  </List>
                )}
              </Section>
              <Section title="Own gear" action={<button type="button" onClick={() => setEditing(true)} className={linkBtn}><Edit3 className="w-3.5 h-3.5" />Edit</button>}>
                {gear.length === 0 ? (
                  <div className={cn(card, "px-4 py-4 text-[13.5px] text-[#8A8599]")}>No gear added. Add their own camera, lens or drone to count rent.</div>
                ) : (
                  <List>{gear.map(g => { const cat = SETUP_CATS.find(c => c.v === g.category) ?? SETUP_CATS[SETUP_CATS.length - 1]; return (
                    <Row key={g.id} icon={cat.icon} color={cat.tile} title={g.name} sub={cat.l}
                      right={gearRents(g).length ? gearRents(g).map(x => (
                        <span key={x.unit} className="text-[13.5px] font-bold text-[#17151F] tabular-nums whitespace-nowrap">{formatCurrency(x.amount)}<span className="text-[12px] font-medium text-[#6B6680]"> / {x.short}</span></span>
                      )) : <span className="text-[12.5px] text-[#8A8599]">No rent</span>} />
                  ); })}</List>
                )}
              </Section>
              {prefs && <PastRateRequests list={prefs.rateRequests} />}
            </>
          )}

          {tab === "about" && (
            <>
              {prefs && <PayoutView prefs={prefs} />}
              {prefs && <DaysOffList prefs={prefs} />}
              <Section title="Contact" action={<button type="button" onClick={() => setEditing(true)} className={linkBtn}><Edit3 className="w-3.5 h-3.5" />Edit</button>}>
                <List>
                  {m.phone && <Row href={`tel:${m.phone}`} external icon={Phone} color="blue" title={m.phone} sub="Phone / WhatsApp" />}
                  {realEmail && <Row href={`mailto:${realEmail}`} external icon={Mail} color="violet" title={realEmail} sub="Gets program reminder emails" />}
                  {!freelancer && m.username && <Row icon={AtSign} color="deep" title={m.username} sub="Username for signing in" />}
                  {!m.phone && !realEmail && (freelancer || !m.username) && <Row icon={Phone} color="ink" title="No contact details yet" sub="Tap Edit to add a phone" />}
                </List>
              </Section>
              <Section title="Work">
                <div className={cn(card, "divide-y divide-[#EEEBF4]")}>
                  {[
                    { k: "Type", v: freelancer ? "Freelancer (no login)" : "Team member" },
                    { k: "Roles", v: m.memberRoles.map(r => role(r).label).join(", ") || "—" },
                    { k: "Member ID", v: m.memberId },
                    { k: "Joined", v: fmtDate(m.createdAt) },
                  ].map(r => (
                    <div key={r.k} className="px-4 py-3 flex items-baseline justify-between gap-4 text-[14px]">
                      <span className="text-[#6B6680] flex-shrink-0">{r.k}</span><span className="font-semibold text-[#17151F] text-right min-w-0 break-words">{r.v}</span>
                    </div>
                  ))}
                </div>
              </Section>
              {m.bio && (
                <Section title="Note"><div className={cn(card, "p-4 text-[14px] text-[#33303F] leading-relaxed whitespace-pre-line")}>{m.bio}</div></Section>
              )}
            </>
          )}
        </div>
      </div>

      {/* Drawers */}
      {payOpen && <PayDrawer member={m} payout={prefs?.payout} onClose={() => setPayOpen(false)} onSaved={load} />}
      <MemberDrawer open={editing} editing={editing ? m : null} onClose={() => setEditing(false)} onSaved={load} customRoles={customRoles} onCustomRolesChange={setCustomRoles} />
      <ResetPassDialog member={resetting ? m : null} onClose={() => setResetting(false)} onDone={load} />
      <DeleteDialog member={deleting ? m : null} onClose={() => setDeleting(false)} onDeleted={() => router.replace("/team")} />
    </div>
  );
}
