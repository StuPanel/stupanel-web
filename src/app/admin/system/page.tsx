"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Database, HardDrive, Mail, RefreshCw, Server, ShieldAlert, XCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Btn, Page, Panel, fmtWhen } from "../_components/staff-kit";

interface Health {
  checkedAt: string;
  api: { ok: boolean; uptimeMinutes: number; node: string; memoryMb: number; commit: string | null; commitMessage: string | null };
  database: { ok: boolean; pingMs: number; sizeMb: number };
  config: Record<string, boolean>;
  email: { last24h: Record<string, number>; lastFailure: { subject: string; status: string; createdAt: string } | null };
  security: { failedStudioLogins24h: number; failedTeamLogins24h: number };
  queues: { pendingPayments: number; openTickets: number; unansweredTickets: number };
  storageNearFull: { id: string; name: string; pct: number }[];
}

function Dot({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-slate-400">{k}</span><span className="text-slate-200 text-right">{v}</span></div>;
}
const up = (m: number) => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} days`;

export default function SystemPage() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/admin/system`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` } });
      if (!r.ok) throw new Error();
      setH(await r.json());
    } catch { setErr("The server did not answer. It may be down or restarting."); } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const emailSent = h ? Object.entries(h.email.last24h).filter(([k]) => !/fail|bounce|error/.test(k)).reduce((s, [, v]) => s + v, 0) : 0;
  const emailFailed = h ? Object.entries(h.email.last24h).filter(([k]) => /fail|bounce|error/.test(k)).reduce((s, [, v]) => s + v, 0) : 0;
  const allOk = !!h && h.api.ok && h.database.ok && Object.values(h.config).every(Boolean) && emailFailed === 0;

  return (
    <Page title="System" sub="Is StuPanel running well? Refreshes every minute."
      right={<Btn variant="ghost" loading={busy} onClick={load}><RefreshCw className="w-3.5 h-3.5" />Check now</Btn>}>
      {err && <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300 flex items-center gap-2"><XCircle className="w-4 h-4" />{err}</div>}
      {h && (
        <>
          <div className={cn("rounded-xl border p-4 flex items-center gap-3", allOk ? "border-emerald-800 bg-emerald-950/30" : "border-amber-800 bg-amber-950/30")}>
            {allOk ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <ShieldAlert className="w-6 h-6 text-amber-400" />}
            <div>
              <p className="text-sm font-semibold text-white">{allOk ? "Everything is running" : "Something needs a look"}</p>
              <p className="text-xs text-slate-400">Checked {fmtWhen(h.checkedAt)}</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Server (API)">
              <div className="divide-y divide-slate-700/60 -my-1.5">
                <Row k="Status" v={<span className="inline-flex items-center gap-1.5"><Dot ok={h.api.ok} />Running</span>} />
                <Row k="Running for" v={up(h.api.uptimeMinutes)} />
                <Row k="Memory" v={`${h.api.memoryMb} MB`} />
                <Row k="Version" v={h.api.commit ? <span title={h.api.commitMessage ?? ""} className="font-mono">{h.api.commit}</span> : "—"} />
                {h.api.commitMessage && <Row k="Last update" v={<span className="text-xs">{h.api.commitMessage}</span>} />}
              </div>
            </Panel>
            <Panel title="Database">
              <div className="divide-y divide-slate-700/60 -my-1.5">
                <Row k="Status" v={<span className="inline-flex items-center gap-1.5"><Dot ok={h.database.ok} /><Database className="w-3.5 h-3.5 text-slate-500" />{h.database.ok ? "Connected" : "Slow"}</span>} />
                <Row k="Answer time" v={`${h.database.pingMs} ms`} />
                <Row k="Size" v={`${h.database.sizeMb} MB`} />
              </div>
            </Panel>
            <Panel title="Connected services" sub="Only checks that the settings are filled in — no secrets are shown.">
              <div className="divide-y divide-slate-700/60 -my-1.5">
                {Object.entries(h.config).map(([k, ok]) => <Row key={k} k={k} v={<span className="inline-flex items-center gap-1.5"><Dot ok={ok} />{ok ? "Set up" : "Missing"}</span>} />)}
              </div>
            </Panel>
            <Panel title="Emails (last 24 hours)">
              <div className="divide-y divide-slate-700/60 -my-1.5">
                <Row k="Sent" v={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" />{emailSent}</span>} />
                <Row k="Failed" v={<span className={emailFailed ? "text-red-300" : ""}>{emailFailed}</span>} />
                <Row k="Last failure" v={h.email.lastFailure ? <span className="text-xs">{fmtWhen(h.email.lastFailure.createdAt)} · {h.email.lastFailure.subject}</span> : "None"} />
              </div>
              <Link href="/admin/email-logs" className="block mt-3 text-xs font-semibold text-indigo-300">Open email logs →</Link>
            </Panel>
            <Panel title="Waiting for the team">
              <div className="divide-y divide-slate-700/60 -my-1.5">
                <Row k="Plan payments to check" v={<Link href="/admin/billing" className="text-indigo-300">{h.queues.pendingPayments}</Link>} />
                <Row k="Open tickets" v={<Link href="/admin/support" className="text-indigo-300">{h.queues.openTickets}</Link>} />
                <Row k="Tickets with no answer yet" v={<span className={cn("inline-flex items-center gap-1", h.queues.unansweredTickets && "text-amber-300")}><Inbox className="w-3.5 h-3.5" />{h.queues.unansweredTickets}</span>} />
              </div>
            </Panel>
            <Panel title="Security (last 24 hours)">
              <div className="divide-y divide-slate-700/60 -my-1.5">
                <Row k="Wrong studio logins" v={h.security.failedStudioLogins24h} />
                <Row k="Wrong team logins / codes" v={<span className={h.security.failedTeamLogins24h ? "text-amber-300" : ""}>{h.security.failedTeamLogins24h}</span>} />
              </div>
            </Panel>
          </div>

          <Panel title="Studios almost out of storage" sub="80% or more of their cloud storage used">
            {h.storageNearFull.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <div className="space-y-2">
                {h.storageNearFull.map(s => (
                  <Link key={s.id} href={`/admin/studios/${s.id}`} className="flex items-center gap-3 text-sm">
                    <HardDrive className="w-4 h-4 text-slate-500" />
                    <span className="flex-1 text-slate-200 truncate">{s.name}</span>
                    <span className="w-32 h-2 rounded-full bg-slate-700 overflow-hidden"><span className={cn("block h-full", s.pct >= 95 ? "bg-red-500" : "bg-amber-500")} style={{ width: `${Math.min(100, s.pct)}%` }} /></span>
                    <span className="w-10 text-right text-xs text-slate-400">{s.pct}%</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
          <p className="text-[11px] text-slate-600 flex items-center gap-1"><Server className="w-3 h-3" />Hosting: Railway (server) · Vercel (website) · Supabase (database).</p>
        </>
      )}
    </Page>
  );
}
