"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Laptop, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { pfetch, savePlatformSession, type PlatformUser } from "@/lib/platform-api";
import { BackupCodes } from "@/app/platform/_components/shell";
import { Btn, Msg, Page, Panel, deviceName, fmtWhen, inp, useCodePrompt } from "../_components/staff-kit";

interface Session { id: string; ipAddress?: string | null; userAgent?: string | null; lastSeenAt: string; createdAt: string; current: boolean }

export default function MyAccountPage() {
  const [me, setMe] = useState<PlatformUser | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ error?: string; ok?: string }>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [pwMsg, setPwMsg] = useState<{ error?: string; ok?: string }>({});
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [sessMsg, setSessMsg] = useState("");
  const { ask, node } = useCodePrompt();

  const load = useCallback(async () => {
    const [u, s] = await Promise.all([pfetch<PlatformUser>("/me"), pfetch<Session[]>("/me/sessions")]);
    setMe(u); setName(u.name); setPhone(u.phone ?? ""); setSessions(s);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSavingProfile(true); setProfileMsg({});
    try {
      const u = await pfetch<PlatformUser>("/me", { method: "PATCH", json: { name: name.trim(), phone: phone.trim() } });
      setMe(u); savePlatformSession(sessionStorage.getItem("admin_token") || "", u);
      setProfileMsg({ ok: "Saved." });
    } catch (err) { setProfileMsg({ error: (err as Error).message }); } finally { setSavingProfile(false); }
  }

  function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPwMsg({});
    if (pw.next !== pw.again) { setPwMsg({ error: "The two new passwords don't match." }); return; }
    ask("Change your password", async code => {
      await pfetch("/me/password", { method: "POST", json: { currentPassword: pw.current || undefined, newPassword: pw.next, code } });
      setPw({ current: "", next: "", again: "" });
      setPwMsg({ ok: "Password changed. Your other devices were signed out." });
      load().catch(() => {});
    });
  }

  if (!me) return <Page title="My account"><div className="h-40" /></Page>;

  return (
    <Page title="My account" sub={`${me.email} · ${me.isOwner ? "Owner" : me.role?.name ?? ""}`}>
      {node}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Profile">
          <form onSubmit={saveProfile} className="space-y-3">
            <label className="block space-y-1"><span className="text-xs text-slate-400">Name</span>
              <input value={name} onChange={e => setName(e.target.value)} required minLength={2} className={inp} /></label>
            <label className="block space-y-1"><span className="text-xs text-slate-400">Phone</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inp} placeholder="01XXXXXXXXX" /></label>
            <label className="block space-y-1"><span className="text-xs text-slate-400">Email</span>
              <input value={me.email} disabled className={inp} /></label>
            <Msg {...profileMsg} />
            <Btn loading={savingProfile}>Save</Btn>
          </form>
        </Panel>

        <Panel title="Password" sub={me.hasPassword ? "Changing it signs out your other devices." : "You sign in with Google. You can add a password too."}>
          <form onSubmit={changePassword} className="space-y-3">
            {me.hasPassword && (
              <label className="block space-y-1"><span className="text-xs text-slate-400">Current password</span>
                <input type="password" autoComplete="current-password" required value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} className={inp} /></label>
            )}
            <label className="block space-y-1"><span className="text-xs text-slate-400">New password</span>
              <input type="password" autoComplete="new-password" required minLength={10} value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} className={inp} /></label>
            <label className="block space-y-1"><span className="text-xs text-slate-400">Type it again</span>
              <input type="password" autoComplete="new-password" required value={pw.again} onChange={e => setPw({ ...pw, again: e.target.value })} className={inp} /></label>
            <p className="text-[11px] text-slate-500">At least 10 characters, with letters and numbers.</p>
            <Msg {...pwMsg} />
            <Btn><KeyRound className="w-3.5 h-3.5" />Change password</Btn>
          </form>
        </Panel>

        <Panel title="Two-step sign-in" sub="Your authenticator app gives a new code every 30 seconds.">
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-950/30 border border-emerald-900/60 px-3 py-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-200 flex-1">On</span>
              <span className="text-xs text-emerald-300/80">{me.backupCodesLeft} backup code{me.backupCodesLeft === 1 ? "" : "s"} left</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2.5">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300 flex-1">Google sign-in</span>
              <span className="text-xs text-slate-400">{me.googleLinked ? "Linked" : "Not used yet"}</span>
            </div>
            {newCodes.length > 0 ? (
              <BackupCodes codes={newCodes} onDone={() => { setNewCodes([]); load().catch(() => {}); }} doneLabel="Done" />
            ) : (
              <Btn variant="ghost" onClick={() => ask("Make new backup codes", async code => {
                const r = await pfetch<{ backupCodes: string[] }>("/me/backup-codes", { method: "POST", json: { code } });
                setNewCodes(r.backupCodes);
              })}>Make new backup codes</Btn>
            )}
            <p className="text-[11px] text-slate-500">Lost your phone? Sign in with a backup code, or ask an Owner to reset your two-step sign-in.</p>
          </div>
        </Panel>

        <Panel title="Where you're signed in" sub="Sessions end after 12 hours, or 2 hours without use.">
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2.5">
                <Laptop className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{deviceName(s.userAgent)}{s.current && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-400">This device</span>}</p>
                  <p className="text-[11px] text-slate-500 truncate">{s.ipAddress ?? "—"} · last used {fmtWhen(s.lastSeenAt)}</p>
                </div>
                {!s.current && (
                  <button aria-label="Sign out this device" onClick={async () => { await pfetch(`/me/sessions/${s.id}`, { method: "DELETE" }); load().catch(() => {}); }}
                    className="text-slate-500 hover:text-red-400"><LogOut className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            {sessions.length > 1 && (
              <Btn variant="danger" onClick={async () => {
                const r = await pfetch<{ ended: number }>("/me/sessions/others", { method: "DELETE" });
                setSessMsg(`Signed out ${r.ended} other device${r.ended === 1 ? "" : "s"}.`); load().catch(() => {});
              }}>Sign out all other devices</Btn>
            )}
            <Msg ok={sessMsg} />
          </div>
        </Panel>
      </div>
    </Page>
  );
}
