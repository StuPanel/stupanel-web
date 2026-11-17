"use client";

/**
 * "Sign in with StuPanel" for the StuPanel Live phone app.
 * The app opens this page in the phone's browser. Signed in here (Google or password, any role)?
 * One tap hands a 2-minute, one-time code to the app (stupanellive://login?code=…), which trades it
 * for its own session. Not signed in → the normal login page, then back here.
 */
import { useEffect, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { CARD_SHADOW } from "@/components/ui/apple";
import { PublicLoading, PublicShell } from "@/components/public/public-shell";

type Me = { firstName?: string; lastName?: string; email?: string; company?: { name?: string } };

export default function AppLoginPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem("access_token"); } catch { /* ignore */ }
    if (!token) { window.location.replace("/login?from=/app-login"); return; }
    apiFetch(`${API}/auth/me`).then(async r => {
      if (!r.ok) { window.location.replace("/login?from=/app-login"); return; }
      const d = await r.json().catch(() => null);
      setMe(d?.user ? { ...d.user, company: d.company } : d);
    }).catch(() => setError("No internet. Check the connection and try again."));
  }, []);

  async function go() {
    setBusy(true); setError("");
    const r = await apiFetch(`${API}/auth/app-code`, { method: "POST" }).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) : null;
    if (!d?.code) { setBusy(false); setError("Couldn't sign the app in. Please try again."); return; }
    setSent(true); setBusy(false);
    window.location.href = `stupanellive://login?code=${encodeURIComponent(d.code)}`;
  }

  if (!me && !error) return <PublicLoading />;
  const name = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || me?.email || "";

  return (
    <PublicShell sub="StuPanel Live" width="max-w-[440px]">
      <div className="rounded-[28px] bg-white p-6 sm:p-7 text-center" style={{ boxShadow: CARD_SHADOW }}>
        <span className="mx-auto w-14 h-14 rounded-2xl bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center"><Smartphone className="w-7 h-7" /></span>
        <h1 className="mt-4 text-[22px] font-bold text-[#17151F]">Sign in to StuPanel Live</h1>
        {me && <p className="mt-1.5 text-[14.5px] text-[#4A4658]">as <b className="text-[#17151F]">{name}</b>{me.company?.name ? <> · {me.company.name}</> : null}</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-[#FDECEF] text-[#C2304F] text-[13.5px] px-3 py-2">{error}</p>}
        <button type="button" onClick={go} disabled={busy || !me}
          className="mt-5 w-full h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}{sent ? "Open the app again" : "Continue to the app"}
        </button>
        <p className="mt-3 text-[12.5px] text-[#6B6680]">{sent ? "The app should open now. If it doesn't, tap the button again." : "Only tap this on the phone where StuPanel Live is installed."}</p>
        <a href="/login?from=/app-login" onClick={() => { try { localStorage.removeItem("access_token"); } catch { /* ignore */ } }}
          className="mt-4 inline-block text-[13px] font-semibold text-[#5B3FD0]">Use another account</a>
      </div>
    </PublicShell>
  );
}
