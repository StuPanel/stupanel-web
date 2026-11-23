"use client";
/**
 * The second step of signing in, after the password or Google: a code from the authenticator app, the code sent
 * by email, or one of the backup codes.
 */
import { useState } from "react";
import { KeyRound, Loader2, Mail, Smartphone } from "lucide-react";
import { postPublic } from "@/lib/studio-session";

export type TwoStepTicket = { ticket: string; app: boolean; email: boolean; sentTo: string | null };

export function TwoStepStep({ step, onDone, onBack }: { step: TwoStepTicket; onDone: (data: unknown) => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError(backup ? "Type one of your backup codes." : "Type the 6-digit code.");
    setBusy(true); setError("");
    const r = await postPublic("/auth/2fa", { ticket: step.ticket, code: code.trim() });
    setBusy(false);
    if (!r.ok) { setError(r.error); if (/sign in again/i.test(r.error)) setTimeout(onBack, 2500); return; }
    onDone(r.data);
  }
  async function resend() {
    setSent(""); setError("");
    const r = await postPublic<{ sentTo: string }>("/auth/2fa/resend", { ticket: step.ticket });
    if (!r.ok) return setError(r.error);
    setSent(`A new code was sent to ${r.data.sentTo}.`);
  }

  const lead = backup ? "Type one of the backup codes you saved when you turned on 2-step sign-in. Each code works once."
    : step.app && step.email ? `Open your authenticator app, or check ${step.sentTo ?? "your email"}, and type the 6-digit code.`
    : step.app ? "Open your authenticator app (Google Authenticator or similar) and type the 6-digit code for StuPanel."
    : `We sent a 6-digit code to ${step.sentTo ?? "your email"}. It works for 15 minutes.`;

  return (
    <div>
      <span className="w-12 h-12 rounded-2xl bg-[#EEE8FD] text-[#5B3FD0] inline-flex items-center justify-center mb-4">
        {backup ? <KeyRound className="w-6 h-6" /> : step.app ? <Smartphone className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
      </span>
      <h2 className="text-2xl font-bold text-[#17151F]">2-step sign-in</h2>
      <p className="text-[#6B6680] mt-1 text-sm leading-relaxed">{lead}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input value={code} onChange={e => setCode(backup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" autoFocus aria-label={backup ? "Backup code" : "6-digit code"}
          placeholder={backup ? "XXXX-XXXX" : "123456"}
          className="w-full h-14 rounded-xl border border-[#E4E0EC] bg-white text-center text-2xl font-bold tracking-[.3em] text-[#17151F] outline-none focus:border-[#7D5CEF] focus:ring-2 focus:ring-[#7D5CEF]/20" />
        {error && <p role="alert" className="px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</p>}
        {sent && <p role="status" className="px-4 py-3 rounded-lg bg-[#F1FAF5] border border-[#CDEBDB] text-[#1F6B47] text-sm">{sent}</p>}
        <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Continue
        </button>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-sm">
        {step.email && !backup && <button type="button" onClick={() => void resend()} className="text-left font-semibold text-[#7D5CEF] hover:text-[#5B3FD0]">Send the email code again</button>}
        <button type="button" onClick={() => { setBackup(b => !b); setCode(""); setError(""); }} className="text-left font-semibold text-[#7D5CEF] hover:text-[#5B3FD0]">
          {backup ? "Use the 6-digit code instead" : "Use a backup code"}
        </button>
        <button type="button" onClick={onBack} className="text-left font-semibold text-[#6B6680] hover:text-[#17151F]">← Back to sign in</button>
      </div>
    </div>
  );
}
