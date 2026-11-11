"use client";

import { useState, useEffect } from "react";
import { Loader2, Camera, Video, Image, Film, Navigation, Briefcase, Tag, CheckCircle2, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate, currencySymbol, currencyPad } from "@/lib/format";
import { type TileColor } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { askConfirm, notify } from "@/components/feedback";
import { AccountPicker } from "@/components/account-picker";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface Member {
  id: string; memberId: string; username: string | null; email: string; memberType?: string;
  firstName: string; lastName?: string; phone?: string; bio?: string;
  memberRoles: string[]; isActive: boolean;
  payRate?: number | null; payRateType?: string | null;
  roleRates?: { roleId: string; rate: number; rateType: string; withSetup?: number; workType?: string; label?: string; note?: string }[];
  setup?: { id: string; category: string; name: string; rent: number; rentUnit: string }[];
  createdAt: string; adminNotes?: string;
}

export interface ProgramEntry {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; status: string; currency: string;
  role: string; totalBill: number; paid?: number; due?: number; note: string; clientName: string;
}

export interface UpcomingDay {
  bookingId: string; bookingNumber: string; eventName?: string; clientName: string;
  date: string; location?: string; work: string[];
}

export interface SalarySlip {
  id: string; month: number; year: number;
  baseSalary: string; deductions: string; netSalary: string;
  notes?: string; status: string; paidAt?: string;
}

export interface ProfileData {
  member: Member;
  upcoming?: UpcomingDay[];
  stats: { totalPrograms: number; thisMonthPrograms: number; lifetimeEarned: number; totalPaid: number; pendingAmount: number };
  programs: ProgramEntry[];
  salarySlips: SalarySlip[];
}

export const ROLES: Record<string, { label: string; icon: React.ElementType; tile: TileColor }> = {
  photographer:    { label: "Photographer",    icon: Camera,     tile: "blue" },
  cinematographer: { label: "Cinematographer", icon: Video,      tile: "deep" },
  photo_editor:    { label: "Photo Editor",    icon: Image,      tile: "green" },
  video_editor:    { label: "Video Editor",    icon: Film,       tile: "orchid" },
  drone_pilot:     { label: "Drone Pilot",     icon: Navigation, tile: "teal" },
  assistant:       { label: "Assistant",       icon: Briefcase,  tile: "ink" },
};
export const role = (id: string) => ROLES[id] ?? { label: id.replace(/_/g, " "), icon: Tag, tile: "violet" as TileColor };
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Pay a member (split over the programs they are owed for) ───────────────
type Due = { id: string; bookingNumber: string; eventName: string | null; date: string; bill: number; paid: number; due: number };
const PAY_METHODS = [{ v: "cash", l: "Cash" }, { v: "mobile_banking", l: "Mobile wallet" }, { v: "bank_transfer", l: "Bank" }, { v: "other", l: "Other" }];
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Oldest program first; anything over the total goes on the last one (same rule as the API). */
function autoSplit(progs: Due[], amount: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = r2(amount);
  for (const p of progs) { if (left <= 0) break; const t = r2(Math.min(left, p.due)); if (t > 0) { out[p.id] = t; left = r2(left - t); } }
  if (left > 0 && progs.length) { const last = progs[progs.length - 1].id; out[last] = r2((out[last] ?? 0) + left); }
  return out;
}

export function PayDrawer({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
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

export type MemberPayment = { id: string; date: string; amount: number; account: string | null; method: string; note?: string; fromProfile: boolean; parts: { bookingId: string; bookingNumber: string; eventName: string | null; amount: number }[] };
