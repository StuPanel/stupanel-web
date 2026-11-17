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
import { AlertTriangle, ArrowLeft, CheckCircle2, Coins, Download, ExternalLink, Images, Loader2, Minus, Plus, Power, RefreshCw, ScanFace, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Btn, Msg, Page, Panel, fmtWhen, inp } from "../_components/staff-kit";

type Settings = { enabled: boolean; welcomeCredits: number; offNotice: string; monthlyCap: number };
type Entry = { id: string; companyId?: string; studio?: string; delta: number; bucket: string; kind: string; note: string | null; actor: string | null; balanceAfter: number; createdAt: string; gallery?: string | null };
type Overview = {
  engine: { ready: boolean; region: string }; settings: Settings;
  totals: {
    studios: number; studiosOff: number; galleries: number; published: number; draft: number; closed: number;
    photos: number; ready: number; waiting: number; oldestWaitMin?: number; failed: number; faces: number; guests: number; found: number;
    creditsLeft: number; creditsGiven: number; usedThisMonth: number; usedTotal: number; awsUsdThisMonth: number; capLeft: number | null;
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
type GalleryView = {
  id: string; title: string; status: string; createdAt: string; link: string; studio: { id: string; name: string } | null;
  settings: { guestsSee: string; strictness: string; downloads: boolean; pin: boolean };
  counts: { photos: number; ready: number; waiting: number; failed: number; guests: number; found: number }; creditsUsed: number;
  failed: { id: string; fileName: string; folder: string | null; error: string | null }[]; reasons: { reason: string; count: number }[];
  guests: { id: string; matchCount: number; searches: number; downloads: number; lastSearchAt: string | null; createdAt: string }[];
};
type Pack = { id: string; name: string; credits: number; priceBdt: number; badge: string | null; isActive: boolean; sortOrder: number; perCredit: number };
type Order = { id: string; companyId: string; studio: string; pack: string; credits: number; amountBdt: number; method: string; reference: string; senderNumber: string | null; status: "pending" | "paid" | "rejected"; rejectReason: string | null; placedBy: string | null; reviewedBy: string | null; reviewedAt: string | null; createdAt: string };
type Orders = { orders: Order[]; next: string | null; totals: { pending: number; paidCount: number; paidBdt: number; creditsSold: number } };
type Tab = "overview" | "orders" | "studios" | "history" | "packs" | "settings";
const METHOD: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", gateway: "Gateway" };
/** What one photo costs StuPanel, in taka: Amazon reading + keeping the faces + guests' searches, with a margin for the exchange rate. */
const COST_PER_CREDIT_BDT = 0.25;

const num = (n: number) => (n ?? 0).toLocaleString("en");
const authH = () => ({ Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
const KIND: Record<string, string> = { grant: "Given", use: "Used", purchase: "Bought", adjust: "Taken back", refund: "Refund", expire: "Expired" };

export default function AdminFaceSearchPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  // A link like /admin/face-search?tab=orders (the new-order email) opens that tab.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (!t || !["overview", "orders", "studios", "history", "packs", "settings"].includes(t)) return;
    const id = setTimeout(() => setTab(t as Tab), 0);
    return () => clearTimeout(id);
  }, []);
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

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
  // How many payments wait for a check (the number on the Orders tab). Looked at again every minute.
  const countPending = useCallback(() => call<Orders>("/orders?status=pending").then(d => setPending(d.totals.pending)).catch(() => null), [call]);
  useEffect(() => { void countPending(); const t = setInterval(() => void countPending(), 60000); return () => clearInterval(t); }, [countPending]);

  const tabs: { id: Tab; label: string; count?: number }[] = [{ id: "overview", label: "Overview" }, { id: "orders", label: "Orders", count: pending }, { id: "studios", label: "Studios" }, { id: "history", label: "Credit history" }, { id: "packs", label: "Packs" }, { id: "settings", label: "Settings" }];

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
            className={cn("h-9 px-4 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors", tab === t.id ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700", "inline-flex items-center gap-1.5")}>
            {t.label}{!!t.count && <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-bold inline-flex items-center justify-center tabular-nums">{t.count}</span>}
          </button>
        ))}
      </div>
      <Msg error={error} />
      {!o ? !error && <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : tab === "overview" ? <OverviewTab o={o} call={call} onDone={load} onStudio={id => { setTab("studios"); setOpen(id); }} />
        : tab === "studios" ? <StudiosTab call={call} open={open} setOpen={setOpen} onChanged={load} />
        : tab === "orders" ? <OrdersTab call={call} onChanged={() => { void load(); void countPending(); }} onStudio={id => { setTab("studios"); setOpen(id); }} />
        : tab === "packs" ? <PacksTab call={call} />
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
            <li className="flex justify-between gap-3"><span className="text-slate-400">Monthly limit</span><span className={cn("tabular-nums", t.capLeft !== null && t.capLeft < o.settings.monthlyCap * 0.1 ? "text-amber-300" : "text-white")}>{t.capLeft === null ? "No limit" : `${num(t.capLeft)} of ${num(o.settings.monthlyCap)} left`}</span></li>
            <li className="flex justify-between gap-3"><span className="text-slate-400">In the queue</span><span className="text-white tabular-nums">{num(t.waiting)}{t.waiting > 0 && t.oldestWaitMin !== undefined ? ` · oldest ${t.oldestWaitMin} min` : ""}</span></li>
            {(t.oldestWaitMin ?? 0) > 10 && (
              <li className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-lg px-2.5 py-2">Photos have waited over 10 minutes — one worker can&apos;t keep up. Time to add a second worker server.</li>
            )}
            <li className="flex justify-between gap-3"><span className="text-slate-400">Could not be read</span><span className={cn("tabular-nums", t.failed ? "text-amber-300" : "text-white")}>{num(t.failed)}</span></li>
          </ul>
          <Btn variant="ghost" className="mt-4 w-full" loading={busy} disabled={!t.failed} onClick={retry}><RefreshCw className="w-3.5 h-3.5" />Try failed photos again</Btn>
          {ok && <p role="status" className="text-xs text-slate-300 mt-2">{ok}</p>}
        </Panel>
      </div>
      <Panel title="Newest credit changes">
        <EntryList entries={o.recent} onStudio={onStudio} />
      </Panel>
      <Panel title="Reports" sub="CSV files you can open in Excel or Google Sheets">
        <Reports call={call} />
      </Panel>
    </div>
  );
}

/** Save a month's usage or credit history as a CSV file. */
function Reports({ call }: { call: Call }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function get(kind: "usage" | "entries") {
    setBusy(kind); setError("");
    try {
      const d = await call<{ name: string; text: string }>(`/export/${kind}?month=${month}`);
      const url = URL.createObjectURL(new Blob([d.text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = d.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setError((e as Error).message); }
    setBusy("");
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="fa-month" className="block text-xs font-medium text-slate-300 mb-1">Month</label>
          <input id="fa-month" type="month" className={cn(inp, "w-44")} value={month} max={new Date().toISOString().slice(0, 7)} onChange={e => setMonth(e.target.value || new Date().toISOString().slice(0, 7))} />
        </div>
        <Btn variant="ghost" loading={busy === "usage"} onClick={() => get("usage")}><Download className="w-3.5 h-3.5" />Usage by studio</Btn>
        <Btn variant="ghost" loading={busy === "entries"} onClick={() => get("entries")}><Download className="w-3.5 h-3.5" />Credit history</Btn>
      </div>
      <Msg error={error} />
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
              {e.studio && " · "}{e.kind === "adjust" && e.delta > 0 ? "Added by StuPanel" : KIND[e.kind] ?? e.kind}{e.gallery ? ` · ${e.gallery}` : ""}
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
      <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto max-w-[calc(100vw-3rem)] lg:max-w-full">
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
  const [gal, setGal] = useState<string | null>(null);

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
        {gal ? <GalleryPanel id={gal} call={call} onBack={() => setGal(null)} onChanged={() => { call<StudioDetail>(`/studios/${id}`).then(setD).catch(() => null); onChanged(); }} />
          : !d ? <div className="p-5"><Msg error={msg.error} />{!msg.error && <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>}</div> : (
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
                    <li key={g.id}>
                      <button type="button" onClick={() => setGal(g.id)} className="w-full text-left py-2.5 flex items-center gap-3 rounded-lg hover:bg-slate-700/40 px-2 -mx-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white truncate">{g.title}</span>
                        <span className="block text-xs text-slate-400 truncate">{[`${num(g.photos)} photos`, g.waiting ? `${num(g.waiting)} in the queue` : "", g.failed ? `${num(g.failed)} not read` : "", `${num(g.guests)} guests`, fmtWhen(g.createdAt)].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0", g.status === "published" ? "bg-emerald-950/60 text-emerald-300" : g.status === "closed" ? "bg-slate-700 text-slate-300" : "bg-amber-950/50 text-amber-300")}>{g.status}</span>
                      </button>
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

/** One gallery for support: what it holds, why photos failed, how guests are doing; close it or open it again. */
function GalleryPanel({ id, call, onBack, onChanged }: { id: string; call: Call; onBack: () => void; onChanged: () => void }) {
  const [g, setG] = useState<GalleryView | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  useEffect(() => { call<GalleryView>(`/galleries/${id}`).then(setG).catch(e => setMsg({ error: e.message })); }, [id, call]);

  async function act(action: "close" | "reopen") {
    setBusy(true); setMsg({});
    try { setG(await call<GalleryView>(`/galleries/${id}/status`, { method: "POST", json: { action } })); onChanged(); setMsg({ ok: action === "close" ? "Gallery closed. Guests read that it is closed." : "Gallery is open again as a draft. The studio publishes it." }); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy(false);
  }
  const row = (label: string, value: React.ReactNode) => <li className="flex justify-between gap-3"><span className="text-slate-400">{label}</span><span className="text-white text-right tabular-nums">{value}</span></li>;

  return (
    <div className="p-5 space-y-5">
      <button type="button" onClick={onBack} className="h-9 px-3 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 inline-flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" />Back to the studio</button>
      <Msg error={msg.error} ok={msg.ok} />
      {!g ? !msg.error && <div className="py-16 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white [overflow-wrap:anywhere]">{g.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Made {fmtWhen(g.createdAt)}</p>
            </div>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0", g.status === "published" ? "bg-emerald-950/60 text-emerald-300" : g.status === "closed" ? "bg-slate-700 text-slate-300" : "bg-amber-950/50 text-amber-300")}>{g.status}</span>
          </div>
          <Panel title="Gallery">
            <ul className="space-y-2.5 text-sm">
              {row("Photos", `${num(g.counts.photos)} · ${num(g.counts.ready)} ready`)}
              {row("In the queue", num(g.counts.waiting))}
              {row("Could not be read", <span className={g.counts.failed ? "text-amber-300" : ""}>{num(g.counts.failed)}</span>)}
              {row("Guests", g.counts.guests ? `${num(g.counts.guests)} · ${Math.round((g.counts.found / g.counts.guests) * 100)}% found photos` : "0")}
              {row("Credits used", num(g.creditsUsed))}
              {row("Guests see", g.settings.guestsSee === "all" ? "All photos" : "Only their own")}
              {row("Matching", <span className="capitalize">{g.settings.strictness}</span>)}
              {row("Downloads", g.settings.downloads ? "Allowed" : "Off")}
              {row("Code before selfie", g.settings.pin ? "Yes" : "No")}
            </ul>
            <div className="flex flex-wrap gap-2 mt-4">
              <a href={g.link} target="_blank" rel="noreferrer" className="h-9 px-4 rounded-lg border border-slate-600 text-xs font-semibold text-slate-200 hover:bg-slate-700 inline-flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Open guest page</a>
              {g.status === "closed"
                ? <Btn loading={busy} onClick={() => act("reopen")}>Open again</Btn>
                : <Btn variant="danger" loading={busy} onClick={() => act("close")}>Close this gallery</Btn>}
            </div>
            <p className="text-xs text-slate-400 mt-2">Closing stops guest search for this gallery only. Photos, guests and credits stay.</p>
          </Panel>
          <Panel title={`Photos that could not be read (${num(g.counts.failed)})`}>
            {g.counts.failed === 0 ? <p className="text-sm text-slate-400">None.</p> : (
              <>
                <ul className="space-y-1.5 mb-3">
                  {g.reasons.map(r => <li key={r.reason} className="flex gap-3 text-sm"><span className="w-10 text-right font-bold text-amber-300 tabular-nums flex-shrink-0">{num(r.count)}</span><span className="text-slate-200 [overflow-wrap:anywhere]">{r.reason}</span></li>)}
                </ul>
                <ul className="divide-y divide-slate-700/70 max-h-60 overflow-y-auto text-xs">
                  {g.failed.map(f => <li key={f.id} className="py-1.5 flex gap-3"><span className="text-slate-200 flex-1 min-w-0 truncate">{[f.folder, f.fileName].filter(Boolean).join(" / ")}</span><span className="text-slate-400 truncate max-w-[45%]">{f.error}</span></li>)}
                </ul>
              </>
            )}
          </Panel>
          <Panel title="Newest guests" sub="No names or phone numbers are shown here.">
            {g.guests.length === 0 ? <p className="text-sm text-slate-400">No guest has searched yet.</p> : (
              <ul className="divide-y divide-slate-700/70 -my-2 text-sm">
                {g.guests.map(u => <li key={u.id} className="py-2 flex justify-between gap-3"><span className="text-slate-300">{fmtWhen(u.lastSearchAt ?? u.createdAt)}</span><span className={cn("tabular-nums", u.matchCount ? "text-emerald-300" : "text-slate-400")}>{u.matchCount ? `${num(u.matchCount)} photos` : "No photos"}{u.downloads ? ` · ${num(u.downloads)} downloads` : ""}</span></li>)}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

/** Payments studios sent for credit packs: check the money, then accept (credits go to the studio at once) or reject with a reason. */
function OrdersTab({ call, onChanged, onStudio }: { call: Call; onChanged: () => void; onStudio: (id: string) => void }) {
  const [status, setStatus] = useState<"pending" | "paid" | "rejected">("pending");
  const [d, setD] = useState<Orders | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback((st: string) => call<Orders>(`/orders?status=${st}`).then(setD).catch(e => setMsg({ error: e.message })), [call]);
  useEffect(() => { void load(status); }, [status, load]);

  async function more() {
    if (!d?.next || busy) return;
    setBusy("more");
    try { const n = await call<Orders>(`/orders?status=${status}&cursor=${d.next}`); setD({ ...n, orders: [...d.orders, ...n.orders] }); } catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }
  async function approve(o: Order) {
    if (busy) return;
    setBusy(o.id); setMsg({});
    try { await call(`/orders/${o.id}/approve`, { method: "POST", json: {} }); setMsg({ ok: `${num(o.credits)} credits added to ${o.studio}.` }); await load(status); onChanged(); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }
  async function reject() {
    if (!rejecting || busy || reason.trim().length < 3) return;
    setBusy(rejecting.id); setMsg({});
    try { await call(`/orders/${rejecting.id}/reject`, { method: "POST", json: { reason: reason.trim() } }); setMsg({ ok: "Order rejected. The studio sees your reason." }); setRejecting(null); setReason(""); await load(status); onChanged(); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }

  return (
    <div className="space-y-4">
      {d && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={AlertTriangle} label="Waiting for a check" value={num(d.totals.pending)} tone={d.totals.pending ? "warn" : undefined} sub={d.totals.pending ? "Oldest first below" : "Nothing waiting"} />
          <Stat icon={CheckCircle2} label="Orders paid" value={num(d.totals.paidCount)} />
          <Stat icon={Coins} label="Money received" value={`৳${num(d.totals.paidBdt)}`} />
          <Stat icon={Coins} label="Credits sold" value={num(d.totals.creditsSold)} sub={`About ৳${num(Math.round(d.totals.creditsSold * COST_PER_CREDIT_BDT))} cost to you`} />
        </div>
      )}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-800 border border-slate-700 w-fit" role="radiogroup" aria-label="Which orders">
        {(["pending", "paid", "rejected"] as const).map(st => (
          <button key={st} type="button" role="radio" aria-checked={status === st} onClick={() => { setD(null); setStatus(st); }}
            className={cn("h-8 px-3 rounded-md text-xs font-semibold", status === st ? "bg-slate-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{st === "pending" ? "Waiting" : st === "paid" ? "Accepted" : "Rejected"}</button>
        ))}
      </div>
      <Msg error={msg.error} ok={msg.ok} />
      {!d ? !msg.error && <div className="py-12 flex justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        : d.orders.length === 0 ? <p className="text-sm text-slate-400 bg-slate-800 border border-slate-700 rounded-xl px-5 py-8 text-center">{status === "pending" ? "No payment is waiting. New ones show here, oldest first." : "Nothing here yet."}</p>
        : (
          <ul className="space-y-3">
            {d.orders.map(o => (
              <li key={o.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="min-w-0 flex-1 grid sm:grid-cols-3 gap-x-6 gap-y-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Studio</p>
                    <button type="button" onClick={() => onStudio(o.companyId)} className="text-sm font-semibold text-white hover:underline truncate max-w-full text-left">{o.studio}</button>
                    <p className="text-xs text-slate-400 truncate">{[o.placedBy, fmtWhen(o.createdAt)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Bought</p>
                    <p className="text-sm font-semibold text-white">{o.pack} · {num(o.credits)} credits</p>
                    <p className="text-lg font-bold text-emerald-300 tabular-nums leading-tight">৳{num(o.amountBdt)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Check this payment in {METHOD[o.method] ?? o.method}</p>
                    <p className="text-sm font-bold text-white tabular-nums tracking-wide [overflow-wrap:anywhere]">{o.reference}</p>
                    <p className="text-xs text-slate-400 tabular-nums">From {o.senderNumber ?? "unknown"}</p>
                  </div>
                </div>
                {o.status === "pending" ? (
                  <div className="flex gap-2 flex-shrink-0">
                    <Btn variant="danger" disabled={!!busy} onClick={() => { setRejecting(o); setReason(""); }}>Reject</Btn>
                    <Btn loading={busy === o.id} disabled={!!busy && busy !== o.id} onClick={() => approve(o)} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Accept and give credits</Btn>
                  </div>
                ) : (
                  <p className={cn("text-xs flex-shrink-0 lg:max-w-[220px] lg:text-right", o.status === "paid" ? "text-emerald-300" : "text-red-300")}>
                    {o.status === "paid" ? "Accepted" : "Rejected"}{o.reviewedBy ? ` by ${o.reviewedBy}` : ""}<span className="block text-slate-400">{fmtWhen(o.reviewedAt)}{o.rejectReason ? ` · ${o.rejectReason}` : ""}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      {d?.next && <div className="flex justify-center"><Btn variant="ghost" loading={busy === "more"} onClick={more}>Show more</Btn></div>}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Reject this order">
          <button type="button" aria-label="Close" onClick={() => setRejecting(null)} className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-bold text-white">Reject this order?</h3>
            <p className="text-sm text-slate-300">{rejecting.studio} · {rejecting.pack} · ৳{num(rejecting.amountBdt)} · {rejecting.reference}</p>
            <div>
              <label htmlFor="fa-reason" className="block text-xs font-medium text-slate-300 mb-1">Reason the studio will read</label>
              <input id="fa-reason" autoFocus className={inp} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="We could not find this transaction ID" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="ghost" onClick={() => setRejecting(null)}>Cancel</Btn>
              <Btn variant="danger" loading={busy === rejecting.id} disabled={reason.trim().length < 3} onClick={reject}>Reject order</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The credit packs studios can buy: name, credits, price, on or off. Shows what each pack earns after the cost. */
function PacksTab({ call }: { call: Call }) {
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [edit, setEdit] = useState<Partial<Pack> | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  useEffect(() => { call<Pack[]>("/packs").then(setPacks).catch(e => setMsg({ error: e.message })); }, [call]);

  async function save(p: Partial<Pack>, done: string) {
    setBusy(p.id ?? "new"); setMsg({});
    try { setPacks(await call<Pack[]>("/packs", { method: "POST", json: p })); setEdit(null); setMsg({ ok: done }); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    setBusy("");
  }
  const profit = (p: { credits?: number; priceBdt?: number }) => {
    const c = Number(p.credits) || 0, price = Number(p.priceBdt) || 0;
    const cost = c * COST_PER_CREDIT_BDT;
    return { cost: Math.round(cost), profit: Math.round(price - cost), pct: price ? Math.round(((price - cost) / price) * 100) : 0, per: c ? price / c : 0 };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400 max-w-2xl">One photo costs you about ৳{COST_PER_CREDIT_BDT.toFixed(2)} (Amazon reading it, keeping the faces, and the guests&apos; searches). Profit below is the price minus that cost. Studios only see packs that are on.</p>
        <Btn onClick={() => setEdit({ name: "", credits: 1000, priceBdt: 700, badge: "", isActive: false, sortOrder: (packs?.length ?? 0) + 1 })}><Plus className="w-3.5 h-3.5" />New pack</Btn>
      </div>
      <Msg error={msg.error} ok={msg.ok} />
      <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto max-w-[calc(100vw-3rem)] lg:max-w-full">
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-700">
            <th className="font-medium px-4 py-3">Pack</th><th className="font-medium px-3 py-3 text-right">Credits</th><th className="font-medium px-3 py-3 text-right">Price</th><th className="font-medium px-3 py-3 text-right">Per photo</th>
            <th className="font-medium px-3 py-3 text-right">Your cost</th><th className="font-medium px-3 py-3 text-right">Profit</th><th className="font-medium px-3 py-3">On sale</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {packs === null ? <tr><td colSpan={8} className="py-10 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              : packs.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-slate-400">No packs yet. Make the first one.</td></tr>
              : packs.map(p => { const m = profit(p); return (
                <tr key={p.id} className="border-b border-slate-700/60 last:border-0">
                  <td className="px-4 py-3"><p className="font-semibold text-white">{p.name}</p>{p.badge && <p className="text-xs text-indigo-300">{p.badge}</p>}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-white">{num(p.credits)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-white font-semibold">৳{num(p.priceBdt)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">৳{m.per.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">৳{num(m.cost)}</td>
                  <td className={cn("px-3 py-3 text-right tabular-nums font-semibold", m.profit > 0 ? "text-emerald-300" : "text-red-300")}>৳{num(m.profit)} · {m.pct}%</td>
                  <td className="px-3 py-3">
                    <button type="button" role="switch" aria-checked={p.isActive} aria-label={`${p.name} on sale`} disabled={busy === p.id} onClick={() => save({ ...p, isActive: !p.isActive }, p.isActive ? `${p.name} is off sale.` : `${p.name} is on sale.`)}
                      className={cn("w-11 h-6 rounded-full relative transition-colors disabled:opacity-60", p.isActive ? "bg-emerald-600" : "bg-slate-600")}>
                      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform", p.isActive && "translate-x-5")} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right"><Btn variant="ghost" onClick={() => setEdit(p)}>Change</Btn></td>
                </tr>
              ); })}
          </tbody>
        </table>
      </section>

      {edit && (() => { const m = profit(edit); return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={edit.id ? "Change pack" : "New pack"}>
          <button type="button" aria-label="Close" onClick={() => setEdit(null)} className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-bold text-white">{edit.id ? "Change pack" : "New pack"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label htmlFor="pk-name" className="block text-xs font-medium text-slate-300 mb-1">Name</label><input id="pk-name" className={inp} maxLength={60} value={edit.name ?? ""} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Standard" /></div>
              <div><label htmlFor="pk-credits" className="block text-xs font-medium text-slate-300 mb-1">Credits</label><input id="pk-credits" className={cn(inp, "tabular-nums")} inputMode="numeric" value={edit.credits ?? ""} onChange={e => setEdit({ ...edit, credits: Number(e.target.value.replace(/\D/g, "").slice(0, 8)) })} /></div>
              <div><label htmlFor="pk-price" className="block text-xs font-medium text-slate-300 mb-1">Price (taka)</label><input id="pk-price" className={cn(inp, "tabular-nums")} inputMode="numeric" value={edit.priceBdt ?? ""} onChange={e => setEdit({ ...edit, priceBdt: Number(e.target.value.replace(/\D/g, "").slice(0, 9)) })} /></div>
              <div><label htmlFor="pk-badge" className="block text-xs font-medium text-slate-300 mb-1">Label (optional)</label><input id="pk-badge" className={inp} maxLength={30} value={edit.badge ?? ""} onChange={e => setEdit({ ...edit, badge: e.target.value })} placeholder="Most popular" /></div>
              <div><label htmlFor="pk-order" className="block text-xs font-medium text-slate-300 mb-1">Position</label><input id="pk-order" className={cn(inp, "tabular-nums")} inputMode="numeric" value={edit.sortOrder ?? 0} onChange={e => setEdit({ ...edit, sortOrder: Number(e.target.value.replace(/\D/g, "").slice(0, 3)) })} /></div>
            </div>
            <p className={cn("text-xs rounded-lg px-3 py-2 border", m.profit > 0 ? "text-emerald-300 bg-emerald-950/40 border-emerald-900" : "text-red-300 bg-red-950/50 border-red-900")}>
              ৳{m.per.toFixed(2)} per photo. Your cost about ৳{num(m.cost)}, profit ৳{num(m.profit)} ({m.pct}%).{m.profit <= 0 ? " This price loses money." : ""}
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={!!edit.isActive} onChange={e => setEdit({ ...edit, isActive: e.target.checked })} />On sale to studios</label>
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
              <Btn loading={busy === (edit.id ?? "new")} disabled={!edit.name?.trim() || !edit.credits || !edit.priceBdt} onClick={() => save(edit, "Saved.")}>Save pack</Btn>
            </div>
          </div>
        </div>
      ); })()}
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
  const [cap, setCap] = useState(String(o.settings.monthlyCap));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  async function save(patch: Partial<Settings>, key: string, done: string) {
    setBusy(key); setMsg({});
    try { const r = await call<Settings>("/settings", { method: "PUT", json: patch }); setS(r); setWelcome(String(r.welcomeCredits)); setNotice(r.offNotice); setCap(String(r.monthlyCap)); setMsg({ ok: done }); onSaved(); }
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

      <Panel title="Monthly limit for all studios" sub="The most photos all studios together may add in one month. When it is reached, adding photos stops until next month and no credits are taken. It keeps the Amazon bill from running away.">
        <div className="flex items-end gap-2">
          <div className="w-44">
            <label htmlFor="fa-cap" className="block text-xs font-medium text-slate-300 mb-1">Photos per month</label>
            <input id="fa-cap" className={cn(inp, "tabular-nums")} inputMode="numeric" value={cap} onChange={e => setCap(e.target.value.replace(/\D/g, "").slice(0, 9))} />
          </div>
          <Btn loading={busy === "cap"} disabled={Number(cap || 0) === s.monthlyCap} onClick={() => save({ monthlyCap: Number(cap || 0) }, "cap", "Saved.")}>Save</Btn>
        </div>
        <p className="text-xs text-slate-400 mt-2">{Number(cap || 0) ? `About US$${(Number(cap) * 0.001).toFixed(2)} at Amazon at most. ${num(o.totals.usedThisMonth)} used so far this month.` : "0 means no limit."}</p>
      </Panel>

      <Panel title="What a credit is">
        <ul className="text-sm text-slate-300 space-y-1.5">
          <li>1 credit = 1 photo added to a face gallery (read once by Amazon, about US$0.001).</li>
          <li>Guest selfie search, viewing and downloads are free for the studio.</li>
          <li>RAW files, videos and the same photo added twice are not counted.</li>
          <li>Studios buy credit packs in Credits → Buy credits; you set the packs in Packs and accept payments in Orders.</li>
          <li>Credits included in plans and an automatic payment gateway are not built yet.</li>
        </ul>
      </Panel>
    </div>
  );
}
