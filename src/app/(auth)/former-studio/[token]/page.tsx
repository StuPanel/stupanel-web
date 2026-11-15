"use client";

/**
 * The link in the "your studio has been deleted" email: StuPanel kept the owner's
 * name, email and phone; here they can have those removed too. Opening the page
 * changes nothing — only the button does.
 */
import { use, useEffect, useState } from "react";
import { CheckCircle2, Loader2, UserX } from "lucide-react";
import { API_URL as API } from "@/lib/api";

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<{ found: boolean; studioName: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/studio-data/former/${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => setInfo({ found: !!d?.found, studioName: d?.studioName ?? null }))
      .catch(() => setInfo({ found: false, studioName: null }));
  }, [token]);

  async function remove() {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/studio-data/former/${encodeURIComponent(token)}/remove`, { method: "POST" });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError((Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong."); return; }
      setDone(true);
    } catch { setError("Couldn't reach StuPanel. Check your internet and try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {!info ? <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" /> : done || !info.found ? (
        <div className="text-center">
          <span className="w-14 h-14 rounded-full bg-[#E9F5EF] text-[#1F8A5B] inline-flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></span>
          <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">{done ? "Your contact details are removed" : "Nothing is kept"}</h1>
          <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">
            {done ? "StuPanel no longer has your name, email or phone number. You will not hear from us again." : "StuPanel has no contact details for this link. They were already removed."}
          </p>
        </div>
      ) : (
        <div>
          <span className="w-14 h-14 rounded-full bg-[#F1EDFB] text-[#5B3FD0] inline-flex items-center justify-center"><UserX className="w-7 h-7" /></span>
          <h1 className="mt-4 text-[24px] font-bold text-[#17151F] break-words">Remove your contact details?</h1>
          <p className="mt-3 text-[14.5px] text-[#4A4658] leading-relaxed">
            <b className="break-words">{info.studioName}</b> is deleted from StuPanel. We kept only your name, email and phone number, so we can tell you about new features.
          </p>
          <p className="mt-2 text-[14.5px] text-[#4A4658] leading-relaxed">If you remove them, we keep nothing about you and will not write to you again.</p>
          {error && <p role="alert" className="mt-4 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-[13.5px] px-4 py-3">{error}</p>}
          <button type="button" onClick={remove} disabled={busy}
            className="mt-6 w-full h-12 rounded-full bg-[#17151F] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}Remove my contact details
          </button>
        </div>
      )}
    </div>
  );
}
