"use client";

/**
 * Share a photo selection or a program's music with the client, two ways:
 *  • Direct link — opens only this one selection, no access code. What they choose there
 *    shows in their portal too (it's the same choice).
 *  • Client portal — everything for this client, with the access code.
 */
import { useState } from "react";
import { Check, Copy, Link2, Loader2, LinkIcon, MessageCircle, RefreshCw, ShieldCheck, X, XCircle } from "lucide-react";
import { askConfirm, notify } from "@/components/feedback";
import { waLink } from "@/lib/portal-session";

export function SelectLinkModal({ title, what, client, link, onSet, message, onPortal, onClose }: {
  title: string;
  /** "this photo selection" / "this program's music" */
  what: string;
  client: { firstName: string; lastName?: string | null; phone?: string | null };
  /** undefined = loading, null = off */
  link: { url: string } | null | undefined;
  onSet: (on: boolean, reset?: boolean) => Promise<boolean>;
  /** The WhatsApp message for this link */
  message: (url: string) => string;
  onPortal: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<"" | "on" | "new" | "off">("");
  const [copied, setCopied] = useState(false);

  async function run(kind: "on" | "new" | "off") {
    if (kind === "new" && !(await askConfirm({ title: "Make a new link?", message: "The old link stops working. Send the new one to the client.", confirmLabel: "New link" }))) return;
    if (kind === "off" && !(await askConfirm({ title: "Turn the link off?", message: "The link stops working. The client can still choose in their portal.", confirmLabel: "Turn off" }))) return;
    setBusy(kind);
    try {
      const ok = await onSet(kind !== "off", kind === "new");
      if (ok) notify(kind === "off" ? "Link turned off" : kind === "new" ? "New link ready" : "Link ready");
    } finally { setBusy(""); }
  }

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { notify("Couldn't copy", { error: true }); }
  }

  const wa = link ? waLink(client.phone, message(link.url)) ?? `https://wa.me/?text=${encodeURIComponent(message(link.url))}` : null;
  const btn = "h-9 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50";

  return (
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-labelledby="select-link-title" className="sp-modal pointer-events-auto w-full max-w-md p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-[#EEE8FD] flex items-center justify-center flex-shrink-0"><Link2 className="w-5 h-5 text-[#5B3FD0]" /></div>
              <div className="min-w-0">
                <h2 id="select-link-title" className="font-bold text-[#17151F] text-lg leading-tight">{title}</h2>
                <p className="text-sm text-[#6B6680] truncate">{client.firstName} {client.lastName ?? ""}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]"><X className="w-4 h-4" /></button>
          </div>

          {/* Direct link */}
          <section className="mt-5 rounded-2xl border border-[#E3DFEC] p-4">
            <p className="text-[14px] font-bold text-[#17151F] flex items-center gap-1.5"><LinkIcon className="w-4 h-4 text-[#5B3FD0]" />Direct link · no code</p>
            <p className="mt-1 text-[13px] text-[#6B6680] leading-relaxed">Opens only {what}. What the client chooses here shows in their portal too.</p>
            {link === undefined ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>
            ) : !link ? (
              <button type="button" onClick={() => run("on")} disabled={!!busy} className={`${btn} mt-3 w-full h-10 bg-[#7D5CEF] hover:bg-[#6143CF] text-white`}>
                {busy === "on" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}Create link
              </button>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F7F5FB] px-3 py-2">
                  <p className="flex-1 min-w-0 truncate text-[13px] text-[#17151F]">{link.url}</p>
                  <button type="button" onClick={() => copy(link.url)} aria-label="Copy link" className="h-8 px-3 rounded-full bg-white hover:bg-[#EEEBF4] text-xs font-semibold text-[#17151F] flex items-center gap-1.5 flex-shrink-0">
                    {copied ? <Check className="w-3.5 h-3.5 text-[#1F8A5B]" /> : <Copy className="w-3.5 h-3.5" />}Copy
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} flex-1 bg-[#1F8A5B] hover:bg-[#18724A] text-white`}><MessageCircle className="w-4 h-4 flex-shrink-0" /><span className="whitespace-nowrap">WhatsApp</span></a>}
                  <button type="button" onClick={() => run("new")} disabled={!!busy} className={`${btn} bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F]`}>
                    {busy === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}New link
                  </button>
                  <button type="button" onClick={() => run("off")} disabled={!!busy} className={`${btn} bg-[#F5F3FA] hover:bg-[#FDECEF] text-[#C2304F]`}>
                    {busy === "off" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}Turn off
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Portal */}
          <section className="mt-3 rounded-2xl border border-[#E3DFEC] p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[#17151F] flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#5B3FD0]" />Client portal</p>
              <p className="mt-1 text-[13px] text-[#6B6680] leading-relaxed">All their programs, payments and files — needs the access code.</p>
            </div>
            <button type="button" onClick={onPortal} className={`${btn} bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] flex-shrink-0`}>Open</button>
          </section>
        </div>
      </div>
    </>
  );
}
