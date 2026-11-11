"use client";

/** Studio side: what a team member set for themselves — rate change requests, days off, how they get paid. */
import { useState } from "react";
import { CalendarOff, Check, Loader2, MessageSquareText, Wallet, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { inputCls } from "@/components/ui/form-kit";
import { Chip, List, Row, Section, card } from "@/components/ui/profile-page";
import { dayRange, payoutLabel, todayStr, type MemberPrefs, type RateRequest } from "@/lib/member-prefs";

/** A waiting request with Done / Not now. `onPrices` opens the price editor. */
export function RateRequestCard({ memberId, name, req, onAnswered, onPrices }: {
  memberId: string; name: string; req: RateRequest; onAnswered: (p: MemberPrefs) => void; onPrices: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"" | "done" | "dismissed">("");
  async function reply(status: "done" | "dismissed") {
    setBusy(status);
    try {
      const r = await apiFetch(`${API}/team/${memberId}/rate-requests/${req.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, answer: answer.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(d?.message || "Couldn't save", { error: true }); return; }
      onAnswered(d);
      notify(status === "done" ? `${name} will see it's done` : `${name} will see "Not now"`);
    } catch { notify("Couldn't save — check your internet", { error: true }); }
    finally { setBusy(""); }
  }
  return (
    <div className={cn(card, "p-4 ring-1 ring-[#E9D3F0]")}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-[#F7E9F4] text-[#823072] flex items-center justify-center flex-shrink-0"><MessageSquareText className="w-4 h-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#823072]">{name} asked for a rate change · {fmtDate(req.createdAt)}</p>
          <p className="text-[14.5px] text-[#17151F] mt-1 whitespace-pre-wrap break-words">{req.message}</p>
        </div>
      </div>
      <input value={answer} onChange={e => setAnswer(e.target.value)} maxLength={300} aria-label="Answer (optional)" placeholder="Answer (optional) — e.g. Changed from next month"
        className={cn(inputCls, "mt-3")} />
      <div className="grid grid-cols-2 sm:flex gap-2 mt-3">
        <button type="button" onClick={onPrices} className="col-span-2 sm:mr-auto h-10 px-4 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[13px] font-semibold">Change prices</button>
        <button type="button" disabled={!!busy} onClick={() => reply("dismissed")} className="h-10 px-4 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
          {busy === "dismissed" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}Not now
        </button>
        <button type="button" disabled={!!busy} onClick={() => reply("done")} className="h-10 px-4 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
          {busy === "done" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Done
        </button>
      </div>
      <p className="text-[12px] text-[#6B6680] mt-2">Change the prices first if you agree, then press Done. Their prices don&apos;t change by themselves.</p>
    </div>
  );
}

export function PastRateRequests({ list }: { list: RateRequest[] }) {
  const past = [...list].filter(r => r.status !== "pending").reverse().slice(0, 5);
  if (!past.length) return null;
  return (
    <Section title="Earlier rate requests">
      <List>
        {past.map(r => (
          <Row key={r.id} icon={r.status === "done" ? Check : X} color={r.status === "done" ? "green" : "ink"} title={r.message}
            sub={[`Asked ${fmtDate(r.createdAt)}`, r.answer ? `Answer: ${r.answer}` : ""].filter(Boolean).join(" · ")}
            right={<Chip tone={r.status === "done" ? "green" : "grey"}>{r.status === "done" ? "Done" : "Not now"}</Chip>} />
        ))}
      </List>
    </Section>
  );
}

export function DaysOffList({ prefs, title = "Days they can't work" }: { prefs: MemberPrefs; title?: string }) {
  const today = todayStr();
  const list = prefs.daysOff.filter(d => d.to >= today);
  return (
    <Section title={title} action={<span className="text-[12.5px] text-[#6B6680]">Set by them</span>}>
      {list.length === 0 ? <div className={cn(card, "px-4 py-4 text-[13.5px] text-[#8A8599]")}>No days off coming up.</div> : (
        <List>{list.map(d => <Row key={d.id} icon={CalendarOff} color="red" title={dayRange(d)} sub={d.note || (d.from <= today ? "Off now" : "Off")} />)}</List>
      )}
    </Section>
  );
}

export function PayoutView({ prefs }: { prefs: MemberPrefs }) {
  const p = prefs.payout;
  return (
    <Section title="How they get paid" action={<span className="text-[12.5px] text-[#6B6680]">Set by them</span>}>
      {!p ? <div className={cn(card, "px-4 py-4 text-[13.5px] text-[#8A8599]")}>They haven&apos;t added payment details yet.</div> : (
        <List>
          <Row icon={Wallet} color="green" title={[payoutLabel(p.method), p.number].filter(Boolean).join(" · ")}
            sub={[p.accountName, p.method === "bank" ? [p.bankName, p.branch].filter(Boolean).join(", ") : "", p.note, p.updatedAt ? `Updated ${fmtDate(p.updatedAt)}` : ""].filter(Boolean).join(" · ") || "Paid by hand"} />
        </List>
      )}
    </Section>
  );
}

export const waitingRequest = (p?: MemberPrefs | null) => p?.rateRequests.find(r => r.status === "pending") ?? null;

