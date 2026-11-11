"use client";

/**
 * Member panel: one program, laid out like the studio's program page —
 * what it is and my pay on the left, tabs for the rest on the right.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Camera, CalendarX, ExternalLink, HardDrive, Mail, MapPin, MessageCircle, Phone, Video, Wallet,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { waNumber } from "@/lib/phone";
import { DateBox, Initial, Tile } from "@/components/ui/apple";
import { CHIP, Chip, Empty, List, ProfileSkeleton, QuickAction, Row, Section, TabBar, card, linkBtn, softBtn, revealPanel, useTab } from "@/components/ui/profile-page";
import { StatusBadge } from "../../_components/kit";
import { EditorRawAccess, MemberRawUpload } from "../../_components/raw-upload";
import { MyCosts } from "../../_components/costs";

type Person = { id: string; isMe: boolean; role: string; name: string; phone?: string | null; setup?: string | null; gear: string[] };
type ProgramHub = {
  id: string;
  bookingNumber: string;
  eventName?: string;
  status: string;
  eventDays: {
    id: string; eventType: string; date?: string; location?: string;
    shifts?: { id: string; label: string; people: Person[] }[];
  }[];
  currency?: string;
  myPay?: {
    role: string; bill: number; paid: number; due: number; note?: string;
    lines: { label: string; amount: number; kind: string; note?: string }[];
    payments: { id: string; amount: number; method: string; date: string }[];
  } | null;
  client: { firstName: string; lastName?: string; phone?: string; email?: string; address?: string };
  team: { id: string; userId: string; roleInBooking: string; user: { firstName: string; lastName?: string; phone?: string } }[];
  editorAssignments: {
    id: string; userId: string; role: string; status: string;
    editingDeadline?: string; deliveryDeadline?: string;
    user: { firstName: string; lastName?: string };
    submissions?: { reviewStatus: string; deliverableType: string; deliveryLink?: string }[];
  }[];
  deliveryLink?: string;
  deliveryLinks?: { id: string; title: string; url: string }[];
};

type Tone = keyof typeof CHIP;
const SETUP_LABEL: Record<string, string> = { own: "Own setup", other: "Others' gear", rented: "Rented gear" };
const METHOD_LABEL: Record<string, string> = { cash: "Cash", mobile_banking: "Mobile wallet", bank_transfer: "Bank", other: "Other" };
const ROLE: Record<string, string> = {
  photographer: "Photographer", videographer: "Videographer", cinematographer: "Cinematographer", drone_pilot: "Drone", assistant: "Assistant",
  drone_operator: "Drone", photo_editor: "Photo Editor", video_editor: "Video Editor",
  album_designer: "Album Design", coordinator: "Coordinator",
};
const roleLabel = (r: string) => ROLE[r] ?? r.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
const ASSIGNMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  assigned:           { label: "Assigned",      tone: "grey" },
  in_progress:        { label: "In progress",   tone: "blue" },
  submitted:          { label: "Submitted",     tone: "orchid" },
  under_review:       { label: "Under review",  tone: "orchid" },
  revision_requested: { label: "Changes asked", tone: "red" },
  resubmitted:        { label: "Sent again",    tone: "orchid" },
  approved:           { label: "Approved",      tone: "green" },
  delivered:          { label: "Delivered",     tone: "green" },
};

const wa = (phone: string) => `https://wa.me/${waNumber(phone) ?? ""}`;
const TABS = ["overview", "raw", "pay", "editing"] as const;
type Tab = (typeof TABS)[number];
const LABEL = "text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]";
const WA_BTN = "w-9 h-9 rounded-full bg-[#E7F5EE] hover:bg-[#D6EEDF] text-[#1F8A5B] inline-flex items-center justify-center flex-shrink-0";

export default function ProgramHubPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useTab<Tab>(`/member/programs/${id}`, TABS, sp.get("tab"));
  const [hub, setHub] = useState<ProgramHub | null>(null);
  const [missing, setMissing] = useState(false);
  const panels = useRef<HTMLDivElement>(null);
  // From a button in the summary: switch the tab and bring it into view (phones).
  const go = (t: Tab) => { setTab(t); revealPanel(panels.current); };
  const [uploadShown, setUploadShown] = useState<boolean | null>(null);
  const [editorShown, setEditorShown] = useState<boolean | null>(null);

  const loadHub = useCallback(() => apiFetch(`${API}/member/programs/${id}/hub`)
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(setHub)
    .catch(() => setMissing(true)), [id]);
  useEffect(() => { loadHub(); }, [loadHub]);
  // My pay changes only when the studio approves a cost, but refresh anyway after I add one.
  const reloadHub = () => { loadHub(); };

  const days = useMemo(() => [...(hub?.eventDays ?? [])].sort((x, y) => (x.date || "9999").localeCompare(y.date || "9999")), [hub]);

  if (missing) return (
    <div className="max-w-md mx-auto pt-16">
      <Empty icon={CalendarX} title="Program not found" text="It may have been removed, or you are not on it.">
        <Link href="/member/programs" className={softBtn}><ArrowLeft className="w-4 h-4" />My programs</Link>
      </Empty>
    </div>
  );
  if (!hub) return <ProfileSkeleton label="Loading program" />;

  const cur = hub.currency;
  const money = (n: number) => formatCurrency(n, cur);
  const clientName = `${hub.client.firstName} ${hub.client.lastName ?? ""}`.trim();
  const dated = days.filter(d => d.date);
  const dateText = dated.length === 0 ? "Date not set"
    : dated.length === 1 ? fmtDate(dated[0].date)
    : `${fmtDate(dated[0].date)} – ${fmtDate(dated[dated.length - 1].date)}`;
  const myRoles = [...new Set(days.flatMap(d => (d.shifts ?? []).flatMap(s => s.people.filter(p => p.isMe).map(p => p.role))))];
  const deliveryLinks = hub.deliveryLinks ?? (hub.deliveryLink ? [{ id: "1", title: "Delivery link", url: hub.deliveryLink }] : []);
  const pay = hub.myPay ?? null;
  const pct = pay && pay.bill > 0 ? Math.min(100, Math.round((pay.paid / pay.bill) * 100)) : 0;
  const hasEditing = (hub.editorAssignments?.length ?? 0) > 0 || deliveryLinks.length > 0;

  const tabs = ([
    { id: "overview", label: "Overview" },
    { id: "raw", label: "Raw files" },
    { id: "pay", label: pay ? "Pay & costs" : "My costs" },
    hasEditing && { id: "editing", label: "Editing & delivery" },
  ].filter(Boolean)) as { id: Tab; label: string }[];
  const openTab: Tab = tabs.some(t => t.id === tab) ? tab : "overview";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/member/programs" className="h-9 pl-2.5 pr-3.5 rounded-full bg-white hover:bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <ArrowLeft className="w-4 h-4" />My programs
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        {/* ── Left: what it is + my pay ──────────────────────────────────── */}
        <aside className="lg:sticky lg:top-6 space-y-4 mb-4 lg:mb-0">
          <div className={cn(card, "p-5")}>
            <div className="flex items-center gap-4 lg:flex-col lg:text-center lg:gap-3">
              <Tile icon={Camera} color="deep" size={64} className="rounded-[20px]" />
              <div className="flex-1 min-w-0 lg:flex-none lg:w-full">
                <h1 className="text-[21px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight break-words">{hub.eventName || hub.bookingNumber}</h1>
                <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">{clientName} · {dateText}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 lg:justify-center">
                  <StatusBadge status={hub.status} />
                  {myRoles.map(r => <Chip key={r} tone="grey">{roleLabel(r)}</Chip>)}
                  <span className="h-6 px-2 rounded-full text-[12px] font-mono text-[#6B6680] inline-flex items-center">{hub.bookingNumber}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-5">
              <QuickAction icon={Phone} label="Client" tone="bg-[#E7F5EE] text-[#1F8A5B]" href={hub.client.phone ? wa(hub.client.phone) : undefined} disabled={!hub.client.phone} />
              <QuickAction icon={HardDrive} label="Raw files" tone="bg-[#EEE8FD] text-[#5B3FD0]" onClick={() => go("raw")} />
              <QuickAction icon={MessageCircle} label="Studio chat" tone="bg-[#F1EFF6] text-[#17151F]" onClick={() => router.push("/member/chat")} />
            </div>
          </div>

          {/* My pay at a glance */}
          {pay && (
            <div className={cn(card, "p-5")}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={LABEL}>{pay.due > 0 ? "Still to get" : "My pay"}</p>
                <p className="text-[12.5px] text-[#6B6680] truncate">{roleLabel(pay.role)}</p>
              </div>
              <p className={cn("text-[30px] font-extrabold tracking-[-0.02em] tabular-nums leading-tight mt-0.5", pay.due > 0 ? "text-[#17151F]" : "text-[#1F8A5B]")}>
                {pay.due > 0 ? money(pay.due) : pay.bill > 0 ? "Paid in full" : money(0)}
              </p>
              <div className="mt-3 h-2 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-label="Paid so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[#1F8A5B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2.5 flex justify-between text-[13px]">
                <span className="text-[#6B6680]">Got <span className="font-bold text-[#1F8A5B] tabular-nums">{money(pay.paid)}</span></span>
                <span className="text-[#6B6680]">of <span className="font-bold text-[#17151F] tabular-nums">{money(pay.bill)}</span></span>
              </div>
              <button type="button" onClick={() => go("pay")} className="mt-4 w-full h-11 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Wallet className="w-4 h-4" />See the details
              </button>
            </div>
          )}
        </aside>

        {/* ── Right: tabs ────────────────────────────────────────────────── */}
        <div ref={panels} className="min-w-0 scroll-mt-20">
          <TabBar tabs={tabs} value={openTab} onChange={setTab} label="Program sections" />

          {/* Panels stay mounted so switching is instant and nothing typed is lost. */}
          <div role="tabpanel" hidden={openTab !== "overview"}>
            <Section title={`Days${days.length ? ` · ${days.length}` : ""}`}>
              {days.length === 0 ? <Empty icon={CalendarX} title="No days added yet" text="The studio hasn't set the days for this program." /> : (
                <div className={cn(card, "overflow-hidden divide-y divide-[#EEEBF4]")}>
                  {days.map(day => {
                    const shifts = (day.shifts ?? []).filter(s => s.people.length);
                    const mine = shifts.some(s => s.people.some(p => p.isMe));
                    return (
                      <div key={day.id} className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <DateBox date={day.date} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[14.5px] font-semibold text-[#17151F] truncate">{day.eventType}</p>
                            <p className="text-[12.5px] text-[#6B6680] mt-0.5 flex items-center gap-1 min-w-0">
                              <span className="flex-shrink-0">{day.date ? fmtDate(day.date) : "Date not set"}</span>
                              {day.location && <><span>·</span><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{day.location}</span></>}
                            </p>
                          </div>
                          {mine && <Chip tone="violet">You work</Chip>}
                        </div>
                        {shifts.map(sh => (
                          <div key={sh.id} className="mt-3 sm:pl-[60px]">
                            {(day.shifts ?? []).length > 1 && <p className="text-[12px] font-semibold text-[#6B6680] mb-1.5">{sh.label}</p>}
                            <ul className="rounded-[14px] bg-[#F7F5FB] divide-y divide-white">
                              {sh.people.map((pp, k) => {
                                const extra = [pp.setup ? SETUP_LABEL[pp.setup] ?? pp.setup : "", pp.gear.join(", ")].filter(Boolean).join(" · ");
                                return (
                                  <li key={`${pp.id}-${k}`} className="flex items-center gap-2.5 px-3 py-2">
                                    <Initial name={pp.name} size={30} />
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-[13.5px] text-[#17151F] truncate">
                                        <span className="font-semibold">{pp.name}</span>
                                        <span className="text-[#6B6680]"> · {roleLabel(pp.role)}</span>
                                      </span>
                                      {extra && <span className="block text-[12px] text-[#6B6680] truncate">{extra}</span>}
                                    </span>
                                    {pp.isMe ? <Chip tone="violet">You</Chip>
                                      : pp.phone && <a href={wa(pp.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${pp.name}`} className={WA_BTN}><Phone className="w-4 h-4" /></a>}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section title="Client">
              <List>
                <Row href={hub.client.phone ? wa(hub.client.phone) : undefined} external lead={<Initial name={clientName} size={38} />}
                  title={clientName} sub={hub.client.phone ? `${hub.client.phone} · WhatsApp` : "No phone number"} />
                {hub.client.email && <Row href={`mailto:${hub.client.email}`} external icon={Mail} color="blue" title={hub.client.email} sub="Email" />}
                {hub.client.address && <Row icon={MapPin} color="red" title={hub.client.address} sub="Address" />}
              </List>
            </Section>

            {hub.team?.length > 0 && (
              <Section title={`Team · ${hub.team.length}`}>
                <List>
                  {hub.team.map(m => {
                    const name = `${m.user.firstName} ${m.user.lastName ?? ""}`.trim();
                    return (
                      <Row key={m.id} lead={<Initial name={name} size={38} />} title={name} sub={roleLabel(m.roleInBooking)}
                        right={m.user.phone ? <a href={wa(m.user.phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name}`} className={WA_BTN}><Phone className="w-4 h-4" /></a> : undefined} />
                    );
                  })}
                </List>
              </Section>
            )}
          </div>

          <div role="tabpanel" hidden={openTab !== "raw"}>
            <EditorRawAccess bookingId={hub.id} onShown={setEditorShown} />
            <MemberRawUpload bookingId={hub.id} bookingNumber={hub.bookingNumber} onShown={setUploadShown} />
            {uploadShown === false && editorShown === false && (
              <Empty icon={HardDrive} title="Raw files are not set up" text="The studio hasn't connected Google Drive for raw files yet. Ask the studio where to send your files.">
                <button type="button" onClick={() => router.push("/member/chat")} className={softBtn}><MessageCircle className="w-4 h-4" />Ask the studio</button>
              </Empty>
            )}
          </div>

          <div role="tabpanel" hidden={openTab !== "pay"}>
            {pay && (<>
              <Section title="My bill for this program">
                <div className={cn(card, "overflow-hidden divide-y divide-[#EEEBF4]")}>
                  {pay.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
                      <span className="min-w-0">
                        <span className="block text-[#17151F] font-medium truncate">{l.label}</span>
                        {l.note && <span className="block text-[12.5px] text-[#6B6680] truncate">{l.note}</span>}
                      </span>
                      <span className={cn("font-semibold tabular-nums flex-shrink-0", l.kind === "deduction" ? "text-[#C2304F]" : "text-[#17151F]")}>{l.kind === "deduction" ? "− " : ""}{money(l.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] font-bold text-[#17151F] bg-[#F7F5FB]">
                    <span>Total</span><span className="tabular-nums">{money(pay.bill)}</span>
                  </div>
                </div>
                {pay.note && <p className="text-[12.5px] text-[#6B6680] px-1 mt-2 break-words">{pay.note}</p>}
              </Section>

              <Section title="Payments I got" action={<Link href="/member/earnings" className={linkBtn}>All my earnings</Link>}>
                {pay.payments.length === 0 ? (
                  <Empty icon={Wallet} title="No payment yet" text={pay.due > 0 ? `The studio still owes you ${money(pay.due)} for this program.` : "Nothing is due for this program."} />
                ) : (
                  <List>
                    {pay.payments.map(p => (
                      <Row key={p.id} icon={Wallet} color="green" title={fmtDate(p.date)} sub={METHOD_LABEL[p.method] ?? p.method.replace(/_/g, " ")}
                        right={<span className="text-[14.5px] font-bold text-[#1F8A5B] tabular-nums">+{money(p.amount)}</span>} />
                    ))}
                  </List>
                )}
              </Section>
            </>)}
            <MyCosts bookingId={hub.id} title="Costs I paid for this program" canAdd={!["cancelled", "refunded"].includes(hub.status)} onChanged={reloadHub} />
          </div>

          {hasEditing && (
            <div role="tabpanel" hidden={openTab !== "editing"}>
              {hub.editorAssignments?.length > 0 && (
                <Section title="Editing">
                  <List>
                    {hub.editorAssignments.map(a => {
                      const asc = ASSIGNMENT_STATUS[a.status] ?? { label: a.status.replace(/_/g, " "), tone: "grey" as Tone };
                      const due = [a.editingDeadline && `Editing by ${fmtDate(a.editingDeadline)}`, a.deliveryDeadline && `Delivery by ${fmtDate(a.deliveryDeadline)}`].filter(Boolean).join(" · ");
                      const sent = a.submissions?.[0]?.deliveryLink;
                      return (
                        <Row key={a.id} href={sent || undefined} external icon={Video} color={a.role === "photo_editor" ? "deep" : "orchid"}
                          title={`${a.user.firstName} ${a.user.lastName ?? ""}`.trim()}
                          sub={[roleLabel(a.role), due, sent && "Open what was sent"].filter(Boolean).join(" · ")}
                          right={<Chip tone={asc.tone}>{asc.label}</Chip>} />
                      );
                    })}
                  </List>
                </Section>
              )}
              {deliveryLinks.length > 0 && (
                <Section title="Delivery">
                  <List>
                    {deliveryLinks.map(l => <Row key={l.id} href={l.url} external icon={ExternalLink} color="green" title={l.title || "Delivery link"} sub={l.url} />)}
                  </List>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
