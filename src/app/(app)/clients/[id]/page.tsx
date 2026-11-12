"use client";

/**
 * One client, on a full page.
 * Top: who they are + quick actions, money at a glance, and what needs doing.
 * Below: tabs — Overview, Programs, Money (invoices and payments in one list), Documents, About.
 * Desktop: identity and money stay in a left column; phone: one column with tabs that stick.
 */
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft, ArrowLeft, BellRing, BookImage, Camera, CalendarDays, ChevronRight, CircleAlert, Edit3, FileSignature, FileText,
  Link2, Mail, MapPin, MessageCircle, MoreHorizontal, Music2, Phone, Plus, Receipt, ScrollText, Star, Trash2, UserX, Wallet,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency, fmtDate } from "@/lib/format";
import { DateBox } from "@/components/ui/apple";
import { Avatar, waLink } from "@/components/ui/profile-kit";
import { Chip, CHIP, Empty, List, ProfileSkeleton, QuickAction, Row, Section, TabBar, card, linkBtn, softBtn, useDismiss, useTab } from "@/components/ui/profile-page";
import { CLIENT_SOURCES } from "@/components/client-form-fields";
import { PortalAccessModal } from "@/components/portal-access-modal";
import { STATUS_CFG } from "../../programs/_components/constants";
import { PaymentModal } from "../../programs/_components/payment-modal";
import type { Booking } from "../../programs/_components/types";
import { ClientDrawer, DeleteDialog, fullName, type Client } from "../_components/client-drawer";

// ─── Types ───────────────────────────────────────────────────────────────────
type Program = { id: string; bookingNumber: string; eventName?: string | null; eventDate?: string | null; status: string; grandTotal: number | string; paidAmount: number | string; currency?: string };
type Todo = { kind: "money" | "contract" | "quote" | "photos" | "music"; tone: "amber" | "violet" | "red"; title: string; sub: string; href: string; external?: boolean };
type LedgerRow = { id: string; type: "invoice" | "payment"; date: string; title: string; sub: string; amount: number; currency: string; state?: string; due?: number; href?: string };
type Profile = Client & {
  facebookProfile?: string;
  bookings: Program[];
  stats: { programs: number; total: number; paid: number; due: number; nextProgram: { id: string; eventName?: string; eventDate?: string } | null };
  referrals: { id: string; firstName: string; lastName?: string; createdAt: string }[];
  todos: Todo[];
  ledger: LedgerRow[];
  quotes: { id: string; quoteNumber: string; status: string; eventType?: string | null; eventDate?: string | null; grandTotal: number | string; currency: string; viewCount: number; createdAt: string }[];
  contracts: { id: string; contractNumber: string; title: string; status: string; sentAt?: string | null; signedAt?: string | null; eventName?: string | null; createdAt: string }[];
  galleries: { id: string; title: string; status: string; picked: number; eventName?: string | null; createdAt: string }[];
  music: { id: string; bookingId: string; status: string; eventName?: string | null; submittedAt?: string | null }[];
};
type Tab = "overview" | "programs" | "money" | "documents" | "about";

// ─── Small pieces ────────────────────────────────────────────────────────────
const INV: Record<string, { label: string; tone: keyof typeof CHIP }> = {
  unpaid: { label: "Unpaid", tone: "orchid" }, partly_paid: { label: "Partly paid", tone: "amber" }, paid: { label: "Paid", tone: "green" }, overdue: { label: "Late", tone: "red" },
};
const QUOTE: Record<string, { label: string; tone: keyof typeof CHIP }> = {
  draft: { label: "Draft", tone: "grey" }, sent: { label: "Sent", tone: "blue" }, viewed: { label: "Opened", tone: "violet" }, accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Declined", tone: "red" }, expired: { label: "Expired", tone: "grey" }, converted: { label: "Booked", tone: "green" },
};
const CONTRACT: Record<string, { label: string; tone: keyof typeof CHIP }> = {
  draft: { label: "Draft", tone: "grey" }, sent: { label: "Sent", tone: "blue" }, viewed: { label: "Opened", tone: "violet" }, signed: { label: "Signed", tone: "green" },
};
const GALLERY: Record<string, { label: string; tone: keyof typeof CHIP }> = {
  preparing: { label: "Not sent", tone: "grey" }, open: { label: "Choosing", tone: "amber" }, submitted: { label: "Chosen", tone: "green" }, taken: { label: "Album started", tone: "violet" }, closed: { label: "Closed", tone: "grey" },
};
const MUSIC: Record<string, { label: string; tone: keyof typeof CHIP }> = { open: { label: "Choosing", tone: "amber" }, submitted: { label: "Chosen", tone: "green" } };
const TODO_ICON: Record<Todo["kind"], React.ElementType> = { money: Wallet, contract: FileSignature, quote: FileText, photos: BookImage, music: Music2 };
const TODO_TONE: Record<Todo["tone"], string> = { red: "bg-[#FDECEF] text-[#C2304F]", violet: "bg-[#EEE8FD] text-[#5B3FD0]", amber: "bg-[#FFF3E0] text-[#9A5B00]" };

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useTab<Tab>(`/clients/${id}`, ["overview", "programs", "money", "documents", "about"], sp.get("tab"));

  const [c, setC] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // ?portal=1 (the link in a client's "Forgot your code?" WhatsApp message) opens their portal code.
  const [portal, setPortal] = useState(sp.get("portal") === "1");
  const [more, setMore] = useState(false);
  const moreRef = useDismiss<HTMLDivElement>(more, () => setMore(false));
  const [payFor, setPayFor] = useState<Program | null>(null);
  const [payPick, setPayPick] = useState(false);
  const payRef = useDismiss<HTMLDivElement>(payPick, () => setPayPick(false));
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "invoice" | "payment">("all");

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/clients/${id}/profile`).catch(() => null);
    if (!r || r.status === 404) { setMissing(true); return; }
    if (r.ok) setC(await r.json());
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const owing = useMemo(() => (c?.bookings ?? []).filter(b => !["cancelled", "refunded"].includes(b.status) && Number(b.grandTotal) - Number(b.paidAmount) > 0.009), [c]);

  if (missing) return (
    <div className="max-w-md mx-auto pt-16">
      <Empty icon={UserX} title="Client not found" text="They may have been deleted."><Link href="/clients" className={softBtn}><ArrowLeft className="w-4 h-4" />All clients</Link></Empty>
    </div>
  );
  if (!c) return <ProfileSkeleton label="Loading client" />;

  const name = fullName(c);
  const st = c.stats;
  const pct = st.total > 0 ? Math.min(100, Math.round((st.paid / st.total) * 100)) : 0;
  const src = CLIENT_SOURCES.find(s => s.value === c.source);
  const referrer = c.referredByClientName || c.referredByName;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = c.bookings.filter(b => b.eventDate && b.eventDate.slice(0, 10) >= today && !["cancelled", "refunded"].includes(b.status)).sort((a, b) => a.eventDate!.localeCompare(b.eventDate!));
  const focus = upcoming[0] ?? c.bookings[0];
  const docCount = c.quotes.length + c.contracts.length + c.galleries.length + c.music.length;
  const ledger = c.ledger.filter(r => ledgerFilter === "all" || r.type === ledgerFilter);
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "programs", label: "Programs", count: c.bookings.length },
    { id: "money", label: "Money", count: c.ledger.length },
    { id: "documents", label: "Documents", count: docCount },
    { id: "about", label: "About" },
  ];
  function recordPayment() {
    if (owing.length === 1) setPayFor(owing[0]);
    else if (owing.length > 1) setPayPick(p => !p);
  }

  const programRow = (b: Program) => {
    const due = Math.max(0, Number(b.grandTotal) - Number(b.paidAmount));
    const cfg = STATUS_CFG[b.status];
    return (
      <Row key={b.id} href={`/programs?view=${b.id}`} lead={<DateBox date={b.eventDate} />}
        title={b.eventName || "Untitled program"}
        sub={<span className="inline-flex items-center gap-1.5"><span className={cn("w-1.5 h-1.5 rounded-full", cfg?.dot ?? "bg-[#B5B0C4]")} />{cfg?.label ?? b.status} · {b.bookingNumber}</span>}
        right={<>
          <span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(b.grandTotal), b.currency)}</span>
          {Number(b.grandTotal) > 0 && (due > 0
            ? <span className="text-[12px] font-semibold text-[#C2304F] tabular-nums">{formatCurrency(due, b.currency)} due</span>
            : <span className="text-[12px] font-semibold text-[#1F8A5B]">Paid</span>)}
        </>} />
    );
  };
  const ledgerRow = (r: LedgerRow) => r.type === "payment" ? (
    <Row key={`p${r.id}`} href={r.href} external
      lead={<span className="w-[38px] h-[38px] rounded-full bg-[#E7F5EE] text-[#1F8A5B] flex items-center justify-center flex-shrink-0"><ArrowDownLeft className="w-[18px] h-[18px]" /></span>}
      title={r.title} sub={`${fmtDate(r.date)} · ${r.sub || "Payment"}`}
      right={<span className="text-[14.5px] font-bold text-[#1F8A5B] tabular-nums">+{formatCurrency(r.amount, r.currency)}</span>} />
  ) : (
    <Row key={`i${r.id}`} href={r.href} external icon={Receipt} color="orchid"
      title={r.title} sub={`${fmtDate(r.date)} · ${r.sub}`}
      right={<>
        <span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(r.amount, r.currency)}</span>
        {r.state && INV[r.state] && <Chip tone={INV[r.state].tone}>{r.state === "partly_paid" && (r.due ?? 0) > 0 ? `${formatCurrency(r.due!, r.currency)} due` : r.state === "overdue" && (r.due ?? 0) > 0 ? `Late · ${formatCurrency(r.due!, r.currency)}` : INV[r.state].label}</Chip>}
      </>} />
  );

  return (
    <div>
      {/* Back */}
      <div className="flex items-center justify-between mb-3">
        <Link href="/clients" className="h-9 pl-2.5 pr-3.5 rounded-full bg-white hover:bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <ArrowLeft className="w-4 h-4" />Clients
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        {/* ── Left: who + money ─────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 space-y-4 mb-4 lg:mb-0">
          <div className={cn(card, "p-5", more && "relative z-30")}>
            <div className="flex items-center gap-4 lg:flex-col lg:text-center lg:gap-3">
              <Avatar name={name} color="#1F5C99" size={68} />
              <div className="flex-1 min-w-0 lg:flex-none lg:w-full">
                <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight break-words">{name}</h1>
                <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">{[c.phone, c.companyName || c.occupation].filter(Boolean).join(" · ") || "No phone yet"}</p>
                <div className="flex flex-wrap gap-1.5 mt-2 lg:justify-center">
                  {c.vipStatus && <Chip tone="orchid"><Star className="w-3 h-3 mr-1 fill-current" />VIP</Chip>}
                  {c.createdAt && <Chip tone="grey">Since {new Date(c.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</Chip>}
                </div>
              </div>
            </div>
            <div ref={moreRef} className="grid grid-cols-4 gap-1 mt-5 relative">
              <QuickAction icon={MessageCircle} label="WhatsApp" tone="bg-[#E7F5EE] text-[#1F8A5B]" href={waLink(c.phone)} disabled={!c.phone} />
              <QuickAction icon={Phone} label="Call" tone="bg-[#E8F0FA] text-[#1F5C99]" href={c.phone ? `tel:${c.phone}` : undefined} disabled={!c.phone} />
              <QuickAction icon={Camera} label="New program" tone="bg-[#EEE8FD] text-[#5B3FD0]" onClick={() => router.push(`/programs?newFor=${c.id}`)} />
              <QuickAction icon={MoreHorizontal} label="Options" tone="bg-[#F1EFF6] text-[#17151F]" onClick={() => setMore(m => !m)} />
              {more && (
                <>
                  <div role="menu" className="absolute right-0 top-[76px] w-56 bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1">
                    {[
                      { icon: Edit3, label: "Edit details", run: () => setEditing(true) },
                      { icon: Link2, label: "Client portal link", run: () => setPortal(true) },
                      { icon: ScrollText, label: "Statement", run: () => window.open(`/statement/${c.id}`, "_blank", "noopener") },
                      { icon: FileText, label: "New quote", run: () => router.push(`/quotes?newFor=${c.id}`) },
                    ].map(m => (
                      <button key={m.label} role="menuitem" type="button" onClick={() => { setMore(false); m.run(); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><m.icon className="w-4 h-4 text-[#6B6680]" />{m.label}</button>
                    ))}
                    <div className="my-1 border-t border-[#EEEBF4]" />
                    <button role="menuitem" type="button" onClick={() => { setMore(false); setDeleting(true); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#C2304F] hover:bg-[#FDECEF]"><Trash2 className="w-4 h-4" />Delete client</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Money at a glance */}
          {(st.programs > 0 || st.total > 0) && <div className={cn(card, "p-5", payPick && "relative z-30")}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">{st.due > 0 ? "Still due" : "Money"}</p>
              <p className="text-[12.5px] text-[#6B6680]">{st.programs} program{st.programs === 1 ? "" : "s"}</p>
            </div>
            <p className={cn("text-[30px] font-extrabold tracking-[-0.02em] tabular-nums leading-tight mt-0.5", st.due > 0 ? "text-[#C2304F]" : "text-[#17151F]")}>
              {st.due > 0 ? formatCurrency(st.due) : st.total > 0 ? "All paid" : formatCurrency(0)}
            </p>
            <div className="mt-3 h-2 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-label="Paid so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[#1F8A5B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2.5 flex justify-between text-[13px]">
              <span className="text-[#6B6680]">Received <span className="font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(st.paid)}</span></span>
              <span className="text-[#6B6680]">of <span className="font-bold text-[#17151F] tabular-nums">{formatCurrency(st.total)}</span></span>
            </div>
            {owing.length > 0 && (
              <div ref={payRef} className="relative mt-4">
                <button type="button" onClick={recordPayment} className="w-full h-11 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4" />Record payment
                </button>
                {payPick && (
                  <>
                    <div role="menu" aria-label="Which program?" className="absolute left-0 right-0 top-[50px] bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1">
                      <p className="px-3 pt-2 pb-1 text-[12px] font-bold text-[#6B6680]">Which program?</p>
                      {owing.map(b => (
                        <button key={b.id} role="menuitem" type="button" onClick={() => { setPayPick(false); setPayFor(b); }} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-[12px] text-left hover:bg-[#F5F3FA]">
                          <span className="text-sm font-semibold text-[#17151F] truncate">{b.eventName || b.bookingNumber}</span>
                          <span className="text-[12.5px] font-semibold text-[#C2304F] tabular-nums flex-shrink-0">{formatCurrency(Number(b.grandTotal) - Number(b.paidAmount), b.currency)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>}
        </aside>

        {/* ── Right: what needs doing + tabs ────────────────────────────── */}
        <div className="min-w-0">
          {c.todos.length > 0 && (
            <Section title={<span className="inline-flex items-center gap-1.5"><BellRing className="w-3.5 h-3.5" />Needs attention</span>}>
              <List>
                {c.todos.map((t, i) => {
                  const I = TODO_ICON[t.kind];
                  return <Row key={i} href={t.href} external={t.external} title={t.title} sub={t.sub}
                    lead={<span className={cn("w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0", TODO_TONE[t.tone])}><I className="w-[18px] h-[18px]" /></span>} />;
                })}
              </List>
            </Section>
          )}

          <TabBar tabs={tabs} value={tab} onChange={setTab} label="Client sections" />

          {tab === "overview" && (
            <>
              <Section title={!focus ? undefined : upcoming[0] ? "Next program" : "Latest program"}
                action={c.bookings.length > 1 ? <button type="button" onClick={() => setTab("programs")} className={linkBtn}>All {c.bookings.length}<ChevronRight className="w-3.5 h-3.5" /></button> : undefined}>
                {focus ? <List>{programRow(focus)}</List> : (
                  <Empty icon={Camera} title="No programs yet" text="Book their first shoot or event.">
                    <button type="button" onClick={() => router.push(`/programs?newFor=${c.id}`)} className={softBtn}><Plus className="w-4 h-4" />New program</button>
                  </Empty>
                )}
              </Section>

              {c.ledger.length > 0 && (
                <Section title="Latest money" action={<button type="button" onClick={() => setTab("money")} className={linkBtn}>See all<ChevronRight className="w-3.5 h-3.5" /></button>}>
                  <List>{c.ledger.slice(0, 3).map(ledgerRow)}</List>
                </Section>
              )}

              <Section title="Notes" action={<button type="button" onClick={() => setEditing(true)} className={linkBtn}>{c.notes || c.internalNotes ? "Edit" : "Add"}</button>}>
                <div className={cn(card, "p-4 space-y-3")}>
                  {c.notes && <p className="text-[14px] text-[#33303F] leading-relaxed whitespace-pre-line">{c.notes}</p>}
                  {c.internalNotes && (
                    <div className="rounded-[14px] bg-[#F7F5FB] px-3.5 py-3">
                      <p className="text-[12px] font-bold text-[#6B6680] mb-1">Private — only your team</p>
                      <p className="text-[14px] text-[#33303F] leading-relaxed whitespace-pre-line">{c.internalNotes}</p>
                    </div>
                  )}
                  {!c.notes && !c.internalNotes && <p className="text-[13.5px] text-[#8A8599]">Nothing written yet. Likes, family details, things to remember…</p>}
                </div>
              </Section>
            </>
          )}

          {tab === "programs" && (
            <Section title={`${c.bookings.length} program${c.bookings.length === 1 ? "" : "s"}`}
              action={<button type="button" onClick={() => router.push(`/programs?newFor=${c.id}`)} className={linkBtn}><Plus className="w-3.5 h-3.5" />New program</button>}>
              {c.bookings.length ? <List>{c.bookings.map(programRow)}</List> : (
                <Empty icon={Camera} title="No programs yet" text="Book their first shoot or event.">
                  <button type="button" onClick={() => router.push(`/programs?newFor=${c.id}`)} className={softBtn}><Plus className="w-4 h-4" />New program</button>
                </Empty>
              )}
            </Section>
          )}

          {tab === "money" && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                {[
                  { label: "Billed", value: st.total, cls: "text-[#17151F]" },
                  { label: "Received", value: st.paid, cls: "text-[#1F8A5B]" },
                  { label: "Due", value: st.due, cls: st.due > 0 ? "text-[#C2304F]" : "text-[#17151F]" },
                ].map(x => (
                  <div key={x.label} className={cn(card, "!rounded-[18px] px-3 sm:px-4 py-3 min-w-0")}>
                    <p className="text-[12px] font-semibold text-[#6B6680]">{x.label}</p>
                    <p className={cn("text-[15px] sm:text-[18px] font-extrabold tabular-nums truncate", x.cls)}>{formatCurrency(x.value)}</p>
                  </div>
                ))}
              </div>
              <Section
                title={
                  <span role="tablist" aria-label="Show" className="inline-flex gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
                    {(["all", "invoice", "payment"] as const).map(f => (
                      <button key={f} role="tab" aria-selected={ledgerFilter === f} type="button" onClick={() => setLedgerFilter(f)}
                        className={cn("h-7 px-3 rounded-full text-[12.5px] font-semibold", ledgerFilter === f ? "bg-[#16141D] text-white" : "text-[#4A4658]")}>
                        {f === "all" ? "All" : f === "invoice" ? "Invoices" : "Payments"}
                      </button>
                    ))}
                  </span>
                }
                action={<a href={`/statement/${c.id}`} target="_blank" rel="noopener noreferrer" className={linkBtn}><ScrollText className="w-3.5 h-3.5" />Statement</a>}>
                {ledger.length ? <List>{ledger.map(ledgerRow)}</List> : (
                  <Empty icon={Wallet} title={c.ledger.length ? "Nothing in this list" : "No money yet"} text={c.ledger.length ? undefined : "Invoices and payments show here, newest first."} />
                )}
              </Section>
            </>
          )}

          {tab === "documents" && (docCount === 0 ? (
            <Empty icon={FileText} title="No documents yet" text="Quotes, agreements, photo and song choices show here.">
              <button type="button" onClick={() => router.push(`/quotes?newFor=${c.id}`)} className={softBtn}><Plus className="w-4 h-4" />New quote</button>
              <Link href="/contracts/new" className={softBtn}><Plus className="w-4 h-4" />New agreement</Link>
            </Empty>
          ) : (
            <>
              {c.quotes.length > 0 && (
                <Section title="Quotes" action={<button type="button" onClick={() => router.push(`/quotes?newFor=${c.id}`)} className={linkBtn}><Plus className="w-3.5 h-3.5" />New</button>}>
                  <List>{c.quotes.map(q => (
                    <Row key={q.id} href={`/quotes?view=${q.id}`} icon={FileText} color="violet" title={q.eventType || q.quoteNumber}
                      sub={[q.quoteNumber, q.eventDate ? fmtDate(q.eventDate) : null, q.viewCount ? `${q.viewCount} view${q.viewCount === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
                      right={<><span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(q.grandTotal), q.currency)}</span><Chip tone={QUOTE[q.status]?.tone ?? "grey"}>{QUOTE[q.status]?.label ?? q.status}</Chip></>} />
                  ))}</List>
                </Section>
              )}
              {c.contracts.length > 0 && (
                <Section title="Agreements" action={<Link href="/contracts/new" className={linkBtn}><Plus className="w-3.5 h-3.5" />New</Link>}>
                  <List>{c.contracts.map(k => (
                    <Row key={k.id} href={`/contracts/${k.id}`} icon={FileSignature} color="ink" title={k.title}
                      sub={[k.contractNumber, k.eventName, k.signedAt ? `Signed ${fmtDate(k.signedAt)}` : k.sentAt ? `Sent ${fmtDate(k.sentAt)}` : null].filter(Boolean).join(" · ")}
                      right={<Chip tone={CONTRACT[k.status]?.tone ?? "grey"}>{CONTRACT[k.status]?.label ?? k.status}</Chip>} />
                  ))}</List>
                </Section>
              )}
              {c.galleries.length > 0 && (
                <Section title="Photo selections">
                  <List>{c.galleries.map(g => (
                    <Row key={g.id} href={`/photo-selection/${g.id}`} icon={BookImage} color="red" title={g.title}
                      sub={[g.eventName, g.picked ? `${g.picked} chosen` : null].filter(Boolean).join(" · ") || "Photo selection"}
                      right={<Chip tone={GALLERY[g.status]?.tone ?? "grey"}>{GALLERY[g.status]?.label ?? g.status}</Chip>} />
                  ))}</List>
                </Section>
              )}
              {c.music.length > 0 && (
                <Section title="Songs">
                  <List>{c.music.map(m => (
                    <Row key={m.id} href={`/programs?view=${m.bookingId}`} icon={Music2} color="orchid" title={m.eventName || "Program"}
                      sub={m.submittedAt ? `Sent ${fmtDate(m.submittedAt)}` : "Songs for the videos"}
                      right={<Chip tone={MUSIC[m.status]?.tone ?? "grey"}>{MUSIC[m.status]?.label ?? m.status}</Chip>} />
                  ))}</List>
                </Section>
              )}
            </>
          ))}

          {tab === "about" && (
            <>
              <Section title="Contact" action={<button type="button" onClick={() => setEditing(true)} className={linkBtn}><Edit3 className="w-3.5 h-3.5" />Edit</button>}>
                <List>
                  {c.phone && <Row href={`tel:${c.phone}`} external icon={Phone} color="blue" title={c.phone} sub="Phone / WhatsApp" />}
                  {c.phoneSecondary && <Row href={`tel:${c.phoneSecondary}`} external icon={Phone} color="blue" title={c.phoneSecondary} sub="Second phone" />}
                  {c.email && <Row href={`mailto:${c.email}`} external icon={Mail} color="violet" title={c.email} sub="Email" />}
                  {(c.address || c.city) && <Row icon={MapPin} color="green" title={[c.address, c.city].filter(Boolean).join(", ")} sub="Address" />}
                  {c.facebookProfile && <Row icon={Link2} color="deep" title={c.facebookProfile} sub="Facebook" />}
                  {!c.phone && !c.email && !c.address && !c.city && !c.facebookProfile && <Row icon={CircleAlert} color="ink" title="No contact details yet" sub="Tap Edit to add a phone or email" />}
                </List>
              </Section>
              {(c.occupation || c.companyName || src || referrer) && (
                <Section title="Background">
                  <div className={cn(card, "divide-y divide-[#EEEBF4]")}>
                    {[
                      c.occupation && { k: "Occupation", v: c.occupation },
                      c.companyName && { k: "Company / organisation", v: c.companyName },
                      src && { k: "Came from", v: src.label },
                      referrer && { k: "Referred by", v: referrer },
                    ].filter(Boolean).map(x => { const r = x as { k: string; v: string }; return (
                      <div key={r.k} className="px-4 py-3 flex items-baseline justify-between gap-4 text-[14px]">
                        <span className="text-[#6B6680] flex-shrink-0">{r.k}</span><span className="font-semibold text-[#17151F] text-right min-w-0 break-words">{r.v}</span>
                      </div>
                    ); })}
                  </div>
                </Section>
              )}
              {c.referrals.length > 0 && (
                <Section title={`Brought ${c.referrals.length} client${c.referrals.length === 1 ? "" : "s"}`}>
                  <List>{c.referrals.map(r => (
                    <Row key={r.id} href={`/clients/${r.id}`} lead={<Avatar name={fullName(r)} color="#7D5CEF" size={38} />} title={fullName(r)} sub={`Added ${fmtDate(r.createdAt)}`} />
                  ))}</List>
                </Section>
              )}
              <p className="px-1 text-[12.5px] text-[#8A8599] inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Client since {c.createdAt ? fmtDate(c.createdAt) : "—"}</p>
            </>
          )}
        </div>
      </div>

      {/* Drawers */}
      <ClientDrawer open={editing} editing={c} onClose={() => setEditing(false)} onSaved={load} onOpenExisting={x => { setEditing(false); router.push(`/clients/${x}`); }} />
      <DeleteDialog client={deleting ? c : null} onClose={() => setDeleting(false)} onDeleted={() => router.replace("/clients")} />
      {portal && <PortalAccessModal client={c} onClose={() => setPortal(false)} />}
      <PaymentModal booking={payFor as unknown as Booking | null} onClose={() => setPayFor(null)} onSaved={load} />
    </div>
  );
}
