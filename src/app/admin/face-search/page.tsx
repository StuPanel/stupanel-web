"use client";

/**
 * Super admin: AI Face Search.
 *  - Overview: is the engine set up, how much is used, what it costs at Amazon
 *  - Studios: credits, usage and an on/off switch for each studio; give or take back credits
 *  - Credit history: every change across all studios
 *  - Settings: on/off for everyone, welcome credits for new studios, the sentence studios read while it is off
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Coins, Images, Loader2, Minus, Plus, Power, RefreshCw, ScanFace, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Btn, Msg, Page, Panel, fmtWhen, inp } from "../_components/staff-kit";

type Settings = { enabled: boolean; welcomeCredits: number; offNotice: string };
type Entry = { id: string; companyId?: string; studio?: string; delta: number; bucket: string; kind: string; note: string | null; actor: string | null; balanceAfter: number; createdAt: string; gallery?: string | null };
type Overview = {
  engine: { ready: boolean; region: string }; settings: Settings;
  totals: {
    studios: number; studiosOff: number; galleries: number; published: number; draft: number; closed: number;
    photos: number; ready: number; waiting: number; failed: number; faces: number; guests: number; found: number;
    creditsLeft: number; creditsGiven: number; usedThisMonth: number; usedTotal: number; awsUsdThisMonth: number;
  };
  days: { day: string; used: number }[]; recent: Entry[];
};
type StudioRow = { id: string; name: string; email: string; galleries: number; photos: number; guests: number; plan: number; purchased: number; credits: number; usedThisMonth: number; usedTotal: number; disabled: boolean; lastActivity: string | null };
type StudioDetail = {
  studio: { id: string; name: string; email: string; phone: string | null }; balance: { plan: number; purchased: number; total: number };
  disabled: boolean; adminNote: string | null; usedTotal: number;
  galleries: { id: string; title: string; status: string; photos: number; ready: number; waiting: number; failed: number; guests: number; createdAt: string }[];
  entries: Entry[];
};
type Tab = "overview" | "studios" | "history" | "settings";

const num = (n: number) => (n ?? 0).toLocaleString("en");
const authH = () => ({ Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
const KIND: Record<string, string> = { grant: "Given", use: "Used", purchase: "Bought", adjust: "Taken back", refund: "Refund", expire: "Expired" };

export default function AdminFaceSearchPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const call = useCallback(async <T,>(path: string, init?: { method?: string; json?: unknown }): Promise<T> => {
    const r = await fetch(`${API}/admin/face-search${path}`, {
      method: init?.method ?? "GET",
      headers: { ...authH(), ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    if (r.status === 401) { router.replace("/admin/login"); throw new Error("Please sign in again."); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || (r.status === 403 ? "Your role cannot do this." : "Something went wrong. Please try again."));
    return d as T;
  }, [router]);

  const load = useCallback(() => call<Overview>("/overview").then(d => { setO(d); setError(""); }).catch(e => setError(e.message)), [call]);
  useEffect(() => { void load(); }, [load]);

  const tabs: { id: Tab; label: string }[] = [{ id: "overview", label: "Overview" }, { id: "studios", label: "Studios" }, { id: "history", label: "Credit history" }, { id: "settings", label: "Settings" }];

  return (
    <Page title="AI Face Search" sub="Switches, credits and usage for every studio"
      right={o && (
        <span className={cn("h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap", o.settings.enabled ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900" : "bg-red-950/60 text-red-300 border border-red-900")}>
          <Power className="w-3.5 h-3.5" />{o.settings.enabled ? "On for studios" : "Off for everyone"}
        </span>
      )}>
      <div role="tablist" aria-label="AI Face Search sections" className="flex gap-1 p-1 rounded-xl bg-slate-800 border border-slate-700 w-full sm:w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("h-9 px-4 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors", tab === t.id ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{t.label}</button>
        ))}
      </div>
      <Msg error={error} />
      {!o ? !error && <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : tab === "overview" ? <OverviewTab o={o} call={call} onDone={load} onStudio={id => { setTab("studios"); setOpen(id); }} />
        : tab === "studios" ? <StudiosTab call={call} open={open} setOpen={setOpen} onChanged={load} />
        : tab === "history" ? <HistoryTab call={call} onStudio={id => { setTab("studios"); setOpen(id); }} />
        : <SettingsTab o={o} call={call} onSaved={load} />}
    </Page>
  );
}

type Call = <T>(path: string, init?: { method?: string; json?: unknown }) => Promise<T>;

function Stat({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 min-w-0">
      <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums mt-1">{value}</p>
      {sub && <p className={cn("text-xs mt-0.5", tone === "warn" ? "text-amber-300" : "text-slate-400")}>{sub}</p>}
    </div>
  );
}

function OverviewTab({ o, call, onDone, onStudio }: { o: Overview; call: Call; onDone: () => void; onStudio: (id: string) => void }) {
  const t = o.totals;
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const max = Math.max(1, ...o.days.map(d => d.used));
  async function retry() {
    setBusy(true); setOk("");
    try { const d = await call<{ retried: number }>("/retry-failed", { method: "POST", json: {} }); setOk(d.retried ? `${num(d.retried)} photos are in the queue again.` : "No photo is waiting for a retry."); onDone(); } catch (e) { setOk((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="space-y-5">
      {!o.engine.ready && (
        <p className="flex items-start gap-2 text-sm text-amber-200 bg-amber-950/40 border border-amber-900 rounded-xl px-4 py-3"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />The Amazon keys are not set on the server, so photos wait and are not read. Add FACE_AWS_ACCESS_KEY_ID and FACE_AWS_SECRET_ACCESS_KEY in Railway.</p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Coins} label="Credits used this month" value={num(t.usedThisMonth)} sub={`About US$${t.awsUsdThisMonth.toFixed(2)} at Amazon`} />
        <Stat icon={Coins} label="Credits studios still have" value={num(t.creditsLeft)} sub={`${num(t.usedTotal)} used so far`} />
        <Stat icon={Images} label="Photos read" value={num(t.ready)} sub={t.failed ? `${num(t.failed)} could not be read` : t.waiting ? `${num(t.waiting)} in the queue` : `${num(t.faces)} faces found`} tone={t.failed ? "warn" : undefined} />
        <Stat icon={Users} label="Guests" value={num(t.guests)} sub={t.guests ? `${Math.round((t.found / t.guests) * 100)}% found their photos` : "No guests yet"} />
      </div>
      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <Panel title="Credits used, last 30 days" sub="One credit is one photo read by Amazon" className="lg:col-span-2">
          <div className="flex items-end gap-[3px] h-32" role="img" aria-label={`Credits used each day for the last 30 days, ${num(o.days.reduce((s, d) => s + d.used, 0))} in total`}>
            {o.days.map(d => (
              <div key={d.day} title={`${d.day}: ${num(d.used)}`} className="flex-1 min-w-0 rounded-t bg-indigo-500/80 hover:bg-indigo-400" style={{ height: `${d.used ? Math.max(4, (d.used / max) * 100) : 1}%`, opacity: d.used ? 1 : 0.25 }} />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1.5"><span>{o.days[0]?.day}</span><span>{o.days[o.days.length - 1]?.day}</span></div>
        </Panel>
        <Panel title="Status">
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between gap-3"><span className="text-slate-400">Engine</span><span className={cn("font-semibold inline-flex items-center gap-1.5", o.engine.ready ? "text-emerald-300" : "text-amber-300")}>{o.engine.ready ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{o.engine.ready ? "Connected" : "Not set up"}</span></li>
            <li className="flex justify-between gap-3"><span className="text-slate-400">Amazon region</span><span className="text-white">{o.engine.region}</span></li>
            <li className="flex justify-between gap-3"><span className="text-slate-400">Studios using it</span><span className="text-white tabular-nums">{num(t.studios)}{t.studiosOff ? ` · ${num(t.studiosOff)} off` : ""}</span></li>
            <li className="flex justify-between gap-3"><span className="text-slate-400">Galleries</span><span className="text-white tabular-nums">{num(t.galleries)} · {num(t.published)} published</span></li>
            <li className="flex justify-between gap-3"><span className="text-slate-400">In the queue</span><span className="text-white tabular-nums">{num(t.waiting)}</span></li>
            <li className="flex justify-between gap-3"><span className="text-slate-400">Could not be read</span><span className={cn("tabular-nums", t.failed ? "text-amber-300" : "text-white")}>{num(t.failed)}</span></li>
          </ul>
          <Btn variant="ghost" className="mt-4 w-full" loading={busy} disabled={!t.failed} onClick={retry}><RefreshCw className="w-3.5 h-3.5" />Try failed photos again</Btn>
          {ok && <p role="status" className="text-xs text-slate-300 mt-2">{ok}</p>}
        </Panel>
      </div>
      <Panel title="Newest credit changes">
        <EntryList entries={o.recent} onStudio={onStudio} />
      </Panel>
    </div>
  );
}

function EntryList({ entries, onStudio }: { entries: Entry[]; onStudio?: (id: string) => void }) {
  if (!entries.length) return <p className="text-sm text-slate-400">Nothing yet.</p>;
  return (
    <ul className="divide-y divide-slate-700/70 -my-2">
      {entries.map(e => (
        <li key={e.id} className="py-2.5 flex items-center gap-3 min-w-0">
          <span className={cn("w-16 text-right text-sm font-bold tabular-nums flex-shrink-0", e.delta > 0 ? "text-emerald-300" : "text-slate-200")}>{e.delta > 0 ? "+" : "−"}{num(Math.abs(e.delta))}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-white truncate">
              {e.studio && (onStudio && e.companyId ? <button type="button" onClick={() => onStudio(e.companyId!)} className="font-semibold hover:underline">{e.studio}</button> : <b>{e.studio}</b>)}
              {e.studio && " · "}{KIND[e.kind] ?? e.kind}{e.gallery ? ` · ${e.gallery}` : ""}
            </span>
            <span className="block text-xs text-slate-400 truncate">{[e.note, e.actor ? `by ${e.actor}` : "", fmtWhen(e.createdAt)].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-xs text-slate-400 tabular-nums flex-shrink-0 hidden sm:block">left {num(e.balanceAfter)}</span>
        </li>
      ))}
    </ul>
  );
}

function StudiosTab({ call, open, setOpen, onChanged }: { call: Call; open: string | null; setOpen: (id: string | null) => void; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StudioRow[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback((term: string) => call<{ studios: StudioRow[] }>(`/studios${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`).then(d => { setRows(d.studios); setError(""); }).catch(e => setError(e.message)), [call]);
  useEffect(() => { const t = setTimeout(() => void load(q), q ? 350 : 0); return () => clearTimeout(t); }, [q, load]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)} type="search" aria-label="Search studios" placeholder="Search any studio by name or email" className={cn(inp, "pl-9 h-10")} />
      </div>
      <p className="text-xs text-slate-400">{q.trim() ? "Search looks at every studio, so you can give credits before a studio has used Face Search." : "Studios that have a face gallery or credits."}</p>
      <Msg error={error} />
      <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
              <th className="font-medium px-4 py-3">Studio</th><th className="font-medium px-3 py-3 text-right">Credits left</th><th className="font-medium px-3 py-3 text-right">Used this month</th>
              <th className="font-medium px-3 py-3 text-right">Galleries</th><th className="font-medium px-3 py-3 text-right">Photos</th><th className="font-medium px-3 py-3 text-right">Guests</th><th className="font-medium px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? <tr><td colSpan={7} className="py-10 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-slate-400">{q.trim() ? "No studio matches." : "No studio has used Face Search yet. Search a studio to give it credits."}</td></tr>
              : rows.map(r => (
                <tr key={r.id} onClick={() => setOpen(r.id)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") setOpen(r.id); }}
                  className="border-b border-slate-700/60 last:border-0 hover:bg-slate-700/40 cursor-pointer focus:outline-none focus-visible:bg-slate-700/60">
                  <td className="px-4 py-3"><p className="font-semibold text-white">{r.name}</p><p className="text-xs text-slate-400">{r.email}</p></td>
                  <td className="px-3 py-3 text-right tabular-nums text-white font-semibold">{num(r.credits)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">{num(r.usedThisMonth)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">{num(r.galleries)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">{num(r.photos)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">{num(r.guests)}</td>
                  <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", r.disabled ? "bg-red-950/60 text-red-300" : "bg-emerald-950/60 text-emerald-300")}>{r.disabled ? "Off" : "On"}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
      {open && <StudioDrawer key={open} id={open} call={call} onClose={() => setOpen(null)} onChanged={() => { void load(q); onChanged(); }} />}
    </div>
  );
}

function StudioDrawer({ id, call, onClose, onChanged }: { id: string; call: Call; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<StudioDetail | null>(null);
  const [mode, setMode] = useState<"give" | "take">("give");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  useEffect(() => { call<StudioDetail>(`/studios/${id}`).then(setD).catch(e => setMsg({ error: e.message })); }, [id, call]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const n = Math.round(Number(amount));
  const valid = Number.isFinite(n) && n > 0;
  const after = d ? Math.max(0, d.balance.total + (mode === "give" ? n : -n)) : 0;

  async function change() {
    if (!valid || busy) return;
    setBusy("credits"); setMsg({});
    try {
      const r = await call<StudioDetail & { changed: number }>(`/studios/${id}/credits`, { method: "POST", json: { amount: mode === "give" ? n : -n, bucket: "purchased", note } });
      setD(r); setAmount(""); setNote(""); onChanged();
      setMsg({ ok: r.changed > 0 ? `${num(r.changed)} credits given.` : `${num(-r.changed)} credits taken back.` });
    } catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }
  async function toggle() {
    if (!d || busy) return;
    setBusy("access"); setMsg({});
    try { const r = await call<StudioDetail>(`/studios/${id}/access`, { method: "POST", json: { disabled: !d.disabled } }); setD(r); onChanged(); setMsg({ ok: r.disabled ? "Face Search is off for this studio." : "Face Search is on for this studio." }); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }
  async function retry() {
    setBusy("retry"); setMsg({});
    try { const r = await call<{ retried: number }>(`/studios/${id}/retry-failed`, { method: "POST", json: {} }); setMsg({ ok: r.retried ? `${num(r.retried)} photos are in the queue again.` : "No photo is waiting for a retry." }); setD(await call<StudioDetail>(`/studios/${id}`)); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }
  const failed = useMemo(() => (d?.galleries ?? []).reduce((s, g) => s + g.failed, 0), [d]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Studio's Face Search">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-[560px] h-full bg-slate-900 border-l border-slate-700 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-5 py-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center flex-shrink-0"><ScanFace className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white truncate">{d?.studio.name ?? "Studio"}</h2>
            <p className="text-xs text-slate-400 truncate">{d ? [d.studio.email, d.studio.phone].filter(Boolean).join(" · ") : "Loading…"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        {!d ? <div className="p-5"><Msg error={msg.error} />{!msg.error && <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>}</div> : (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3"><p className="text-xs text-slate-400">Credits left</p><p className="text-xl font-bold text-white tabular-nums">{num(d.balance.total)}</p></div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3"><p className="text-xs text-slate-400">Used so far</p><p className="text-xl font-bold text-white tabular-nums">{num(d.usedTotal)}</p></div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3"><p className="text-xs text-slate-400">Galleries</p><p className="text-xl font-bold text-white tabular-nums">{num(d.galleries.length)}</p></div>
            </div>
            <Msg error={msg.error} ok={msg.ok} />

            <Panel title="Credits" sub="The studio sees this change, with your note, in its credit history.">
              <div className="flex gap-1 p-1 rounded-lg bg-slate-900 border border-slate-700 w-fit mb-3" role="radiogroup" aria-label="Give or take back">
                {(["give", "take"] as const).map(m => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                    className={cn("h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5", mode === m ? (m === "give" ? "bg-emerald-600 text-white" : "bg-red-700 text-white") : "text-slate-300 hover:bg-slate-800")}>
                    {m === "give" ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}{m === "give" ? "Give credits" : "Take back"}
                  </button>
                ))}
              </div>
              <div className="grid sm:grid-cols-[140px_1fr] gap-3">
                <div>
                  <label htmlFor="fa-amount" className="block text-xs font-medium text-slate-300 mb-1">How many</label>
                  <input id="fa-amount" className={cn(inp, "tabular-nums")} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="1000" />
                </div>
                <div>
                  <label htmlFor="fa-note" className="block text-xs font-medium text-slate-300 mb-1">Note for the studio (optional)</label>
                  <input id="fa-note" className={inp} value={note} maxLength={250} onChange={e => setNote(e.target.value)} placeholder={mode === "give" ? "Free trial credits" : "Given by mistake"} />
                </div>
              </div>
              {mode === "give" && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {[100, 500, 1000, 5000, 10000].map(v => <button key={v} type="button" onClick={() => setAmount(String(v))} className="h-7 px-2.5 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 tabular-nums">{num(v)}</button>)}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 mt-4">
                <p className="text-xs text-slate-400">{valid ? <>After this: <b className="text-white tabular-nums">{num(after)}</b> credits</> : "Type a number."}</p>
                <Btn onClick={change} loading={busy === "credits"} disabled={!valid} variant={mode === "give" ? "primary" : "danger"}>{mode === "give" ? `Give ${valid ? num(n) : ""} credits` : `Take back ${valid ? num(n) : ""} credits`}</Btn>
              </div>
            </Panel>

            <Panel title="Access">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{d.disabled ? "Off for this studio" : "On for this studio"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{d.disabled ? "The studio can't make galleries or add photos, and guest search is closed. Nothing is deleted." : "Turn it off to stop new galleries, new photos and guest search for this studio only."}</p>
                </div>
                <Btn variant={d.disabled ? "primary" : "danger"} loading={busy === "access"} onClick={toggle}>{d.disabled ? "Turn on" : "Turn off"}</Btn>
              </div>
            </Panel>

            <Panel title={`Galleries (${num(d.galleries.length)})`}>
              {d.galleries.length === 0 ? <p className="text-sm text-slate-400">No face gallery yet.</p> : (
                <ul className="divide-y divide-slate-700/70 -my-2">
                  {d.galleries.map(g => (
                    <li key={g.id} className="py-2.5 flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white truncate">{g.title}</span>
                        <span className="block text-xs text-slate-400 truncate">{[`${num(g.photos)} photos`, g.waiting ? `${num(g.waiting)} in the queue` : "", g.failed ? `${num(g.failed)} not read` : "", `${num(g.guests)} guests`, fmtWhen(g.createdAt)].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0", g.status === "published" ? "bg-emerald-950/60 text-emerald-300" : g.status === "closed" ? "bg-slate-700 text-slate-300" : "bg-amber-950/50 text-amber-300")}>{g.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {failed > 0 && <Btn variant="ghost" className="mt-4" loading={busy === "retry"} onClick={retry}><RefreshCw className="w-3.5 h-3.5" />Try {num(failed)} failed photos again</Btn>}
            </Panel>

            <Panel title="Credit history" sub="Newest first, up to 100"><EntryList entries={d.entries} /></Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ call, onStudio }: { call: Call; onStudio: (id: string) => void }) {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { call<Entry[]>("/entries").then(setRows).catch(e => setError(e.message)); }, [call]);
  return (
    <Panel title="Credit history" sub="The newest 100 changes across all studios">
      <Msg error={error} />
      {rows === null ? !error && <div className="py-10 flex justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div> : <EntryList entries={rows} onStudio={onStudio} />}
    </Panel>
  );
}

function SettingsTab({ o, call, onSaved }: { o: Overview; call: Call; onSaved: () => void }) {
  const [s, setS] = useState<Settings>(o.settings);
  const [welcome, setWelcome] = useState(String(o.settings.welcomeCredits));
  const [notice, setNotice] = useState(o.settings.offNotice);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  async function save(patch: Partial<Settings>, key: string, done: string) {
    setBusy(key); setMsg({});
    try { const r = await call<Settings>("/settings", { method: "PUT", json: patch }); setS(r); setWelcome(String(r.welcomeCredits)); setNotice(r.offNotice); setMsg({ ok: done }); onSaved(); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Msg error={msg.error} ok={msg.ok} />
      <Panel title="AI Face Search for all studios">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{s.enabled ? "On" : "Off for everyone"}</p>
            <p className="text-xs text-slate-400 mt-0.5">Off stops new galleries, new photos and guest search in every studio. Galleries, photos and credits stay as they are.</p>
          </div>
          <Btn variant={s.enabled ? "danger" : "primary"} loading={busy === "enabled"} onClick={() => save({ enabled: !s.enabled }, "enabled", s.enabled ? "Face Search is off for everyone." : "Face Search is on.")}>{s.enabled ? "Turn off for everyone" : "Turn on"}</Btn>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700/70">
          <label htmlFor="fa-notice" className="block text-xs font-medium text-slate-300 mb-1">What studios read while it is off</label>
          <div className="flex gap-2">
            <input id="fa-notice" className={inp} value={notice} maxLength={300} onChange={e => setNotice(e.target.value)} />
            <Btn variant="ghost" loading={busy === "notice"} disabled={notice.trim() === s.offNotice} onClick={() => save({ offNotice: notice }, "notice", "Saved.")}>Save</Btn>
          </div>
        </div>
      </Panel>

      <Panel title="Welcome credits" sub="Free credits a studio gets the first time it opens AI Face Search. Studios that opened it before are not changed.">
        <div className="flex items-end gap-2">
          <div className="w-40">
            <label htmlFor="fa-welcome" className="block text-xs font-medium text-slate-300 mb-1">Credits for a new studio</label>
            <input id="fa-welcome" className={cn(inp, "tabular-nums")} inputMode="numeric" value={welcome} onChange={e => setWelcome(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
          <Btn loading={busy === "welcome"} disabled={Number(welcome || 0) === s.welcomeCredits} onClick={() => save({ welcomeCredits: Number(welcome || 0) }, "welcome", "Saved.")}>Save</Btn>
        </div>
        <p className="text-xs text-slate-400 mt-2">0 means a new studio starts with no credits until you give some in Studios.</p>
      </Panel>

      <Panel title="What a credit is">
        <ul className="text-sm text-slate-300 space-y-1.5">
          <li>1 credit = 1 photo added to a face gallery (read once by Amazon, about US$0.001).</li>
          <li>Guest selfie search, viewing and downloads are free for the studio.</li>
          <li>RAW files, videos and the same photo added twice are not counted.</li>
          <li>Selling credit packs and credits included in plans are not built yet.</li>
        </ul>
      </Panel>
    </div>
  );
}
