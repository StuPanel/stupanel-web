"use client";

import { useState, useEffect, use } from "react";
import {
  CheckCircle2, XCircle, Printer, Loader2, AlertTriangle,
  Phone, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { currencySymbol, fmtDate } from "@/lib/format";
import { StudioLogo } from "@/components/studio-logo";
import { PublicLoading, PublicMessage, PublicShell } from "@/components/public/public-shell";

interface QuoteItem { id: string; name: string; description?: string; qty: number; unitPrice: number; total: number; }
interface Quote {
  id: string; quoteNumber: string; status: string; version: number;
  eventType?: string; eventDate?: string; venue?: string; currency: string;
  subtotal: number; discountAmount: number; taxAmount: number; grandTotal: number;
  advanceRequired: number; validUntil?: string; notes?: string; termsAndConditions?: string;
  items: QuoteItem[];
  client: { firstName: string; lastName?: string; phone?: string; email?: string };
  program?: { name: string; category?: string };
  company: { name: string; email?: string; phone?: string; address?: string; logoUrl?: string; currency: string };
  acceptedAt?: string; rejectedAt?: string;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: "Draft",     color: "text-[#4A4658]", bg: "bg-[#F1EFF6]", border: "border-[#E4E0EC]" },
  sent:      { label: "Pending",   color: "text-[#1F5C99]", bg: "bg-[#E8F0FA]", border: "border-[#C9DCF0]" },
  viewed:    { label: "Pending",   color: "text-[#1F5C99]", bg: "bg-[#E8F0FA]", border: "border-[#C9DCF0]" },
  accepted:  { label: "Accepted",  color: "text-[#1F8A5B]", bg: "bg-[#E7F5EE]", border: "border-[#CDEBDB]" },
  rejected:  { label: "Rejected",  color: "text-[#C2304F]", bg: "bg-[#FDECEF]", border: "border-[#F6CFD8]" },
  expired:   { label: "Expired",   color: "text-[#9A5B00]", bg: "bg-[#FFF3E0]", border: "border-[#F6E3B8]" },
  converted: { label: "Confirmed", color: "text-[#126B66]", bg: "bg-[#E3F2F1]", border: "border-[#BFE0DD]" },
};

export default function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<"accept" | "reject" | null>(null);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/quotes/${token}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setQuote(d); })
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    setSubmitting(true);
    const r = await fetch(`${API}/public/quotes/${token}/accept`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setSubmitting(false);
    if (r.ok) { setDone("accepted"); setQuote(q => q ? { ...q, status: "accepted" } : q); }
  }

  async function reject() {
    setSubmitting(true);
    const r = await fetch(`${API}/public/quotes/${token}/reject`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setSubmitting(false);
    setShowRejectModal(false);
    if (r.ok) { setDone("rejected"); setQuote(q => q ? { ...q, status: "rejected" } : q); }
  }

  if (loading) return <PublicLoading />;
  if (notFound || !quote) return <PublicMessage icon={AlertTriangle} title="Quote not found" text="This quote link isn't working or was removed. Please ask the studio for a new link." />;

  const sym = currencySymbol(quote.currency);
  const money = (n: number | string) => `${sym}${Number(n).toLocaleString(quote.currency === "BDT" || quote.currency === "INR" ? "en-IN" : "en-US")}`;
  const sc = STATUS_CFG[quote.status] ?? STATUS_CFG.sent;
  const isExpired = quote.status === "expired";
  const canAct = ["sent", "viewed"].includes(quote.status) && !done;
  const clientName = `${quote.client.firstName} ${quote.client.lastName ?? ""}`.trim();
  const contact = [quote.company.phone, quote.company.email].filter(Boolean).join(" · ");
  const facts: [string, React.ReactNode][] = [
    ...(quote.eventType ? [["Event", quote.eventType] as [string, React.ReactNode]] : []),
    ...(quote.eventDate ? [["Date", fmtDate(quote.eventDate)] as [string, React.ReactNode]] : []),
    ...(quote.venue ? [["Venue", quote.venue] as [string, React.ReactNode]] : []),
    ...(quote.program ? [["Package", quote.program.name] as [string, React.ReactNode]] : []),
    ...(quote.validUntil ? [["Valid until", <span key="v" className={new Date(quote.validUntil) < new Date() && !["accepted", "converted"].includes(quote.status) ? "text-[#C2304F]" : ""}>{fmtDate(quote.validUntil)}</span>] as [string, React.ReactNode]] : []),
  ];

  const banner = done === "accepted"
    ? { tone: "green", icon: CheckCircle2, title: "Thank you — you accepted this quote", text: "The studio will confirm your booking once the advance is paid." }
    : done === "rejected" ? { tone: "ink", icon: XCircle, title: "You declined this quote", text: "Your answer was sent to the studio. Ask them any time for a new quote." }
    : quote.status === "converted" ? { tone: "green", icon: CheckCircle2, title: "Your booking is confirmed", text: "The studio will be in touch with you soon." }
    : quote.status === "accepted" ? { tone: "green", icon: CheckCircle2, title: "You accepted this quote", text: "The booking is confirmed once the advance is paid." }
    : quote.status === "rejected" ? { tone: "ink", icon: XCircle, title: "You declined this quote", text: "Ask the studio if you'd like a new one." }
    : isExpired ? { tone: "amber", icon: AlertTriangle, title: "This quote has expired", text: "Please ask the studio for a fresh quote." }
    : null;
  const toneCls = { green: "bg-[#E7F5EE] text-[#14613F]", ink: "bg-[#F1EFF6] text-[#33303F]", amber: "bg-[#FFF3E0] text-[#7A4A00]" } as const;

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } } @page { margin: 1.2cm; }`}</style>

      {showRejectModal && (
        <>
          <div className="sp-backdrop fixed inset-0 z-50" onClick={() => setShowRejectModal(false)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none">
            <div role="dialog" aria-modal="true" aria-label="Decline this quote" className="sp-modal pointer-events-auto bg-white rounded-t-[26px] sm:rounded-[26px] w-full sm:max-w-sm p-6 pb-8 sm:pb-6 shadow-[0_24px_60px_-18px_rgba(22,18,40,.45)]">
              <h3 className="text-[18px] font-extrabold text-[#17151F]">Decline this quote?</h3>
              <p className="text-sm text-[#6B6680] mt-1 mb-4">You can tell the studio why (optional).</p>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Reason (optional)" aria-label="Reason"
                className="w-full px-3.5 py-3 rounded-[14px] bg-[#F5F3FA] text-[15px] text-[#17151F] placeholder:text-[#A29DB3] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF] resize-none mb-4" />
              <div className="flex gap-2.5">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 h-11 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
                <button onClick={reject} disabled={submitting} className="flex-1 h-11 rounded-full bg-[#C2304F] text-white text-sm font-semibold flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}Decline
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <PublicShell studio={quote.company} sub="Quotation" className={canAct ? "pb-28 sm:pb-8" : undefined}
        right={
          <button type="button" onClick={() => window.print()} aria-label="Print or save as PDF"
            className="h-10 px-3.5 rounded-full bg-white/80 hover:bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.08)]">
            <Printer className="w-4 h-4" /><span className="hidden sm:inline">Print / PDF</span>
          </button>
        }>
        {banner && (
          <div className={cn("no-print mb-4 rounded-[18px] px-4 py-3.5 flex items-start gap-3", toneCls[banner.tone as keyof typeof toneCls])} role="status">
            <banner.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div><p className="text-[15px] font-bold">{banner.title}</p><p className="text-[13px] opacity-85 mt-0.5">{banner.text}</p></div>
          </div>
        )}
        {canAct && <p className="no-print mb-4 px-1 text-[13.5px] text-[#6B6680]">Please look over your quote, then accept it or tell the studio it&apos;s not right.</p>}

        <article className="sp-paper bg-white rounded-[22px] print:rounded-none">
          <header className="flex items-center gap-3.5 px-6 sm:px-10 pt-7 pb-5 border-b border-[#E9E5F1]">
            <StudioLogo url={quote.company.logoUrl} name={quote.company.name} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-extrabold tracking-[-0.01em] text-[#17151F] truncate">{quote.company.name}</p>
              {(contact || quote.company.address) && <p className="text-[12.5px] text-[#6B6680] truncate">{contact || quote.company.address}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[11.5px] text-[#9893A8]">Quotation</p>
              <p className="text-[14px] font-bold text-[#17151F] tabular-nums">{quote.quoteNumber}</p>
              <span className={cn("inline-flex mt-1 h-6 px-2.5 items-center rounded-full text-[12px] font-bold", sc.bg, sc.color)}>{sc.label}</span>
            </div>
          </header>

          <div className="px-6 sm:px-10 py-7">
            <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599]">Prepared for</p>
            <p className="mt-1 text-[22px] sm:text-[24px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{clientName}</p>
            <p className="mt-1 text-[13px] text-[#6B6680] flex flex-wrap gap-x-3 gap-y-0.5">
              {quote.client.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{quote.client.phone}</span>}
              {quote.client.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{quote.client.email}</span>}
            </p>

            {facts.length > 0 && (
              <dl className="mt-5 rounded-[14px] border border-[#E9E5F1] divide-y divide-[#E9E5F1] overflow-hidden">
                {facts.map(([l, v]) => (
                  <div key={l} className="flex gap-4 px-4 py-2.5 text-[14px]">
                    <dt className="w-[34%] flex-shrink-0 text-[#6B6680]">{l}</dt>
                    <dd className="flex-1 min-w-0 font-medium text-[#17151F] break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            <h2 className="text-[15px] font-bold text-[#17151F] mt-7 mb-2.5">What&apos;s included</h2>
            <div className="rounded-[14px] border border-[#E9E5F1] overflow-hidden">
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_56px_110px_110px] gap-3 px-4 py-2.5 bg-[#FBFAFD] text-[12px] font-semibold text-[#6B6680] border-b border-[#E9E5F1]">
                <span>Item</span><span className="text-center">Qty</span><span className="text-right">Price</span><span className="text-right">Total</span>
              </div>
              <ul className="divide-y divide-[#E9E5F1]">
                {quote.items.map(item => (
                  <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_56px_110px_110px] gap-x-3 gap-y-0.5 px-4 py-3 text-[14px]">
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#17151F]">{item.name}</span>
                      {item.description && <span className="block text-[12.5px] text-[#6B6680] mt-0.5 leading-relaxed">{item.description}</span>}
                      <span className="sm:hidden block text-[12.5px] text-[#6B6680] mt-0.5 tabular-nums">{item.qty} × {money(item.unitPrice)}</span>
                    </span>
                    <span className="hidden sm:block text-center text-[#4A4658] tabular-nums">{item.qty}</span>
                    <span className="hidden sm:block text-right text-[#4A4658] tabular-nums">{money(item.unitPrice)}</span>
                    <span className="text-right font-semibold text-[#17151F] tabular-nums">{money(item.total)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 sm:ml-auto sm:max-w-[320px] space-y-2 text-[14px]">
              <div className="flex justify-between text-[#6B6680]"><span>Subtotal</span><span className="tabular-nums">{money(quote.subtotal)}</span></div>
              {Number(quote.discountAmount) > 0 && <div className="flex justify-between text-[#1F8A5B]"><span>Discount</span><span className="tabular-nums">− {money(quote.discountAmount)}</span></div>}
              {Number(quote.taxAmount) > 0 && <div className="flex justify-between text-[#6B6680]"><span>Tax</span><span className="tabular-nums">+ {money(quote.taxAmount)}</span></div>}
              <div className="flex justify-between items-baseline pt-2.5 mt-1 border-t border-[#17151F]">
                <span className="font-bold text-[#17151F]">Total</span><span className="text-[22px] font-extrabold text-[#17151F] tabular-nums">{money(quote.grandTotal)}</span>
              </div>
              {Number(quote.advanceRequired) > 0 && (
                <div className="flex justify-between rounded-[12px] bg-[#EEE8FD] px-3.5 py-2.5 font-semibold text-[#5B3FD0]">
                  <span>Advance to confirm</span><span className="tabular-nums">{money(quote.advanceRequired)}</span>
                </div>
              )}
            </div>

            {quote.notes && (
              <section className="mt-7 rounded-[14px] bg-[#F7F4FE] px-4 py-3.5">
                <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5B3FD0] mb-1">Note from {quote.company.name}</p>
                <p className="text-[14px] text-[#33303F] leading-relaxed whitespace-pre-line">{quote.notes}</p>
              </section>
            )}

            {quote.termsAndConditions && (
              <section className="mt-7">
                <h2 className="text-[15px] font-bold text-[#17151F] mb-2">Terms</h2>
                <div className="space-y-1.5">
                  {quote.termsAndConditions.split("\n").filter(l => l.trim()).map((l, i) => (
                    <p key={i} className="text-[13.5px] text-[#33303F] leading-relaxed">{l}</p>
                  ))}
                </div>
              </section>
            )}
          </div>

          <footer className="px-6 sm:px-10 py-5 border-t border-[#E9E5F1] bg-[#FBFAFD] rounded-b-[22px] print:bg-white text-center">
            <p className="text-[12.5px] text-[#6B6680]">Thank you for considering <span className="font-semibold text-[#17151F]">{quote.company.name}</span>.</p>
            <p className="text-[12px] text-[#9893A8] mt-1 tabular-nums">{quote.quoteNumber} · version {quote.version}</p>
          </footer>
        </article>

        {canAct && (() => {
          const decline = (
            <button onClick={() => setShowRejectModal(true)}
              className="flex-1 sm:flex-none h-12 px-6 rounded-full bg-white text-[#C2304F] text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(22,18,40,.08)] hover:bg-[#FEF5F7]">
              <XCircle className="w-4 h-4" />Decline
            </button>
          );
          const acceptBtn = (
            <button onClick={accept} disabled={submitting}
              className="flex-[2] sm:flex-none h-12 px-8 rounded-full bg-[#1F8A5B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Accept quote
            </button>
          );
          return (
            <>
              <div className="no-print hidden sm:flex mt-6 gap-2.5 justify-center">{decline}{acceptBtn}</div>
              <div className="no-print sm:hidden fixed bottom-0 inset-x-0 z-20 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sp-topbar border-t border-white/70 flex gap-2.5">{decline}{acceptBtn}</div>
            </>
          );
        })()}
      </PublicShell>
    </>
  );
}
