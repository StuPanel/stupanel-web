"use client";

/**
 * Plan & billing: the plan now (with what it allows and what is used), the plans to choose from, and every payment.
 * Paying happens on its own page: /billing/checkout.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarPlus, Check, CheckCircle2, Clock, Crown, Gift, Loader2, Lock, Sparkles, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/apple";
import { apiFetch, API_URL } from "@/lib/api";
import { loadBillingStatus } from "@/components/billing/billing-banner";
import { cn } from "@/lib/utils";
import {
  METHOD_LABEL, checkoutHref, fmtDate, money, planLines, priceOf, yearlySavePercent,
  type BillingStatus, type Interval, type Plan, type TrialState, type Use,
} from "@/lib/billing";

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setIv] = useState<Interval>("monthly");
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [extending, setExtending] = useState(false);
  const [extendMsg, setExtendMsg] = useState<{ ok?: string; error?: string }>({});

  async function load() {
    const [s, p, t] = await Promise.all([
      apiFetch(`${API_URL}/billing/status`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`${API_URL}/billing/plans`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`${API_URL}/billing/trial`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (s) { setStatus(s); if (s.interval) setIv(s.interval); }
    setTrial(t);
    if (p) setPlans(p.plans ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Opened from "Choose a plan" (…/billing#plans): go to the plans once they are on the page.
  useEffect(() => {
    if (!loading && window.location.hash === "#plans") document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  async function extend() {
    setExtending(true); setExtendMsg({});
    try {
      const res = await apiFetch(`${API_URL}/billing/trial/extend`, { method: "POST" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setExtendMsg({ error: (Array.isArray(b.message) ? b.message[0] : b.message) || "Could not add the days. Please try again." });
      else { setExtendMsg({ ok: `Done — your free trial now runs until ${fmtDate(b.trialEndsAt)}.` }); await loadBillingStatus(true); await load(); }
    } catch { setExtendMsg({ error: "Network problem. Please try again." }); }
    setExtending(false);
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>;
  if (!status) return <p className="py-24 text-center text-[#6B6680]">Plan &amp; billing could not be opened. Please refresh the page.</p>;

  const pending = status.pendingRequest;
  const offer = status.offer ?? null;
  const maxSave = Math.max(0, ...plans.map(yearlySavePercent));
  const currentSlug = status.plan?.slug ?? plans.find(p => p.id === status.plan?.id)?.slug ?? null;

  return (
    <div className="space-y-6 max-w-[1120px]">
      <PageHeader icon={Crown} color="violet" title="Plan & billing" sub="Your plan, what it allows, and every payment in one place." />

      <CurrentPlan status={status} />

      {pending && (
        <div className="rounded-[20px] border border-[#CFC2F8] bg-[#F6F2FF] p-5 flex gap-4">
          <Clock className="w-6 h-6 text-[#5B3FD0] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#5B3FD0]">
            <p className="font-semibold text-base">Payment waiting to be checked</p>
            <p className="mt-1">{pending.planName} · {pending.interval === "yearly" ? "1 year" : "1 month"} · {money(pending.amount, pending.currency)} by {METHOD_LABEL[pending.method]}</p>
            <p className="mt-0.5">TrxID <span className="font-mono font-semibold">{pending.trxId}</span> from {pending.senderNumber}</p>
            <p className="mt-2 text-[#4A4658]">We usually check it within a few hours and email you when your plan is on. You don&apos;t need to do anything else.</p>
          </div>
        </div>
      )}

      {offer && !pending && (
        <div className="rounded-[20px] border border-[#CDEBDB] bg-[#F1FAF5] p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#1F8A5B] flex items-center justify-center flex-shrink-0"><Gift className="w-5 h-5 text-white" /></div>
          <div>
            <p className="font-semibold text-[#17151F]">{offer.percent}% off your first month</p>
            <p className="text-sm text-[#4A4658] mt-0.5">Choose a monthly plan before {fmtDate(offer.until)} and the first month costs {offer.percent}% less. The monthly prices below already show it.</p>
          </div>
        </div>
      )}

      {trial?.canExtend && !pending && (
        <div className="rounded-[20px] border border-[#E3DFEC] bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#EEE8FD] flex items-center justify-center flex-shrink-0"><CalendarPlus className="w-5 h-5 text-[#7D5CEF]" /></div>
          <div className="flex-1">
            <p className="font-semibold text-[#17151F]">Need more time to try it?</p>
            <p className="text-sm text-[#4A4658] mt-0.5">Take {trial.extendDays} more days free. You can do this once.</p>
            {extendMsg.error && <p className="text-sm text-[#C2304F] mt-1">{extendMsg.error}</p>}
          </div>
          <button type="button" onClick={() => void extend()} disabled={extending}
            className="h-11 px-5 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {extending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}Take {trial.extendDays} more days
          </button>
        </div>
      )}
      {extendMsg.ok && <p role="status" className="rounded-xl bg-[#F1FAF5] border border-[#CDEBDB] px-4 py-3 text-sm text-[#1F6B47]">{extendMsg.ok}</p>}

      {/* Plans */}
      {!pending && plans.length > 0 && (
        <section id="plans" className="scroll-mt-24 pt-2">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[20px] font-extrabold tracking-[-0.01em] text-[#17151F]">Plans</h2>
              <p className="text-sm text-[#6B6680]">Pay with bKash, Nagad or Rocket. Your plan starts as soon as the payment is checked.</p>
            </div>
            <div className="inline-flex rounded-full bg-white border border-[#E3DFEC] p-1" role="radiogroup" aria-label="How long">
              {(["monthly", "yearly"] as Interval[]).map((iv) => (
                <button key={iv} type="button" role="radio" aria-checked={interval === iv} onClick={() => setIv(iv)}
                  className={cn("h-9 px-4 rounded-full text-sm font-semibold transition-colors", interval === iv ? "bg-[#17151F] text-white" : "text-[#4A4658] hover:bg-[#F5F3FA]")}>
                  {iv === "monthly" ? "Monthly" : "Yearly"}
                  {iv === "yearly" && maxSave > 0 && <span className={cn("ml-1.5 text-xs font-bold", interval === iv ? "text-[#9AE6BD]" : "text-[#1F8A5B]")}>save {maxSave}%</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => {
              const price = priceOf(p, interval, offer);
              const full = interval === "yearly" ? p.priceYearly : p.priceMonthly;
              const mine = currentSlug === p.slug;
              const save = interval === "yearly" ? p.priceMonthly * 12 - p.priceYearly : 0;
              return (
                <div key={p.id} className={cn("relative rounded-[22px] border bg-white p-6 flex flex-col",
                  p.isPopular ? "border-[#7D5CEF] shadow-[0_18px_40px_-24px_rgba(125,92,239,.7)]" : "border-[#E3DFEC]")}>
                  {p.isPopular && <span className="absolute -top-3 left-6 rounded-full bg-[#7D5CEF] px-3 py-1 text-xs font-bold text-white inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />Most chosen</span>}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[17px] font-bold text-[#17151F]">{p.name}</p>
                    {mine && <span className="rounded-full bg-[#EEE8FD] px-2.5 py-0.5 text-xs font-bold text-[#5B3FD0]">Your plan</span>}
                  </div>
                  {p.tagline && <p className="text-[13px] text-[#6B6680] mt-0.5">{p.tagline}</p>}
                  <p className="mt-4 flex items-baseline gap-1.5 flex-wrap">
                    {price < full && <span className="text-sm text-[#9C97AC] line-through">{money(full, p.currency)}</span>}
                    <span className="text-[30px] font-extrabold tracking-[-0.02em] tabular-nums text-[#17151F]">{money(price, p.currency)}</span>
                    <span className="text-sm text-[#6B6680]">/ {interval === "yearly" ? "year" : "month"}</span>
                  </p>
                  <p className="text-xs font-semibold text-[#1F8A5B] min-h-[18px] mt-0.5">
                    {price < full ? `First month, then ${money(full, p.currency)} a month` : save > 0 ? `${money(save, p.currency)} less than paying monthly` : ""}
                  </p>
                  <ul className="mt-4 space-y-2 text-[14px] text-[#4A4658] flex-1">
                    {planLines(p, 7).map(l => <li key={l} className="flex gap-2"><Check className="w-4 h-4 text-[#7D5CEF] flex-shrink-0 mt-0.5" strokeWidth={3} />{l}</li>)}
                  </ul>
                  <Link href={checkoutHref(p.slug, interval)}
                    className={cn("mt-6 h-12 rounded-full text-[15px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors",
                      p.isPopular ? "bg-[#7D5CEF] hover:bg-[#6B4BDD] text-white" : "bg-[#F5F3FA] hover:bg-[#ECE8F5] text-[#17151F]")}>
                    {mine ? `Renew ${p.name}` : `Choose ${p.name}`}<ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Payments */}
      <section className="rounded-[20px] border border-[#E3DFEC] bg-white">
        <div className="px-5 py-4 border-b border-[#E3DFEC] flex items-center justify-between gap-3">
          <p className="font-semibold text-[#17151F]">Payments</p>
          {status.history.some(r => r.state === "approved") && (
            <p className="text-sm text-[#6B6680]">Paid {money(status.history.filter(r => r.state === "approved").reduce((t, r) => t + r.amount, 0))}</p>
          )}
        </div>
        {status.history.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#6B6680] text-center">No payments yet. They show here as soon as you send one.</p>
        ) : (
          <ul className="divide-y divide-[#E3DFEC]">
            {status.history.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                {r.state === "approved" ? <CheckCircle2 className="w-4 h-4 text-[#1F8A5B] flex-shrink-0" />
                  : r.state === "rejected" ? <XCircle className="w-4 h-4 text-[#C2304F] flex-shrink-0" />
                  : <Clock className="w-4 h-4 text-[#7D5CEF] flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[#17151F] font-medium truncate">{r.planName} · {r.interval === "yearly" ? "Yearly" : "Monthly"} · {money(r.amount, r.currency)}</p>
                  <p className="text-xs text-[#6B6680] truncate">
                    {fmtDate(r.submittedAt)} · {METHOD_LABEL[r.method]} · {r.trxId}
                    {r.state === "rejected" && r.rejectReason ? ` · Not accepted: ${r.rejectReason}` : ""}
                    {r.state === "approved" && r.periodEnd ? ` · paid until ${fmtDate(r.periodEnd)}` : ""}
                  </p>
                </div>
                <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5",
                  r.state === "approved" ? "bg-[#E6F4EC] text-[#1F8A5B]" : r.state === "rejected" ? "bg-[#FDECEF] text-[#C2304F]" : "bg-[#EEE8FD] text-[#5B3FD0]")}>
                  {r.state === "approved" ? "Checked" : r.state === "rejected" ? "Not accepted" : "Being checked"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="px-5 py-3 border-t border-[#E3DFEC] text-xs text-[#6B6680]">Payments are usually checked within a few hours. Questions? Open Support from the menu.</p>
      </section>
    </div>
  );
}

/** The plan now: its name and state, until when, and what is used of its limits. */
function CurrentPlan({ status }: { status: BillingStatus }) {
  const a = status.access;
  const name = status.plan?.name ?? "Free trial";
  const tag = a.mode === "full" ? { t: "Active", c: "bg-[#E6F4EC] text-[#1F8A5B]" }
    : a.mode === "trial" ? { t: a.daysLeft !== null ? `${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} left` : "Trial", c: "bg-[#EEE8FD] text-[#5B3FD0]" }
    : a.mode === "grace" ? { t: "Ended — pay to keep going", c: "bg-[#FFF1E0] text-[#A15C07]" }
    : { t: "Ended", c: "bg-[#FDECEF] text-[#C2304F]" };
  const line = a.mode === "full" ? (a.periodEndsAt ? `Paid until ${fmtDate(a.periodEndsAt)}` : "No end date")
    : a.mode === "trial" ? (a.periodEndsAt ? `Free until ${fmtDate(a.periodEndsAt)}` : "")
    : a.mode === "grace" ? `Ended ${fmtDate(a.periodEndsAt)}. Everything works until ${fmtDate(a.graceEndsAt)}, then StuPanel pauses until you renew.`
    : `Ended ${fmtDate(a.periodEndsAt)}. Renew now to keep working — all your work is saved.`;
  const u = status.usage;
  const bars: { label: string; u: Use }[] = u ? [
    { label: "Clients", u: u.clients }, { label: "Programs this month", u: u.programsThisMonth }, { label: "Team members", u: u.team },
  ] : [];
  const bad = a.mode === "read_only" || a.mode === "grace";
  return (
    <section className="rounded-[22px] border border-[#E3DFEC] bg-white p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0", bad ? "bg-[#FDECEF] text-[#C2304F]" : "bg-[#EEE8FD] text-[#7D5CEF]")}>
          {bad ? <Lock className="w-6 h-6" /> : <Crown className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[#6B6680]">Your plan</p>
          <p className="flex items-center gap-2 flex-wrap">
            <span className="text-[22px] font-extrabold tracking-[-0.01em] text-[#17151F]">{name}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", tag.c)}>{tag.t}</span>
          </p>
          {line && <p className={cn("text-sm mt-0.5", bad ? "text-[#8A1F37]" : "text-[#4A4658]")}>{line}</p>}
        </div>
        {!status.pendingRequest && (
          <a href="#plans" className={cn("h-11 px-5 rounded-full text-sm font-bold inline-flex items-center justify-center gap-1.5 flex-shrink-0",
            bad || a.mode === "trial" ? "bg-[#7D5CEF] text-white hover:bg-[#6B4BDD]" : "bg-[#F5F3FA] text-[#17151F] hover:bg-[#ECE8F5]")}>
            {a.mode === "full" ? "Change plan" : bad && status.plan ? "Renew plan" : "Choose a plan"}
          </a>
        )}
      </div>
      {bars.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {bars.map(b => {
            const pct = b.u.max ? Math.min(100, Math.round((b.u.used / b.u.max) * 100)) : 0;
            const full = b.u.max !== null && b.u.used >= b.u.max;
            return (
              <div key={b.label} className="rounded-2xl bg-[#F7F5FB] px-4 py-3">
                <p className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-[#4A4658]">{b.label}</span>
                  <span className={cn("font-bold tabular-nums", full ? "text-[#C2304F]" : "text-[#17151F]")}>{b.u.used.toLocaleString("en-US")}{b.u.max ? ` / ${b.u.max.toLocaleString("en-US")}` : ""}</span>
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-[#E6E1EF] overflow-hidden" role="progressbar" aria-label={b.label} aria-valuenow={b.u.used} aria-valuemax={b.u.max ?? undefined}>
                  <div className={cn("h-full rounded-full", full ? "bg-[#C2304F]" : "bg-[#7D5CEF]")} style={{ width: b.u.max ? `${Math.max(pct, b.u.used ? 4 : 0)}%` : "100%", opacity: b.u.max ? 1 : 0.25 }} />
                </div>
                {!b.u.max && <p className="text-[11.5px] text-[#6B6680] mt-1">No limit</p>}
              </div>
            );
          })}
          {status.usage?.trial && <p className="sm:col-span-3 text-xs text-[#6B6680]">During the free trial you can use as much as the {status.usage.planName} plan allows.</p>}
        </div>
      )}
    </section>
  );
}
