"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Clock, Copy, Crown, Loader2, Lock, XCircle } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { loadBillingStatus, type BillingAccess } from "@/components/billing/billing-banner";
import { cn } from "@/lib/utils";

type Interval = "monthly" | "yearly";
type Method = "bkash" | "nagad" | "rocket";

interface Plan {
  id: string; name: string; slug: string; description: string | null; tagline: string | null; isPopular: boolean;
  priceMonthly: number; priceYearly: number; currency: string;
  maxClients: number; maxTeamMembers: number; maxStorageGb: number; maxBookingsPerMonth: number;
  features?: { featureKey: string; featureLabel: string; featureValue: string | null }[];
}
interface Account { method: Method; number: string }
interface PayRequest {
  id: string; number: string; state: "pending" | "approved" | "rejected"; amount: number; currency: string;
  method: Method; trxId: string; senderNumber: string | null; planName: string | null; interval: Interval | null;
  rejectReason: string | null; submittedAt: string; approvedAt: string | null; periodEnd: string | null;
}
interface Status {
  status: string; plan: { id: string; name: string } | null; interval: Interval | null;
  access: BillingAccess; pendingRequest: PayRequest | null; history: PayRequest[];
}

const METHOD_LABEL: Record<Method, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };
const METHOD_COLOR: Record<Method, string> = { bkash: "#E2136E", nagad: "#EC1C24", rocket: "#8C3494" };

function money(n: number, cur = "BDT") {
  return `${cur === "BDT" ? "৳" : cur + " "}${n.toLocaleString("en-IN")}`;
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default function BillingPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [interval, setBillingInterval] = useState<Interval>("monthly");
  const [planId, setPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const [s, p] = await Promise.all([
      apiFetch(`${API_URL}/billing/status`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`${API_URL}/billing/plans`).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (s) setStatus(s);
    if (p) {
      setPlans(p.plans ?? []);
      setAccounts(p.accounts ?? []);
      setInstructions(p.instructions ?? null);
      if (!method && p.accounts?.length) setMethod(p.accounts[0].method);
    }
    if (s?.plan?.id) setPlanId((cur) => cur ?? s.plan.id);
    if (s?.interval) setBillingInterval(s.interval);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const plan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const amount = plan ? (interval === "yearly" ? plan.priceYearly : plan.priceMonthly) : 0;
  const account = accounts.find((a) => a.method === method) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !method) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/billing/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, interval, method, senderNumber, trxId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const msg = Array.isArray(b.message) ? b.message[0] : b.message;
        setError(msg || "Could not submit. Please try again.");
      } else {
        setSenderNumber(""); setTrxId("");
        await loadBillingStatus(true);
        await load();
      }
    } catch {
      setError("Network problem. Please try again.");
    }
    setSubmitting(false);
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>;
  }

  const access = status?.access;
  const pending = status?.pendingRequest ?? null;
  const yearlySaving = (p: Plan) => Math.max(0, p.priceMonthly * 12 - p.priceYearly);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#17151F]">Plan & Billing</h1>
        <p className="text-sm text-[#6B6680] mt-1">Pay with bKash, Nagad or Rocket. Your plan starts as soon as we confirm the payment.</p>
      </div>

      {/* Current status */}
      {access && <StatusCard status={status!} />}

      {pending ? (
        <div className="rounded-2xl border border-[#CFC2F8] bg-[#EEE8FD] p-5 flex gap-4">
          <Clock className="w-6 h-6 text-[#5B3FD0] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#5B3FD0]">
            <p className="font-semibold text-base">Payment waiting for confirmation</p>
            <p className="mt-1">
              {pending.planName} · {pending.interval === "yearly" ? "1 year" : "1 month"} · {money(pending.amount, pending.currency)} via {METHOD_LABEL[pending.method]}
            </p>
            <p className="mt-0.5">TrxID <span className="font-mono font-semibold">{pending.trxId}</span> from {pending.senderNumber}</p>
            <p className="mt-2 text-[#4A4658]">We usually confirm within a few hours. You don&apos;t need to do anything else.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Interval toggle */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-xl bg-white border border-[#E3DFEC] p-1">
              {(["monthly", "yearly"] as Interval[]).map((iv) => (
                <button key={iv} onClick={() => setBillingInterval(iv)}
                  className={cn("px-5 py-2 rounded-lg text-sm font-semibold transition-colors",
                    interval === iv ? "bg-[#7D5CEF] text-white" : "text-[#4A4658] hover:bg-[#F5F3FA]")}>
                  {iv === "monthly" ? "Monthly" : "Yearly"}
                  {iv === "yearly" && <span className={cn("ml-1.5 text-xs", interval === iv ? "text-white/80" : "text-[#1F8A5B]")}>save more</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Plans */}
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => {
              const selected = p.id === planId;
              const price = interval === "yearly" ? p.priceYearly : p.priceMonthly;
              return (
                <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                  className={cn("relative text-left rounded-2xl border bg-white p-5 transition-all",
                    selected ? "border-[#7D5CEF] ring-2 ring-[#7D5CEF]/25 shadow-md" : "border-[#E3DFEC] hover:border-[#B29DF8]")}>
                  {p.isPopular && (
                    <span className="absolute -top-2.5 left-5 rounded-full bg-[#7D5CEF] px-2.5 py-0.5 text-xs font-semibold text-white">Popular</span>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#17151F]">{p.name}</p>
                    <span className={cn("w-5 h-5 rounded-full border flex items-center justify-center",
                      selected ? "bg-[#7D5CEF] border-[#7D5CEF]" : "border-[#E3DFEC]")}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </span>
                  </div>
                  {p.tagline && <p className="text-xs text-[#6B6680] mt-0.5">{p.tagline}</p>}
                  <p className="mt-3">
                    <span className="text-2xl font-bold text-[#17151F]">{money(price, p.currency)}</span>
                    <span className="text-sm text-[#6B6680]"> / {interval === "yearly" ? "year" : "month"}</span>
                  </p>
                  {interval === "yearly" && yearlySaving(p) > 0 && (
                    <p className="text-xs font-medium text-[#1F8A5B] mt-0.5">Save {money(yearlySaving(p), p.currency)} a year</p>
                  )}
                  <ul className="mt-4 space-y-1.5 text-sm text-[#4A4658]">
                    <li className="flex gap-2"><Check className="w-4 h-4 text-[#7D5CEF] flex-shrink-0 mt-0.5" />{p.maxClients >= 99999 ? "Unlimited" : p.maxClients} clients</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-[#7D5CEF] flex-shrink-0 mt-0.5" />{p.maxTeamMembers >= 999 ? "Unlimited" : p.maxTeamMembers} team members</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-[#7D5CEF] flex-shrink-0 mt-0.5" />{p.maxBookingsPerMonth >= 99999 ? "Unlimited" : p.maxBookingsPerMonth} programs / month</li>
                    {(p.features ?? []).slice(0, 5).map((f) => (
                      <li key={f.featureKey} className="flex gap-2"><Check className="w-4 h-4 text-[#7D5CEF] flex-shrink-0 mt-0.5" />{f.featureLabel}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Payment */}
          {plan && (
            <form onSubmit={submit} className="rounded-2xl border border-[#E3DFEC] bg-white p-5 sm:p-6 space-y-5">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-[#17151F]">Pay {money(amount, plan.currency)}</h2>
                <p className="text-sm text-[#6B6680]">{plan.name} · {interval === "yearly" ? "1 year" : "1 month"}</p>
              </div>

              {accounts.length === 0 ? (
                <p className="rounded-lg bg-[#F5F3FA] p-4 text-sm text-[#4A4658]">
                  Payment numbers are not set up yet. Please contact StuPanel support to pay.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-[#17151F] mb-2">1. Choose how you&apos;ll pay</p>
                    <div className="flex flex-wrap gap-2">
                      {accounts.map((a) => (
                        <button key={a.method} type="button" onClick={() => setMethod(a.method)}
                          className={cn("rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                            method === a.method ? "text-white" : "bg-white text-[#4A4658] border-[#E3DFEC] hover:bg-[#F5F3FA]")}
                          style={method === a.method ? { background: METHOD_COLOR[a.method], borderColor: METHOD_COLOR[a.method] } : undefined}>
                          {METHOD_LABEL[a.method]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {account && (
                    <div>
                      <p className="text-sm font-medium text-[#17151F] mb-2">2. Send money to this {METHOD_LABEL[account.method]} number</p>
                      <div className="flex items-center gap-3 rounded-xl bg-[#F5F3FA] px-4 py-3">
                        <span className="font-mono text-lg font-bold tracking-wide text-[#17151F] flex-1">{account.number}</span>
                        <button type="button" onClick={() => copy(account.number)}
                          className="flex items-center gap-1 text-sm font-medium text-[#7D5CEF] hover:text-[#6143CF]">
                          {copied === account.number ? <><Check className="w-4 h-4" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                        </button>
                      </div>
                      <p className="text-xs text-[#6B6680] mt-1.5">
                        Use &quot;Send Money&quot; and send exactly <span className="font-semibold">{money(amount, plan.currency)}</span>.
                      </p>
                      {instructions && <p className="text-xs text-[#6B6680] mt-1 whitespace-pre-line">{instructions}</p>}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-[#17151F] mb-2">3. Tell us about the payment</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-[#6B6680]">Number you sent from</span>
                        <input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} required inputMode="tel"
                          placeholder="01XXXXXXXXX"
                          className="mt-1 w-full rounded-lg border border-[#E3DFEC] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30 focus:border-[#7D5CEF]" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[#6B6680]">Transaction ID (TrxID)</span>
                        <input value={trxId} onChange={(e) => setTrxId(e.target.value.toUpperCase())} required
                          placeholder="e.g. 9JK4L2M8NP"
                          className="mt-1 w-full rounded-lg border border-[#E3DFEC] px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/30 focus:border-[#7D5CEF]" />
                      </label>
                    </div>
                  </div>

                  {error && <p className="rounded-lg bg-[#FDECEF] px-3 py-2 text-sm text-[#C2304F]">{error}</p>}

                  <button type="submit" disabled={submitting || !method}
                    className="w-full sm:w-auto rounded-xl bg-[#7D5CEF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#6143CF] disabled:opacity-60 flex items-center justify-center gap-2">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit payment
                  </button>
                </>
              )}
            </form>
          )}
        </>
      )}

      {/* History */}
      {status && status.history.length > 0 && (
        <div className="rounded-2xl border border-[#E3DFEC] bg-white">
          <p className="px-5 py-4 font-semibold text-[#17151F] border-b border-[#E3DFEC]">Payment history</p>
          <ul className="divide-y divide-[#E3DFEC]">
            {status.history.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                {r.state === "approved" ? <CheckCircle2 className="w-4 h-4 text-[#1F8A5B] flex-shrink-0" />
                  : r.state === "rejected" ? <XCircle className="w-4 h-4 text-[#C2304F] flex-shrink-0" />
                  : <Clock className="w-4 h-4 text-[#7D5CEF] flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[#17151F] font-medium truncate">
                    {r.planName} · {r.interval === "yearly" ? "Yearly" : "Monthly"} · {money(r.amount, r.currency)}
                  </p>
                  <p className="text-xs text-[#6B6680] truncate">
                    {fmtDate(r.submittedAt)} · {METHOD_LABEL[r.method]} · {r.trxId}
                    {r.state === "rejected" && r.rejectReason ? ` · Not accepted: ${r.rejectReason}` : ""}
                    {r.state === "approved" && r.periodEnd ? ` · valid till ${fmtDate(r.periodEnd)}` : ""}
                  </p>
                </div>
                <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5",
                  r.state === "approved" ? "bg-[#E6F4EC] text-[#1F8A5B]"
                    : r.state === "rejected" ? "bg-[#FDECEF] text-[#C2304F]" : "bg-[#EEE8FD] text-[#5B3FD0]")}>
                  {r.state === "approved" ? "Confirmed" : r.state === "rejected" ? "Rejected" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusCard({ status }: { status: Status }) {
  const a = status.access;
  const map = {
    full: { icon: Crown, title: `${status.plan?.name ?? "Paid"} plan active`, tone: "ok" },
    trial: { icon: Clock, title: "Free trial", tone: "info" },
    grace: { icon: Clock, title: "Plan ended — grace period", tone: "warn" },
    read_only: { icon: Lock, title: "Plan ended — view only", tone: "warn" },
  } as const;
  const m = map[a.mode];
  const Icon = m.icon;
  let detail = "";
  if (a.mode === "full") detail = a.periodEndsAt ? `Valid till ${fmtDate(a.periodEndsAt)}` : "No end date";
  else if (a.mode === "trial") detail = a.periodEndsAt ? `Ends ${fmtDate(a.periodEndsAt)}${a.daysLeft !== null ? ` · ${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} left` : ""}` : "";
  else if (a.mode === "grace") detail = `Full access until ${fmtDate(a.graceEndsAt)}, then view-only. Pay now to avoid interruption.`;
  else detail = "Your data is safe. You can view everything; renew to add or change anything.";

  return (
    <div className={cn("rounded-2xl border p-5 flex items-center gap-4",
      m.tone === "ok" ? "border-[#CDEBDB] bg-[#F1FAF5]" : m.tone === "warn" ? "border-[#F5C6D0] bg-[#FDECEF]" : "border-[#E3DFEC] bg-white")}>
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
        m.tone === "ok" ? "bg-[#1F8A5B]" : m.tone === "warn" ? "bg-[#C2304F]" : "bg-[#7D5CEF]")}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="font-semibold text-[#17151F]">{m.title}</p>
        {detail && <p className="text-sm text-[#4A4658] mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}
