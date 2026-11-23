"use client";

/**
 * The link in "Your StuPanel sign-in email was changed": puts the old email back and signs everyone out.
 * Opening the page changes nothing; only the button does.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { API_URL as API } from "@/lib/api";

function Undo() {
  const t = useSearchParams().get("t") ?? "";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function undo() {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/public/account/undo-email-change`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError((Array.isArray(d.message) ? d.message[0] : d.message) || "That did not work."); return; }
      setDone(d.email);
    } catch { setError("Couldn't reach StuPanel. Check your internet and try again."); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="w-14 h-14 rounded-full bg-[#E9F5EF] text-[#1F8A5B] inline-flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></span>
        <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">Your email is back</h1>
        <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">StuPanel signs in with <b>{done}</b> again, and every device was signed out. Set a new password now, so whoever changed it can&apos;t get back in.</p>
        <Link href="/forgot-password" className="mt-6 inline-flex h-12 px-6 rounded-full bg-[#17151F] text-white text-[15px] font-semibold items-center justify-center">Set a new password</Link>
      </div>
    );
  }
  return (
    <div>
      <span className="w-14 h-14 rounded-full bg-[#FDECEF] text-[#C2304F] inline-flex items-center justify-center"><ShieldAlert className="w-7 h-7" /></span>
      <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">Undo the email change?</h1>
      <p className="mt-3 text-[14.5px] text-[#4A4658] leading-relaxed">Your StuPanel account was moved to another email. If you didn&apos;t do this, put your email back: StuPanel signs everyone out and turns off anything set up after the change.</p>
      {error && <p role="alert" className="mt-4 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-[13.5px] px-4 py-3">{error}</p>}
      <button type="button" onClick={() => void undo()} disabled={busy || !t}
        className="mt-6 w-full h-12 rounded-full bg-[#C2304F] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}Put my email back
      </button>
      <p className="mt-3 text-[13px] text-[#6B6680] text-center">If it was you, close this page — nothing changes.</p>
    </div>
  );
}

export default function Page() {
  return <div className="w-full max-w-md mx-auto"><Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" />}><Undo /></Suspense></div>;
}
