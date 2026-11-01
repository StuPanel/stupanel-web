"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Inbox, Loader2, Lock, MessageCircle, RotateCcw, Search, Send, UserRound, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { can, getPlatformUser } from "@/lib/platform-api";

const H = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }) : "—";
function since(a: string, b?: string | null) {
  if (!b) return null;
  const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-amber-500/20 text-amber-300 border-amber-600/30" },
  in_progress: { label: "In progress", cls: "bg-sky-500/20 text-sky-300 border-sky-600/30" },
  resolved: { label: "Resolved", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-600/30" },
  closed: { label: "Closed", cls: "bg-slate-500/20 text-slate-400 border-slate-600/30" },
};
const PRIORITY: Record<string, string> = { low: "text-slate-400", medium: "text-amber-300", high: "text-orange-300", urgent: "text-red-300" };
type View = "mine" | "none" | "all";

interface Row {
  id: string; ticketNumber: string; subject: string; status: string; priority: string; category: string;
  companyName: string; assignedToName: string | null; waitingOnUs: boolean; updatedAt: string; _count: { messages: number };
}
interface Detail {
  id: string; ticketNumber: string; subject: string; status: string; priority: string; category: string; createdAt: string;
  firstResponseAt?: string | null; assignedToId?: string | null; assignedToName: string | null;
  messages: { id: string; senderType: string; senderName: string; content: string; isInternal: boolean; createdAt: string }[];
  company: { id: string; name: string; slug: string; plan?: { name: string } | null; access: { state: string; daysLeft: number | null } } | null;
  owner: { firstName: string; lastName?: string | null; email: string; phone?: string | null } | null;
  team: { id: string; name: string; email: string }[];
}

function SupportDesk() {
  const me = getPlatformUser();
  const canReply = can(me, "support.reply");
  const q = useSearchParams();
  const [view, setView] = useState<View>("all");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState({ openMine: 0, openUnassigned: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(q.get("ticket"));
  const [d, setD] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(p), assigned: view, ...(status && { status }), ...(search.trim() && { search: search.trim() }) });
    const r = await fetch(`${API}/admin/support?${qs}`, { headers: H() });
    if (r.ok) { const b = await r.json(); setRows(b.items); setPages(b.pages || 1); setPage(p); setCounts(b.counts ?? counts); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, status, search]);
  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [view, status]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`${API}/admin/support/${id}`, { headers: H() });
    if (r.ok) setD(await r.json());
  }, []);
  useEffect(() => { if (openId) loadDetail(openId); else setD(null); }, [openId, loadDetail]);

  async function call(path: string, body?: unknown) {
    setErr("");
    const r = await fetch(`${API}/admin/support/${openId}${path}`, { method: path === "/reply" ? "POST" : "PATCH", headers: H(), body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { const b = await r.json().catch(() => ({})); setErr(Array.isArray(b.message) ? b.message[0] : b.message || "Something went wrong."); return false; }
    await Promise.all([loadDetail(openId!), load(page)]);
    return true;
  }

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    if (await call("/reply", { content: text.trim(), internal })) { setText(""); setInternal(false); }
    setSending(false);
  }

  const VIEWS: { key: View; label: string; count?: number }[] = [
    { key: "mine", label: "My tickets", count: counts.openMine },
    { key: "none", label: "Not assigned", count: counts.openUnassigned },
    { key: "all", label: "All" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Support</h1>
        <p className="text-sm text-slate-400 mt-0.5">Answer studios, assign tickets to the team, keep team-only notes.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* List */}
        <div className={cn("bg-slate-800 border border-slate-700 rounded-xl overflow-hidden", openId && "hidden lg:block")}>
          <div className="flex gap-1 px-3 pt-3 border-b border-slate-700">
            {VIEWS.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap", view === v.key ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white")}>
                {v.label}{v.count ? <span className="ml-1.5 text-[11px] px-1.5 rounded-full bg-indigo-600/30 text-indigo-200">{v.count}</span> : null}
              </button>
            ))}
          </div>
          <div className="flex gap-2 p-3 border-b border-slate-700/60">
            <form onSubmit={e => { e.preventDefault(); load(1); }} className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Subject or ticket no." className="w-full h-8 pl-8 pr-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-600" />
            </form>
            <select value={status} onChange={e => setStatus(e.target.value)} className="h-8 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 px-2">
              <option value="">Any status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          {loading ? <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
            : rows.length === 0 ? <div className="py-16 text-center"><Inbox className="w-7 h-7 text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-500">No tickets here</p></div>
            : (
              <ul className="divide-y divide-slate-700/60 max-h-[70vh] overflow-y-auto">
                {rows.map(t => (
                  <li key={t.id}>
                    <button onClick={() => setOpenId(t.id)} className={cn("w-full text-left px-4 py-3 hover:bg-slate-700/30", openId === t.id && "bg-indigo-950/40")}>
                      <div className="flex items-center gap-2">
                        {t.waitingOnUs && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Waiting for our answer" />}
                        <span className="text-sm font-medium text-white truncate flex-1">{t.subject}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", STATUS[t.status]?.cls)}>{STATUS[t.status]?.label ?? t.status}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {t.ticketNumber} · {t.companyName} · <span className={PRIORITY[t.priority]}>{t.priority}</span> · {t.assignedToName ?? "not assigned"} · {fmt(t.updatedAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          {pages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 text-xs text-slate-400">
              <button disabled={page <= 1} onClick={() => load(page - 1)} className="disabled:opacity-40 inline-flex items-center"><ChevronLeft className="w-3.5 h-3.5" />Prev</button>
              <span>Page {page} of {pages}</span>
              <button disabled={page >= pages} onClick={() => load(page + 1)} className="disabled:opacity-40 inline-flex items-center">Next<ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>

        {/* Ticket */}
        <div className={cn("bg-slate-800 border border-slate-700 rounded-xl min-h-[60vh] flex flex-col", !openId && "hidden lg:flex")}>
          {!openId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><MessageCircle className="w-8 h-8 text-slate-600 mb-2" /><p className="text-sm text-slate-500">Pick a ticket</p></div>
          ) : !d ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-700 space-y-3">
                <button onClick={() => setOpenId(null)} className="lg:hidden inline-flex items-center gap-1 text-xs text-slate-400"><ArrowLeft className="w-3.5 h-3.5" />Back</button>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white">{d.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {d.ticketNumber} · {d.category} · opened {fmt(d.createdAt)}
                      {d.firstResponseAt ? ` · first answer in ${since(d.createdAt, d.firstResponseAt)}` : " · not answered yet"}
                    </p>
                  </div>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", STATUS[d.status]?.cls)}>{STATUS[d.status]?.label ?? d.status}</span>
                </div>
                {canReply && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-400"><UserRound className="w-3.5 h-3.5" />
                      <select value={d.assignedToId ?? ""} onChange={e => call("/assign", { assignedToId: e.target.value || null })}
                        className="h-8 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 px-2">
                        <option value="">Not assigned</option>
                        {d.team.map(u => <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (me)` : u.name}</option>)}
                      </select>
                    </label>
                    <select value={d.priority} onChange={e => call("/priority", { priority: e.target.value })}
                      className={cn("h-8 rounded-lg bg-slate-900 border border-slate-700 text-xs px-2 capitalize", PRIORITY[d.priority])}>
                      {["low", "medium", "high", "urgent"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <span className="flex-1" />
                    {d.status === "closed"
                      ? <button onClick={() => call("/reopen")} className="h-8 px-3 rounded-lg border border-slate-600 text-xs text-slate-200 hover:bg-slate-700 inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Reopen</button>
                      : <button onClick={() => call("/close")} className="h-8 px-3 rounded-lg border border-emerald-800 text-xs text-emerald-300 hover:bg-emerald-950/40 inline-flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Close</button>}
                  </div>
                )}
                {d.company && (
                  <div className="rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-medium truncate">{d.company.name} <span className="text-slate-500">· {d.company.plan?.name ?? "No plan"} · {d.company.access.state}</span></p>
                      {d.owner && <p className="text-slate-500 truncate">{`${d.owner.firstName} ${d.owner.lastName ?? ""}`.trim()} · {d.owner.email}{d.owner.phone ? ` · ${d.owner.phone}` : ""}</p>}
                    </div>
                    <Link href={`/admin/studios/${d.company.id}`} className="text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 whitespace-nowrap">Studio 360<ExternalLink className="w-3 h-3" /></Link>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                {d.messages.map(m => {
                  const ours = m.senderType !== "studio";
                  return (
                    <div key={m.id} className={cn("flex", ours ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 border",
                        m.isInternal ? "bg-amber-950/40 border-amber-800/60" : ours ? "bg-indigo-600/20 border-indigo-700/50" : "bg-slate-700/60 border-slate-600")}>
                        <p className={cn("text-[11px] font-semibold mb-0.5 flex items-center gap-1", m.isInternal ? "text-amber-300" : ours ? "text-indigo-300" : "text-slate-300")}>
                          {m.isInternal && <Lock className="w-3 h-3" />}{m.senderName}{m.isInternal && " · team note"}
                          <span className="font-normal text-slate-500 ml-1">{fmt(m.createdAt)}</span>
                        </p>
                        <p className="text-sm text-white whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canReply && (
                <div className="p-3 border-t border-slate-700 space-y-2">
                  <div className="flex gap-1 text-xs">
                    <button onClick={() => setInternal(false)} className={cn("px-3 py-1 rounded-full", !internal ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white")}>Reply to studio</button>
                    <button onClick={() => setInternal(true)} className={cn("px-3 py-1 rounded-full inline-flex items-center gap-1", internal ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white")}><Lock className="w-3 h-3" />Team note</button>
                  </div>
                  <div className="flex gap-2">
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                      placeholder={internal ? "Only the StuPanel team sees this…" : "Write to the studio…"}
                      onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
                      className={cn("flex-1 rounded-lg bg-slate-900 border p-2.5 text-sm text-white placeholder:text-slate-600 outline-none", internal ? "border-amber-800 focus:border-amber-500" : "border-slate-700 focus:border-indigo-500")} />
                    <button onClick={send} disabled={sending || !text.trim()} aria-label="Send"
                      className={cn("self-end h-10 w-10 rounded-lg text-white flex items-center justify-center disabled:opacity-50", internal ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700")}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {err && <p className="text-xs text-red-400">{err}</p>}
                  <p className="text-[11px] text-slate-500">Ctrl/⌘ + Enter to send. Answering a ticket that nobody has assigns it to you.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSupportPage() {
  return <Suspense><SupportDesk /></Suspense>;
}
