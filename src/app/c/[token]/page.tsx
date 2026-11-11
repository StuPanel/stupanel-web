"use client";

/**
 * A client's page for one agreement: read it, sign it (draw or type), keep a copy.
 * Opened from the link the studio sends — no login.
 */
import { use, useEffect, useState } from "react";
import { CheckCircle2, FileSignature, Loader2, Printer, ShieldCheck } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StudioLogo } from "@/components/studio-logo";
import { ContractPaper } from "@/components/contracts/contract-paper";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { fmtDayTime, type ContractDetails, type ContractSection, type ContractSignature, type ContractStudio } from "@/lib/contracts";

interface PublicContract {
  contractNumber: string; title: string; status: string; details: ContractDetails; sections: ContractSection[];
  createdAt: string; sentAt: string | null; studio: ContractStudio; clientName: string; signature: ContractSignature | null;
}

export default function ContractSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [c, setC] = useState<PublicContract | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [sig, setSig] = useState<{ kind: "drawn" | "typed"; image: string | null; ready: boolean }>({ kind: "drawn", image: null, ready: false });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    const viewer = new URLSearchParams(window.location.search).get("viewer") === "studio" ? "?viewer=studio" : "";
    fetch(`${API}/public/contracts/${token}${viewer}`)
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || "This agreement is not available."); return d; })
      .then((d: PublicContract) => { setC(d); setName(n => n || d.clientName || ""); document.title = `${d.title} — ${d.studio.name}`; })
      .catch(e => setError(e.message));
  }, [token]);

  const missing = name.trim().length < 2 ? "Type your full name" : !sig.ready ? (sig.kind === "drawn" ? "Draw your signature" : "Type your full name") : !agree ? "Tick the box to accept" : "";

  async function sign() {
    if (missing || !c) return;
    setBusy(true); setFailed("");
    try {
      const r = await fetch(`${API}/public/contracts/${token}/sign`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kind: sig.kind, ...(sig.kind === "drawn" ? { signature: sig.image } : {}), agree: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFailed(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't sign. Please try again."); return; }
      setC(d); setJustSigned(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setFailed("No connection. Please try again."); }
    finally { setBusy(false); }
  }

  if (error) return (
    <main className="min-h-dvh bg-[#F5F3FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] p-8 max-w-sm text-center shadow-[0_18px_50px_-20px_rgba(22,18,40,.25)]">
        <span className="w-14 h-14 rounded-full bg-[#EEE8FD] flex items-center justify-center mx-auto"><FileSignature className="w-6 h-6 text-[#5B3FD0]" /></span>
        <h1 className="mt-4 text-lg font-bold text-[#17151F]">Agreement not found</h1>
        <p className="mt-1.5 text-sm text-[#6B6680]">{error}</p>
      </div>
    </main>
  );
  if (!c) return <main className="min-h-dvh bg-[#F5F3FA] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" aria-label="Loading" /></main>;

  const signed = c.status === "signed";
  return (
    <main className="min-h-dvh bg-[#F5F3FA] print:bg-white">
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-[#EEEBF4] print:hidden">
        <div className="max-w-[820px] mx-auto px-4 h-14 flex items-center gap-3">
          <StudioLogo url={c.studio.logoUrl} name={c.studio.name} size={32} />
          <p className="flex-1 min-w-0 text-[14px] font-bold text-[#17151F] truncate">{c.studio.name}</p>
          <span className={cn("h-7 px-2.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0",
            signed ? "bg-[#E7F5EE] text-[#1F8A5B]" : "bg-[#EEE8FD] text-[#5B3FD0]")}>
            {signed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#7D5CEF]" />}
            {signed ? "Signed" : "Waiting for your signature"}
          </span>
          <button type="button" onClick={() => window.print()} aria-label="Print or save as PDF"
            className="h-9 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 flex-shrink-0">
            <Printer className="w-4 h-4" /><span className="hidden sm:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      <div className="max-w-[820px] mx-auto px-3 sm:px-4 py-5 sm:py-8 print:p-0 print:max-w-none">
        {signed && (
          <div className="mb-4 rounded-[18px] bg-[#E7F5EE] px-4 py-3.5 flex items-start gap-3 print:hidden" role="status">
            <CheckCircle2 className="w-5 h-5 text-[#1F8A5B] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#14613F]">{justSigned ? "Thank you — the agreement is signed" : "This agreement is signed"}</p>
              <p className="text-[13px] text-[#1F6F4C] mt-0.5">Signed by {c.signature?.name} on {fmtDayTime(c.signature?.signedAt)}. {c.studio.name} has been told. Use Print / PDF to keep your copy.</p>
            </div>
          </div>
        )}
        {!signed && (
          <p className="mb-4 px-1 text-[13.5px] text-[#6B6680] print:hidden">Please read the agreement, then sign at the bottom. It takes about a minute.</p>
        )}

        <ContractPaper studio={c.studio} clientName={c.clientName} title={c.title} number={c.contractNumber}
          details={c.details} sections={c.sections} madeOn={c.sentAt ?? c.createdAt} signature={c.signature}>
          {!signed && (
            <div className="print:hidden">
              <label htmlFor="signer" className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">Your full name</label>
              <input id="signer" value={name} onChange={e => setName(e.target.value)} maxLength={150} autoComplete="name" placeholder="Full name"
                className="w-full h-11 px-3.5 mb-3 rounded-[12px] bg-white text-[15px] text-[#17151F] placeholder:text-[#A29DB3] border border-[#DDD8EA] outline-none focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/12" />
              <SignaturePad name={name} onChange={setSig} />
              <label className="flex items-start gap-2.5 mt-3 text-[13.5px] text-[#33303F] cursor-pointer">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="w-[18px] h-[18px] mt-0.5 accent-[#7D5CEF] flex-shrink-0" />
                <span>I have read this agreement and I accept it.</span>
              </label>
              <button type="button" onClick={sign} disabled={!!missing || busy}
                className="mt-4 w-full h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}Sign agreement
              </button>
              <p className={cn("mt-2 text-[12.5px] text-center", failed ? "text-[#C2304F] font-semibold" : "text-[#6B6680]")} role={failed ? "alert" : undefined}>
                {failed || missing || "Ready to sign"}
              </p>
            </div>
          )}
        </ContractPaper>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-[#9893A8] print:hidden">
          <ShieldCheck className="w-3.5 h-3.5" />Signed online with the date, time and device saved · Sent with StuPanel
        </p>
      </div>
    </main>
  );
}
