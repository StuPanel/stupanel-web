"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, MailPlus, MoreHorizontal, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatformUser, pfetch, type PlatformUser } from "@/lib/platform-api";
import { Btn, Msg, Page, Panel, fmtWhen, inp, useCodePrompt } from "../_components/staff-kit";

interface Role { id: string; key: string; name: string; description?: string; permissions: string[] }
interface Invite { id: string; email: string; name?: string | null; role: { key: string; name: string }; expiresAt: string; accessEndsAt?: string | null; createdAt: string }

const ROLE_TONE: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-300 border-amber-700/50",
  admin: "bg-indigo-500/15 text-indigo-300 border-indigo-700/50",
  accountant: "bg-emerald-500/15 text-emerald-300 border-emerald-700/50",
  support: "bg-sky-500/15 text-sky-300 border-sky-700/50",
};

export default function TeamPage() {
  const me = getPlatformUser();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", roleKey: "support", accessEndsAt: "" });
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [menu, setMenu] = useState<string | null>(null);
  const { ask, node } = useCodePrompt();

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([pfetch<{ users: PlatformUser[]; invites: Invite[] }>("/team"), pfetch<Role[]>("/roles")]);
    setUsers(t.users); setInvites(t.invites); setRoles(r);
  }, []);
  useEffect(() => { load().catch(e => setMsg({ error: (e as Error).message })); }, [load]);

  const done = (ok: string) => { setMsg({ ok }); setMenu(null); load().catch(() => {}); };

  function sendInvite(e: React.FormEvent) {
    e.preventDefault(); setMsg({});
    ask(`Invite ${form.email}`, async code => {
      await pfetch("/team/invite", { method: "POST", json: {
        email: form.email.trim(), name: form.name.trim() || undefined, roleKey: form.roleKey,
        accessEndsAt: form.accessEndsAt ? new Date(`${form.accessEndsAt}T23:59:59+06:00`).toISOString() : null, code,
      } });
      setForm({ email: "", name: "", roleKey: "support", accessEndsAt: "" }); setShowInvite(false);
      done(`Invite sent to ${form.email}. It works for 7 days.`);
    });
  }

  const roleName = (k: string) => roles.find(r => r.key === k)?.name ?? k;

  return (
    <Page title="Team" sub="People who can open StuPanel Admin"
      right={<Btn onClick={() => setShowInvite(v => !v)}><MailPlus className="w-3.5 h-3.5" />Invite</Btn>}>
      {node}
      <Msg {...msg} />

      {showInvite && (
        <Panel title="Invite someone" sub="They get an email, set a password and turn on two-step sign-in.">
          <form onSubmit={sendInvite} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs text-slate-400">Email</span>
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inp} /></label>
            <label className="space-y-1"><span className="text-xs text-slate-400">Name (optional)</span>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></label>
            <label className="space-y-1"><span className="text-xs text-slate-400">Role</span>
              <select value={form.roleKey} onChange={e => setForm({ ...form, roleKey: e.target.value })} className={inp}>
                {roles.filter(r => r.key !== "owner" || me?.isOwner).map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
              </select></label>
            <label className="space-y-1"><span className="text-xs text-slate-400">Access ends (optional)</span>
              <input type="date" value={form.accessEndsAt} onChange={e => setForm({ ...form, accessEndsAt: e.target.value })} className={inp} /></label>
            <p className="sm:col-span-2 text-[11px] text-slate-500">{roles.find(r => r.key === form.roleKey)?.description}</p>
            <div className="sm:col-span-2 flex gap-2">
              <Btn>Send invite</Btn>
              <Btn type="button" variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Btn>
            </div>
          </form>
        </Panel>
      )}

      <Panel className="overflow-visible">
        <div className="-m-5 divide-y divide-slate-700/60">
          {users.map(u => {
            const self = u.id === me?.id;
            const key = u.isOwner ? "owner" : u.role?.key ?? "";
            return (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 relative">
                <span className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {u.isOwner ? <Crown className="w-4 h-4 text-amber-300" /> : u.name?.[0]?.toUpperCase() ?? <UserRound className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{u.name}{self && <span className="ml-2 text-[10px] uppercase text-slate-400">You</span>}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email} · last sign-in {fmtWhen(u.lastLoginAt)}
                    {u.accessEndsAt && <> · access ends {fmtWhen(u.accessEndsAt)}</>}</p>
                </div>
                {u.status === "paused" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-900">Paused</span>}
                {!u.twoFactorOn && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-900">2FA not set</span>}
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-semibold", ROLE_TONE[key] ?? "bg-slate-700 text-slate-300 border-slate-600")}>{roleName(key)}</span>
                {!self && (
                  <div className="relative">
                    <button aria-label={`Actions for ${u.name}`} onClick={() => setMenu(menu === u.id ? null : u.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700"><MoreHorizontal className="w-4 h-4" /></button>
                    {menu === u.id && (
                      <div className="absolute right-0 top-9 z-20 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-xl p-1.5 text-sm animate-in fade-in zoom-in-95 duration-100">
                        <p className="px-2.5 pt-1 pb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Change role</p>
                        {roles.filter(r => r.key !== key && (r.key !== "owner" || me?.isOwner)).map(r => (
                          <button key={r.key} onClick={() => ask(`Make ${u.name} ${r.name}`, async code => {
                            await pfetch(`/team/${u.id}`, { method: "PATCH", json: { roleKey: r.key, code } }); done(`${u.name} is now ${r.name}.`);
                          })} className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800">{r.name}</button>
                        ))}
                        <div className="my-1 h-px bg-slate-700" />
                        <button onClick={() => ask(u.status === "paused" ? `Turn on ${u.name}` : `Pause ${u.name}`, async code => {
                          await pfetch(`/team/${u.id}`, { method: "PATCH", json: { status: u.status === "paused" ? "active" : "paused", code } });
                          done(u.status === "paused" ? `${u.name} can sign in again.` : `${u.name} is paused and signed out.`);
                        })} className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800">{u.status === "paused" ? "Turn access back on" : "Pause access"}</button>
                        <button onClick={async () => { await pfetch(`/team/${u.id}/send-reset`, { method: "POST" }); done(`Password reset link sent to ${u.email}.`); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800">Send password reset link</button>
                        <button onClick={() => ask(`Reset two-step sign-in for ${u.name}`, async code => {
                          await pfetch(`/team/${u.id}/reset-2fa`, { method: "POST", json: { code } }); done(`${u.name} will set up two-step sign-in again on next sign-in.`);
                        })} className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800">Reset two-step sign-in</button>
                        <div className="my-1 h-px bg-slate-700" />
                        <button onClick={() => ask(`Remove ${u.name} from the team`, async code => {
                          await pfetch(`/team/${u.id}/remove`, { method: "POST", json: { code } }); done(`${u.name} was removed.`);
                        })} className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-300 hover:bg-red-950/40">Remove from team</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {invites.length > 0 && (
        <Panel title="Waiting to accept">
          <div className="-m-5 divide-y divide-slate-700/60">
            {invites.map(i => (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3">
                <MailPlus className="w-4 h-4 text-slate-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{i.name || i.email}</p>
                  <p className="text-xs text-slate-400 truncate">{i.email} · {i.role.name} · link works until {fmtWhen(i.expiresAt)}</p>
                </div>
                <button aria-label={`Cancel invite for ${i.email}`} onClick={async () => { await pfetch(`/team/invites/${i.id}`, { method: "DELETE" }); done("Invite cancelled."); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-700"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="What each role can do">
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map(r => (
            <div key={r.key} className="rounded-lg bg-slate-900/60 border border-slate-700 p-3">
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-semibold", ROLE_TONE[r.key])}>{r.name}</span>
              <p className="text-xs text-slate-400 mt-2">{r.description}</p>
            </div>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
