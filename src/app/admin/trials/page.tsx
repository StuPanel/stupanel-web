"use client";
/**
 * Super Admin → Trials: every studio on its free trial (and those whose trial ended without paying), how they use
 * StuPanel, the messages they got, WhatsApp texts to send by hand, and the messages themselves (on/off, own words).
 * Plan: StuPanel-Docs/03-Decisions/2026-11-23-trial-plan.md.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, MessageCircle, PhoneCall, Search, Send, Sparkles, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Btn, Msg, Page, Panel, inp, fmtWhen } from "../_components/staff-kit";

const authH = (json = false) => ({ Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}`, ...(json ? { "Content-Type": "application/json" } : {}) });
const get = (p: string) => fetch(`${API}/admin/trials${p}`, { headers: authH() }).then(r => (r.ok ? r.json() : Promise.reject(r)));
const post = (p: string, body: unknown) => fetch(`${API}/admin/trials${p}`, { method: "POST", headers: authH(true), body: JSON.stringify(body) }).then(async r => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({})))?.message ?? "Failed"))));

type Health = "green" | "yellow" | "red";
type Row = {
  id: string; name: string; country: string | null; lang: "bn" | "en"; owner: string; email: string; phone: string | null; createdAt: string; trialEndsAt: string; daysLeft: number;
  lastActive: string | null; programs: number; clients: number; health: Health; extendedAt: string | null; canExtend: boolean;
  offer: { percent: number; until: string } | null; lastMessage: { key: string; sentAt: string } | null;
  feedback: { reason: string; note: string | null } | null; note: string | null; calledAt: string | null; removeAt: string | null;
};
type List = { view: string; page: number; pageSize: number; total: number; rows: Row[] };
type Stats = { onTrial: number; ended: number; waiting: number; started: { used: number; of: number }; converted: { paid: number; of: number }; reasons: Record<string, number> };
type WaItem = { id: string; key: string; sentAt: string; phone: string; text: string; studio: { id: string; name: string } };
type Words = { subject: string; body: string; wa: string };
type OwnWords = { subject?: string; body?: string; wa?: string };
/** default/own: Bangla (studios in Bangladesh); defaultEn/ownEn: English (every other country). */
type MsgSetting = { key: string; name: string; when: string; on: boolean; default: Words; own: OwnWords; defaultEn: Words; ownEn: OwnWords };
type Settings = { autoRemove: boolean; messages: MsgSetting[] };

const HEALTH: Record<Health, { dot: string; label: string }> = {
  green: { dot: "bg-emerald-400", label: "Using it" },
  yellow: { dot: "bg-amber-400", label: "Slowing down" },
  red: { dot: "bg-red-400", label: "Not using it" },
};
const REASON: Record<string, string> = { price: "Too expensive", no_time: "No time", missing: "Something missing", other_software: "Uses other software", not_now: "Not now / off-season", other: "Other" };
const KEY_NAME: Record<string, string> = {
  welcome: "Welcome", first_program: "Add first program", quiet: "All well?", features: "Feature to try", ends_7: "7 days left", ends_3: "3 days left",
  ended: "Trial ended", feedback: "Why not continue?", site_off: "Website off tomorrow", extend: "7 more days", offer_60: "20% off", keep_90: "Data kept",
  season: "Season offer", remove_notice: "Removal notice",
};
const keyName = (k: string) => KEY_NAME[k.startsWith("season") ? "season" : k] ?? k;
const ago = (d: string | null) => {
  if (!d) return "never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
const waLink = (phone: string, text: string) => {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = `88${p}`;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
};

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TrialsPage() {
  const [tab, setTab] = useState<"studios" | "whatsapp" | "messages">("studios");
  const [stats, setStats] = useState<Stats | null>(null);
  const loadStats = useCallback(() => { get("/stats").then(setStats).catch(() => {}); }, []);
  useEffect(() => { loadStats(); }, [loadStats]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <Page title="Trials" sub="Studios on the free trial and after it: who uses StuPanel, who needs a call, and the messages they get. Messages go each morning at 10:05 (Bangladesh time), at most one a day per studio.">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="On trial now" value={stats.onTrial} sub={`${stats.ended} trials ended without paying`} />
          <Stat label="Started using it" value={pct(stats.started.used, stats.started.of)} sub={`${stats.started.used} of ${stats.started.of} new studios (180 days) added a program`} />
          <Stat label="Trial → paid" value={pct(stats.converted.paid, stats.converted.of)} sub={`${stats.converted.paid} of ${stats.converted.of} finished trials (180 days)`} />
          <Stat label="WhatsApp to send" value={stats.waiting} sub={Object.keys(stats.reasons).length ? `Answers: ${Object.entries(stats.reasons).map(([k, v]) => `${REASON[k] ?? k} ${v}`).join(" · ")}` : "No answers to “why not continue?” yet"} />
        </div>
      )}
      <div className="inline-flex rounded-lg bg-slate-800 p-1 self-start">
        {([["studios", "Studios"], ["whatsapp", `WhatsApp to send${stats?.waiting ? ` (${stats.waiting})` : ""}`], ["messages", "Messages"]] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setTab(v)} aria-pressed={tab === v}
            className={cn("h-9 px-3.5 rounded-md text-sm font-semibold", tab === v ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{label}</button>
        ))}
      </div>
      {tab === "studios" && <StudiosTab onChange={loadStats} />}
      {tab === "whatsapp" && <WhatsAppTab onChange={loadStats} />}
      {tab === "messages" && <MessagesTab />}
    </Page>
  );
}

// ── Studios ─────────────────────────────────────────────────────────────────────────────────────

function StudiosTab({ onChange }: { onChange: () => void }) {
  const [view, setView] = useState("on");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState<List | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    const p = new URLSearchParams({ view, page: String(page), ...(q ? { search: q } : {}) });
    get(`?${p}`).then(x => { setD(x); setErr(""); }).catch(() => setErr("Couldn't load the trials."));
  }, [view, page, q]);
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, [load]);
  useEffect(() => { const id = setTimeout(() => { setPage(1); setQ(search.trim()); }, 350); return () => clearTimeout(id); }, [search]);
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg bg-slate-800 p-1">
          {[["on", "On trial"], ["ended", "Ended, not paid"], ["all", "All"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => { setView(v); setPage(1); }} aria-pressed={view === v}
              className={cn("h-8 px-3 rounded-md text-sm font-semibold", view === v ? "bg-slate-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{label}</button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Studio, email or phone" aria-label="Search" className={cn(inp, "h-10 pl-9")} />
        </div>
      </div>
      {err && <Msg error={err} />}
      <div className="rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700/70">
        {!d ? <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></div>
          : !d.rows.length ? <p className="py-10 text-center text-sm text-slate-400">No studio here{q ? " with this name" : ""}.</p>
          : d.rows.map(r => <StudioRow key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(o => (o === r.id ? null : r.id))} onSaved={() => { load(); onChange(); }} />)}
      </div>
      {d && d.total > d.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-400">
          <span>Page {page} of {pages}</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page" className="h-9 w-9 rounded-lg bg-slate-800 disabled:opacity-40 inline-flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Next page" className="h-9 w-9 rounded-lg bg-slate-800 disabled:opacity-40 inline-flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
      <p className="text-xs text-slate-500">Colour: green = added programs and used it in the last 3 days · amber = slowing down · red = nothing added and not used for 4+ days (call these first).</p>
    </div>
  );
}

function StudioRow({ r, open, onToggle, onSaved }: { r: Row; open: boolean; onToggle: () => void; onSaved: () => void }) {
  const h = HEALTH[r.health];
  const ended = r.daysLeft < 0;
  return (
    <div className={cn(open && "bg-slate-800/40")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left px-4 py-3 grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_24px] gap-x-4 gap-y-1 items-center hover:bg-slate-800/50">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate inline-flex items-center gap-2"><span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", h.dot)} title={h.label} aria-label={h.label} />{r.name}</p>
          <p className="text-xs text-slate-400 truncate">{r.owner}{r.phone ? ` · ${r.phone}` : ""}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 lg:hidden transition-transform", open && "rotate-180")} />
        <p className="text-sm text-slate-300 col-span-2 lg:col-span-1"><span className={cn("font-semibold", ended ? "text-red-300" : r.daysLeft <= 7 ? "text-amber-300" : "text-white")}>{ended ? `Ended ${-r.daysLeft}d ago` : r.daysLeft === 0 ? "Ends today" : `${r.daysLeft} days left`}</span>{r.extendedAt && <span className="text-xs text-indigo-300"> · +7 used</span>}</p>
        <p className="text-sm text-slate-300 col-span-2 lg:col-span-1">Last used <span className="text-white">{ago(r.lastActive)}</span></p>
        <p className="text-sm text-slate-300 col-span-2 lg:col-span-1"><span className="text-white tabular-nums">{r.programs}</span> programs · <span className="text-white tabular-nums">{r.clients}</span> clients</p>
        <p className="text-xs text-slate-400 col-span-2 lg:col-span-1 truncate">{r.calledAt ? <span className="text-emerald-300">Called {ago(r.calledAt)}</span> : r.lastMessage ? `${keyName(r.lastMessage.key)} · ${ago(r.lastMessage.sentAt)}` : "No message yet"}</p>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 hidden lg:block transition-transform", open && "rotate-180")} />
      </button>
      {open && <StudioActions r={r} onSaved={onSaved} />}
    </div>
  );
}

function StudioActions({ r, onSaved }: { r: Row; onSaved: () => void }) {
  const [note, setNote] = useState(r.note ?? "");
  const [days, setDays] = useState(7);
  const [key, setKey] = useState("ends_7");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const run = async (what: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(what); setMsg({});
    try { await fn(); setMsg({ ok }); onSaved(); } catch (e) { setMsg({ error: (e as Error).message }); } finally { setBusy(""); }
  };
  const hello = `আসসালামু আলাইকুম ${r.owner || ""}, StuPanel থেকে বলছি। ${r.daysLeft >= 0 ? `আপনার trial-এর আর ${r.daysLeft} দিন বাকি।` : "আপনার trial শেষ হয়েছে, আপনার data রাখা আছে।"} কোনো সাহায্য লাগবে?`;

  return (
    <div className="px-4 pb-4 pt-1 grid gap-4 lg:grid-cols-3">
      <div className="space-y-2 text-sm">
        <p className="text-slate-400">Joined {day(r.createdAt)} · trial {ended(r) ? "ended" : "ends"} {day(r.trialEndsAt)}</p>
        <p className="text-slate-400 break-all">{r.email}</p>
        <p className="text-slate-500">{r.country || "Bangladesh"} · messages in {r.lang === "en" ? "English" : "Bangla"}</p>
        {r.feedback && <p className="text-amber-200">Said: {REASON[r.feedback.reason] ?? r.feedback.reason}{r.feedback.note ? ` — “${r.feedback.note}”` : ""}</p>}
        {r.offer && <p className="text-emerald-300">{r.offer.percent}% off the first month until {day(r.offer.until)}</p>}
        {r.removeAt && <p className="text-slate-500">Data kept until {day(r.removeAt)}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {r.phone && <a href={waLink(r.phone, hello)} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />WhatsApp</a>}
          {r.phone && <a href={`tel:${r.phone}`} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"><PhoneCall className="w-4 h-4" />Call</a>}
          <Link href={`/admin/studios/${r.id}`} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold inline-flex items-center">Open studio</Link>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-400" htmlFor={`note-${r.id}`}>Your note</label>
        <textarea id={`note-${r.id}`} value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="What they said on the call…" className={cn(inp, "h-auto py-2")} />
        <div className="flex flex-wrap gap-2">
          <Btn loading={busy === "note"} onClick={() => run("note", () => post(`/${r.id}/note`, { note }), "Note saved.")}>Save note</Btn>
          <Btn variant="ghost" loading={busy === "called"} onClick={() => run("called", () => post(`/${r.id}/note`, { note, called: !r.calledAt }), r.calledAt ? "Unmarked." : "Marked as called.")}>
            {r.calledAt ? <><Undo2 className="w-4 h-4" />Not called</> : <><PhoneCall className="w-4 h-4" />I called them</>}
          </Btn>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Give more days (from today, or from the end if later)</p>
          <div className="flex gap-2">
            <input type="number" min={1} max={90} value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Days" className={cn(inp, "w-20")} />
            <Btn loading={busy === "extend"} onClick={() => run("extend", () => post(`/${r.id}/extend`, { days }), `Trial extended by ${days} days.`)}><CalendarPlus className="w-4 h-4" />Extend</Btn>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Send one message as a test (to the owner, marked [Test])</p>
          <div className="flex gap-2">
            <select value={key} onChange={e => setKey(e.target.value)} aria-label="Message" className={cn(inp, "flex-1")}>
              {Object.entries(KEY_NAME).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <Btn variant="ghost" loading={busy === "test"} onClick={() => run("test", () => post(`/${r.id}/test`, { key }), "Test email sent.")}><Send className="w-4 h-4" />Send</Btn>
          </div>
        </div>
        <Msg {...msg} />
      </div>
    </div>
  );
}
const ended = (r: Row) => r.daysLeft < 0;

// ── WhatsApp to send ──────────────────────────────────────────────────────────────────────────────

function WhatsAppTab({ onChange }: { onChange: () => void }) {
  const [list, setList] = useState<WaItem[] | null>(null);
  const load = useCallback(() => { get("/whatsapp").then(setList).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  const done = async (id: string) => {
    setList(l => (l ?? []).filter(x => x.id !== id));
    await post(`/whatsapp/${id}/done`, {}).catch(() => load());
    onChange();
  };
  if (!list) return <Loader2 className="w-5 h-5 animate-spin text-slate-500" />;
  return (
    <Panel title="WhatsApp messages to send" sub="The same message the studio got by email, ready in WhatsApp. Open it, press send in WhatsApp, then mark it sent here. Older than 14 days drop off.">
      {!list.length ? <p className="text-sm text-slate-400">Nothing to send. Messages go out each morning.</p> : (
        <div className="divide-y divide-slate-700/70">
          {list.map(w => (
            <div key={w.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{w.studio.name} <span className="text-xs font-normal text-slate-400">· {keyName(w.key)} · {fmtWhen(w.sentAt)}</span></p>
                <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{w.text}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a href={waLink(w.phone, w.text)} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />Open WhatsApp</a>
                <button type="button" onClick={() => void done(w.id)} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"><Check className="w-4 h-4" />Sent</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Messages: on/off and own words ────────────────────────────────────────────────────────────────

function MessagesTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [lang, setLang] = useState<"bn" | "en">("bn");
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  useEffect(() => { get("/settings").then(setS).catch(() => setMsg({ error: "Couldn't load the messages." })); }, []);
  if (!s) return <><Msg {...msg} /><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></>;

  const save = async (next: Settings, ok = "Saved.") => {
    setBusy(true); setMsg({});
    try {
      const texts = Object.fromEntries([
        ...next.messages.filter(m => Object.values(m.own).some(Boolean)).map(m => [m.key, m.own]),
        ...next.messages.filter(m => Object.values(m.ownEn ?? {}).some(Boolean)).map(m => [`${m.key}:en`, m.ownEn]),
      ]);
      setS(await post("/settings", { off: next.messages.filter(m => !m.on).map(m => m.key), texts, autoRemove: next.autoRemove }));
      setMsg({ ok });
    } catch (e) { setMsg({ error: (e as Error).message }); } finally { setBusy(false); }
  };
  const setMsgAt = (key: string, patch: Partial<MsgSetting>) => setS(x => x && { ...x, messages: x.messages.map(m => (m.key === key ? { ...m, ...patch } : m)) });
  /** [own words, StuPanel's words] in the language being edited. */
  const words = (m: MsgSetting): [OwnWords, Words] => (lang === "en" ? [m.ownEn ?? {}, m.defaultEn] : [m.own, m.default]);
  const setWords = (m: MsgSetting, f: keyof Words, v: string) => {
    const [own, def] = words(m);
    const next = { ...own, [f]: v === def[f] ? "" : v };
    setMsgAt(m.key, lang === "en" ? { ownEn: next } : { own: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg bg-slate-800 p-1" role="group" aria-label="Language">
          {([["bn", "বাংলা — studios in Bangladesh"], ["en", "English — every other country"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setLang(v)} aria-pressed={lang === v}
              className={cn("h-8 px-3 rounded-md text-sm font-semibold", lang === v ? "bg-slate-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{label}</button>
          ))}
        </div>
        <p className="text-xs text-slate-500">The studio&apos;s country (Settings → Studio) decides which one it gets.</p>
      </div>
      <Panel title="Messages" sub="Each goes once per studio, by email and in the WhatsApp list. Words in {curly brackets} are filled in: {name} {studio} {days} {date} {programs} {clients} {paid} {feature} {offerUntil} {removeDate}.">
        <div className="divide-y divide-slate-700/70">
          {s.messages.map(m => (
            <div key={m.key} className="py-3">
              <div className="flex items-center gap-3">
                <button type="button" role="switch" aria-checked={m.on} aria-label={`${m.name} on`} onClick={() => void save({ ...s, messages: s.messages.map(x => (x.key === m.key ? { ...x, on: !x.on } : x)) }, m.on ? `${m.name}: off.` : `${m.name}: on.`)}
                  className={cn("w-10 h-6 rounded-full relative flex-shrink-0 transition-colors", m.on ? "bg-indigo-600" : "bg-slate-600")}>
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", m.on ? "left-[18px]" : "left-0.5")} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{m.name}{(Object.values(m.own).some(Boolean) || Object.values(m.ownEn ?? {}).some(Boolean)) && <span className="ml-2 text-[11px] text-indigo-300">own words</span>}</p>
                  <p className="text-xs text-slate-400">{m.when}</p>
                </div>
                <button type="button" onClick={() => setEdit(e => (e === m.key ? null : m.key))} className="text-sm text-indigo-300 hover:text-white font-semibold">{edit === m.key ? "Close" : "Words"}</button>
              </div>
              {edit === m.key && (
                <div className="mt-3 space-y-2 lg:pl-[52px]">
                  {(["subject", "body", "wa"] as const).map(f => (
                    <label key={f} className="block">
                      <span className="text-xs font-semibold text-slate-400">{f === "subject" ? "Email subject" : f === "body" ? "Email text (one paragraph per line)" : "WhatsApp text"}</span>
                      {f === "subject"
                        ? <input value={words(m)[0][f] || words(m)[1][f]} onChange={e => setWords(m, f, e.target.value)} className={cn(inp, "mt-1")} />
                        : <textarea value={words(m)[0][f] || words(m)[1][f]} rows={f === "body" ? 6 : 3} onChange={e => setWords(m, f, e.target.value)} className={cn(inp, "mt-1 h-auto py-2")} />}
                    </label>
                  ))}
                  <div className="flex gap-2">
                    <Btn loading={busy} onClick={() => void save(s, `${m.name}: words saved.`)}>Save words</Btn>
                    <Btn variant="ghost" onClick={() => { const next = { ...s, messages: s.messages.map(x => (x.key === m.key ? { ...x, ...(lang === "en" ? { ownEn: {} } : { own: {} }) } : x)) }; setS(next); void save(next, `${m.name}: back to StuPanel's words.`); }}>Use StuPanel&apos;s words</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Removing data of studios that never paid" sub="Kept 1 year after the trial (90 days if they added nothing). The removal notice goes 30 days before. While this is off, nothing is removed.">
        <label className="flex items-center gap-3 cursor-pointer">
          <button type="button" role="switch" aria-checked={s.autoRemove} onClick={() => void save({ ...s, autoRemove: !s.autoRemove }, s.autoRemove ? "Removing is off." : "Removing is on.")}
            className={cn("w-10 h-6 rounded-full relative flex-shrink-0 transition-colors", s.autoRemove ? "bg-red-500" : "bg-slate-600")}>
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", s.autoRemove ? "left-[18px]" : "left-0.5")} />
          </button>
          <span className="text-sm text-white">{s.autoRemove ? "On — studios past their time are removed for good" : "Off — nothing is removed"}</span>
        </label>
      </Panel>
      <Msg {...msg} />
      <p className="text-xs text-slate-500 inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Gap: at least 3 days between two messages to the same studio (the 3-days-left, trial-ended, website and removal messages may come sooner).</p>
    </div>
  );
}
