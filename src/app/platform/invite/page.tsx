"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api";
import { loginPath, platformPost } from "@/lib/platform-api";
import { Btn, ErrorBox, Field, Shell, inputCls } from "../_components/shell";

interface Info { email: string; name?: string | null; role: { key: string; name: string } }

function InviteInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [info, setInfo] = useState<Info | null>(null);
  const [bad, setBad] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setBad("This invite link is missing its code."); return; }
    fetch(`${API_URL}/platform/auth/invite?token=${encodeURIComponent(token)}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d as Info; })
      .then(d => { setInfo(d); setName(d.name || ""); })
      .catch(e => setBad((e as Error).message || "This invite is not valid any more."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (password !== again) { setError("The two passwords don't match."); return; }
    setLoading(true);
    try {
      const r = await platformPost<{ next: string; challenge: string }>("/auth/invite/accept", { token, name: name.trim(), password });
      router.replace(`${loginPath()}?step=${r.next}&challenge=${encodeURIComponent(r.challenge)}`);
    } catch (e) { setError((e as Error).message); setLoading(false); }
  }

  if (bad) return <Shell title="Invite not valid"><ErrorBox text={bad} /><p className="text-xs text-slate-500">Ask the StuPanel owner to send a new invite.</p></Shell>;
  if (!info) return <Shell title="Loading invite…"><div className="h-24" /></Shell>;

  return (
    <Shell title="Join StuPanel Admin" sub={`You're invited as ${info.role.name}`}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email"><input value={info.email} disabled className={`${inputCls} opacity-70`} /></Field>
        <Field label="Your name"><input required minLength={2} value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Password" hint="At least 10 characters, with letters and numbers. You can also use Google later with this same email.">
          <input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Type it again"><input type="password" required autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} className={inputCls} /></Field>
        <ErrorBox text={error} />
        <Btn loading={loading}>Create account</Btn>
      </form>
      <p className="text-[11px] text-slate-500">Next you will turn on two-step sign-in with an authenticator app on your phone.</p>
    </Shell>
  );
}

export default function PlatformInvitePage() {
  return <Suspense><InviteInner /></Suspense>;
}
