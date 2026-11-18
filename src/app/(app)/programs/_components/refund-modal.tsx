"use client";

/**
 * Giving money back to a client, and cancelling a program that has money paid.
 * A studio keeps the advance by default when a program is cancelled; giving some or all of it back is a choice.
 * A refund is its own record (date, account, note): the payments and their receipts stay as they were.
 */
import { useState } from "react";
import { Loader2, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { apiFetch, API_URL as API } from "@/lib/api";
import { currencyPad, currencySymbol, formatCurrency, localDateStr } from "@/lib/format";
import { AccountPicker } from "@/components/account-picker";
import { notify } from "@/components/feedback";
import { PAYMENT_METHODS } from "./constants";
import type { Booking } from "./types";

type Choice = "keep" | "all" | "part";

const errText = async (r: Response, fallback: string) => {
  const d = await r.json().catch(() => ({}));
  return (Array.isArray(d.message) ? d.message[0] : d.message) || fallback;
};

export function RefundDrawer({ booking, cancel, onClose, onDone }: {
  booking: Booking;
  /** Cancelling the program: keep the money (default) or give some or all of it back. */
  cancel?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const paid = Math.max(0, Number(booking.paidAmount) || 0);
  const [choice, setChoice] = useState<Choice>(cancel ? "keep" : "all");
  const [amount, setAmount] = useState(cancel ? "" : String(paid));
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(localDateStr());
  const [walletId, setWalletId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fmt = (n: number) => formatCurrency(n, booking.currency);

  const giving = !cancel || choice !== "keep";
  const back = choice === "all" ? paid : Number(amount) || 0;
  const kept = Math.max(0, paid - (giving ? back : 0));

  async function submit() {
    setError("");
    if (giving) {
      if (!(back > 0)) { setError("Enter how much you give back."); return; }
      if (back > paid + 0.009) { setError(`Only ${fmt(paid)} was paid, so no more than that can be given back.`); return; }
      if (!walletId) { setError("Pick the account the money left from."); return; }
    }
    setBusy(true);
    try {
      if (giving) {
        const r = await apiFetch(`${API}/refunds`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking.id, amount: back, refundDate: date, walletId, method, note: note.trim() || undefined }),
        });
        if (!r.ok) { setError(await errText(r, "Couldn't save the refund. Please try again.")); return; }
      }
      if (cancel) {
        const r = await apiFetch(`${API}/bookings/${booking.id}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }),
        });
        if (!r.ok) { setError(await errText(r, "Couldn't cancel the program. Please try again.")); onDone(); return; }
        notify(giving ? `Cancelled · ${fmt(back)} given back` : `Cancelled · ${fmt(paid)} kept`);
      } else notify(`${fmt(back)} given back`);
      onDone(); onClose();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  const option = (v: Choice, title: string, sub: string) => (
    <label key={v} className={cn("flex items-start gap-3 px-4 py-3.5 cursor-pointer", choice === v && "bg-[#F7F5FB]")}>
      <input type="radio" name="refund-choice" value={v} checked={choice === v} onChange={() => { setChoice(v); if (v === "part") setAmount(""); }} className="mt-1 accent-[#7D5CEF] w-4 h-4" />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-[#17151F]">{title}</span>
        <span className="block text-[12.5px] text-[#6B6680]">{sub}</span>
      </span>
    </label>
  );

  return (
    <FormDrawer open onClose={onClose} onTop icon={cancel ? XCircle : RotateCcw} color={cancel ? "red" : "violet"}
      title={cancel ? "Cancel this program" : "Give money back"} sub={booking.eventName ?? booking.bookingNumber}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">{cancel ? "Keep program" : "Close"}</button>
          <button type="button" onClick={submit} disabled={busy}
            className={cn("flex-1 h-11 rounded-full text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50", cancel ? "bg-[#B42347] hover:bg-[#9C1E3C]" : "bg-[#7D5CEF] hover:bg-[#6B4AE0]")}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {cancel ? (giving && back > 0 ? `Cancel and give back ${fmt(back)}` : "Cancel program") : `Give back ${back > 0 ? fmt(back) : ""}`.trim()}
          </button>
        </>
      }>
      <div className="mb-4 flex items-center justify-between rounded-[16px] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(22,18,40,.05)]">
        <span className="text-[13px] font-semibold text-[#6B6680]">The client has paid</span>
        <span className="text-[17px] font-extrabold text-[#17151F] tabular-nums">{fmt(paid)}</span>
      </div>
      {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{error}</p>}

      {cancel && (
        <>
          <p className="px-1 mb-1.5 text-[12.5px] font-bold text-[#6B6680]">What happens to the money?</p>
          <FormGroup>
            {option("keep", `Keep ${fmt(paid)}`, "The usual: the advance is not given back. It stays as the studio's income.")}
            {option("all", `Give all ${fmt(paid)} back`, "The client gets everything back.")}
            {option("part", "Give part of it back", "Enter how much goes back; the rest is kept.")}
          </FormGroup>
        </>
      )}

      {giving && (
        <FormGroup>
          {(choice === "part" || !cancel) && (
            <Field label="Amount given back" required name="amount">{id => (
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-[15px] font-semibold">{currencySymbol(booking.currency).trim()}</span>
                <input id={id} type="number" inputMode="decimal" min="0" max={paid} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus
                  className={cn(inputCls, "pl-8 text-[17px] font-bold tabular-nums")} style={{ paddingLeft: currencyPad(booking.currency) }} />
              </div>
            )}</Field>
          )}
          <div className="grid grid-cols-2">
            <Field label="Given back by">{id => (
              <select id={id} value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}</Field>
            <Field label="Date" className="pl-0">{id => <input id={id} type="date" value={date} max={localDateStr()} onChange={e => setDate(e.target.value)} className={inputCls} />}</Field>
          </div>
          <div className="px-4 py-3.5"><AccountPicker value={walletId} onChange={setWalletId} method={method} label="Money left from" payOut={back || undefined} /></div>
          <Field label="Note">{id => <input id={id} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional, e.g. why" className={inputCls} />}</Field>
        </FormGroup>
      )}

      {(cancel || back > 0) && (
        <p className="px-1 text-[13px] text-[#4A4658]">
          {giving && back > 0 ? <>Given back <b className="tabular-nums">{fmt(back)}</b> · kept <b className="tabular-nums">{fmt(kept)}</b>.</> : <>The studio keeps <b className="tabular-nums">{fmt(paid)}</b>.</>}
          {" "}Payments and their receipts stay as they were; the refund is saved on its own date.
        </p>
      )}
    </FormDrawer>
  );
}
