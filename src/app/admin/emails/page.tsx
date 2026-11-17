"use client";

/**
 * Super admin: how many emails each studio sends (they cost money at Resend), by week, month, year or all time,
 * who got them (clients, team, the studio itself, event guests) and what they were. Set a monthly limit per studio
 * here; a plan's limit is set on Plans. Over the limit, a studio's emails are held (account emails always go).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, DownloadCloud, Loader2, Mail, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Btn, Msg, Page, Panel, fmtWhen, inp } from "../_components/staff-kit";
import { WHO, kindLabel, limitText, n, whoOf, type EmailBar, type EmailCounts, type EmailKindRow, type EmailMonth, type EmailWho } from "@/lib/email-usage";

type Period = "week" | "month" | "year" | "all";
const PERIODS: { id: Period; label: string }[] = [{ id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "year", label: "Year" }, { id: "all", label: "All time" }];

type StudioRow = EmailCounts & { id: string; name: string; logoUrl: string | null; plan: string | null; limit: number | null; limitFrom: "studio" | "plan" | "none"; ownLimit: number | null; usedThisMonth: number };
type Overview = { label: string; totals: EmailCounts; platform: EmailCounts; series: EmailBar[]; kinds: EmailKindRow[]; studios: StudioRow[] };
type Detail = {
  studio: { id: string; name: string; logoUrl: string | null; plan: string | null; planLimit: number | null; ownLimit: number | null };
  month: EmailMonth; label: string; totals: EmailCounts; series: EmailBar[]; kinds: EmailKindRow[];
  recent: { id: string; to: string; subject: string; kind: string; who: EmailWho; status: string; at: string }[];
};

const token = () => sessionStorage.getItem("admin_token") ?? "";
const H = (json = false) => ({ Authorization: `Bearer ${token()}`, ...(json ? { "Content-Type": "application/json" } : {}) });

export default function AdminEmailsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");
  const [back, setBack] = useState(0);
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  /** Emails sent before counting started (17 Nov 2026) are brought in from Resend's own list. */
  async function importPast() {
    setImporting(true); setErr(""); setOkMsg("");
    try {
      const r = await fetch(`${API}/admin/email-usage/import`, { method: "POST", headers: H() });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(r.status === 403 ? "Only staff who manage plans can do this." : x.message || "Couldn't bring in past emails."); return; }
      setOkMsg(x.imported ? `Brought in ${n(x.imported)} past emails${x.oldest ? ` (oldest ${fmtWhen(x.oldest)})` : ""}.` : "Nothing new — all emails Resend still has are already counted.");
      setPeriod("all"); setBack(0); void load();
    } finally { setImporting(false); }
  }

  const load = useCallback(async () => {
    setErr("");
    const r = await fetch(`${API}/admin/email-usage?period=${period}&back=${back}`, { headers: H() }).catch(() => null);
    if (r?.status === 401) { router.replace("/admin/login"); return; }
    if (!r?.ok) { setErr(r?.status === 403 ? "You don't have access to reports." : "Couldn't load the email numbers."); return; }
    setO(await r.json());
  }, [period, back, router]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (open) return <StudioView id={open} onBack={() => { setOpen(null); void load(); }} />;

  const list = (o?.studios ?? []).filter(s => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Page title="Emails" sub="How many emails each studio sends, to whom, and its monthly limit. Each person an email goes to counts as one."
      right={<div className="flex gap-2"><Btn variant="ghost" loading={importing} onClick={importPast} title="Bring in emails sent before counting started, from Resend"><DownloadCloud className="w-3.5 h-3.5" />Past emails</Btn><Btn variant="ghost" onClick={() => void load()}><RefreshCw className="w-3.5 h-3.5" />Refresh</Btn></div>}>
      <PeriodBar period={period} back={back} label={o?.label ?? ""} onPeriod={p => { setPeriod(p); setBack(0); }} onBack={setBack} />
      <Msg error={err} ok={okMsg} />
      {!o ? <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div> : (
        <>
          <Totals c={o.totals} />
          <Panel title="Emails sent" sub={o.label}><Bars bars={o.series} /></Panel>
          <Panel title="Studios" sub="Biggest senders first. Open one to see its emails and set its own limit.">
            <div className="relative mb-3 max-w-xs">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a studio" className={cn(inp, "pl-9")} aria-label="Find a studio" />
            </div>
            {list.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">No studio sent emails in this time.</p> : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                      <th className="font-medium px-5 py-2">Studio</th>
                      <th className="font-medium px-3 py-2 w-[190px]">This month / limit</th>
                      <th className="font-medium px-3 py-2 text-right">Sent</th>
                      {WHO.filter(w => w.id !== "system").map(w => <th key={w.id} className="font-medium px-3 py-2 text-right">{w.short}</th>)}
                      <th className="font-medium px-5 py-2 text-right">Held</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(s => {
                      const m = limitText({ limit: s.limit, limitFrom: s.limitFrom, used: s.usedThisMonth, left: null, since: "" });
                      return (
                        <tr key={s.id} onClick={() => setOpen(s.id)} className="border-b border-slate-700/60 hover:bg-slate-700/40 cursor-pointer">
                          <td className="px-5 py-2.5">
                            <p className="text-white font-medium">{s.name}</p>
                            <p className="text-xs text-slate-500">{s.plan ?? "No plan"}{s.limitFrom === "studio" ? " · own limit" : ""}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <p className={cn("text-xs tabular-nums", m.over ? "text-red-300" : m.near ? "text-amber-300" : "text-slate-300")}>{s.limit === null ? `${n(s.usedThisMonth)} · no limit` : m.text}</p>
                            {s.limit !== null && <div className="h-1.5 mt-1 rounded-full bg-slate-700 overflow-hidden"><div className={cn("h-full rounded-full", m.over ? "bg-red-400" : m.near ? "bg-amber-400" : "bg-indigo-400")} style={{ width: `${m.pct}%` }} /></div>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-white font-semibold tabular-nums">{n(s.total)}</td>
                          {WHO.filter(w => w.id !== "system").map(w => <td key={w.id} className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{s[w.id] ? n(s[w.id]) : "—"}</td>)}
                          <td className={cn("px-5 py-2.5 text-right tabular-nums", s.blocked ? "text-red-300 font-semibold" : "text-slate-500")}>{s.blocked ? n(s.blocked) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {o.platform.total > 0 && <p className="text-xs text-slate-500 mt-3">StuPanel&apos;s own emails (sign-up, password, notices) not tied to a studio: {n(o.platform.total)}.</p>}
          </Panel>
          <Panel title="What was sent" sub="Every kind of email. New kinds appear here by themselves."><Kinds rows={o.kinds} /></Panel>
        </>
      )}
    </Page>
  );
}

function PeriodBar({ period, back, label, onPeriod, onBack }: { period: Period; back: number; label: string; onPeriod: (p: Period) => void; onBack: (n: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex p-1 rounded-lg bg-slate-800 border border-slate-700" role="radiogroup" aria-label="Time">
        {PERIODS.map(p => (
          <button key={p.id} type="button" role="radio" aria-checked={period === p.id} onClick={() => onPeriod(p.id)}
            className={cn("h-8 px-3.5 rounded-md text-xs font-semibold transition-colors", period === p.id ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{p.label}</button>
        ))}
      </div>
      {period !== "all" && (
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => onBack(back + 1)} aria-label="Earlier" className="w-8 h-8 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-700 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-white">{label}</span>
          <button type="button" onClick={() => onBack(Math.max(0, back - 1))} disabled={back === 0} aria-label="Later" className="w-8 h-8 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-700 flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function Totals({ c }: { c: EmailCounts }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
      <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-xs text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Sent</p>
        <p className="text-3xl font-bold text-white tabular-nums mt-1">{n(c.total)}</p>
      </div>
      {WHO.map(w => (
        <div key={w.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: w.color }} />{w.short}</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">{n(c[w.id])}</p>
        </div>
      ))}
      <div className={cn("bg-slate-800 border rounded-xl p-3.5", c.blocked || c.failed ? "border-red-900" : "border-slate-700")}>
        <p className="text-[11px] text-slate-400">Held · Failed</p>
        <p className={cn("text-xl font-bold tabular-nums mt-1", c.blocked || c.failed ? "text-red-300" : "text-white")}>{n(c.blocked)} · {n(c.failed)}</p>
      </div>
    </div>
  );
}

/** Stacked bars: each bar split by who got the emails. */
function Bars({ bars }: { bars: EmailBar[] }) {
  const max = Math.max(1, ...bars.map(b => b.total));
  const every = bars.length > 16 ? Math.ceil(bars.length / 10) : 1;
  return (
    <div>
      <div className="h-44 flex items-end gap-[3px]" role="img" aria-label={`Emails sent: ${bars.map(b => `${b.label} ${b.total}`).join(", ")}`}>
        {bars.map(b => (
          <div key={b.key} className="group flex-1 min-w-0 h-full flex flex-col justify-end relative" title={`${b.label}: ${n(b.total)} sent${WHO.filter(w => b[w.id]).map(w => `\n${w.short}: ${n(b[w.id])}`).join("")}`}>
            <div className="w-full max-w-[56px] mx-auto rounded-t-[3px] overflow-hidden flex flex-col-reverse transition-[height] duration-500 ease-out group-hover:opacity-80" style={{ height: `${(b.total / max) * 100}%` }}>
              {WHO.map(w => b[w.id] ? <div key={w.id} style={{ height: `${(b[w.id] / b.total) * 100}%`, background: w.color }} /> : null)}
            </div>
            {b.total === 0 && <div className="w-full h-[2px] bg-slate-700 rounded" />}
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {bars.map((b, i) => <span key={b.key} className="flex-1 min-w-0 text-center text-[10px] text-slate-500 tabular-nums truncate">{i % every === 0 ? b.label : ""}</span>)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {WHO.map(w => <span key={w.id} className="text-xs text-slate-400 inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: w.color }} />{w.label}</span>)}
      </div>
    </div>
  );
}

function Kinds({ rows }: { rows: EmailKindRow[] }) {
  if (!rows.length) return <p className="text-sm text-slate-400 py-4 text-center">No emails in this time.</p>;
  const max = Math.max(1, ...rows.map(r => r.sent));
  return (
    <ul className="space-y-2">
      {rows.map(r => {
        const w = whoOf(r.who);
        return (
          <li key={`${r.kind}|${r.who}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2"><span className="text-sm text-white truncate">{kindLabel(r.kind)}</span><span className="text-[11px] text-slate-500 flex-shrink-0">{w.short}</span></div>
              <div className="h-1.5 mt-1 rounded-full bg-slate-700/60 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(r.sent / max) * 100}%`, background: w.color }} /></div>
            </div>
            <span className="text-sm tabular-nums text-right">
              <span className="text-white font-semibold">{n(r.sent)}</span>
              {r.blocked > 0 && <span className="text-red-300 text-xs ml-2">{n(r.blocked)} held</span>}
              {r.failed > 0 && <span className="text-red-300 text-xs ml-2">{n(r.failed)} failed</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StudioView({ id, onBack }: { id: string; onBack: () => void }) {
  const [period, setPeriod] = useState<Period>("month");
  const [back, setBack] = useState(0);
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [mode, setMode] = useState<"plan" | "none" | "own">("plan");
  const [own, setOwn] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/admin/email-usage/${id}?period=${period}&back=${back}`, { headers: H() }).catch(() => null);
    if (!r?.ok) { setErr("Couldn't load this studio."); return; }
    const x: Detail = await r.json();
    setD(x);
    setMode(x.studio.ownLimit === null ? "plan" : x.studio.ownLimit === 0 ? "none" : "own");
    setOwn(x.studio.ownLimit ? String(x.studio.ownLimit) : "");
  }, [id, period, back]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function saveLimit() {
    setErr(""); setOk("");
    const limit = mode === "plan" ? null : mode === "none" ? 0 : Math.floor(Number(own));
    if (mode === "own" && (!limit || limit < 1)) { setErr("Type how many emails a month, 1 or more."); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/email-usage/${id}/limit`, { method: "PATCH", headers: H(true), body: JSON.stringify({ limit }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(r.status === 403 ? "Only staff who manage plans can change limits." : x.message || "Couldn't save"); return; }
      setOk("Limit saved."); void load();
    } finally { setSaving(false); }
  }

  const m = d ? limitText(d.month) : null;
  return (
    <Page title={d?.studio.name ?? "Studio"} sub={d ? `${d.studio.plan ?? "No plan"} · emails` : ""}
      right={<Btn variant="ghost" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5" />All studios</Btn>}>
      {!d ? <div className="py-16 flex justify-center">{err ? <Msg error={err} /> : <Loader2 className="w-6 h-6 animate-spin text-slate-500" />}</div> : (
        <>
          <Panel title="This month" sub="What counts against the limit. Account emails (sign-in, password, team invite) always go.">
            <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
              <div>
                <p className={cn("text-3xl font-bold tabular-nums", m!.over ? "text-red-300" : "text-white")}>{m!.text}</p>
                <p className="text-xs text-slate-400 mt-1">{d.month.limit === null ? "No limit" : d.month.limitFrom === "studio" ? "This studio's own limit" : `The ${d.studio.plan} plan's limit`}{d.month.left !== null ? ` · ${n(d.month.left)} left` : ""}</p>
                {d.month.limit !== null && <div className="h-2 mt-3 rounded-full bg-slate-700 overflow-hidden"><div className={cn("h-full rounded-full transition-[width] duration-700", m!.over ? "bg-red-400" : m!.near ? "bg-amber-400" : "bg-indigo-400")} style={{ width: `${m!.pct}%` }} /></div>}
                {m!.over && <p className="text-xs text-red-300 mt-2">Limit reached — this studio&apos;s emails are held until next month or a higher limit.</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">Monthly limit</p>
                <div className="space-y-1.5" role="radiogroup" aria-label="Monthly limit">
                  {([
                    { v: "plan", l: `Use the plan's limit${d.studio.planLimit ? ` (${n(d.studio.planLimit)})` : " (no limit)"}` },
                    { v: "none", l: "No limit for this studio" },
                    { v: "own", l: "Own limit" },
                  ] as const).map(x => (
                    <label key={x.v} className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                      <input type="radio" name="lim" checked={mode === x.v} onChange={() => setMode(x.v)} className="accent-indigo-500" />{x.l}
                      {x.v === "own" && mode === "own" && <input type="number" min={1} value={own} onChange={e => setOwn(e.target.value)} placeholder="e.g. 1000" className={cn(inp, "w-28 h-8")} aria-label="Emails a month" autoFocus />}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2"><Btn loading={saving} onClick={saveLimit}>Save limit</Btn></div>
                <div className="mt-2"><Msg error={err} ok={ok} /></div>
              </div>
            </div>
          </Panel>
          <PeriodBar period={period} back={back} label={d.label} onPeriod={p => { setPeriod(p); setBack(0); }} onBack={setBack} />
          <Totals c={d.totals} />
          <Panel title="Emails sent" sub={d.label}><Bars bars={d.series} /></Panel>
          <Panel title="What was sent"><Kinds rows={d.kinds} /></Panel>
          <Panel title="Latest emails" sub="Up to 50 in this time">
            {d.recent.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">None.</p> : (
              <ul className="divide-y divide-slate-700/60 -my-2">
                {d.recent.map(r => (
                  <li key={r.id} className="py-2 flex items-center gap-3 text-sm">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: whoOf(r.who).color }} title={whoOf(r.who).label} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white truncate">{r.subject}</p>
                      <p className="text-xs text-slate-500 truncate">{kindLabel(r.kind)} · {r.to}</p>
                    </div>
                    {r.status !== "sent" && <span className="text-[11px] font-semibold text-red-300 flex items-center gap-1 flex-shrink-0"><X className="w-3 h-3" />{r.status === "blocked" ? "Held" : "Failed"}</span>}
                    <span className="text-xs text-slate-500 flex-shrink-0 hidden sm:inline">{fmtWhen(r.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}
