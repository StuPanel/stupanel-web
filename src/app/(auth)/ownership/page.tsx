"use client";

/**
 * The link in "… wants to give you <studio> on StuPanel": become the studio's owner. With a StuPanel account the
 * person types its password; without one they choose a name and a password. Opening the page changes nothing.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Crown, Loader2 } from "lucide-react";
import { API_URL as API } from "@/lib/api";

type View = { studio: string; logoUrl: string | null; from: string; toEmail: string; toName: string | null; hasAccount: boolean; keepOld: boolean };
const inp = "w-full h-12 rounded-[14px] border border-[#E3DFEC] px-3.5 text-[15px] text-[#17151F] outline-none focus:border-[#7D5CEF] focus:ring-2 focus:ring-[#7D5CEF]/20";

function Accept() {
  const t = useSearchParams().get("t") ?? "";
  const [v, setV] = useState<View | null>(null);
  const [bad, setBad] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ email: string; studio: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/public/account/ownership?t=${encodeURIComponent(t)}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setBad((Array.isArray(d.message) ? d.message[0] : d.message) || "This invitation is not valid.");
      setV(d); setFirst((d.toName ?? "").split(" ")[0] ?? ""); setLast((d.toName ?? "").split(" ").slice(1).join(" "));
    }).catch(() => setBad("Couldn't reach StuPanel. Check your internet and try again."));
  }, [t]);

  async function accept() {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/public/account/ownership/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, password: pw, firstName: first, lastName: last }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError((Array.isArray(d.message) ? d.message[0] : d.message) || "That did not work.");
      setDone({ email: d.email, studio: d.studio });
    } catch { setError("Couldn't reach StuPanel. Check your internet and try again."); }
    finally { setBusy(false); }
  }

  if (bad) return <p className="text-center text-[15px] text-[#4A4658]">{bad}</p>;
  if (!v) return <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" />;
  if (done) {
    return (
      <div className="text-center">
        <span className="w-14 h-14 rounded-full bg-[#E9F5EF] text-[#1F8A5B] inline-flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></span>
        <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">You own {done.studio} now</h1>
        <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">Sign in with <b>{done.email}</b>{v.hasAccount ? " and your password." : " and the password you just chose."}</p>
        <Link href="/login" className="mt-6 inline-flex h-12 px-6 rounded-full bg-[#17151F] text-white text-[15px] font-semibold items-center justify-center">Sign in</Link>
      </div>
    );
  }
  return (
    <div>
      <span className="w-14 h-14 rounded-full bg-[#F1EDFB] text-[#5B3FD0] inline-flex items-center justify-center"><Crown className="w-7 h-7" /></span>
      <h1 className="mt-4 text-[24px] font-bold text-[#17151F] break-words">Become the owner of {v.studio}?</h1>
      <p className="mt-3 text-[14.5px] text-[#4A4658] leading-relaxed"><b>{v.from}</b> wants to give you the studio. As the owner you control its plan, its team and all its data, and you sign in with <b>{v.toEmail}</b>. {v.from} will {v.keepOld ? "stay as a manager" : "leave the studio"}.</p>
      <div className="mt-5 space-y-3">
        {!v.hasAccount && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-[13px] font-semibold text-[#4A4658]">First name</span><input value={first} onChange={e => setFirst(e.target.value)} autoComplete="given-name" className={`${inp} mt-1.5`} /></label>
            <label className="block"><span className="text-[13px] font-semibold text-[#4A4658]">Last name</span><input value={last} onChange={e => setLast(e.target.value)} autoComplete="family-name" className={`${inp} mt-1.5`} /></label>
          </div>
        )}
        <label className="block"><span className="text-[13px] font-semibold text-[#4A4658]">{v.hasAccount ? "Your StuPanel password" : "Choose a password (at least 8 characters)"}</span>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete={v.hasAccount ? "current-password" : "new-password"} className={`${inp} mt-1.5`} />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-[13.5px] px-4 py-3">{error}</p>}
      <button type="button" onClick={() => void accept()} disabled={busy}
        className="mt-6 w-full h-12 rounded-full bg-[#17151F] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}Accept and become the owner
      </button>
      <p className="mt-3 text-[13px] text-[#6B6680] text-center">Not expecting this? Close the page — nothing changes.</p>
    </div>
  );
}

export default function Page() {
  return <div className="w-full max-w-md mx-auto"><Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" />}><Accept /></Suspense></div>;
}
