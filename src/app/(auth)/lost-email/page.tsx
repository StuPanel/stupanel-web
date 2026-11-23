"use client";

/**
 * "I lost my email": for a studio owner who can't open the email they sign in with (and has no recovery email).
 * 1) prove a new email with a code, 2) tell StuPanel which studio and give proofs. StuPanel checks it (and may
 * call the studio's phone) and writes back to the new email.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LifeBuoy, Loader2 } from "lucide-react";
import { API_URL as API } from "@/lib/api";

const inp = "w-full h-11 rounded-[12px] border border-[#E3DFEC] bg-white px-3.5 text-[15px] text-[#17151F] outline-none focus:border-[#7D5CEF] focus:ring-2 focus:ring-[#7D5CEF]/20";
const lbl = "block text-[13px] font-semibold text-[#4A4658] mb-1.5";

async function post(path: string, body: unknown) {
  try {
    const r = await fetch(`${API}/public/account/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true as const, data: d } : { ok: false as const, error: (Array.isArray(d.message) ? d.message[0] : d.message) || "That did not work." };
  } catch { return { ok: false as const, error: "Couldn't reach StuPanel. Check your internet and try again." }; }
}

export default function LostEmailPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [f, setF] = useState({ studioName: "", oldEmail: "", name: "", phone: "", trxId: "", senderNumber: "", programNumber: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }));

  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await post("lost-email/code", { email: newEmail });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setStep(2);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await post("lost-email", { newEmail, code, ...f });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setStep(3);
  }

  if (step === 3) {
    return (
      <div className="text-center">
        <span className="w-14 h-14 rounded-full bg-[#E9F5EF] text-[#1F8A5B] inline-flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></span>
        <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">Request sent</h1>
        <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">StuPanel will check it — we may call the studio&apos;s phone — and write to <b>{newEmail}</b>, usually within a day.</p>
        <Link href="/login" className="mt-6 inline-flex h-12 px-6 rounded-full bg-[#17151F] text-white text-[15px] font-semibold items-center justify-center">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <span className="w-12 h-12 rounded-2xl bg-[#EEE8FD] text-[#5B3FD0] inline-flex items-center justify-center mb-4"><LifeBuoy className="w-6 h-6" /></span>
      <h1 className="text-2xl font-bold text-[#17151F]">I lost my email</h1>
      <p className="text-[#6B6680] mt-1 text-sm leading-relaxed">
        Can&apos;t open the email your studio signs in with? First try <Link href="/forgot-password" className="font-semibold text-[#7D5CEF]">Forgot password</Link> — if you added a recovery email, the link goes there. If not, ask StuPanel to move your studio to a new email.
      </p>

      {step === 1 ? (
        <form onSubmit={sendCode} className="mt-6 space-y-4">
          <label className="block"><span className={lbl}>Your new email (one you can open)</span><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required autoComplete="email" className={inp} /></label>
          {error && <p role="alert" className="px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send a code to this email</button>
        </form>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block"><span className={lbl}>Code sent to {newEmail}</span>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" className={`${inp} tracking-[.3em] font-bold max-w-[200px]`} /></label>
          <p className="text-[13.5px] font-semibold text-[#17151F] pt-2">Which studio?</p>
          <label className="block"><span className={lbl}>Studio name, or its website address</span><input value={f.studioName} onChange={set("studioName")} required placeholder="Pick Photo  or  pickphoto.stupanel.com" className={inp} /></label>
          <label className="block"><span className={lbl}>The email it signed in with (if you remember)</span><input type="email" value={f.oldEmail} onChange={set("oldEmail")} className={inp} /></label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>Your name</span><input value={f.name} onChange={set("name")} required autoComplete="name" className={inp} /></label>
            <label className="block"><span className={lbl}>Studio phone number</span><input type="tel" value={f.phone} onChange={set("phone")} required autoComplete="tel" className={inp} /></label>
          </div>
          <p className="text-[13.5px] font-semibold text-[#17151F] pt-2">Proof that it&apos;s your studio <span className="font-normal text-[#6B6680]">(the more, the faster)</span></p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>TrxID of a StuPanel plan payment</span><input value={f.trxId} onChange={set("trxId")} className={inp} /></label>
            <label className="block"><span className={lbl}>bKash / Nagad number you paid from</span><input type="tel" value={f.senderNumber} onChange={set("senderNumber")} className={inp} /></label>
          </div>
          <label className="block"><span className={lbl}>A program number from your studio (e.g. PRG-1023)</span><input value={f.programNumber} onChange={set("programNumber")} className={inp} /></label>
          <label className="block"><span className={lbl}>Anything else that helps</span><textarea value={f.note} onChange={set("note")} rows={3} maxLength={2000} className={`${inp} h-auto py-2.5`} /></label>
          {error && <p role="alert" className="px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send to StuPanel</button>
          <p className="text-[12.5px] text-[#6B6680]">For safety, the studio&apos;s present email also gets a notice, so the real owner can stop a false request.</p>
        </form>
      )}
      <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6B6680] hover:text-[#33303F]"><ArrowLeft className="w-4 h-4" /> Back to Sign In</Link>
    </div>
  );
}
