"use client";

/**
 * Admin → Settings → Sign-in & security: everything about signing in to StuPanel Admin, in one place.
 * - How long a sign-in lasts (Owner sets it for the whole admin team)
 * - The app code (two-step sign-in): the team rule (Owner) and each person's own choice
 * - Password, backup codes, and the devices where you are signed in
 */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Laptop, LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { pfetch } from "@/lib/platform-api";
import { BackupCodes } from "@/app/platform/_components/shell";
import { Btn, Msg, Page, Panel, deviceName, fmtWhen, inp, useCodePrompt } from "../../_components/staff-kit";

type Rules = { idleMinutes: number; maxHours: number; twoStepRequired: boolean };
type Info = { rules: Rules; canEdit: boolean; me: { twoFactorOn: boolean; twoStepOff: boolean; backupCodesLeft: number } };
interface Session { id: string; ipAddress?: string | null; userAgent?: string | null; lastSeenAt: string; createdAt: string; expiresAt: string; current: boolean }

const IDLE: { v: number; label: string }[] = [
  { v: 30, label: "30 minutes" }, { v: 120, label: "2 hours" }, { v: 480, label: "8 hours" },
  { v: 1440, label: "1 day" }, { v: 10080, label: "7 days" }, { v: 0, label: "Never (only the longest time below)" },
];
const MAX: { v: number; label: string }[] = [
  { v: 12, label: "12 hours" }, { v: 24, label: "1 day" }, { v: 168, label: "7 days" }, { v: 720, label: "30 days" },
];

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn("relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50", on ? "bg-indigo-600" : "bg-slate-600")}>
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform", on && "translate-x-5")} />
    </button>
  );
}

export default function SignInSecurityPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [rulesMsg, setRulesMsg] = useState<{ error?: string; ok?: string }>({});
  const [savingRules, setSavingRules] = useState(false);
  const [twoMsg, setTwoMsg] = useState<{ error?: string; ok?: string }>({});
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [pwMsg, setPwMsg] = useState<{ error?: string; ok?: string }>({});
  const [hasPassword, setHasPassword] = useState(true);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [sessMsg, setSessMsg] = useState("");
  const { ask, node } = useCodePrompt();

  const load = useCallback(async () => {
    const [i, s, me] = await Promise.all([pfetch<Info>("/security"), pfetch<Session[]>("/me/sessions"), pfetch<{ hasPassword: boolean }>("/me")]);
    setInfo(i); setRules(i.rules); setSessions(s); setHasPassword(me.hasPassword);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  async function saveRules(next: Rules) {
    setRules(next); setSavingRules(true); setRulesMsg({});
    try {
      const i = await pfetch<Info>("/security", { method: "PUT", json: next });
      setInfo(i); setRules(i.rules); setRulesMsg({ ok: "Saved. It counts for everyone on the admin team, also for sign-ins that are open now." });
      load().catch(() => {});
    } catch (e) { setRulesMsg({ error: (e as Error).message }); setRules(info?.rules ?? null); } finally { setSavingRules(false); }
  }

  function setMine(on: boolean) {
    setTwoMsg({});
    const send = async (code?: string) => {
      const i = await pfetch<Info>("/me/two-step", { method: "POST", json: { on, code } });
      setInfo(i);
      setTwoMsg({ ok: on ? "The app code is asked again when you sign in." : "You are not asked for the app code when you sign in." });
    };
    if (on) send().catch(e => setTwoMsg({ error: (e as Error).message }));
    else ask("Stop asking me for the code", code => send(code));
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

  if (!info || !rules) return <Page title="Sign-in & security"><div className="h-40" /></Page>;
  const ownAllowed = !rules.twoStepRequired;
  const askedNow = info.me.twoFactorOn && (rules.twoStepRequired || !info.me.twoStepOff);
  const idleLabel = IDLE.find(o => o.v === rules.idleMinutes)?.label ?? "";
  const maxLabel = MAX.find(o => o.v === rules.maxHours)?.label ?? "";

  return (
    <Page title="Sign-in & security" sub="How you and your admin team sign in, and where you are signed in">
      {node}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* How long a sign-in lasts */}
        <Panel title="Stay signed in" sub={info.canEdit ? "For everyone on the admin team." : "Set by an Owner for the whole admin team."}>
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Sign out when the admin panel is not used for</span>
              <select value={rules.idleMinutes} disabled={!info.canEdit || savingRules} onChange={e => saveRules({ ...rules, idleMinutes: Number(e.target.value) })} className={inp}>
                {IDLE.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Longest a sign-in lasts, even when it is used</span>
              <select value={rules.maxHours} disabled={!info.canEdit || savingRules} onChange={e => saveRules({ ...rules, maxHours: Number(e.target.value) })} className={inp}>
                {MAX.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-400 leading-relaxed">
              Now: you stay signed in {rules.idleMinutes ? <>until the panel is unused for <b className="text-slate-200">{idleLabel}</b>, and</> : "while you use it, and"} at most <b className="text-slate-200">{maxLabel}</b>. Closing the browser does not sign you out.
            </p>
            {rules.idleMinutes === 0 || rules.maxHours >= 168 ? (
              <p className="text-[11px] text-amber-300/90">Long sign-ins are easy, but anyone who uses this computer can open the admin panel. Keep it on your own computer only.</p>
            ) : null}
            <Msg {...rulesMsg} />
          </div>
        </Panel>

        {/* App code */}
        <Panel title="App code at sign-in" sub="Two-step sign-in: a 6-digit code from your authenticator app after the password or Google.">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">Everyone on the admin team must use it</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{info.canEdit ? "Turn off to let each person choose for themselves." : "Only an Owner can change this."}</p>
              </div>
              <Switch label="Everyone must use the app code" on={rules.twoStepRequired} disabled={!info.canEdit || savingRules} onChange={v => saveRules({ ...rules, twoStepRequired: v })} />
            </div>
            <div className={cn("flex items-start gap-3 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-3", !ownAllowed && "opacity-70")}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">Ask me for the code when I sign in</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {!ownAllowed ? "On for everyone while the rule above is on." : "Turning it off needs one code from your app."}
                </p>
              </div>
              <Switch label="Ask me for the code when I sign in" on={rules.twoStepRequired || !info.me.twoStepOff} disabled={!ownAllowed} onChange={setMine} />
            </div>
            <div className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 border", askedNow ? "bg-emerald-950/30 border-emerald-900/60" : "bg-amber-950/30 border-amber-900/60")}>
              {askedNow ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldOff className="w-4 h-4 text-amber-400" />}
              <span className={cn("text-sm flex-1", askedNow ? "text-emerald-200" : "text-amber-200")}>{askedNow ? "You are asked for the code" : "You sign in with the password or Google only"}</span>
              {info.me.twoFactorOn && <span className="text-xs text-slate-400">{info.me.backupCodesLeft} backup code{info.me.backupCodesLeft === 1 ? "" : "s"} left</span>}
            </div>
            <Msg {...twoMsg} />
            {info.me.twoFactorOn && (newCodes.length > 0 ? (
              <BackupCodes codes={newCodes} onDone={() => { setNewCodes([]); load().catch(() => {}); }} doneLabel="Done" />
            ) : (
              <Btn variant="ghost" onClick={() => ask("Make new backup codes", async code => {
                const r = await pfetch<{ backupCodes: string[] }>("/me/backup-codes", { method: "POST", json: { code } });
                setNewCodes(r.backupCodes);
              })}>Make new backup codes</Btn>
            ))}
            <p className="text-[11px] text-slate-500">Deleting a studio for good and changing your password still ask for the app code.</p>
          </div>
        </Panel>

        {/* Devices */}
        <Panel title="Where you're signed in" sub="Sign out a device you don't use or don't know.">
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2.5">
                <Laptop className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{deviceName(s.userAgent)}{s.current && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-400">This device</span>}</p>
                  <p className="text-[11px] text-slate-500 truncate">{s.ipAddress ?? "—"} · signed in {fmtWhen(s.createdAt)} · last used {fmtWhen(s.lastSeenAt)} · ends {fmtWhen(s.expiresAt)}</p>
                </div>
                {!s.current && (
                  <button type="button" aria-label="Sign out this device" title="Sign out this device" onClick={async () => { await pfetch(`/me/sessions/${s.id}`, { method: "DELETE" }); setSessMsg("Signed out that device."); load().catch(() => {}); }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-950/40"><LogOut className="w-4 h-4" /></button>
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

        {/* Password */}
        <Panel title="Password" sub={hasPassword ? "Changing it signs out your other devices." : "You sign in with Google. You can add a password too."}>
          <form onSubmit={changePassword} className="space-y-3">
            {hasPassword && (
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
      </div>
    </Page>
  );
}
