"use client";

/**
 * Member panel: what the member tells the studio about themselves —
 * days they can't work, how they want to be paid, and asking for a rate change.
 */
import { useState } from "react";
import { CalendarOff, Check, Clock, Loader2, MessageSquareText, Plus, Trash2, Wallet, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { Field, FormDrawer, inputCls } from "@/components/ui/form-kit";
import { Chip, Empty, List, Row, Section, card, linkBtn, softBtn } from "@/components/ui/profile-page";
import {
  PAYOUT_METHODS, dayRange, payoutLabel, todayStr,
  type DayOff, type MemberPrefs, type Payout, type PayoutMethod,
} from "@/lib/member-prefs";

async function send(path: string, method: string, body?: unknown): Promise<MemberPrefs | null> {
  try {
    const r = await apiFetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(Array.isArray(d?.message) ? d.message[0] : d?.message || "Couldn't save", { error: true }); return null; }
    return d as MemberPrefs;
  } catch { notify("Couldn't save — check your internet", { error: true }); return null; }
}

// ─── Days I can't work ──────────────────────────────────────────────────────
export function DaysOffSection({ prefs, onChange }: { prefs: MemberPrefs; onChange: (p: MemberPrefs) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayStr();
  const list = prefs.daysOff.filter(d => d.to >= today);

  function start() { setFrom(""); setTo(""); setNote(""); setOpen(true); }

  async function add() {
    if (!from) { notify("Choose the day", { error: true }); return; }
    if (to && to < from) { notify("The last day can't be before the first day", { error: true }); return; }
    setBusy(true);
    const next = await send("/member/days-off", "PATCH", { items: [...prefs.daysOff, { from, to: to || from, note: note.trim() || undefined }] });
    setBusy(false);
    if (next) { onChange(next); setOpen(false); notify("Saved — the studio will see it"); }
  }
  async function remove(d: DayOff) {
    if (!(await askConfirm({ title: "Remove this day off?", message: `${dayRange(d)} — the studio can give you work on this day again.`, confirmLabel: "Remove" }))) return;
    const next = await send("/member/days-off", "PATCH", { items: prefs.daysOff.filter(x => x.id !== d.id) });
    if (next) onChange(next);
  }

  return (
    <Section title="Days I can't work" action={list.length > 0 ? <button type="button" onClick={start} className={linkBtn}><Plus className="w-3.5 h-3.5" />Add</button> : undefined}>
      {list.length === 0 ? (
        <Empty icon={CalendarOff} title="No days off" text="Going away or busy? Add the days, so the studio doesn't give you a shift then.">
          <button type="button" onClick={start} className={softBtn}><Plus className="w-4 h-4" />Add days off</button>
        </Empty>
      ) : (
        <List>
          {list.map(d => (
            <Row key={d.id} icon={CalendarOff} color="red" title={dayRange(d)} sub={d.note || (d.from <= today ? "Today" : "The studio sees this")}
              right={<button type="button" onClick={() => remove(d)} aria-label={`Remove ${dayRange(d)}`} className="w-9 h-9 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]"><Trash2 className="w-4 h-4" /></button>} />
          ))}
        </List>
      )}

      <FormDrawer open={open} onClose={() => { if (!busy) setOpen(false); }} icon={CalendarOff} color="red" title="Add days off" sub="The studio sees these before giving you a shift"
        footer={<>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} className="h-12 px-6 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[15px] font-semibold">Cancel</button>
          <button type="button" onClick={add} disabled={busy || !from} className="flex-1 h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-50 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save
          </button>
        </>}>
        <div className={cn(card, "divide-y divide-[#EEEBF4]")}>
          <div className="grid grid-cols-2">
            <Field label="From" required>{id => <input id={id} type="date" min={today} value={from} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo(""); }} className={inputCls} />}</Field>
            <Field label="To" hint="Leave empty for one day">{id => <input id={id} type="date" min={from || today} value={to} onChange={e => setTo(e.target.value)} className={inputCls} />}</Field>
          </div>
          <Field label="Why (optional)" hint="Only the studio sees this.">{id => <input id={id} value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="e.g. Family wedding" className={inputCls} />}</Field>
        </div>
      </FormDrawer>
    </Section>
  );
}

// ─── How I get paid ─────────────────────────────────────────────────────────
export function PayoutSection({ prefs, onChange }: { prefs: MemberPrefs; onChange: (p: MemberPrefs) => void }) {
  const p = prefs.payout;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Payout>({ method: "bkash" });
  const [busy, setBusy] = useState(false);
  const wallet = PAYOUT_METHODS.find(m => m.v === f.method)?.wallet;

  function start() { setF(p ?? { method: "bkash" }); setOpen(true); }
  async function save() {
    setBusy(true);
    const next = await send("/member/payout", "PATCH", { payout: f });
    setBusy(false);
    if (next) { onChange(next); setOpen(false); notify("Saved — the studio will see it when paying you"); }
  }
  const set = (k: keyof Payout, v: string) => setF(x => ({ ...x, [k]: v }));

  return (
    <Section title="How I get paid" action={p ? <button type="button" onClick={start} className={linkBtn}>Change</button> : undefined}>
      {!p ? (
        <Empty icon={Wallet} title="Not set yet" text="Tell the studio where to send your money — bKash, Nagad, bank or cash.">
          <button type="button" onClick={start} className={softBtn}><Plus className="w-4 h-4" />Add payment details</button>
        </Empty>
      ) : (
        <List>
          <Row icon={Wallet} color="green" title={payoutLabel(p.method)}
            sub={[p.method === "bank" ? p.bankName : "", p.number, p.accountName, p.method === "bank" ? p.branch : "", p.note].filter(Boolean).join(" · ") || (p.method === "cash" ? "Paid by hand" : "")} />
        </List>
      )}

      <FormDrawer open={open} onClose={() => { if (!busy) setOpen(false); }} icon={Wallet} color="green" title="How I get paid" sub="Only the studio sees this"
        footer={<>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} className="h-12 px-6 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[15px] font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={busy} className="flex-1 h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-50 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save
          </button>
        </>}>
        <div className={cn(card, "p-4 mb-4")}>
          <p className="text-[13px] font-bold text-[#4A4658] mb-2">Pay me by</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pay me by">
            {PAYOUT_METHODS.map(m => (
              <button key={m.v} type="button" role="radio" aria-checked={f.method === m.v} onClick={() => setF(x => ({ ...x, method: m.v as PayoutMethod }))}
                className={cn("h-10 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center gap-1.5", f.method === m.v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
                {f.method === m.v && <Check className="w-3.5 h-3.5" />}{m.l}
              </button>
            ))}
          </div>
        </div>
        {f.method !== "cash" && (
          <div className={cn(card, "divide-y divide-[#EEEBF4]")}>
            <Field label={wallet ? `${payoutLabel(f.method)} number` : f.method === "bank" ? "Account number" : "Number / ID"} required={wallet || f.method === "bank"}>
              {id => <input id={id} inputMode={wallet ? "tel" : "text"} value={f.number ?? ""} onChange={e => set("number", e.target.value)} placeholder={wallet ? "01XXXXXXXXX" : ""} className={inputCls} />}
            </Field>
            <Field label="Account name" hint={wallet ? "The name on the account, if it isn't yours" : undefined}>{id => <input id={id} value={f.accountName ?? ""} onChange={e => set("accountName", e.target.value)} className={inputCls} />}</Field>
            {f.method === "bank" && (
              <div className="grid grid-cols-2">
                <Field label="Bank">{id => <input id={id} value={f.bankName ?? ""} onChange={e => set("bankName", e.target.value)} placeholder="e.g. DBBL" className={inputCls} />}</Field>
                <Field label="Branch">{id => <input id={id} value={f.branch ?? ""} onChange={e => set("branch", e.target.value)} className={inputCls} />}</Field>
              </div>
            )}
            <Field label="Note (optional)">{id => <input id={id} value={f.note ?? ""} onChange={e => set("note", e.target.value)} placeholder="e.g. Personal number, not agent" className={inputCls} />}</Field>
          </div>
        )}
        <p className="px-1 mt-3 text-xs text-[#6B6680] leading-relaxed">The studio sees this on your profile when it pays you. StuPanel never sends money by itself.</p>
      </FormDrawer>
    </Section>
  );
}

// ─── Ask for a rate change ──────────────────────────────────────────────────
const STATUS: Record<RateReqStatus, { label: string; tone: "amber" | "green" | "grey" }> = {
  pending: { label: "Waiting", tone: "amber" }, done: { label: "Done", tone: "green" }, dismissed: { label: "Not now", tone: "grey" },
};
type RateReqStatus = MemberPrefs["rateRequests"][number]["status"];

export function RateRequestSection({ prefs, onChange }: { prefs: MemberPrefs; onChange: (p: MemberPrefs) => void }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const list = [...prefs.rateRequests].reverse();
  const waiting = list.find(r => r.status === "pending");

  async function ask() {
    if (msg.trim().length < 3) { notify("Write what you would like to change", { error: true }); return; }
    setBusy(true);
    const next = await send("/member/rate-requests", "POST", { message: msg.trim() });
    setBusy(false);
    if (next) { onChange(next); setOpen(false); setMsg(""); notify("Sent to the studio"); }
  }
  async function cancel(id: string) {
    if (!(await askConfirm({ title: "Cancel this request?", message: "The studio will not see it any more.", confirmLabel: "Cancel request", cancelLabel: "Keep it" }))) return;
    const next = await send(`/member/rate-requests/${id}`, "DELETE");
    if (next) onChange(next);
  }

  return (
    <Section title="Rate change requests" action={!waiting && list.length > 0 ? <button type="button" onClick={() => setOpen(true)} className={linkBtn}><Plus className="w-3.5 h-3.5" />New request</button> : undefined}>
      {list.length === 0 ? (
        <Empty icon={MessageSquareText} title="Want a different rate?" text="Ask the studio here. It sees your request on your profile and answers.">
          <button type="button" onClick={() => setOpen(true)} className={softBtn}><MessageSquareText className="w-4 h-4" />Ask for a rate change</button>
        </Empty>
      ) : (
        <List>
          {list.slice(0, 6).map(r => (
            <Row key={r.id} icon={r.status === "pending" ? Clock : r.status === "done" ? Check : X} color={r.status === "pending" ? "orchid" : r.status === "done" ? "green" : "ink"}
              title={r.message}
              sub={[`Sent ${fmtDate(r.createdAt)}`, r.answer ? `Studio: ${r.answer}` : ""].filter(Boolean).join(" · ")}
              right={<>
                <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>
                {r.status === "pending" && <button type="button" onClick={() => cancel(r.id)} className="text-[12px] font-semibold text-[#C2304F] hover:text-[#9C2340]">Cancel</button>}
              </>} />
          ))}
        </List>
      )}

      <FormDrawer open={open} onClose={() => { if (!busy) setOpen(false); }} icon={MessageSquareText} color="violet" title="Ask for a rate change" sub="The studio decides and changes the price"
        footer={<>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} className="h-12 px-6 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[15px] font-semibold">Cancel</button>
          <button type="button" onClick={ask} disabled={busy || msg.trim().length < 3} className="flex-1 h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-50 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Send to studio
          </button>
        </>}>
        <div className={card}>
          <Field label="What would you like?" hint="Which work, which price, and why — e.g. per shift with own setup 3,500 instead of 3,250, new lens added.">
            {id => <textarea id={id} rows={5} maxLength={600} value={msg} onChange={e => setMsg(e.target.value)} className={cn(inputCls, "h-auto py-2.5 resize-none")} />}
          </Field>
        </div>
        <p className="px-1 mt-3 text-xs text-[#6B6680] leading-relaxed">One request can wait at a time. Your prices change only when the studio changes them.</p>
      </FormDrawer>
    </Section>
  );
}
