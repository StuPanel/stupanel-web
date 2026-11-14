"use client";

/** The link in the "Confirm: delete …" email. Opening it changes nothing — only the button does. */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { longDate } from "@/components/studio-data/studio-data";

function Confirm() {
  const token = useSearchParams().get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ scheduledFor: string; studioName: string } | null>(null);
  async function go() {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/studio-data/delete/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError((Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong."); return; }
      setDone(d);
    } catch { setError("Couldn't reach StuPanel. Check your internet and try again."); }
    finally { setBusy(false); }
  }
  if (done) return (
    <div className="text-center">
      <span className="w-14 h-14 rounded-full bg-[#FDECEF] text-[#C2304F] inline-flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></span>
      <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">{done.studioName} is closed</h1>
      <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">All of its data will be deleted on <b>{longDate(done.scheduledFor)}</b>. Until then you can sign in to download your data or stop the deletion.</p>
      <Link href="/login" className="mt-6 inline-flex h-12 px-6 rounded-full bg-[#17151F] text-white text-[15px] font-semibold items-center">Sign in</Link>
    </div>
  );
  return (
    <div>
      <span className="w-14 h-14 rounded-full bg-[#FDECEF] text-[#C2304F] inline-flex items-center justify-center"><AlertTriangle className="w-7 h-7" /></span>
      <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">Delete your studio?</h1>
      <ul className="mt-3 space-y-2 text-[14.5px] text-[#4A4658] leading-relaxed list-disc pl-5">
        <li>The studio closes <b>now</b>: your team cannot sign in and client links stop working.</li>
        <li>All of its data is deleted for good after <b>15 days</b>.</li>
        <li>Until then you can sign in, download your data, or stop the deletion.</li>
      </ul>
      {error && <p role="alert" className="mt-4 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-[13.5px] px-4 py-3">{error}</p>}
      <button type="button" onClick={go} disabled={busy || !token} className="mt-6 w-full h-12 rounded-full bg-[#C2304F] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Yes, delete my studio
      </button>
      <Link href="/dashboard" className="mt-3 w-full h-12 rounded-full bg-[#F5F3FA] text-[#17151F] text-[15px] font-semibold inline-flex items-center justify-center">No, keep my studio</Link>
      {!token && <p className="mt-3 text-[13px] text-[#C2304F]">This link is not complete. Open it again from the email.</p>}
    </div>
  );
}

export default function Page() {
  return (
    <div className="w-full max-w-md mx-auto">
      <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" />}><Confirm /></Suspense>
    </div>
  );
}
