"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Info, Mail, Megaphone, Send, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { askConfirm } from "@/components/feedback";
import { can, getPlatformUser } from "@/lib/platform-api";
import { Btn, Msg, Page, Panel, fmtWhen, inp } from "../_components/staff-kit";

const H = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });

const SEGMENTS: { key: string; label: string; hint: string }[] = [
  { key: "all", label: "All studios", hint: "Every studio that is not archived" },
  { key: "paid", label: "Paying studios", hint: "Plan is paid and active" },
  { key: "trial", label: "On trial", hint: "Free trial still running" },
  { key: "trial_ending", label: "Trial ends in 3 days", hint: "Good time for a reminder or an offer" },
  { key: "expired", label: "Plan ended", hint: "In grace days or view-only" },
  { key: "inactive", label: "Not using the app", hint: "No use for more than 14 days" },
  { key: "plan", label: "One plan", hint: "Studios on the plan you pick" },
];
const SEG_LABEL = Object.fromEntries(SEGMENTS.map(s => [s.key, s.label]));
const TYPES: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  info: { label: "Info", icon: Megaphone, cls: "text-indigo-300" },
  success: { label: "Good news", icon: CheckCircle2, cls: "text-emerald-300" },
  warning: { label: "Warning", icon: AlertTriangle, cls: "text-amber-300" },
  critical: { label: "Important", icon: Info, cls: "text-red-300" },
};

interface Ann {
  id: string; title: string; content: string; type: string; isActive: boolean; segment?: string | null; targetAll: boolean;
  recipients: number | null; sentByName: string | null; createdAt: string; expiresAt?: string | null;
}

export default function BroadcastPage() {
  const me = getPlatformUser();
  const canSend = can(me, "communication.send");
  const [list, setList] = useState<Ann[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ title: "", content: "", type: "info", segment: "all", planId: "", expiresAt: "", sendEmail: false });
  const [aud, setAud] = useState<{ count: number; studios: { id: string; name: string }[] } | null>(null);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const load = useCallback(async () => {
    const r = await fetch(`${API}/admin/announcements`, { headers: H() });
    if (r.ok) setList(await r.json());
  }, []);
  useEffect(() => {
    load();
    fetch(`${API}/admin/plans`, { headers: H() }).then(r => r.ok ? r.json() : []).then((p: { id: string; name: string }[]) => setPlans(Array.isArray(p) ? p : [])).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (f.segment === "plan" && !f.planId) { setAud(null); return; }
    const qs = new URLSearchParams({ segment: f.segment, ...(f.planId && f.segment === "plan" ? { planId: f.planId } : {}) });
    let alive = true;
    fetch(`${API}/admin/announcements/audience?${qs}`, { headers: H() }).then(r => r.ok ? r.json() : null).then(d => { if (alive) setAud(d); });
    return () => { alive = false; };
  }, [f.segment, f.planId]);

  async function send() {
    setMsg({});
    if (!aud?.count) { setMsg({ error: "No studios are in this group." }); return; }
    if (!(await askConfirm({ title: "Send message?", message: `Send "${f.title}" to ${aud.count} studio${aud.count === 1 ? "" : "s"}${f.sendEmail ? " and email their owners" : ""}?`, confirmLabel: "Send" }))) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/admin/announcements`, {
        method: "POST", headers: H(),
        body: JSON.stringify({
          title: f.title.trim(), content: f.content.trim(), type: f.type, segment: f.segment,
          planId: f.segment === "plan" ? f.planId : undefined,
          expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59+06:00`).toISOString() : undefined,
          sendEmail: f.sendEmail,
        }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(b.message) ? b.message[0] : b.message || "Could not send.");
      setMsg({ ok: `Sent to ${b.recipients} studio${b.recipients === 1 ? "" : "s"}${f.sendEmail ? ` · ${b.emailed} emails sent` : ""}.` });
      setF({ title: "", content: "", type: "info", segment: "all", planId: "", expiresAt: "", sendEmail: false });
      load();
    } catch (e) { setMsg({ error: (e as Error).message }); } finally { setSending(false); }
  }

  async function toggle(a: Ann) {
    await fetch(`${API}/admin/announcements/${a.id}`, { method: "PATCH", headers: H(), body: JSON.stringify({ isActive: !a.isActive }) });
    load();
  }
  async function remove(a: Ann) {
    if (!(await askConfirm({ message: `Delete "${a.title}"? Studios will stop seeing it.`, danger: true }))) return;
    await fetch(`${API}/admin/announcements/${a.id}`, { method: "DELETE", headers: H() });
    load();
  }

  const ready = f.title.trim().length >= 3 && f.content.trim().length >= 3 && (f.segment !== "plan" || f.planId);

  return (
    <Page title="Broadcast" sub="Send a message to a group of studios. It shows at the top of their app until they close it.">
      <Msg {...msg} />
      {canSend && (
        <Panel title="New message">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <label className="block space-y-1"><span className="text-xs text-slate-400">Title</span>
                <input value={f.title} maxLength={255} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. New: send invoices on WhatsApp" className={inp} /></label>
              <label className="block space-y-1"><span className="text-xs text-slate-400">Message</span>
                <textarea value={f.content} rows={5} maxLength={5000} onChange={e => setF({ ...f, content: e.target.value })}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500" /></label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1"><span className="text-xs text-slate-400">Style</span>
                  <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className={inp}>
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></label>
                <label className="space-y-1"><span className="text-xs text-slate-400">Send to</span>
                  <select value={f.segment} onChange={e => setF({ ...f, segment: e.target.value })} className={inp}>
                    {SEGMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select></label>
                <label className="space-y-1"><span className="text-xs text-slate-400">Hide after (optional)</span>
                  <input type="date" value={f.expiresAt} onChange={e => setF({ ...f, expiresAt: e.target.value })} className={inp} /></label>
              </div>
              {f.segment === "plan" && (
                <label className="block space-y-1"><span className="text-xs text-slate-400">Plan</span>
                  <select value={f.planId} onChange={e => setF({ ...f, planId: e.target.value })} className={inp}>
                    <option value="">Pick a plan…</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></label>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={f.sendEmail} onChange={e => setF({ ...f, sendEmail: e.target.checked })} className="accent-indigo-500" />
                <Mail className="w-4 h-4 text-slate-400" />Also email the studio owners
              </label>
              <Btn loading={sending} disabled={!ready || !aud?.count} onClick={send}><Send className="w-3.5 h-3.5" />Send{aud ? ` to ${aud.count}` : ""}</Btn>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3">
              <p className="text-xs text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Who gets it</p>
              <p className="text-2xl font-bold text-white mt-1">{aud ? aud.count : "…"} <span className="text-sm font-normal text-slate-400">studios</span></p>
              <p className="text-[11px] text-slate-500">{SEGMENTS.find(s => s.key === f.segment)?.hint}</p>
              <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
                {aud?.studios.map(s => <li key={s.id} className="text-xs text-slate-300 truncate">· {s.name}</li>)}
                {aud && aud.count > aud.studios.length && <li className="text-[11px] text-slate-500">…and {aud.count - aud.studios.length} more</li>}
              </ul>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Sent messages">
        {list.length === 0 ? <p className="text-sm text-slate-500">Nothing sent yet.</p> : (
          <div className="-m-5 divide-y divide-slate-700/60">
            {list.map(a => {
              const t = TYPES[a.type] ?? TYPES.info; const Icon = t.icon;
              const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
              return (
                <div key={a.id} className={cn("flex items-start gap-3 px-5 py-3.5", (!a.isActive || expired) && "opacity-55")}>
                  <Icon className={cn("w-4 h-4 mt-0.5", t.cls)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{a.title}</p>
                    <p className="text-xs text-slate-400 line-clamp-2 whitespace-pre-wrap">{a.content}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {a.segment ? SEG_LABEL[a.segment] ?? a.segment : a.targetAll ? "All studios" : "Some plans"}
                      {a.recipients != null && ` · ${a.recipients} studios`} · {fmtWhen(a.createdAt)}{a.sentByName && ` · by ${a.sentByName}`}
                      {a.expiresAt && ` · hides ${fmtWhen(a.expiresAt)}`}{!a.isActive && " · hidden"}
                    </p>
                  </div>
                  {canSend && (
                    <div className="flex gap-1">
                      <button onClick={() => toggle(a)} aria-label={a.isActive ? "Hide from studios" : "Show again"} title={a.isActive ? "Hide from studios" : "Show again"} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700">{a.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      <button onClick={() => remove(a)} aria-label="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </Page>
  );
}
