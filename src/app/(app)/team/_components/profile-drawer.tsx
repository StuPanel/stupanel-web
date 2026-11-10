"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, Camera, Video, Image, Film, Navigation, Briefcase, Tag,
  Phone, MessageCircle, Edit3, KeyRound, UserCheck, UserX, Wallet, CalendarDays,
  CheckCircle2, Plus, HandCoins, TrendingUp, MapPin, MoreHorizontal, Mail, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate, currencySymbol, currencyPad } from "@/lib/format";
import { DateBox, Group, TILE, Tile, type TileColor } from "@/components/ui/apple";
import { ActionButton, Avatar, IdentityCard, InfoRow, MiniStat, ProfileShell, waLink } from "@/components/ui/profile-kit";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { STATUS_CFG } from "../../programs/_components/constants";
import { SETUP_CATS, unitLabel } from "./rate-card";
import { askConfirm, notify } from "@/components/feedback";
import { AccountPicker } from "@/components/account-picker";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Member {
  id: string; memberId: string; username: string | null; email: string; memberType?: string;
  firstName: string; lastName?: string; phone?: string; bio?: string;
  memberRoles: string[]; isActive: boolean;
  payRate?: number | null; payRateType?: string | null;
  roleRates?: { roleId: string; rate: number; rateType: string; withSetup?: number; workType?: string; label?: string; note?: string }[];
  setup?: { id: string; category: string; name: string; rent: number; rentUnit: string }[];
  createdAt: string; adminNotes?: string;
}

interface ProgramEntry {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; status: string; currency: string;
  role: string; totalBill: number; paid?: number; due?: number; note: string; clientName: string;
}

interface UpcomingDay {
  bookingId: string; bookingNumber: string; eventName?: string; clientName: string;
  date: string; location?: string; work: string[];
}

interface SalarySlip {
  id: string; month: number; year: number;
  baseSalary: string; deductions: string; netSalary: string;
  notes?: string; status: string; paidAt?: string;
}

interface ProfileData {
  member: Member;
  upcoming?: UpcomingDay[];
  stats: { totalPrograms: number; thisMonthPrograms: number; lifetimeEarned: number; totalPaid: number; pendingAmount: number };
  programs: ProgramEntry[];
  salarySlips: SalarySlip[];
}

const ROLES: Record<string, { label: string; icon: React.ElementType; tile: TileColor }> = {
  photographer:    { label: "Photographer",    icon: Camera,     tile: "blue" },
  cinematographer: { label: "Cinematographer", icon: Video,      tile: "deep" },
  photo_editor:    { label: "Photo Editor",    icon: Image,      tile: "green" },
  video_editor:    { label: "Video Editor",    icon: Film,       tile: "orchid" },
  drone_pilot:     { label: "Drone Pilot",     icon: Navigation, tile: "teal" },
  assistant:       { label: "Assistant",       icon: Briefcase,  tile: "ink" },
};
const role = (id: string) => ROLES[id] ?? { label: id.replace(/_/g, " "), icon: Tag, tile: "violet" as TileColor };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Pay a member (split over the programs they are owed for) ───────────────
type Due = { id: string; bookingNumber: string; eventName: string | null; date: string; bill: number; paid: number; due: number };
const PAY_METHODS = [{ v: "cash", l: "Cash" }, { v: "mobile_banking", l: "bKash / Nagad" }, { v: "bank_transfer", l: "Bank" }, { v: "other", l: "Other" }];
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Oldest program first; anything over the total goes on the last one (same rule as the API). */
function autoSplit(progs: Due[], amount: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = r2(amount);
  for (const p of progs) { if (left <= 0) break; const t = r2(Math.min(left, p.due)); if (t > 0) { out[p.id] = t; left = r2(left - t); } }
  if (left > 0 && progs.length) { const last = progs[progs.length - 1].id; out[last] = r2((out[last] ?? 0) + left); }
  return out;
}

function PayDrawer({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const [dues, setDues] = useState<Due[] | null>(null);
  const [amount, setAmount] = useState("");
  const [split, setSplit] = useState<Record<string, number>>({});
  const [custom, setCustom] = useState(false);
  const [method, setMethod] = useState("cash");
  const [walletId, setWalletId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`${API}/team/${member.id}/dues`).then(r => r.ok ? r.json() : null).then(d => {
      const list: Due[] = d?.programs ?? [];
      setDues(list);
      const total = Number(d?.totalDue ?? 0);
      if (total > 0) { setAmount(String(total)); setSplit(autoSplit(list, total)); }
    }).catch(() => setDues([]));
  }, [member.id]);

  const total = r2((dues ?? []).reduce((s, p) => s + p.due, 0));
  const amt = parseFloat(amount) || 0;
  const splitSum = r2(Object.values(split).reduce((s, v) => s + (v || 0), 0));
  const setAmountAuto = (v: string) => { setAmount(v); if (!custom && dues) setSplit(autoSplit(dues, parseFloat(v) || 0)); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(amt > 0)) { setError("Write how much you are paying."); return; }
    if (!walletId) { setError("Pick the account the money was paid from."); return; }
    if (!dues?.length) { setError("Nothing is owed on any program. Pay from the program instead."); return; }
    if (Math.abs(splitSum - amt) > 0.009) { setError(`The programs add up to ${formatCurrency(splitSum)}, not ${formatCurrency(amt)}.`); return; }
    const over = amt > total + 0.009 || (dues ?? []).some(p => (split[p.id] ?? 0) > p.due + 0.009);
    if (over && !(await askConfirm({
      title: "Pay more than owed?",
      message: `${member.firstName} is owed ${formatCurrency(total)} in all. You are paying ${formatCurrency(Math.max(0, amt - total))} extra — it is added to the last program.`,
      confirmLabel: "Pay anyway", cancelLabel: "Go back",
    }))) return;
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/team/${member.id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt, walletId, method, date, note: note.trim() || undefined, allowOver: over || undefined,
          split: Object.entries(split).filter(([, v]) => v > 0).map(([bookingId, v]) => ({ bookingId, amount: v })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save. Please try again."); return; }
      notify(`Paid ${formatCurrency(amt)} to ${member.firstName}`); onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <FormDrawer open onTop onClose={onClose} icon={HandCoins} color="green" title={`Pay ${member.firstName}`}
      sub={dues === null ? "Loading…" : total > 0 ? `Owed now: ${formatCurrency(total)}` : "Nothing owed right now"}
      footer={<>
        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F] hover:bg-[#E4E0EC]">Cancel</button>
        <button type="submit" form="pay-form" disabled={saving || !dues}
          className="flex-[1.4] h-12 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Save payment
        </button>
      </>}>
      <form id="pay-form" onSubmit={submit} noValidate>
        {error && <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{error}</div>}
        <FormGroup title="Payment">
          <Field label="Amount" required>
            {id => (
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{currencySymbol().trim()}</span>
                  <input style={{ paddingLeft: currencyPad() }} id={id} type="number" inputMode="numeric" min="0" step="100" autoFocus value={amount}
                    onChange={e => setAmountAuto(e.target.value)} placeholder="0"
                    className={cn(inputCls, "pl-8 h-12 text-lg font-bold tabular-nums", amt > total && total >= 0 && dues && "ring-2 ring-[#F2B04B]")} />
                </div>
                {dues && amt > total + 0.009 && (
                  <p role="alert" className="mt-2 text-[12px] font-medium text-[#823072] bg-[#FBF2FA] rounded-xl px-3 py-2">
                    More than owed — {formatCurrency(amt - total)} extra. You&apos;ll be asked to confirm.
                  </p>
                )}
              </div>
            )}
          </Field>
          <Field label="Paid by">{() => (
            <div className="flex flex-wrap gap-1.5">
              {PAY_METHODS.map(o => <button key={o.v} type="button" onClick={() => setMethod(o.v)}
                className={cn("h-9 px-3 rounded-full text-[12px] font-semibold", method === o.v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{o.l}</button>)}
            </div>
          )}</Field>
          <div className="px-4 py-3"><AccountPicker label="Paid from" value={walletId} method={method} payOut={amt} onChange={setWalletId} /></div>
          <Field label="Date">{id => <input id={id} type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />}</Field>
          <Field label="Note">{id => <input id={id} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. transaction ID" className={inputCls} />}</Field>
        </FormGroup>

        {dues && dues.length > 0 && (
          <FormGroup title="Goes to these programs" note={custom ? "Change how much each program gets." : "Oldest program first."}>
            {dues.map(p => {
              const v = split[p.id] ?? 0;
              return (
                <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#17151F] truncate">{p.eventName || p.bookingNumber}</p>
                    <p className="text-xs text-[#6B6680] tabular-nums">{p.bookingNumber} · {fmtDate(p.date)} · owed {formatCurrency(p.due)}</p>
                  </div>
                  {custom ? (
                    <input type="number" min="0" aria-label={`Amount for ${p.bookingNumber}`} value={v || ""}
                      onChange={e => setSplit(sp => ({ ...sp, [p.id]: r2(parseFloat(e.target.value) || 0) }))}
                      className="w-28 h-9 px-2 rounded-lg border border-[#E6E2EE] text-sm text-right tabular-nums" />
                  ) : (
                    <span className={cn("text-sm font-bold tabular-nums", v >= p.due && v > 0 ? "text-[#1F8A5B]" : v > 0 ? "text-[#823072]" : "text-[#A29DB3]")}>
                      {v > 0 ? formatCurrency(v) : "—"}
                    </span>
                  )}
                </div>
              );
            })}
            <div className="px-4 py-2.5 flex items-center justify-between text-xs">
              <button type="button" onClick={() => { if (custom && dues) setSplit(autoSplit(dues, amt)); setCustom(c => !c); }} className="font-semibold text-[#5B3FD0]">
                {custom ? "Split by itself again" : "Choose amounts myself"}
              </button>
              <span className={cn("font-semibold tabular-nums", Math.abs(splitSum - amt) > 0.009 ? "text-[#C2304F]" : "text-[#6B6680]")}>Total {formatCurrency(splitSum)}</span>
            </div>
          </FormGroup>
        )}
      </form>
    </FormDrawer>
  );
}

type MemberPayment = { id: string; date: string; amount: number; account: string | null; method: string; note?: string; fromProfile: boolean; parts: { bookingId: string; bookingNumber: string; eventName: string | null; amount: number }[] };

// ─── Profile ──────────────────────────────────────────────────────────────────
export function ProfileDrawer({ member, onClose, onEdit, onReset, onToggle, customRoles }: {
  member: Member | null;
  onClose: () => void;
  onEdit: (m: Member) => void;
  onReset: (m: Member) => void;
  onToggle: (m: Member) => void;
  customRoles: string[];
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [pays, setPays] = useState<MemberPayment[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [notesState, setNotesState] = useState<"" | "saving" | "saved">("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  void customRoles;

  const fetchProfile = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/team/${member.id}/profile`);
      if (r.ok) { const d = await r.json(); setData(d); setNotes(d.member.adminNotes ?? ""); }
      const p = await apiFetch(`${API}/team/${member.id}/payments`);
      if (p.ok) setPays(await p.json());
    } finally { setLoading(false); }
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!member) { setData(null); return; }
    setShowAllPrograms(false); setMoreOpen(false);
    fetchProfile();
    apiFetch(`${API}/companies/settings`).then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d?.workTypes)) setTypeNames(Object.fromEntries(d.workTypes.map((w: { id: string; name: string }) => [w.id, w.name])));
    }).catch(() => {});
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveNotes(value: string) {
    if (!member) return;
    setNotesState("saving");
    try {
      await apiFetch(`${API}/team/${member.id}/admin-notes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: value }),
      });
      setNotesState("saved");
    } catch { setNotesState(""); }
  }
  function onNotes(v: string) {
    setNotes(v); setNotesState("");
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => saveNotes(v), 1000);
  }

  if (!member) return null;

  const m = data?.member ?? member;
  const name = `${m.firstName} ${m.lastName ?? ""}`.trim();
  const freelancer = m.memberType === "freelancer";
  const main = role(m.memberRoles[0] ?? "");
  const stats = data?.stats;
  const programs = data?.programs ?? [];
  const slips = data?.salarySlips ?? [];
  const upcoming = data?.upcoming ?? [];
  const owed = stats?.pendingAmount ?? 0;
  const realEmail = m.email && !m.email.includes(".internal") ? m.email : "";
  const rates = (m.roleRates ?? []).filter(r => r.rate || r.withSetup);
  const shownPrograms = showAllPrograms ? programs : programs.slice(0, 5);

  return (
    <ProfileShell open onClose={onClose} label={freelancer ? "Freelancer" : "Team member"}>
      <IdentityCard
        avatar={<Avatar name={name} color={TILE[main.tile]} />}
        name={name}
        sub={<>{m.memberId}{freelancer ? " · no login" : m.username ? ` · @${m.username}` : ""}{m.phone ? ` · ${m.phone}` : ""}</>}
        chips={<>
          {freelancer && <span className="h-6 px-2.5 rounded-full bg-[#FBF2FA] text-[#9E3A8C] text-xs font-bold inline-flex items-center">Freelancer</span>}
          {!m.isActive && <span className="h-6 px-2.5 rounded-full bg-[#EEEDF2] text-[#4A4658] text-xs font-bold inline-flex items-center">Inactive</span>}
          {m.memberRoles.map(r => {
            const rc = role(r); const Icon = rc.icon;
            return <span key={r} className="h-6 pl-1 pr-2.5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-xs font-semibold inline-flex items-center gap-1.5"><Tile icon={Icon} color={rc.tile} size={18} />{rc.label}</span>;
          })}
        </>}
        actions={<>
          <ActionButton icon={MessageCircle} label="WhatsApp" tone="green" href={waLink(m.phone)} disabled={!m.phone} />
          <ActionButton icon={Phone} label="Call" tone="blue" href={m.phone ? `tel:${m.phone}` : undefined} disabled={!m.phone} />
          <ActionButton icon={HandCoins} label="Pay" tone="violet" onClick={() => setPayOpen(true)} />
          <div className="relative">
            <ActionButton icon={MoreHorizontal} label="More" tone="ink" onClick={() => setMoreOpen(o => !o)} />
            {moreOpen && (
              <div role="menu" className="absolute right-0 top-[72px] w-52 bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1">
                <button role="menuitem" onClick={() => { setMoreOpen(false); onEdit(m); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><Edit3 className="w-4 h-4 text-[#6B6680]" />Edit details</button>
                {!freelancer && <button role="menuitem" onClick={() => { setMoreOpen(false); onReset(m); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><KeyRound className="w-4 h-4 text-[#6B6680]" />Reset password</button>}
                <button role="menuitem" onClick={() => { setMoreOpen(false); onToggle(m); }} className={cn("w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm hover:bg-[#F5F3FA]", m.isActive ? "text-[#C2304F]" : "text-[#1F8A5B]")}>
                  {m.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}{m.isActive ? "Make inactive" : "Make active"}
                </button>
              </div>
            )}
          </div>
        </>}
      />

      {loading && !data ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-7">
            <MiniStat icon={Wallet} color="red" label="Owed now" value={formatCurrency(owed)} tone={owed > 0 ? "red" : undefined} sub={owed > 0 ? "Tap Pay to settle" : "All settled"} />
            <MiniStat icon={CheckCircle2} color="green" label="Paid so far" value={formatCurrency(stats?.totalPaid ?? 0)} sub={`of ${formatCurrency(stats?.lifetimeEarned ?? 0)} earned`} />
            <MiniStat icon={CalendarDays} color="blue" label="This month" value={`${stats?.thisMonthPrograms ?? 0} program${stats?.thisMonthPrograms === 1 ? "" : "s"}`} sub={`${stats?.totalPrograms ?? 0} in total`} />
            <MiniStat icon={TrendingUp} color="violet" label="Next work" value={upcoming[0] ? fmtDate(upcoming[0].date) : "—"} sub={upcoming[0]?.eventName ?? "Nothing booked"} />
          </div>

          <Group title="Coming up" note={upcoming.length ? undefined : "No upcoming work. Add them to a program's shift and it shows here."}>
            {upcoming.length === 0 ? <InfoRow left={<span className="text-[#A29DB3]">Nothing booked yet</span>} /> : upcoming.slice(0, 6).map((u, i) => (
              <div key={`${u.bookingId}-${u.date}-${i}`} className="flex items-center gap-3 px-4 py-3">
                <DateBox date={u.date} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#17151F] truncate">{u.eventName || u.bookingNumber}</p>
                  <p className="text-xs text-[#6B6680] truncate mt-0.5">{u.work.join(", ")}{u.location ? <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {u.location}</> : null}</p>
                  <p className="text-xs text-[#9893A8] truncate">{u.clientName}</p>
                </div>
              </div>
            ))}
          </Group>

          <Group title="Programs & pay" note={programs.length ? "Bill and paid come from each program's team payments." : undefined}
            action={programs.length > 5 ? <button type="button" onClick={() => setShowAllPrograms(v => !v)} className="text-[13px] font-semibold text-[#5B3FD0]">{showAllPrograms ? "Show less" : `See all ${programs.length}`}</button> : undefined}>
            {programs.length === 0 ? <InfoRow left={<span className="text-[#A29DB3]">No programs yet</span>} /> : shownPrograms.map(p => {
              const sc = STATUS_CFG[p.status];
              const due = p.due ?? 0;
              return (
                <InfoRow key={p.id}
                  left={p.eventName || p.bookingNumber}
                  sub={<>{fmtDate(p.eventDate)} · {p.clientName}{p.role ? ` · ${p.role.split(", ").map(r => role(r).label).join(", ")}` : ""}{sc ? ` · ${sc.label}` : ""}</>}
                  right={<>
                    <p className="text-[15px] font-bold text-[#17151F] tabular-nums">{formatCurrency(p.totalBill, p.currency)}</p>
                    {p.totalBill > 0 && (due > 0
                      ? <p className="text-xs font-semibold text-[#C2304F] tabular-nums">{formatCurrency(due, p.currency)} due</p>
                      : <p className="text-xs font-semibold text-[#1F8A5B]">Paid</p>)}
                  </>} />
              );
            })}
          </Group>

          <Group title="Payments" action={<button type="button" onClick={() => setPayOpen(true)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5B3FD0]"><Plus className="w-3.5 h-3.5" />Pay</button>}>
            {pays.length === 0 ? <InfoRow left={<span className="text-[#A29DB3]">No payments yet</span>} /> : pays.map(p => (
              <div key={p.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#17151F]">{fmtDate(p.date)}{p.account ? <span className="font-normal text-[#6B6680]"> · {p.account}</span> : null}</p>
                  <p className="text-xs text-[#6B6680] truncate">
                    {p.parts.length === 1 ? (p.parts[0].eventName || p.parts[0].bookingNumber) : `${p.parts.length} programs: ${p.parts.map(x => x.bookingNumber).join(", ")}`}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <p className="text-[15px] font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(p.amount)}</p>
                <button type="button" aria-label="Remove this payment" disabled={removing === p.id}
                  onClick={async () => {
                    if (!(await askConfirm({ title: "Remove this payment?", message: `${formatCurrency(p.amount)} will be taken off ${p.parts.length === 1 ? "the program" : `${p.parts.length} programs`} and put back in ${p.account ?? "the account"}.`, confirmLabel: "Remove", danger: true }))) return;
                    setRemoving(p.id);
                    try {
                      const r = await apiFetch(`${API}/team/${m.id}/payments/${encodeURIComponent(p.id)}`, { method: "DELETE" });
                      if (r.ok) { notify("Payment removed"); fetchProfile(); } else notify("Couldn't remove it", { error: true });
                    } finally { setRemoving(null); }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#A29DB3] hover:text-[#C2304F] hover:bg-[#FDECEF]">
                  {removing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </Group>

          {slips.length > 0 && (
            <Group title="Monthly salary" note="From the Salary page.">
              {slips.map(s => (
                <InfoRow key={s.id}
                  left={`${MONTHS[s.month - 1]} ${s.year}`}
                  sub={[s.paidAt ? `Paid ${fmtDate(s.paidAt)}` : s.status, s.notes, Number(s.deductions) > 0 ? `−${formatCurrency(Number(s.deductions))} cut` : null].filter(Boolean).join(" · ")}
                  right={<p className="text-[15px] font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(Number(s.netSalary))}</p>} />
              ))}
            </Group>
          )}

          <Group title="Prices" action={<button type="button" onClick={() => onEdit(m)} className="text-[13px] font-semibold text-[#5B3FD0]">Edit</button>}>
            {m.payRateType === "monthly" && m.payRate ? (
              <InfoRow left="Monthly salary" right={<p className="text-[15px] font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(m.payRate))}<span className="text-xs font-medium text-[#6B6680]"> / month</span></p>} />
            ) : null}
            {rates.length === 0 && !(m.payRateType === "monthly" && m.payRate)
              ? <InfoRow left={<span className="text-[#A29DB3]">No prices set</span>} />
              : rates.map((r, i) => {
                const rc = role(r.roleId); const Icon = rc.icon;
                return (
                  <div key={`${r.roleId}-${r.rateType}-${r.workType ?? ""}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <Tile icon={Icon} color={rc.tile} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-[#17151F] truncate">{rc.label}</p>
                      <p className="text-xs text-[#6B6680] truncate">{unitLabel(r.roleId, r.rateType, r.label)}{r.workType ? ` · ${typeNames[r.workType] ?? r.workType}` : " · All programs"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {r.rate ? <p className="text-[15px] font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(r.rate))}<span className="text-[11px] font-medium text-[#6B6680]">{r.withSetup != null ? " work only" : ""}</span></p> : null}
                      {r.withSetup != null && <p className="text-xs font-semibold text-[#5B3FD0] tabular-nums">{formatCurrency(Number(r.withSetup))} with setup</p>}
                    </div>
                  </div>
                );
              })}
          </Group>

          <Group title="Own setup" action={<button type="button" onClick={() => onEdit(m)} className="text-[13px] font-semibold text-[#5B3FD0]">Edit</button>}
            note={(m.setup?.length ?? 0) > 0 ? "Rent goes to them when someone else works with this gear." : undefined}>
            {(m.setup?.length ?? 0) === 0 ? <InfoRow left={<span className="text-[#A29DB3]">No gear added</span>} /> : m.setup!.map(g => {
              const cat = SETUP_CATS.find(c => c.v === g.category) ?? SETUP_CATS[SETUP_CATS.length - 1];
              return (
                <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                  <Tile icon={cat.icon} color={cat.tile} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[#17151F] truncate">{g.name}</p>
                    <p className="text-xs text-[#6B6680]">{cat.l}</p>
                  </div>
                  <p className="text-[15px] font-bold text-[#17151F] tabular-nums flex-shrink-0">{formatCurrency(Number(g.rent))}<span className="text-xs font-medium text-[#6B6680]"> / {g.rentUnit === "per_program" ? "program" : g.rentUnit === "per_day" ? "day" : "shift"}</span></p>
                </div>
              );
            })}
          </Group>

          <Group title="Details">
            {m.phone && <InfoRow left={m.phone} sub="Phone / WhatsApp" />}
            {realEmail && <InfoRow left={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[#6B6680]" />{realEmail}</span>} sub="Gets program reminder emails" />}
            <InfoRow left={fmtDate(m.createdAt)} sub="Joined" />
            {m.bio && <InfoRow left={<span className="whitespace-normal">{m.bio}</span>} sub="Note" />}
          </Group>

          <Group title="Private notes" note="Only you and managers see these. Saved as you type."
            action={notesState === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B6680]" /> : notesState === "saved" ? <span className="text-xs font-semibold text-[#1F8A5B]">Saved</span> : undefined}>
            <div className="p-3">
              <textarea value={notes} onChange={e => onNotes(e.target.value)} rows={3} aria-label="Private notes"
                placeholder="Attendance, behaviour, special arrangements…" className={inputCls + " h-auto py-2.5 resize-none"} />
            </div>
          </Group>
        </>
      )}

      {payOpen && <PayDrawer member={m} onClose={() => setPayOpen(false)} onSaved={fetchProfile} />}
    </ProfileShell>
  );
}
