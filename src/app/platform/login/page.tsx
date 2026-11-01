"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, Smartphone } from "lucide-react";
import { API_URL } from "@/lib/api";
import { installAdminFetchShim, platformPost, refreshPlatform, savePlatformSession, type PlatformUser } from "@/lib/platform-api";
import { BackupCodes, Btn, CodeInput, ErrorBox, Field, OkBox, QrBox, Shell, inputCls } from "../_components/shell";

type Step = "signin" | "forgot" | "2fa" | "setup" | "codes";
interface Session { accessToken: string; user: PlatformUser; backupCodes?: string[] }

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const q = useSearchParams();
  const [step, setStep] = useState<Step>("signin");
  const [challenge, setChallenge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const goIn = () => { installAdminFetchShim(); router.replace("/admin/dashboard"); };

  // Coming back from Google, or from the invite page
  useEffect(() => {
    const err = q.get("error");
    const ch = q.get("challenge");
    const st = q.get("step");
    if (err) setError(err);
    if (ch && (st === "2fa" || st === "setup")) {
      setChallenge(ch); setStep(st);
      window.history.replaceState(null, "", window.location.pathname); // keep the link out of history
    } else if (!err) {
      // Already signed in on this browser? Skip the form.
      refreshPlatform().then(okay => { if (okay) goIn(); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup: ask the server for a new secret when we land on that step
  useEffect(() => {
    if (step !== "setup" || !challenge || setup) return;
    platformPost<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup", { challenge })
      .then(setSetup)
      .catch(e => { setError(e.message); setStep("signin"); });
  }, [step, challenge, setup]);

  async function run(fn: () => Promise<void>) {
    setError(""); setOk(""); setLoading(true);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  const signIn = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const r = await platformPost<{ next: "2fa" | "setup"; challenge: string }>("/auth/login", { email: email.trim(), password });
    setPassword(""); setChallenge(r.challenge); setCode(""); setStep(r.next);
  }); };

  const verify = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const r = await platformPost<Session>("/auth/2fa/verify", { challenge, code: code.trim() });
    savePlatformSession(r.accessToken, r.user); goIn();
  }); };

  const confirmSetup = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const r = await platformPost<Session>("/auth/2fa/setup/confirm", { challenge, code });
    savePlatformSession(r.accessToken, r.user);
    setCodes(r.backupCodes ?? []); setStep("codes");
  }); };

  const forgot = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    await platformPost("/auth/forgot-password", { email: email.trim() });
    setOk("If this email is on the team, a reset link is on its way. It works for 30 minutes.");
  }); };

  if (step === "codes") {
    return <Shell title="Two-step sign-in is on" sub="One last thing"><BackupCodes codes={codes} onDone={goIn} doneLabel="Open the admin panel" /></Shell>;
  }

  if (step === "setup") {
    return (
      <Shell title="Turn on two-step sign-in" sub="Required for everyone on the team">
        <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
          <li>Open Google Authenticator, Microsoft Authenticator or Authy on your phone.</li>
          <li>Scan this QR code (or type the key below).</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        {setup ? <QrBox uri={setup.otpauthUrl} secret={setup.secret} /> : <div className="h-[250px]" />}
        <form onSubmit={confirmSetup} className="space-y-3">
          <Field label="6-digit code"><CodeInput value={code} onChange={setCode} /></Field>
          <ErrorBox text={error} />
          <Btn loading={loading} disabled={code.length !== 6 || !setup}><Smartphone className="w-4 h-4" />Turn on and sign in</Btn>
        </form>
      </Shell>
    );
  }

  if (step === "2fa") {
    return (
      <Shell title="Enter your code" sub="Open your authenticator app">
        <form onSubmit={verify} className="space-y-3">
          <Field label="6-digit code" hint="Lost your phone? Type one of your backup codes instead.">
            <CodeInput value={code} onChange={setCode} autoFocus allowBackup />
          </Field>
          <ErrorBox text={error} />
          <Btn loading={loading} disabled={code.replace(/[^A-Z0-9]/gi, "").length < 6}>Sign in</Btn>
        </form>
        <button type="button" onClick={() => { setStep("signin"); setChallenge(""); setError(""); }} className="w-full text-xs text-slate-500 hover:text-slate-300">Start again</button>
      </Shell>
    );
  }

  if (step === "forgot") {
    return (
      <Shell title="Forgot password" sub="We'll email you a reset link">
        <form onSubmit={forgot} className="space-y-3">
          <Field label="Email"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="you@stupanel.com" /></Field>
          <ErrorBox text={error} /><OkBox text={ok} />
          <Btn loading={loading}>Send reset link</Btn>
        </form>
        <button type="button" onClick={() => { setStep("signin"); setOk(""); setError(""); }} className="w-full text-xs text-slate-500 hover:text-slate-300">Back to sign in</button>
      </Shell>
    );
  }

  return (
    <Shell title="StuPanel Admin" sub="Sign in to the team panel">
      <a href={`${API_URL}/auth/google?for=platform`}
        className="w-full h-10 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors">
        <GoogleIcon />Continue with Google
      </a>
      <div className="flex items-center gap-3 text-[11px] text-slate-600"><span className="h-px flex-1 bg-slate-800" />or<span className="h-px flex-1 bg-slate-800" /></div>
      <form onSubmit={signIn} className="space-y-3">
        <Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="you@stupanel.com" /></Field>
        <Field label="Password">
          <div className="relative">
            <input type={showPw ? "text" : "password"} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} pr-10`} placeholder="••••••••" />
            <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <ErrorBox text={error} />
        <Btn loading={loading}><KeyRound className="w-4 h-4" />Sign in</Btn>
      </form>
      <button type="button" onClick={() => { setStep("forgot"); setError(""); }} className="w-full text-xs text-slate-500 hover:text-slate-300">Forgot password?</button>
    </Shell>
  );
}

export default function PlatformLoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
