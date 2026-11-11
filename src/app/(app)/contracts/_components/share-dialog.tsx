"use client";

/** After "Send": the client's link, ready to copy, send on WhatsApp or email. */
import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Mail, MessageCircle, Send, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { waNumber } from "@/lib/phone";
import { notify } from "@/components/feedback";
import { clientFull, contractLink } from "@/lib/contracts";

export function ShareDialog({ contract, studioName, onClose, signed }: {
  contract: { id: string; title: string; publicToken: string; client: { firstName: string; lastName: string | null; phone: string | null; email: string | null } };
  studioName: string; signed?: boolean; onClose: () => void;
}) {
  const link = contractLink(contract.publicToken);
  const [copied, setCopied] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [mailed, setMailed] = useState(false);
  const wa = waNumber(contract.client.phone);
  const first = contract.client.firstName || clientFull(contract.client);
  const msg = signed
    ? `Hi ${first}, here is your signed copy of "${contract.title}".\n${link}\n\n— ${studioName}`
    : `Hi ${first}, please read and sign "${contract.title}". It takes about a minute.\n${link}\n\n— ${studioName}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { notify("Couldn't copy — select the link and copy it", { error: true }); }
  }
  async function email() {
    setMailing(true);
    try {
      const r = await apiFetch(`${API}/contracts/${contract.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.emailed) { notify(d.message || "Couldn't send the email", { error: true }); return; }
      setMailed(true); notify(`Emailed to ${contract.client.email}`);
    } finally { setMailing(false); }
  }

  const btn = "h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50";
  return (
    <>
      <div className="sp-backdrop z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Send to client" className="pointer-events-auto w-full sm:max-w-[440px] bg-white rounded-t-[26px] sm:rounded-[26px] p-5 pb-7 sm:pb-5 shadow-[0_24px_60px_-18px_rgba(22,18,40,.45)] sp-pop-in">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-full bg-[#E7F5EE] flex items-center justify-center flex-shrink-0"><Send className="w-5 h-5 text-[#1F8A5B]" /></span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-[#17151F]">{signed ? "Share the signed copy" : "Ready to sign"}</h2>
              <p className="text-[13px] text-[#6B6680] mt-0.5">{signed ? `${clientFull(contract.client)} can open and print it from this link.` : `Send this link to ${clientFull(contract.client)}. You'll get a notification when they sign.`}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#6B6680] flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>

          <div className="mt-4 flex items-center gap-2 p-1.5 pl-3.5 rounded-full bg-[#F5F3FA]">
            <p className="flex-1 min-w-0 text-[13px] text-[#4A4658] truncate select-all">{link}</p>
            <button type="button" onClick={copy} className={`${btn} h-9 px-4 ${copied ? "bg-[#1F8A5B] text-white" : "bg-[#17151F] text-white"}`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
              className={`${btn} bg-[#1F8A5B] hover:bg-[#19744C] text-white`}><MessageCircle className="w-4 h-4" />WhatsApp</a>
            <button type="button" onClick={email} disabled={!contract.client.email || mailing || mailed || signed}
              title={contract.client.email ? undefined : "This client has no email"} className={`${btn} bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0]`}>
              {mailing ? <Loader2 className="w-4 h-4 animate-spin" /> : mailed ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}{mailed ? "Emailed" : "Email"}
            </button>
          </div>
          {!contract.client.email && !signed && <p className="mt-2 text-[12px] text-[#9893A8]">Email is off because this client has no email address.</p>}

          <a href={`${link}?viewer=studio`} target="_blank" rel="noopener noreferrer" className="mt-4 text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />See what the client sees
          </a>
        </div>
      </div>
    </>
  );
}
