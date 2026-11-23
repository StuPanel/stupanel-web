"use client";
/**
 * Settings → Security (and My Account for team members): the email you sign in with (change it), a recovery email, and 2-step sign-in
 * (authenticator app or a code by email, with backup codes). Every change asks for your password; codes go by email.
 */
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, KeyRound, Loader2, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";

type Overview = {
  email: string; hasPassword: boolean; canChange: boolean;
  recovery: { email: string; verified: boolean } | null;
  twoFactor: { on: boolean; app: boolean; email: boolean; backupLeft: number };
  appSaved?: boolean;
};
type Open = null | "email" | "recovery" | "app" | "appOn" | "mailcode" | "offApp" | "offEmail" | "backup" | "recoveryRemove";

const card = cn("bg-white rounded-[20px]", CARD_SHADOW);
const lbl = "block text-[13px] font-semibold text-[#4A4658] mb-1.5";
const btn = "h-10 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50";

async function post<T = Overview>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const r = await apiFetch(`${API}/account/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!r) return { ok: false, error: "No internet connection. Try again." };
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const m = (d as { message?: string | string[] }).message; return { ok: false, error: (Array.isArray(m) ? m[0] : m) || "That did not work. Try again." }; }
  return { ok: true, data: d as T };
}

function Pw({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <label className="block" htmlFor={id}><span className={lbl}>Your password</span>
      <input id={id} type="password" value={value} onChange={e => onChange(e.target.value)} autoComplete="current-password" className={inputCls} />
    </label>
  );
}

function CodeInput({ value, onChange, id, label = "6-digit code" }: { value: string; onChange: (v: string) => void; id: string; label?: string }) {
  return (
    <label className="block" htmlFor={id}><span className={lbl}>{label}</span>
      <input id={id} value={value} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
        className={cn(inputCls, "tracking-[.3em] text-lg font-bold max-w-[200px]")} />
    </label>
  );
}

function Toggle({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn("relative w-[51px] h-[31px] rounded-full transition-colors flex-shrink-0 disabled:opacity-40", on ? "bg-[#1F8A5B]" : "bg-[#E4E0EC]")}>
      <span className={cn("absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-transform", on && "translate-x-[20px]")} />
    </button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="w-6 h-6 rounded-full bg-[#7D5CEF] text-white text-[12px] font-bold inline-flex items-center justify-center flex-shrink-0">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

/** The backup codes, shown once, with copy and download. */
function BackupCodes({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const text = `StuPanel backup codes — each works once\n\n${codes.join("\n")}\n`;
  return (
    <div className="rounded-[16px] border-2 border-[#F3DDAE] bg-[#FFF9EC] p-4">
      <p className="text-[14px] font-bold text-[#6B4A00]">Save these backup codes now</p>
      <p className="text-[13px] text-[#6B4A00] mt-1">If you lose your phone or can&apos;t get the email code, one of these lets you sign in. Each works once. You will not see them again.</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[15px] font-bold text-[#17151F]">{codes.map(c => <span key={c} className="bg-white rounded-lg px-3 py-1.5 text-center">{c}</span>)}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(text).then(() => notify("Codes copied"))} className={cn(btn, "bg-white border border-[#E3DFEC] text-[#4A4658]")}><Copy className="w-4 h-4" />Copy</button>
        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="stupanel-backup-codes.txt" className={cn(btn, "bg-white border border-[#E3DFEC] text-[#4A4658]")}><Download className="w-4 h-4" />Download</a>
        <button type="button" onClick={onClose} className={cn(btn, "bg-[#17151F] text-white")}><Check className="w-4 h-4" />I saved them</button>
      </div>
    </div>
  );
}

export function SignInSecurity() {
  const [o, setO] = useState<Overview | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [pw, setPw] = useState("");
  const [val, setVal] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [qr, setQr] = useState<{ img: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => { apiFetch(`${API}/account/security`).then(r => (r.ok ? r.json() : null)).then(setO).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  function start(which: Open) { setOpen(o => (o === which ? null : which)); setPw(""); setVal(""); setCode(""); setSentTo(""); setQr(null); setErr(""); }
  async function run<T>(path: string, body: unknown, then: (d: T) => void) {
    setBusy(true); setErr("");
    const r = await post<T>(path, body);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    then(r.data);
  }

  if (!o) return null;
  if (!o.canChange) return null;
  const tf = o.twoFactor;
  const needPw = !o.hasPassword;

  const errBox = err && <p role="alert" className="text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{err}</p>;
  const panel = "px-4 sm:px-5 pb-4 pt-1 space-y-3";
  const lastOne = (what: "app" | "email") => (what === "app" ? !tf.email : !tf.app);
  const offPanel = (what: "app" | "email", done: string) => (
    <div className="px-3.5 pb-4 space-y-3">
      <p className="text-[13px] text-[#6B6680]">{lastOne(what) ? "This turns 2-step sign-in off: your password alone will open your account." : "The other way stays on."}</p>
      <Pw value={pw} onChange={setPw} id={`pw-off-${what}`} />
      {errBox}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void run("2fa/off", { password: pw, what }, d => { setO(d as Overview); notify(lastOne(what) ? "2-step sign-in is off" : done); start(null); })} className={cn(btn, "bg-[#C2304F] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Turn off</button>
        <button type="button" onClick={() => start(null)} className={cn(btn, "text-[#4A4658]")}>Keep it on</button>
      </div>
    </div>
  );

  return (
    <section>
      <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Sign-in &amp; security</h2>
      {needPw && <p className="mb-2 px-1 text-[12.5px] text-[#6B6680]">You sign in with Google. Set a password above first — every change here asks for it.</p>}
      <div className={cn(card, "divide-y divide-[#EEEBF4] overflow-hidden")}>

        {/* Login email */}
        <div>
          <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#5B3FD0] flex-shrink-0" />
            <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold text-[#17151F]">Sign-in email</p><p className="text-[13px] text-[#6B6680] truncate">{o.email}</p></div>
            <button type="button" disabled={needPw} onClick={() => start("email")} className="text-[13.5px] font-semibold text-[#7D5CEF] disabled:opacity-40">{open === "email" ? "Close" : "Change"}</button>
          </div>
          {open === "email" && (
            <div className={panel}>
              <p className="text-[13px] text-[#6B6680]">After the change you sign in with the new email in every studio you work in. The old email stops working at once and is free to make a new StuPanel account. It gets a notice with 7 days to undo, in case it wasn&apos;t you.</p>
              {!sentTo ? (<>
                <label className="block"><span className={lbl}>New email</span><input type="email" value={val} onChange={e => setVal(e.target.value)} autoComplete="email" className={inputCls} /></label>
                <Pw value={pw} onChange={setPw} id="pw-email" />
                {errBox}
                <button type="button" disabled={busy} onClick={() => void run<{ sentTo: string }>("email-change", { email: val, password: pw }, d => setSentTo(d.sentTo))} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send code to the new email</button>
              </>) : (<>
                <p className="text-[13.5px] text-[#17151F]">We sent a code to <b>{sentTo}</b>.</p>
                <CodeInput value={code} onChange={setCode} id="code-email" />
                {errBox}
                <button type="button" disabled={busy || code.length < 6} onClick={() => void run<{ email: string }>("email-change/confirm", { code }, d => { notify(`You now sign in with ${d.email}`); try { localStorage.setItem("user_email", d.email); } catch { /* ignore */ } start(null); load(); })} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Change my sign-in email</button>
              </>)}
            </div>
          )}
        </div>

        {/* Recovery email */}
        <div>
          <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-[#5B3FD0] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-[#17151F]">Recovery email</p>
              <p className="text-[13px] text-[#6B6680] truncate">{o.recovery?.verified ? o.recovery.email : "Not added — if you lose your main email, this is how you get back in"}</p>
            </div>
            {o.recovery?.verified
              ? <button type="button" disabled={needPw} onClick={() => start("recoveryRemove")} className="text-[13.5px] font-semibold text-[#C2304F] disabled:opacity-40">{open === "recoveryRemove" ? "Close" : "Remove"}</button>
              : <button type="button" disabled={needPw} onClick={() => start("recovery")} className="text-[13.5px] font-semibold text-[#7D5CEF] disabled:opacity-40">{open === "recovery" ? "Close" : "Add"}</button>}
          </div>
          {open === "recovery" && (
            <div className={panel}>
              <p className="text-[13px] text-[#6B6680]">A second email of yours (not your sign-in email). Password reset links also go there, and it helps StuPanel know it&apos;s you if you lose your main email.</p>
              {!sentTo ? (<>
                <label className="block"><span className={lbl}>Recovery email</span><input type="email" value={val} onChange={e => setVal(e.target.value)} className={inputCls} /></label>
                <Pw value={pw} onChange={setPw} id="pw-rec" />
                {errBox}
                <button type="button" disabled={busy} onClick={() => void run<{ sentTo: string }>("recovery-email", { email: val, password: pw }, d => setSentTo(d.sentTo))} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send code</button>
              </>) : (<>
                <p className="text-[13.5px] text-[#17151F]">We sent a code to <b>{sentTo}</b>.</p>
                <CodeInput value={code} onChange={setCode} id="code-rec" />
                {errBox}
                <button type="button" disabled={busy || code.length < 6} onClick={() => void run("recovery-email/confirm", { code }, d => { setO(d as Overview); notify("Recovery email added"); start(null); })} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Add recovery email</button>
              </>)}
            </div>
          )}
          {open === "recoveryRemove" && (
            <div className={panel}>
              <Pw value={pw} onChange={setPw} id="pw-recrm" />
              {errBox}
              <button type="button" disabled={busy} onClick={() => void run("recovery-email/remove", { password: pw }, d => { setO(d as Overview); notify("Recovery email removed"); start(null); })} className={cn(btn, "bg-[#C2304F] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Remove recovery email</button>
            </div>
          )}
        </div>

        {/* 2-step sign-in */}
        <div>
          <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
            <ShieldCheck className={cn("w-5 h-5 flex-shrink-0", tf.on ? "text-[#1F8A5B]" : "text-[#5B3FD0]")} />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-[#17151F] flex items-center gap-2">2-step sign-in <span className={cn("h-5 px-2 rounded-full text-[11.5px] font-bold inline-flex items-center", tf.on ? "bg-[#E9F5EF] text-[#1F6B47]" : "bg-[#F1EFF5] text-[#6B6680]")}>{tf.on ? "On" : "Off"}</span></p>
              <p className="text-[13px] text-[#6B6680]">After your password, StuPanel also asks for a code — a stolen password alone can&apos;t get in.</p>
            </div>
          </div>
          {codes && <div className="px-4 sm:px-5 pb-4"><BackupCodes codes={codes} onClose={() => setCodes(null)} /></div>}

          {/* Way 1: authenticator app (recommended) */}
          <div className="mx-4 sm:mx-5 mb-3 rounded-[16px] border-2 border-[#E5DEFB] bg-[#FAF8FF]">
            <div className="px-3.5 py-3 flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-[#5B3FD0] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#17151F] flex flex-wrap items-center gap-x-2 gap-y-1">Google Authenticator app <span className="h-5 px-2 rounded-full bg-[#7D5CEF] text-white text-[11px] font-bold inline-flex items-center">Recommended</span></p>
                <p className="text-[12.5px] text-[#6B6680] mt-0.5">A new code on your phone every 30 seconds. Works without internet, no emails to wait for.</p>
              </div>
              <Toggle on={tf.app} label="Authenticator app" disabled={needPw} onChange={v => start(v ? (o.appSaved ? "appOn" : "app") : "offApp")} />
            </div>
            {(tf.app || o.appSaved) && open !== "app" && (
              <button type="button" disabled={needPw} onClick={() => start("app")} className="px-3.5 pb-3 -mt-1 text-[12.5px] font-semibold text-[#7D5CEF] disabled:opacity-40">New phone? Scan again</button>
            )}
            {open === "app" && (
              <div className="px-3.5 pb-4 space-y-3">
                <ol className="space-y-2.5 text-[13.5px] text-[#17151F]">
                  <Step n={1}>Install <b>Google Authenticator</b> on your phone:{" "}
                    <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#7D5CEF] underline">Android (Play Store)</a>{" · "}
                    <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#7D5CEF] underline">iPhone (App Store)</a>
                  </Step>
                  <Step n={2}>Open the app, tap <b>+</b> (bottom right), then <b>Scan a QR code</b>.</Step>
                  <Step n={3}>Point the camera at the QR code below. &ldquo;StuPanel&rdquo; appears in the app with a 6-digit code.</Step>
                  <Step n={4}>Type that code here and tap <b>Turn on</b>.</Step>
                </ol>
                {!qr ? (<>
                  <Pw value={pw} onChange={setPw} id="pw-app" />
                  {errBox}
                  <button type="button" disabled={busy} onClick={() => void run<{ secret: string; uri: string }>("2fa/app", { password: pw }, async d => setQr({ img: await QRCode.toDataURL(d.uri, { margin: 1, width: 220 }), secret: d.secret }))} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Show the QR code</button>
                </>) : (<>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr.img} alt="QR code for the authenticator app" width={180} height={180} className="rounded-xl border border-[#EEEBF4] bg-white" />
                  <p className="text-[12.5px] text-[#6B6680]">On this same phone, or can&apos;t scan? In the app choose <b>Enter a setup key</b> and type: <span className="font-mono font-semibold text-[#17151F] break-all">{qr.secret}</span></p>
                  <CodeInput value={code} onChange={setCode} id="code-app" />
                  {errBox}
                  <button type="button" disabled={busy || code.length < 6} onClick={() => void run<Overview & { backupCodes: string[] | null }>("2fa/app/confirm", { code }, d => { setO(d); if (d.backupCodes) setCodes(d.backupCodes); notify("2-step sign-in is on"); start(null); })} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Turn on</button>
                </>)}
                <button type="button" onClick={() => start(null)} className="block text-[13px] font-semibold text-[#6B6680]">Close</button>
              </div>
            )}
            {open === "appOn" && (
              <div className="px-3.5 pb-4 space-y-3">
                <p className="text-[13px] text-[#6B6680]">StuPanel is still in your authenticator app, so you don&apos;t need to scan again. (Deleted it from the app? Use &ldquo;Scan again&rdquo;.)</p>
                <Pw value={pw} onChange={setPw} id="pw-appon" />
                {errBox}
                <button type="button" disabled={busy} onClick={() => void run<Overview & { backupCodes: string[] | null }>("2fa/app/on", { password: pw }, d => { setO(d); if (d.backupCodes) setCodes(d.backupCodes); notify("2-step sign-in is on"); start(null); })} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Turn on</button>
              </div>
            )}
            {open === "offApp" && offPanel("app", "Authenticator app turned off")}
          </div>

          {/* Way 2: a code by email */}
          <div className="mx-4 sm:mx-5 mb-3 rounded-[16px] border border-[#ECE9F2]">
            <div className="px-3.5 py-3 flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#6B6680] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#17151F]">Code by email</p>
                <p className="text-[12.5px] text-[#6B6680] mt-0.5">An email with a code at every sign-in — slower, and your inbox fills up. Use it if you can&apos;t use the app.</p>
              </div>
              <Toggle on={tf.email} label="Code by email" disabled={needPw} onChange={v => start(v ? "mailcode" : "offEmail")} />
            </div>
            {open === "mailcode" && (
              <div className="px-3.5 pb-4 space-y-3">
                <p className="text-[13px] text-[#6B6680]">Each time you sign in, StuPanel emails a 6-digit code to <b>{o.email}</b>.</p>
                <Pw value={pw} onChange={setPw} id="pw-mail" />
                {errBox}
                <button type="button" disabled={busy} onClick={() => void run<Overview & { backupCodes: string[] | null }>("2fa/email", { password: pw }, d => { setO(d); if (d.backupCodes) setCodes(d.backupCodes); notify("2-step sign-in is on"); start(null); })} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Turn on</button>
              </div>
            )}
            {open === "offEmail" && offPanel("email", "Email code turned off")}
          </div>

          {/* Backup codes */}
          {tf.on && (
            <div className="px-4 sm:px-5 pb-4">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-[#6B6680] flex-shrink-0" />
                <p className="flex-1 text-[13.5px] text-[#4A4658]">Backup codes: <b>{tf.backupLeft}</b> left — for a lost phone</p>
                <button type="button" disabled={needPw} onClick={() => start("backup")} className="text-[13.5px] font-semibold text-[#7D5CEF] disabled:opacity-40">{open === "backup" ? "Close" : "New codes"}</button>
              </div>
              {open === "backup" && (
                <div className="pt-3 space-y-3">
                  <p className="text-[13px] text-[#6B6680]">10 new codes; the old ones stop working.</p>
                  <Pw value={pw} onChange={setPw} id="pw-backup" />
                  {errBox}
                  <button type="button" disabled={busy} onClick={() => void run<{ backupCodes: string[] }>("2fa/backup-codes", { password: pw }, d => { setCodes(d.backupCodes); start(null); load(); })} className={cn(btn, "bg-[#7D5CEF] text-white")}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Make new codes</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
