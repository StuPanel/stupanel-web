"use client";
/**
 * One referrer's referral pay: totals, their own rate, programs (what each earns and when it can be paid),
 * Pay (split oldest first, like team pay) and earlier payments with Undo.
 * Data: GET /referrers/:id, PATCH /referrers/:id/rate, POST/DELETE /referrers/:id/payouts.
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, HandCoins, Loader2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { currencyPad, currencySymbol, fmtDate, formatCurrency, localDateStr } from "@/lib/format";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { AccountPicker } from "@/components/account-picker";
import { askConfirm, notify } from "@/components/feedback";
import type { ReferrerKind } from "@/components/ui/referrer-picker";
import { jumpToField } from "@/lib/jump-to-field";

type RateType = "percent" | "fixed";
type Rate = { type: RateType; value: number; from: "program" | "person" | "studio" };
type Program = { id: string; number: string; name: string; date: string | null; status: string; total: number; rate: Rate; earned: number; paid: number; owed: number; waiting: number; ready: boolean };
type Payout = { id: string; date: string; amount: number; account: string | null; method: string; note: string | null; parts: { bookingId: string; bookingNumber: string; eventName: string | null; amount: number }[] };
type Detail = {
  id: string; kind: ReferrerKind; name: string; phone?: string | null; rateType: RateType | null; rateValue: number | null;
  studioRate: { type: RateType; value: number }; pay: boolean;
  earned: number; paid: number; owed: number; waiting: number; programs: Program[]; payouts: Payout[];
};

const METHODS = [{ v: "cash", l: "Cash" }, { v: "mobile_banking", l: "Mobile wallet" }, { v: "bank_transfer", l: "Bank" }, { v: "other", l: "Other" }];
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHODS.map(m => [m.v, m.l]));
export const rateLabel = (t: RateType, v: number) => (Number(v) === 0 ? "No referral pay" : t === "percent" ? `${v}% of profit` : `${formatCurrency(v)} per program`);
const errText = (d: { message?: string | string[] }) => (Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save. Please try again.";

export function ReferralPayDrawer({ referrerId, onClose, onChanged }: { referrerId: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  // Own rate
  const [ownRate, setOwnRate] = useState(false);
  const [rType, setRType] = useState<RateType>("percent");
  const [rValue, setRValue] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  // Pay
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [walletId, setWalletId] = useState("");
  const [date, setDate] = useState(() => localDateStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/referrers/${referrerId}`).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    const x: Detail = await r.json();
    setD(x);
    setOwnRate(!!x.rateType);
    setRType(x.rateType ?? x.studioRate.type);
    setRValue(String(x.rateValue ?? x.studioRate.value));
    setAmount(x.owed > 0 ? String(x.owed) : "");
  }, [referrerId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function saveRate(own: boolean) {
    if (!d) return;
    const v = parseFloat(rValue);
    if (own && (!(v >= 0) || (rType === "percent" && v > 100))) { notify(rType === "percent" ? "Write a percent from 0 to 100." : "Write the amount."); return; }
    setSavingRate(true);
    try {
      const r = await apiFetch(`${API}/referrers/${d.id}/rate`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(own ? { rateType: rType, rateValue: v } : { rateType: null, rateValue: null }),
      });
      if (!r.ok) { notify(errText(await r.json().catch(() => ({})))); return; }
      notify(own ? `${d.name}: ${rateLabel(rType, v)}` : `${d.name} uses the studio's referral pay`);
      await load(); onChanged();
    } finally { setSavingRate(false); }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    const amt = parseFloat(amount) || 0;
    if (!(amt > 0)) { setError("Write how much you are paying."); jumpToField("ref-amount"); return; }
    if (amt > d.owed + 0.009) { setError(`Only ${formatCurrency(d.owed)} can be paid now.`); jumpToField("ref-amount"); return; }
    if (!walletId) { setError("Pick the account the money was paid from."); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/referrers/${d.id}/payouts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, walletId, method, date, note: note.trim() || undefined }),
      });
      if (!r.ok) { setError(errText(await r.json().catch(() => ({})))); return; }
      notify(`Paid ${formatCurrency(amt)} to ${d.name}`);
      setNote("");
      await load(); onChanged();
    } finally { setSaving(false); }
  }

  async function undo(p: Payout) {
    if (!d) return;
    if (!(await askConfirm({ title: "Undo this payment?", message: `${formatCurrency(p.amount)} paid on ${fmtDate(p.date)} is removed from ${d.name}'s referral pay and from Accounts.`, confirmLabel: "Undo payment", cancelLabel: "Keep it", danger: true }))) return;
    const r = await apiFetch(`${API}/referrers/${d.id}/payouts/${p.id}`, { method: "DELETE" });
    if (!r.ok) { notify(errText(await r.json().catch(() => ({})))); return; }
    notify("Payment removed");
    await load(); onChanged();
  }

  const amt = parseFloat(amount) || 0;
  return (
    <FormDrawer open onClose={onClose} icon={HandCoins} color="green" title={d ? `Referral pay · ${d.name}` : "Referral pay"}
      sub={!d ? (failed ? "Couldn't load" : "Loading…") : d.owed > 0 ? `Can pay now: ${formatCurrency(d.owed)}` : "Nothing to pay right now"}
      footer={<>
        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F] hover:bg-[#E4E0EC]">Close</button>
        {d && d.owed > 0 && (
          <button type="submit" form="ref-pay-form" disabled={saving}
            className="flex-[1.4] h-12 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Save payment
          </button>
        )}
      </>}>
      {!d ? (
        <div className="py-16 flex justify-center">{failed ? <p className="text-sm text-[#6B6680]">Couldn&apos;t load. Close and try again.</p> : <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" />}</div>
      ) : (
        <form id="ref-pay-form" onSubmit={pay} noValidate>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {[
              { k: "Earned", v: d.earned, tone: "text-[#17151F]" },
              { k: "Paid", v: d.paid, tone: "text-[#17151F]" },
              { k: "Can pay now", v: d.owed, tone: "text-[#1F8A5B]" },
              { k: "Waiting", v: d.waiting, tone: "text-[#9A5B00]", hint: "Program not Completed or not fully paid yet" },
            ].map(x => (
              <div key={x.k} className="rounded-[16px] bg-white px-3.5 py-3">
                <p className="text-[12px] font-semibold text-[#6B6680]">{x.k}</p>
                <p className={cn("text-[18px] font-bold tabular-nums", x.tone)}>{formatCurrency(x.v)}</p>
                {x.hint && <p className="text-[11px] text-[#8A859A] leading-tight mt-0.5">{x.hint}</p>}
              </div>
            ))}
          </div>

          {error && <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{error}</div>}

          {d.owed > 0 && (
            <FormGroup title="Pay now" note="Goes to the oldest programs first.">
              <Field label="Amount" required name="ref-amount">
                {id => (
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{currencySymbol().trim()}</span>
                    <input style={{ paddingLeft: currencyPad() }} id={id} type="number" inputMode="numeric" min="0" value={amount}
                      onChange={e => setAmount(e.target.value)} className={cn(inputCls, "h-12 text-lg font-bold tabular-nums", amt > d.owed + 0.009 && "ring-2 ring-[#F2B04B]")} />
                  </div>
                )}
              </Field>
              <Field label="Paid by">{() => (
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map(o => <button key={o.v} type="button" onClick={() => setMethod(o.v)} aria-pressed={method === o.v}
                    className={cn("h-9 px-3 rounded-full text-[12px] font-semibold", method === o.v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{o.l}</button>)}
                </div>
              )}</Field>
              <div className="px-4 py-3"><AccountPicker label="Paid from" value={walletId} method={method} payOut={amt} onChange={setWalletId} /></div>
              <Field label="Date">{id => <input id={id} type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />}</Field>
              <Field label="Note">{id => <input id={id} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. transaction ID" className={inputCls} />}</Field>
            </FormGroup>
          )}

          <FormGroup title="Referral pay for this person" note={ownRate ? "Used on this person's programs unless a program has its own." : `Uses the studio's: ${rateLabel(d.studioRate.type, d.studioRate.value)}. Change it in Settings → Referrals.`}>
            <div className="px-4 py-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { if (ownRate && d.rateType) saveRate(false); else setOwnRate(o => !o); }}
                className={cn("h-9 px-3.5 rounded-full text-[12.5px] font-semibold", !ownRate ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")} aria-pressed={!ownRate}>Studio&apos;s</button>
              <button type="button" onClick={() => setOwnRate(true)} aria-pressed={ownRate}
                className={cn("h-9 px-3.5 rounded-full text-[12.5px] font-semibold", ownRate ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>Own rate</button>
            </div>
            {ownRate && (
              <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                <select aria-label="Kind of referral pay" value={rType} onChange={e => setRType(e.target.value as RateType)} className={cn(inputCls, "w-auto")}>
                  <option value="percent">% of profit</option>
                  <option value="fixed">Fixed amount</option>
                </select>
                <input aria-label={rType === "percent" ? "Percent of profit" : "Amount per program"} type="number" min="0" max={rType === "percent" ? 100 : undefined}
                  value={rValue} onChange={e => setRValue(e.target.value)} className={cn(inputCls, "w-28 tabular-nums")} />
                <button type="button" onClick={() => saveRate(true)} disabled={savingRate}
                  className="h-10 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
                  {savingRate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Save rate
                </button>
              </div>
            )}
          </FormGroup>

          <FormGroup title={`Programs (${d.programs.length})`}>
            {d.programs.length === 0 ? <p className="px-4 py-3 text-sm text-[#6B6680]">No programs yet.</p> : d.programs.map(p => {
              const off = p.status === "cancelled" || p.status === "refunded";
              return (
                <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", off ? "text-[#9A95AC] line-through" : "text-[#17151F]")}>{p.name}</p>
                    <p className="text-xs text-[#6B6680] truncate">{p.number}{p.date ? ` · ${fmtDate(p.date)}` : ""} · {rateLabel(p.rate.type, p.rate.value)}{p.rate.from === "program" ? " (this program)" : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums text-[#17151F]">{formatCurrency(p.earned)}</p>
                    <p className={cn("text-[11.5px] font-semibold", p.owed > 0 ? "text-[#1F8A5B]" : p.waiting > 0 ? "text-[#9A5B00]" : "text-[#8A859A]")}>
                      {off ? "Cancelled" : p.owed > 0 ? `${formatCurrency(p.owed)} to pay` : p.waiting > 0 ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Waiting</span> : p.earned > 0 ? "Paid" : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </FormGroup>

          {d.payouts.length > 0 && (
            <FormGroup title="Paid before">
              {d.payouts.map(p => (
                <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#17151F] tabular-nums">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-[#6B6680] truncate">{fmtDate(p.date)} · {METHOD_LABEL[p.method] ?? p.method}{p.account ? ` · ${p.account}` : ""} · {p.parts.map(x => x.bookingNumber).join(", ")}{p.note ? ` · ${p.note}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => undo(p)} className="h-9 px-3 rounded-full bg-[#F5F3FA] text-[12px] font-semibold text-[#4A4658] hover:bg-[#EEEBF4] inline-flex items-center gap-1">
                    <Undo2 className="w-3.5 h-3.5" />Undo
                  </button>
                </div>
              ))}
            </FormGroup>
          )}
        </form>
      )}
    </FormDrawer>
  );
}
