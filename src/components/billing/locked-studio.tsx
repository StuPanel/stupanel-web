"use client";
/**
 * A locked studio (its free trial or paid plan ended and it did not renew, after 3 grace days): every page of the
 * app shows this instead — only totals, nothing one by one (Faisal 24-NOV-2026: otherwise a studio could copy its
 * data out and not renew). Plan & billing and Support still open. Renewing opens everything again at once.
 * Client links keep working for 7 days after the end, then close until the studio renews.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarDays, CalendarPlus, Clock, Images, Link2Off, Link2, Loader2, LockKeyhole, LifeBuoy, Users, UsersRound, Wallet,
} from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { checkoutHref, fmtDate, money, type BillingStatus, type TrialState } from "@/lib/billing";
import { cn } from "@/lib/utils";

type Summary = { clients: number; programs: number; upcoming: number; team: number; galleries: number; collected: number; clientsOwe: number; teamOwed: number };

const LINK_DAYS = 7;

/** For the owner. */
export function LockedStudio({ status }: { status: BillingStatus }) {
  const [sum, setSum] = useState<Summary | null>(null);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    apiFetch(`${API_URL}/dashboard/locked-summary`).then(r => (r.ok ? r.json() : null)).then(setSum).catch(() => null);
    apiFetch(`${API_URL}/billing/trial`).then(r => (r.ok ? r.json() : null)).then(setTrial).catch(() => null);
  }, []);

  async function extend() {
    setBusy(true); setErr("");
    const r = await apiFetch(`${API_URL}/billing/trial/extend`, { method: "POST" }).catch(() => null);
    const b = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setErr((Array.isArray(b.message) ? b.message[0] : b.message) || "Could not add the days. Please try again."); return; }
    window.location.reload();
  }

  const wasTrial = !status.plan;
  const end = status.access.periodEndsAt;
  const linksClose = end ? new Date(new Date(end).getTime() + LINK_DAYS * 864e5) : null;
  const [now] = useState(() => Date.now());
  const linksOpen = !!linksClose && linksClose.getTime() > now;
  const renew = status.plan?.slug ? checkoutHref(status.plan.slug, status.interval ?? "monthly") : "/billing#plans";
  const pending = status.pendingRequest;

  const counts = sum ? [
    { n: sum.clients, label: "Clients", icon: Users },
    { n: sum.programs, label: "Programs", icon: CalendarDays },
    { n: sum.upcoming, label: "Programs coming up", icon: Clock },
    { n: sum.team, label: "Team members", icon: UsersRound },
    { n: sum.galleries, label: "Photo galleries", icon: Images },
  ] : [];
  const moneyRows = sum ? [
    { label: "Money received", v: sum.collected, tone: "text-[#17151F]" },
    { label: "Clients still owe you", v: sum.clientsOwe, tone: "text-[#A15C07]" },
    { label: "You still owe your team", v: sum.teamOwed, tone: "text-[#17151F]" },
  ] : [];

  return (
    <div className="max-w-[920px] mx-auto py-2 sm:py-6">
      <section className="rounded-[28px] bg-white border border-[#E3DFEC] overflow-hidden shadow-[0_24px_60px_-36px_rgba(40,28,96,.45)]">
        <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-7 bg-[linear-gradient(160deg,#F6F2FF_0%,#FFFFFF_65%)]">
          <div className="w-14 h-14 rounded-2xl bg-[#17151F] text-white flex items-center justify-center"><LockKeyhole className="w-6 h-6" /></div>
          <h1 className="mt-5 text-[28px] sm:text-[34px] leading-[1.1] font-extrabold tracking-[-0.025em] text-[#17151F]">
            {wasTrial ? "Your free trial has ended" : "Your studio is locked"}
          </h1>
          <p className="mt-3 max-w-[620px] text-[15.5px] leading-relaxed text-[#4A4658]">
            {wasTrial ? "Choose a plan to keep using StuPanel." : `Your ${status.plan?.name ?? ""} plan ended${end ? ` on ${fmtDate(end)}` : ""}.`}{" "}
            Everything you made is kept safe and nothing is deleted. Renew and it all opens again, exactly as you left it.
          </p>
          {pending ? (
            <p className="mt-6 rounded-2xl bg-[#EEE8FD] px-4 py-3 text-[14px] text-[#5B3FD0] flex gap-2.5"><Clock className="w-5 h-5 flex-shrink-0" />Your payment of {money(pending.amount, pending.currency)} is being checked. Everything opens as soon as it is accepted.</p>
          ) : (
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <Link href={renew} className="h-[52px] px-7 rounded-full bg-[#7D5CEF] hover:bg-[#6B4BDD] text-white text-[16px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_12px_26px_-12px_rgba(125,92,239,.8)]">
                {wasTrial ? "Choose a plan" : `Renew ${status.plan?.name ?? "plan"}`}<ArrowRight className="w-5 h-5" />
              </Link>
              {!wasTrial && <Link href="/billing#plans" className="h-[52px] px-6 rounded-full bg-[#F5F3FA] hover:bg-[#ECE8F5] text-[#17151F] text-[15px] font-semibold inline-flex items-center justify-center">See all plans</Link>}
              {trial?.canExtend && (
                <button type="button" onClick={() => void extend()} disabled={busy} className="h-[52px] px-6 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}Take {trial.extendDays} more days free
                </button>
              )}
            </div>
          )}
          {err && <p role="alert" className="mt-2 text-[13px] text-[#C2304F]">{err}</p>}
          {status.offer && !pending && <p className="mt-3 text-[13.5px] font-semibold text-[#1F8A5B]">{status.offer.percent}% off your first month if you choose a monthly plan before {fmtDate(status.offer.until)}.</p>}
        </div>

        {/* Your clients' links */}
        {end && (
          <div className={cn("mx-6 sm:mx-10 rounded-2xl px-4 py-3.5 flex gap-3 text-[14px]", linksOpen ? "bg-[#FFF6E8] text-[#7A4A07]" : "bg-[#FDECEF] text-[#8A1F37]")}>
            {linksOpen ? <Link2 className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <Link2Off className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <p>
              {linksOpen
                ? <>Your clients&apos; links (client portal, photo selection, face search, quotes, invoices) keep working until <b>{fmtDate(linksClose!.toISOString())}</b>. After that they stop until you renew.</>
                : <>Your clients&apos; links (client portal, photo selection, face search, quotes, invoices) are closed. They open again as soon as you renew.</>}
            </p>
          </div>
        )}

        {/* Totals only */}
        <div className="px-6 sm:px-10 pt-7 pb-8">
          <p className="text-[15px] font-bold text-[#17151F]">Your studio in numbers</p>
          <p className="text-[13px] text-[#6B6680]">Renew to open every client, program, payment and team member again.</p>
          {!sum ? (
            <div className="py-10 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {counts.map(c => (
                  <div key={c.label} className="rounded-2xl bg-[#F7F5FB] px-3.5 py-3">
                    <c.icon className="w-5 h-5 text-[#7D5CEF]" />
                    <p className="mt-2 text-[22px] font-extrabold tabular-nums text-[#17151F] leading-none">{c.n.toLocaleString("en-US")}</p>
                    <p className="mt-1 text-[12.5px] text-[#6B6680] leading-tight">{c.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-2xl border border-[#EEEBF4] divide-y divide-[#EEEBF4]">
                {moneyRows.map(m => (
                  <p key={m.label} className="px-4 py-3 flex items-center justify-between gap-3 text-[14.5px]">
                    <span className="flex items-center gap-2.5 text-[#4A4658]"><Wallet className="w-4 h-4 text-[#A29DB3]" />{m.label}</span>
                    <span className={cn("font-extrabold tabular-nums", m.tone)}>{money(m.v)}</span>
                  </p>
                ))}
              </div>
            </>
          )}
          <p className="mt-5 text-[13px] text-[#6B6680] flex items-center gap-2">
            <LifeBuoy className="w-4 h-4" />Questions about your plan? <Link href="/support" className="font-semibold text-[#5B3FD0]">Write to Support</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

/** For a manager or team member of a locked studio. */
export function LockedForTeam() {
  return (
    <div className="max-w-[560px] mx-auto py-10 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-[#17151F] text-white flex items-center justify-center"><LockKeyhole className="w-6 h-6" /></div>
      <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F]">The studio&apos;s plan has ended</h1>
      <p className="mt-2 text-[15px] text-[#4A4658]">StuPanel is locked for this studio until the owner renews the plan. Nothing is deleted — everything opens again as soon as it is renewed.</p>
      <p className="mt-4 text-[14px] text-[#6B6680]">Please ask the studio owner to open Plan &amp; billing.</p>
    </div>
  );
}
