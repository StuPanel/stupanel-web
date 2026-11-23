"use client";

/**
 * Pay for a plan: three steps (Choose plan ✓ → Pay → Send the details), with the order on the right.
 * Opened from Plan & billing: /billing/checkout?plan=<slug>&cycle=monthly|yearly.
 * The payment is checked by StuPanel by hand (TrxID); the plan turns on when it is accepted.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Clock, Copy, Loader2, ShieldCheck, Tag } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { loadBillingStatus } from "@/components/billing/billing-banner";
import { cn } from "@/lib/utils";
import {
  METHOD_COLOR, METHOD_LABEL, fmtDate, money, planLines, priceOf, yearlySavePercent,
  type Account, type BillingStatus, type Interval, type Method, type PayRequest, type Plan,
} from "@/lib/billing";

export default function CheckoutPage() {
  return <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>}><Checkout /></Suspense>;
}

function Checkout() {
  const q = useSearchParams();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [interval, setIv] = useState<Interval>(q.get("cycle") === "yearly" ? "yearly" : "monthly");
  const [method, setMethod] = useState<Method | null>(null);
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<PayRequest | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponText, setCouponText] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; label: string; price: number; for: string } | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch(`${API_URL}/billing/plans`).then(r => (r.ok ? r.json() : null)),
      apiFetch(`${API_URL}/billing/status`).then(r => (r.ok ? r.json() : null)),
    ]).then(([p, s]) => {
      if (p) { setPlans(p.plans ?? []); setAccounts(p.accounts ?? []); setInstructions(p.instructions ?? null); if (p.accounts?.length) setMethod(p.accounts[0].method); }
      setStatus(s);
      setLoading(false);
    });
  }, []);

  const plan = useMemo(() => plans.find(p => p.slug === q.get("plan")) ?? plans.find(p => p.isPopular) ?? plans[0] ?? null, [plans, q]);
  const offer = status?.offer ?? null;
  const base = plan ? priceOf(plan, interval, offer) : 0;
  const full = plan ? (interval === "yearly" ? plan.priceYearly : plan.priceMonthly) : 0;
  const couponNow = coupon && plan && coupon.for === `${plan.id}:${interval}` ? coupon : null;
  // One discount per payment: the coupon or the offer, whichever is bigger (the server decides the same way).
  const useCoupon = !!couponNow && couponNow.price < base;
  const amount = useCoupon ? couponNow!.price : base;
  const account = accounts.find(a => a.method === method) ?? null;
  const senderOk = /^01\d{9}$/.test(sender.replace(/\D/g, ""));
  const trxOk = /^[A-Z0-9]{8,12}$/.test(trx);

  function setCycle(iv: Interval) {
    setIv(iv);
    if (plan) router.replace(`/billing/checkout?plan=${plan.slug}&cycle=${iv}`, { scroll: false });
  }
  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }
  async function applyCoupon() {
    if (!plan || !couponText.trim()) return;
    setCouponBusy(true); setCouponErr("");
    const r = await apiFetch(`${API_URL}/billing/coupon`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: couponText, planId: plan.id, interval }) }).catch(() => null);
    const b = r ? await r.json().catch(() => ({})) : {};
    setCouponBusy(false);
    if (!r?.ok) { setCoupon(null); setCouponErr((Array.isArray(b.message) ? b.message[0] : b.message) || "Could not check the code. Try again."); return; }
    setCoupon({ code: b.code, label: b.label, price: Number(b.price), for: `${plan.id}:${interval}` });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !method || !senderOk || !trxOk) return;
    setBusy(true); setError("");
    try {
      const res = await apiFetch(`${API_URL}/billing/requests`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, interval, method, senderNumber: sender.replace(/\D/g, ""), trxId: trx, ...(useCoupon ? { couponCode: couponNow!.code } : {}) }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setError((Array.isArray(b.message) ? b.message[0] : b.message) || "Could not send. Please try again.");
      else {
        await loadBillingStatus(true);
        const s = await apiFetch(`${API_URL}/billing/status`).then(r => (r.ok ? r.json() : null)).catch(() => null);
        setSent(s?.pendingRequest ?? { id: "", number: "", state: "pending", amount, currency: plan.currency, method, trxId: trx, senderNumber: sender, planName: plan.name, interval, rejectReason: null, submittedAt: new Date().toISOString(), approvedAt: null, periodEnd: null });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch { setError("Network problem. Please try again."); }
    setBusy(false);
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>;
  if (!plan) return <p className="py-24 text-center text-[#6B6680]">No plan to choose yet. <Link href="/billing" className="text-[#5B3FD0] font-semibold">Back to Plan &amp; billing</Link></p>;

  const waiting = !sent && status?.pendingRequest;
  const step = sent ? 3 : 2;

  return (
    <div className="max-w-[1080px] mx-auto">
      <Link href="/billing" className="inline-flex items-center gap-1.5 h-10 -ml-2 px-2 rounded-full text-sm font-semibold text-[#4A4658] hover:bg-white">
        <ArrowLeft className="w-4 h-4" />Plan &amp; billing
      </Link>
      <h1 className="mt-2 text-[28px] sm:text-[32px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">
        {sent ? "Payment sent for checking" : `Switch on ${plan.name}`}
      </h1>
      <p className="mt-1 text-[15px] text-[#4A4658]">
        {sent ? "We check it by hand, usually within a few hours, and email you when your plan is on." : "Send the money, then tell us the transaction ID. Your plan turns on as soon as we check it."}
      </p>

      {/* Steps */}
      <ol className="mt-5 flex items-center gap-1.5 sm:gap-2" aria-label="Steps">
        {["Choose plan", "Pay", sent ? "Being checked" : "Checked"].map((t, i) => {
          const n = i + 1, done = n < step, on = n === step;
          return (
            <li key={t} className="flex items-center gap-2 flex-shrink-0">
              {i > 0 && <span className="w-3 sm:w-6 h-px bg-[#D9D4E5]" aria-hidden="true" />}
              <span className={cn("h-9 pl-1.5 pr-3 sm:pr-3.5 rounded-full inline-flex items-center gap-1.5 sm:gap-2 text-[13px] sm:text-[13.5px] font-semibold",
                done ? "bg-[#E6F4EC] text-[#1F6B47]" : on ? "bg-[#17151F] text-white" : "bg-white text-[#8A8599] border border-[#E3DFEC]")} aria-current={on ? "step" : undefined}>
                <span className={cn("w-6 h-6 rounded-full inline-flex items-center justify-center text-xs", done ? "bg-[#1F8A5B] text-white" : on ? "bg-white text-[#17151F]" : "bg-[#F5F3FA]")}>
                  {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : n}
                </span>{t}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px] items-start">
        {/* Left */}
        <div className={cn("space-y-5 lg:order-1", sent ? "order-1" : "order-2")}>
          {sent ? (
            <section className="rounded-[24px] bg-white border border-[#E3DFEC] p-6 sm:p-8">
              <div className="w-14 h-14 rounded-2xl bg-[#E6F4EC] text-[#1F8A5B] flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></div>
              <p className="mt-4 text-[18px] font-bold text-[#17151F]">{money(sent.amount, sent.currency)} by {METHOD_LABEL[sent.method]}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[14px]">
                <dt className="text-[#6B6680]">Plan</dt><dd className="text-[#17151F] font-medium">{sent.planName} · {sent.interval === "yearly" ? "1 year" : "1 month"}</dd>
                <dt className="text-[#6B6680]">From</dt><dd className="text-[#17151F] font-medium">{sent.senderNumber}</dd>
                <dt className="text-[#6B6680]">TrxID</dt><dd className="text-[#17151F] font-mono font-semibold">{sent.trxId}</dd>
              </dl>
              <p className="mt-5 rounded-2xl bg-[#F7F5FB] px-4 py-3 text-[14px] text-[#4A4658] flex gap-2.5"><Clock className="w-5 h-5 text-[#7D5CEF] flex-shrink-0" />You can keep working. Plan &amp; billing shows &quot;Being checked&quot; until then.</p>
              <Link href="/billing" className="mt-6 h-12 px-6 rounded-full bg-[#17151F] text-white text-[15px] font-bold inline-flex items-center justify-center">Back to Plan &amp; billing</Link>
            </section>
          ) : waiting ? (
            <section className="rounded-[24px] bg-[#F6F2FF] border border-[#CFC2F8] p-6 text-[#5B3FD0]">
              <p className="font-bold text-[17px]">A payment is already being checked</p>
              <p className="mt-1 text-[14px]">{waiting.planName} · {money(waiting.amount, waiting.currency)} · TrxID <span className="font-mono font-semibold">{waiting.trxId}</span>. Wait for it to be checked before sending another one.</p>
              <Link href="/billing" className="mt-4 h-11 px-5 rounded-full bg-[#5B3FD0] text-white text-sm font-bold inline-flex items-center">Back to Plan &amp; billing</Link>
            </section>
          ) : accounts.length === 0 ? (
            <p className="rounded-[24px] bg-white border border-[#E3DFEC] p-6 text-[14px] text-[#4A4658]">Payment numbers are not set up yet. Please write to StuPanel from Support to pay.</p>
          ) : (
            <>
              {/* 1. Send the money */}
              <section className="rounded-[24px] bg-white border border-[#E3DFEC] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[17px] font-bold text-[#17151F]">1. Send the money</p>
                    <p className="text-[13.5px] text-[#6B6680]">Choose your app</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] text-[#6B6680]">Amount to send</p>
                    <p className="text-[28px] font-extrabold tracking-[-0.02em] tabular-nums text-[#17151F] leading-none mt-1">{money(amount, plan.currency)}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pay with">
                  {accounts.map(a => (
                    <button key={a.method} type="button" role="radio" aria-checked={method === a.method} onClick={() => setMethod(a.method)}
                      className={cn("h-12 rounded-2xl border-2 text-[15px] font-bold transition-colors", method === a.method ? "text-white" : "bg-white text-[#4A4658] border-[#E3DFEC] hover:border-[#CFC8DC]")}
                      style={method === a.method ? { background: METHOD_COLOR[a.method], borderColor: METHOD_COLOR[a.method] } : undefined}>
                      {METHOD_LABEL[a.method]}
                    </button>
                  ))}
                </div>
                {account && (
                  <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_1fr]">
                    <div className="rounded-2xl p-4 text-white flex flex-col justify-between min-h-[132px]" style={{ background: METHOD_COLOR[account.method] }}>
                      <p className="text-[13px] opacity-90">{METHOD_LABEL[account.method]} number</p>
                      <p className="text-[26px] font-extrabold tracking-[0.04em] tabular-nums">{account.number}</p>
                      <button type="button" onClick={() => copy(account.number)} className="self-start h-9 px-3.5 rounded-full bg-white/20 hover:bg-white/30 text-[13px] font-bold inline-flex items-center gap-1.5">
                        {copied ? <><Check className="w-4 h-4" strokeWidth={3} />Copied</> : <><Copy className="w-4 h-4" />Copy number</>}
                      </button>
                    </div>
                    <ol className="space-y-3 text-[14px] text-[#4A4658]">
                      <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#F5F3FA] text-[12px] font-bold text-[#17151F] inline-flex items-center justify-center flex-shrink-0">a</span><span>Open {METHOD_LABEL[account.method]} and choose <b className="text-[#17151F]">Send Money</b>.</span></li>
                      <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#F5F3FA] text-[12px] font-bold text-[#17151F] inline-flex items-center justify-center flex-shrink-0">b</span><span>Send exactly <b className="text-[#17151F]">{money(amount, plan.currency)}</b> to this number.</span></li>
                      <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#F5F3FA] text-[12px] font-bold text-[#17151F] inline-flex items-center justify-center flex-shrink-0">c</span><span>Keep the <b className="text-[#17151F]">TrxID</b> from the SMS (it looks like 9AB12CD34E).</span></li>
                    </ol>
                  </div>
                )}
                {instructions && <p className="mt-4 text-[13px] text-[#6B6680] whitespace-pre-line">{instructions}</p>}
              </section>

              {/* 2. Tell us */}
              <form onSubmit={submit} className="rounded-[24px] bg-white border border-[#E3DFEC] p-5 sm:p-6">
                <p className="text-[17px] font-bold text-[#17151F]">2. Tell us about the payment</p>
                <p className="text-[13.5px] text-[#6B6680]">We match these with our {account ? METHOD_LABEL[account.method] : ""} account. Nothing else is needed.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[13px] font-semibold text-[#4A4658]">The number you sent from</span>
                    <input value={sender} onChange={e => setSender(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX"
                      aria-invalid={!!sender && !senderOk} className="mt-1.5 h-12 w-full rounded-xl border border-[#E3DFEC] px-3.5 text-[15px] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30 focus:border-[#7D5CEF]" />
                    {sender && !senderOk && <span className="block text-xs text-[#C2304F] mt-1">An 11-digit number starting with 01.</span>}
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-[#4A4658]">Transaction ID (TrxID)</span>
                    <input value={trx} onChange={e => setTrx(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} required maxLength={12} placeholder="9AB12CD34E" autoComplete="off"
                      aria-invalid={!!trx && !trxOk} className="mt-1.5 h-12 w-full rounded-xl border border-[#E3DFEC] px-3.5 text-[15px] font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30 focus:border-[#7D5CEF]" />
                    {trx && !trxOk && <span className="block text-xs text-[#C2304F] mt-1">8–12 letters and numbers, as in the SMS.</span>}
                  </label>
                </div>
                {error && <p role="alert" className="mt-3 rounded-xl bg-[#FDECEF] px-3.5 py-2.5 text-sm text-[#C2304F]">{error}</p>}
                <button type="submit" disabled={busy || !method || !senderOk || !trxOk}
                  className="mt-5 h-[52px] w-full rounded-full bg-[#7D5CEF] hover:bg-[#6B4BDD] text-white text-[16px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}Send for checking · {money(amount, plan.currency)}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Right: the order */}
        <aside className={cn("lg:order-2 lg:sticky lg:top-24 rounded-[24px] bg-white border border-[#E3DFEC] p-5 sm:p-6", sent ? "order-2" : "order-1")}>
          <p className="text-[13px] text-[#6B6680]">Your plan</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[20px] font-extrabold text-[#17151F]">{plan.name}</p>
            <span className="rounded-full bg-[#EEE8FD] px-2.5 py-0.5 text-xs font-bold text-[#5B3FD0]">{interval === "yearly" ? "Yearly" : "Monthly"}</span>
          </div>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[28px] font-extrabold tracking-[-0.02em] tabular-nums text-[#17151F]">{money(base, plan.currency)}</span>
            <span className="text-sm text-[#6B6680]">/ {interval === "yearly" ? "year" : "month"}</span>
          </p>
          {!sent && (
            <div className="mt-3 grid grid-cols-2 rounded-full bg-[#F5F3FA] p-1" role="radiogroup" aria-label="How long">
              {(["monthly", "yearly"] as Interval[]).map(iv => (
                <button key={iv} type="button" role="radio" aria-checked={interval === iv} onClick={() => setCycle(iv)}
                  className={cn("h-9 rounded-full text-[13.5px] font-semibold", interval === iv ? "bg-[#17151F] text-white" : "text-[#4A4658]")}>
                  {iv === "monthly" ? "Monthly" : `Yearly${yearlySavePercent(plan) ? ` · save ${yearlySavePercent(plan)}%` : ""}`}
                </button>
              ))}
            </div>
          )}
          <ul className="mt-4 space-y-2 text-[13.5px] text-[#4A4658] hidden sm:block">
            {planLines(plan, 5).map(l => <li key={l} className="flex gap-2"><Check className="w-4 h-4 text-[#7D5CEF] flex-shrink-0 mt-0.5" strokeWidth={3} />{l}</li>)}
          </ul>
          <div className="mt-4 pt-4 border-t border-[#EEEBF4] space-y-2 text-[14px]">
            {!sent && (couponNow ? (
              <p className="rounded-xl bg-[#E9F5EF] px-3 py-2 text-[13px] text-[#1F6B47] flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4" /><b>{couponNow.label}</b>
                {!useCoupon && <span className="text-[#4A4658]">— your offer is bigger, so it is used</span>}
                <button type="button" onClick={() => { setCoupon(null); setCouponText(""); }} className="ml-auto underline text-xs text-[#4A4658]">Remove</button>
              </p>
            ) : !couponOpen ? (
              <button type="button" onClick={() => setCouponOpen(true)} className="text-[13.5px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5"><Tag className="w-4 h-4" />Have a coupon?</button>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input value={couponText} onChange={e => setCouponText(e.target.value.toUpperCase())} maxLength={50} placeholder="Coupon code" aria-label="Coupon code" autoFocus
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }}
                    className="h-10 flex-1 min-w-0 rounded-xl border border-[#E3DFEC] px-3 text-sm uppercase tracking-wide" />
                  <button type="button" disabled={couponBusy || !couponText.trim()} onClick={() => void applyCoupon()} className="h-10 px-4 rounded-xl bg-[#17151F] text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">{couponBusy && <Loader2 className="w-4 h-4 animate-spin" />}Apply</button>
                </div>
                {couponErr && <p role="alert" className="text-xs text-[#C2304F] mt-1.5">{couponErr}</p>}
              </div>
            ))}
            <p className="flex justify-between text-[#4A4658]"><span>Price</span><span className="tabular-nums">{money(full, plan.currency)}</span></p>
            {amount < full && <p className="flex justify-between text-[#1F8A5B]"><span>{useCoupon ? "Coupon" : `${offer?.percent ?? 0}% first-month offer`}</span><span className="tabular-nums">− {money(full - amount, plan.currency)}</span></p>}
            <p className="flex justify-between text-[16px] font-extrabold text-[#17151F] pt-1"><span>To pay now</span><span className="tabular-nums">{money(amount, plan.currency)}</span></p>
            {status?.access.mode === "full" && status.access.periodEndsAt && (
              <p className="text-xs text-[#6B6680]">Your plan now is paid until {fmtDate(status.access.periodEndsAt)}.</p>
            )}
          </div>
          <p className="mt-4 text-[12.5px] text-[#6B6680] flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#1F8A5B]" />Checked by StuPanel · your data stays safe</p>
        </aside>
      </div>
    </div>
  );
}
