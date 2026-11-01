"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity, ArrowLeft, Ban, CalendarClock, Camera, CheckCircle, CreditCard, ExternalLink, HardDrive,
  HeartPulse, LifeBuoy, LogIn, Users, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { can, getPlatformUser, isAdminHost } from "@/lib/platform-api";
import { Btn, Msg, Panel, fmtWhen, inp } from "../../_components/staff-kit";

interface Overview {
  studio: {
    id: string; name: string; slug: string; email: string; phone?: string | null; city?: string | null; logoUrl?: string | null;
    createdAt: string; deletedAt?: string | null; isActive: boolean; subscriptionStatus: string;
    trialEndsAt?: string | null; subscriptionEndsAt?: string | null; storageUsedMb: number; r2Enabled: boolean; r2StorageLimitMb: number;
    plan?: { name: string; priceMonthly: string | number } | null;
    access: { state: string; daysLeft: number | null; endsAt: string | null };
  };
  counts: { programs: number; clients: number; users: number; programsLast30: number; clientPayments: number; logins30: number };
  money: { planIncome: number; planPayments: number; pendingRequests: number; clientPaymentsTotal: number };
  activity: { lastLoginAt: string | null; daysSinceLogin: number | null; lastProgramAt: string | null; health: number };
  users: { id: string; firstName: string; lastName?: string | null; email: string; phone?: string | null; role: string; memberType: string; isOwner: boolean; isActive: boolean; lastLoginAt?: string | null; createdAt: string }[];
  planPayments: { id: string; total: number; status: string; paymentMethod: string; paymentReference?: string | null; paidAt?: string | null; createdAt: string }[];
  tickets: { id: string; ticketNumber: string; subject: string; status: string; priority: string; category: string; updatedAt: string }[];
  studioLog: { id: string; action: string; entityType?: string | null; description?: string | null; createdAt: string }[];
  teamLog: { id: string; actorEmail?: string | null; action: string; reason?: string | null; createdAt: string }[];
}

const ACCESS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-900/40 text-emerald-300 border-emerald-700" },
  trial: { label: "Trial", cls: "bg-amber-900/40 text-amber-300 border-amber-700" },
  ending: { label: "Ending (grace)", cls: "bg-orange-900/40 text-orange-300 border-orange-700" },
  expired: { label: "Expired · view-only", cls: "bg-red-900/40 text-red-300 border-red-700" },
  suspended: { label: "Suspended", cls: "bg-slate-700 text-slate-300 border-slate-600" },
};
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const H = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
type Tab = "overview" | "users" | "payments" | "support" | "activity";

function Stat({ icon: Icon, label, value, sub, tone = "indigo" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  const tones: Record<string, string> = { indigo: "bg-indigo-600/20 text-indigo-300", green: "bg-emerald-600/20 text-emerald-300", amber: "bg-amber-600/20 text-amber-300", red: "bg-red-600/20 text-red-300", sky: "bg-sky-600/20 text-sky-300" };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2">
        <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tones[tone])}><Icon className="w-4 h-4" /></span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-slate-400">{k}</span><span className="text-slate-200 text-right">{v}</span></div>;
}

export default function Studio360Page() {
  const { id } = useParams<{ id: string }>();
  const me = getPlatformUser();
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState("");
  const [loginAs, setLoginAs] = useState(false);
  const [reason, setReason] = useState("");
  const [trialDays, setTrialDays] = useState("7");

  const load = useCallback(async () => {
    const r = await fetch(`${API}/admin/studios/${id}/overview`, { headers: H() });
    if (!r.ok) { setError(r.status === 404 ? "Studio not found." : "Couldn't load this studio."); return; }
    setD(await r.json());
  }, [id]);
  useEffect(() => { load().catch(() => setError("Couldn't load this studio.")); }, [load]);

  async function act(key: string, fn: () => Promise<Response>, ok: string) {
    setBusy(key); setMsg({});
    try {
      const r = await fn();
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Something went wrong."); }
      setMsg({ ok }); await load();
    } catch (e) { setMsg({ error: (e as Error).message }); } finally { setBusy(""); }
  }

  async function doLoginAs() {
    const tabWin = window.open("", "_blank");
    setBusy("login"); setMsg({});
    try {
      const r = await fetch(`${API}/admin/studios/${id}/impersonate`, { method: "POST", headers: { ...H(), "x-reason": reason.trim() } });
      const b = await r.json();
      if (!r.ok || !b.token) throw new Error(b.message || "Could not open the studio.");
      const appBase = isAdminHost() ? "https://app.stupanel.com" : window.location.origin;
      if (tabWin) tabWin.location.href = `${appBase}/auth/callback#token=${encodeURIComponent(b.token)}&role=owner&onboarding=false`;
      setLoginAs(false); setReason("");
    } catch (e) { tabWin?.close(); setMsg({ error: (e as Error).message }); } finally { setBusy(""); }
  }

  if (error) return <div className="p-8"><Msg error={error} /></div>;
  if (!d) return <div className="p-8 text-slate-500 text-sm">Loading…</div>;

  const s = d.studio;
  const acc = ACCESS[s.access.state] ?? { label: s.subscriptionStatus, cls: "bg-slate-700 text-slate-300 border-slate-600" };
  const owner = d.users.find(u => u.isOwner);
  const health = d.activity.health;
  const healthTone = health >= 70 ? "green" : health >= 40 ? "amber" : "red";
  const healthText = health >= 70 ? "Healthy" : health >= 40 ? "Needs a nudge" : "At risk";

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: "Users", count: d.users.length },
    { key: "payments", label: "Plan payments", count: d.planPayments.length },
    { key: "support", label: "Support", count: d.tickets.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-6xl">
      <Link href="/admin/studios" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" />All studios</Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.logoUrl ? <img src={s.logoUrl} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-slate-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">{s.name}</h1>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", acc.cls)}>
              {acc.label}{s.access.daysLeft != null && s.access.state !== "expired" && s.access.state !== "suspended" && ` · ${s.access.daysLeft}d left`}
            </span>
            {s.deletedAt && <span className="text-xs px-2 py-0.5 rounded-full border border-slate-600 bg-slate-700 text-slate-300">Archived</span>}
          </div>
          <p className="text-sm text-slate-400 mt-0.5 truncate">/{s.slug} · {s.plan?.name ?? "No plan"} · joined {fmtWhen(s.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(me, "studios.impersonate") && !s.deletedAt && (
            <Btn onClick={() => setLoginAs(true)}><LogIn className="w-3.5 h-3.5" />Log in as studio</Btn>
          )}
          {can(me, "studios.suspend") && !s.deletedAt && (
            <Btn variant={s.isActive ? "danger" : "ghost"} loading={busy === "suspend"}
              onClick={() => act("suspend", () => fetch(`${API}/admin/studios/${id}/${s.isActive ? "suspend" : "reactivate"}`, { method: "PATCH", headers: H() }), s.isActive ? "Studio suspended." : "Studio turned back on.")}>
              {s.isActive ? <><Ban className="w-3.5 h-3.5" />Suspend</> : <><CheckCircle className="w-3.5 h-3.5" />Turn back on</>}
            </Btn>
          )}
        </div>
      </div>

      <Msg {...msg} />

      {loginAs && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setLoginAs(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center"><LogIn className="w-4 h-4" /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Log in as {s.name}</p>
                <p className="text-xs text-slate-400">Opens the studio app as its owner for 2 hours. Your name and reason are saved in the activity log.</p>
              </div>
              <button aria-label="Close" onClick={() => setLoginAs(false)} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why? e.g. Ticket #T-1024 — invoice not printing"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 p-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500" />
            <Btn className="w-full h-10" loading={busy === "login"} disabled={reason.trim().length < 5} onClick={doLoginAs}><ExternalLink className="w-3.5 h-3.5" />Open studio</Btn>
          </div>
        </div>
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={HeartPulse} label="Health" value={`${health}/100`} sub={healthText} tone={healthTone} />
        <Stat icon={Activity} label="Last active" value={d.activity.daysSinceLogin == null ? "Never" : d.activity.daysSinceLogin === 0 ? "Today" : `${d.activity.daysSinceLogin}d ago`} sub={`${d.counts.logins30} sign-ins in 30 days`} tone="sky" />
        <Stat icon={Camera} label="Programs" value={d.counts.programs} sub={`${d.counts.programsLast30} added in 30 days`} />
        <Stat icon={Wallet} label="Paid to StuPanel" value={taka(d.money.planIncome)} sub={d.money.pendingRequests ? `${d.money.pendingRequests} payment waiting` : `${d.money.planPayments} payments`} tone="green" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t.key ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200")}>
            {t.label}{t.count != null && <span className="ml-1.5 text-[11px] text-slate-500">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Studio">
            <div className="divide-y divide-slate-700/60 -my-2">
              <Row k="Owner" v={owner ? `${owner.firstName} ${owner.lastName ?? ""}`.trim() : "—"} />
              <Row k="Email" v={s.email} />
              <Row k="Phone" v={s.phone || "—"} />
              <Row k="City" v={s.city || "—"} />
              <Row k="Users" v={d.counts.users} />
              <Row k="Clients" v={d.counts.clients} />
              <Row k="Client payments recorded" v={`${d.counts.clientPayments} · ${taka(d.money.clientPaymentsTotal)}`} />
              <Row k="Storage" v={<span className="inline-flex items-center gap-1"><HardDrive className="w-3 h-3" />{s.storageUsedMb} MB{s.r2Enabled ? ` of ${(s.r2StorageLimitMb / 1024).toFixed(0)} GB` : " · cloud storage off"}</span>} />
              <Row k="Last program added" v={fmtWhen(d.activity.lastProgramAt)} />
            </div>
          </Panel>
          <Panel title="Subscription">
            <div className="divide-y divide-slate-700/60 -my-2">
              <Row k="Plan" v={s.plan ? `${s.plan.name} · ${taka(Number(s.plan.priceMonthly))}/month` : "—"} />
              <Row k="Status" v={acc.label} />
              <Row k="Trial ends" v={fmtWhen(s.trialEndsAt)} />
              <Row k="Paid until" v={fmtWhen(s.subscriptionEndsAt)} />
            </div>
            {can(me, "studios.edit") && !s.deletedAt && (
              <div className="mt-4 pt-4 border-t border-slate-700/60">
                <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" />Give extra trial days (from today, or from the current trial end if later)</p>
                <div className="flex gap-2">
                  <select value={trialDays} onChange={e => setTrialDays(e.target.value)} className={cn(inp, "w-32")}>
                    {["3", "7", "14", "30"].map(n => <option key={n} value={n}>{n} days</option>)}
                  </select>
                  <Btn variant="ghost" loading={busy === "trial"} onClick={() => {
                    const base = Math.max(Date.now(), s.trialEndsAt ? new Date(s.trialEndsAt).getTime() : 0);
                    const until = new Date(base + Number(trialDays) * 864e5).toISOString();
                    act("trial", () => fetch(`${API}/admin/studios/${id}`, { method: "PATCH", headers: H(), body: JSON.stringify({ trialEndsAt: until, subscriptionStatus: s.subscriptionStatus === "active" ? undefined : "trialing" }) }), `Trial extended to ${fmtWhen(until)}.`);
                  }}>Extend trial</Btn>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "users" && (
        <Panel>
          <div className="-m-5 divide-y divide-slate-700/60">
            {d.users.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{u.firstName?.[0]?.toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{`${u.firstName} ${u.lastName ?? ""}`.trim()}{!u.isActive && <span className="ml-2 text-[10px] text-red-300">OFF</span>}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                </div>
                <span className="text-xs text-slate-400 hidden sm:block">last sign-in {fmtWhen(u.lastLoginAt)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300 capitalize">{u.isOwner ? "Owner" : u.role}{u.memberType === "freelancer" ? " · freelancer" : ""}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "payments" && (
        <Panel>
          {d.planPayments.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">No plan payments yet.</p> : (
            <div className="-m-5 divide-y divide-slate-700/60">
              {d.planPayments.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{taka(p.total)} <span className="text-xs text-slate-400 capitalize">· {p.paymentMethod}</span></p>
                    <p className="text-xs text-slate-500 truncate">{fmtWhen(p.paidAt ?? p.createdAt)}{p.paymentReference ? ` · TrxID ${p.paymentReference}` : ""}</p>
                  </div>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full border",
                    p.status === "paid" ? "border-emerald-700 text-emerald-300 bg-emerald-900/30" : p.status === "sent" ? "border-amber-700 text-amber-300 bg-amber-900/30" : "border-slate-600 text-slate-400")}>
                    {p.status === "paid" ? "Approved" : p.status === "sent" ? "Waiting" : "Rejected"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {d.money.pendingRequests > 0 && <Link href="/admin/billing" className="block mt-4 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Review waiting payments →</Link>}
        </Panel>
      )}

      {tab === "support" && (
        <Panel>
          {d.tickets.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">No support tickets.</p> : (
            <div className="-m-5 divide-y divide-slate-700/60">
              {d.tickets.map(t => (
                <Link key={t.id} href={`/admin/support?ticket=${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-700/30">
                  <LifeBuoy className="w-4 h-4 text-slate-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.subject}</p>
                    <p className="text-xs text-slate-500">{t.ticketNumber} · {t.category} · {t.priority} · updated {fmtWhen(t.updatedAt)}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300 capitalize">{t.status.replace(/_/g, " ")}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "activity" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="What our team did" sub="From the StuPanel activity log">
            {d.teamLog.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : (
              <ul className="space-y-2.5">
                {d.teamLog.map(l => (
                  <li key={l.id} className="text-xs">
                    <p className="text-slate-200">{l.action}</p>
                    <p className="text-slate-500">{l.actorEmail ?? "System"} · {fmtWhen(l.createdAt)}{l.reason ? ` · “${l.reason}”` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Inside the studio" sub="Recent changes the studio made">
            {d.studioLog.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : (
              <ul className="space-y-2.5">
                {d.studioLog.map(l => (
                  <li key={l.id} className="text-xs">
                    <p className="text-slate-200">{l.description || `${l.action} ${l.entityType ?? ""}`}</p>
                    <p className="text-slate-500">{fmtWhen(l.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <p className="text-[11px] text-slate-600 flex items-center gap-1"><Users className="w-3 h-3" />Health = recent sign-ins (40) + programs added in the last 30 days (30) + paying (30).</p>
    </div>
  );
}
