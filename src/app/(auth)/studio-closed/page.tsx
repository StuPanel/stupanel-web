"use client";

/** What the owner of a studio being deleted sees: the date, download the data, or stop the deletion. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { clearAccessTokenCookie } from "@/lib/auth-cookie";
import { notify } from "@/components/feedback";
import { ExportDrawer, Prove, longDate, type DataStatus } from "@/components/studio-data/studio-data";

export default function StudioClosedPage() {
  const [s, setS] = useState<DataStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [creds, setCreds] = useState<{ password?: string; code?: string }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("access_token")) { window.location.href = "/login"; return; }
    apiFetch(`${API}/studio-data/status`).then(async r => (r.ok ? setS(await r.json()) : setFailed(true))).catch(() => setFailed(true));
  }, []);
  async function stop() {
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/studio-data/delete/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creds) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't stop it", { error: true }); return; }
      notify("The deletion is stopped — your studio is open again");
      window.location.href = "/dashboard";
    } finally { setBusy(false); }
  }
  if (failed) return <p className="text-center text-[15px] text-[#4A4658]">Only the studio owner can open this page. <Link href="/login" className="font-semibold text-[#5B3FD0]">Sign in</Link></p>;
  if (!s) return <Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF] mx-auto" />;
  if (!s.scheduledFor) return (
    <div className="text-center"><p className="text-[16px] text-[#17151F] font-semibold">{s.studioName} is open.</p><Link href="/dashboard" className="mt-4 inline-flex h-12 px-6 rounded-full bg-[#17151F] text-white font-semibold items-center">Open StuPanel</Link></div>
  );
  const ready = !!creds.password || (creds.code ?? "").length === 6;
  return (
    <div className="w-full max-w-md mx-auto">
      <span className="w-14 h-14 rounded-full bg-[#FDECEF] text-[#C2304F] inline-flex items-center justify-center"><ShieldAlert className="w-7 h-7" /></span>
      <h1 className="mt-4 text-[24px] font-bold text-[#17151F]">{s.studioName} is closed</h1>
      <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">
        All of its data will be deleted on <b className="text-[#C2304F]">{longDate(s.scheduledFor)}</b>
        {s.daysLeft !== null && <> — <b>{s.daysLeft <= 0 ? "today" : `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`}</b></>}.
        Your team cannot sign in and client links do not work.
      </p>
      {s.requestedBy && <p className="mt-1 text-[12.5px] text-[#6B6680]">Asked by {s.requestedBy}</p>}
      <button type="button" onClick={() => setExporting(true)} className="mt-6 w-full h-12 rounded-full bg-[#1F8A5B] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2"><Download className="w-4 h-4" />Download all my data</button>
      {!cancel ? (
        <button type="button" onClick={() => setCancel(true)} className="mt-3 w-full h-12 rounded-full bg-[#F5F3FA] text-[#17151F] text-[15px] font-semibold inline-flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" />Stop the deletion</button>
      ) : (
        <div className="mt-4 rounded-[20px] bg-white p-4 space-y-3 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
          <p className="text-[14px] font-semibold text-[#17151F]">Stop the deletion and open the studio again</p>
          <Prove purpose="cancel" status={s} value={creds} onChange={setCreds} />
          <button type="button" onClick={stop} disabled={!ready || busy} className="w-full h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}Stop deletion
          </button>
        </div>
      )}
      <button type="button" onClick={async () => { try { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); } catch { /* signed out here anyway */ } localStorage.removeItem("access_token"); localStorage.removeItem("user_role"); clearAccessTokenCookie(); window.location.href = "/login"; }} className="mt-4 w-full text-[13.5px] font-semibold text-[#6B6680] hover:underline">Sign out</button>
      {exporting && <ExportDrawer status={s} onClose={() => setExporting(false)} />}
    </div>
  );
}
