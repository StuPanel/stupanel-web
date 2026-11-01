"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { platformPost, loginPath } from "@/lib/platform-api";
import { Btn, CodeInput, ErrorBox, Field, OkBox, Shell, inputCls } from "../_components/shell";

function ResetInner() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (password !== again) { setError("The two passwords don't match."); return; }
    setLoading(true);
    try { await platformPost("/auth/reset-password", { token, password, code: code.trim() || undefined }); setDone(true); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  if (!token) return <Shell title="Link not valid"><ErrorBox text="This reset link is missing its code. Ask for a new link." /></Shell>;
  if (done) {
    return (
      <Shell title="Password changed">
        <OkBox text="Your new password is saved and every device was signed out." />
        <Link href={loginPath()} className="block"><Btn type="button">Sign in</Btn></Link>
      </Shell>
    );
  }
  return (
    <Shell title="Choose a new password" sub="At least 10 characters, with letters and numbers">
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password"><input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} /></Field>
        <Field label="Type it again"><input type="password" required autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} className={inputCls} /></Field>
        <Field label="Code from your authenticator app" hint="Or one of your backup codes.">
          <CodeInput value={code} onChange={setCode} allowBackup />
        </Field>
        <ErrorBox text={error} />
        <Btn loading={loading}>Save new password</Btn>
      </form>
    </Shell>
  );
}

export default function PlatformResetPage() {
  return <Suspense><ResetInner /></Suspense>;
}
