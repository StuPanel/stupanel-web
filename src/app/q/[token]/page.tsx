"use client";

import { useState, useEffect, use } from "react";
import {
  CheckCircle2, XCircle, Printer, Loader2, AlertTriangle,
  CalendarDays, MapPin, Phone, Mail, Globe, Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";

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
  draft:     { label: "Draft",     color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200" },
  sent:      { label: "Pending",   color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  viewed:    { label: "Pending",   color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  accepted:  { label: "Accepted",  color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  rejected:  { label: "Rejected",  color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200" },
  expired:   { label: "Expired",   color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  converted: { label: "Confirmed", color: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200" },
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

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  );

  if (notFound || !quote) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Quote Not Found</h1>
        <p className="text-slate-500 text-sm">This quote link is invalid or has been removed.</p>
      </div>
    </div>
  );

  const SYMS: Record<string,string> = { BDT:"৳", USD:"$", EUR:"€", GBP:"£", INR:"₹" };
  const sym = SYMS[quote.currency] ?? quote.currency;
  const sc = STATUS_CFG[quote.status] ?? STATUS_CFG.sent;
  const isExpired = quote.status === "expired";
  const canAct = ["sent", "viewed"].includes(quote.status) && !done;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; border: none !important; }
          body { background: white !important; }
        }
        @page { margin: 1.5cm; }
      `}</style>

      {/* Reject Modal */}
      {showRejectModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowRejectModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="font-bold text-slate-900 text-base mb-1">Reject Quote?</h3>
              <p className="text-sm text-slate-500 mb-4">You can optionally share a reason with the studio.</p>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                placeholder="Reason (optional)…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-red-400 resize-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={reject} disabled={submitting}
                  className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}Reject
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
        {/* Actions bar — top */}
        {canAct && (
          <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
            <p className="text-sm text-slate-600 font-medium">Review your quotation below and respond:</p>
            <div className="flex gap-2">
              <button onClick={() => setShowRejectModal(true)}
                className="h-9 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 flex items-center gap-1.5 transition-colors">
                <XCircle className="w-4 h-4" />Reject
              </button>
              <button onClick={accept} disabled={submitting}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Accept
              </button>
            </div>
          </div>
        )}

        {/* Accepted / Rejected confirmation */}
        {done === "accepted" && (
          <div className="no-print max-w-3xl mx-auto mb-4">
            <div className="bg-emerald-600 text-white rounded-2xl px-5 py-4 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-base">Quote Accepted — Thank You!</p>
                <p className="text-emerald-100 text-sm mt-0.5">Please contact the studio or arrange the advance payment to confirm your booking. Your booking will be confirmed after advance payment is received.</p>
              </div>
            </div>
          </div>
        )}
        {done === "rejected" && (
          <div className="no-print max-w-3xl mx-auto mb-4">
            <div className="bg-slate-700 text-white rounded-2xl px-5 py-4 flex items-start gap-3">
              <XCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-base">Quote Rejected</p>
                <p className="text-slate-300 text-sm mt-0.5">We have recorded your response. Please contact the studio if you change your mind or need a revised quote.</p>
              </div>
            </div>
          </div>
        )}
        {quote.status === "accepted" && !done && (
          <div className="no-print max-w-3xl mx-auto mb-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">You have accepted this quote. Please await booking confirmation after advance payment.</p>
            </div>
          </div>
        )}
        {quote.status === "converted" && (
          <div className="no-print max-w-3xl mx-auto mb-4">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <p className="text-sm font-semibold text-teal-800">Your booking has been confirmed! The studio will be in touch with you shortly.</p>
            </div>
          </div>
        )}
        {isExpired && (
          <div className="no-print max-w-3xl mx-auto mb-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">This quote has expired. Please contact the studio for a fresh quotation.</p>
            </div>
          </div>
        )}

        {/* Main Quote Document */}
        <div className="max-w-3xl mx-auto print-page">
          <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden print:rounded-none print:shadow-none print:border-0">

            {/* Header — Studio Info */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-7 text-white print:bg-indigo-600">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {quote.company.logoUrl ? (
                    <img src={quote.company.logoUrl} alt="logo" className="w-14 h-14 rounded-xl object-cover bg-white/20" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-extrabold">{quote.company.name}</h1>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-indigo-200 text-xs">
                      {quote.company.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{quote.company.phone}</span>}
                      {quote.company.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{quote.company.email}</span>}
                      {quote.company.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{quote.company.address}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-indigo-200 text-xs uppercase tracking-widest mb-1">Quotation</p>
                  <p className="text-white font-extrabold text-xl">{quote.quoteNumber}</p>
                  <span className={cn("inline-block mt-2 text-[10px] px-2.5 py-0.5 rounded-full font-bold", sc.bg, sc.color, sc.border, "border")}>{sc.label}</span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Client + Event Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Prepared For</p>
                  <p className="font-extrabold text-slate-900 text-lg">{quote.client.firstName} {quote.client.lastName ?? ""}</p>
                  {quote.client.phone && <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{quote.client.phone}</p>}
                  {quote.client.email && <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><Mail className="w-3.5 h-3.5 text-slate-400" />{quote.client.email}</p>}
                </div>
                <div className="space-y-2">
                  {quote.eventType && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Event Type</span>
                      <span className="font-semibold text-slate-800">{quote.eventType}</span>
                    </div>
                  )}
                  {quote.eventDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Event Date</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-indigo-400" />{fmtDate(quote.eventDate)}</span>
                    </div>
                  )}
                  {quote.venue && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Venue</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-400" />{quote.venue}</span>
                    </div>
                  )}
                  {quote.validUntil && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Valid Until</span>
                      <span className={cn("font-semibold", new Date(quote.validUntil) < new Date() ? "text-red-600" : "text-slate-800")}>{fmtDate(quote.validUntil)}</span>
                    </div>
                  )}
                  {quote.program && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Package</span>
                      <span className="font-semibold text-indigo-700">{quote.program.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-100" />

              {/* Line Items */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Services & Packages</p>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Qty</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Unit Price</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items.map((item, i) => (
                        <tr key={item.id} className={cn("border-b border-slate-100 last:border-b-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                          </td>
                          <td className="text-center px-4 py-3.5 text-slate-600">{item.qty}</td>
                          <td className="text-right px-5 py-3.5 text-slate-600">{sym}{item.unitPrice.toLocaleString()}</td>
                          <td className="text-right px-5 py-3.5 font-semibold text-slate-800">{sym}{item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span><span>{sym}{Number(quote.subtotal).toLocaleString()}</span>
                  </div>
                  {Number(quote.discountAmount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount</span><span>− {sym}{Number(quote.discountAmount).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(quote.taxAmount) > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Tax</span><span>+ {sym}{Number(quote.taxAmount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-extrabold text-xl border-t-2 border-slate-900 pt-2 mt-2">
                    <span>Grand Total</span><span>{sym}{Number(quote.grandTotal).toLocaleString()}</span>
                  </div>
                  {Number(quote.advanceRequired) > 0 && (
                    <div className="flex justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 font-bold text-orange-700 mt-2">
                      <span>Advance Required</span><span>{sym}{Number(quote.advanceRequired).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {quote.notes && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Note from Studio</p>
                  <p className="text-sm text-indigo-900 leading-relaxed">{quote.notes}</p>
                </div>
              )}

              {/* Terms */}
              {quote.termsAndConditions && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Terms & Conditions</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">{quote.termsAndConditions}</pre>
                  </div>
                </div>
              )}

              {/* Signature Area */}
              <div className="grid grid-cols-2 gap-8 pt-4">
                <div>
                  <div className="h-16 border-b-2 border-slate-300 border-dashed mb-2" />
                  <p className="text-xs text-slate-400">Client Signature & Date</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{quote.client.firstName} {quote.client.lastName ?? ""}</p>
                </div>
                <div>
                  <div className="h-16 border-b-2 border-slate-300 border-dashed mb-2" />
                  <p className="text-xs text-slate-400">Studio Authorized Signature</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{quote.company.name}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 pt-5 text-center">
                <p className="text-xs text-slate-400">Thank you for considering <span className="font-semibold text-slate-600">{quote.company.name}</span>. We look forward to capturing your special moments.</p>
                <p className="text-[10px] text-slate-300 mt-2">{quote.quoteNumber} · Version {quote.version}</p>
              </div>
            </div>
          </div>

          {/* Accept/Reject + Print buttons */}
          <div className="no-print mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            {canAct && (
              <>
                <button onClick={() => setShowRejectModal(true)}
                  className="h-12 px-8 rounded-2xl border-2 border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 flex items-center justify-center gap-2 transition-colors">
                  <XCircle className="w-5 h-5" />Reject Quote
                </button>
                <button onClick={accept} disabled={submitting}
                  className="h-12 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}Accept Quote
                </button>
              </>
            )}
            <button onClick={() => window.print()}
              className="h-12 px-8 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors">
              <Printer className="w-5 h-5" />Download / Print PDF
            </button>
          </div>

          <p className="no-print text-center text-xs text-slate-400 mt-4 pb-8">
            Powered by <span className="font-semibold">StuPanel</span>
          </p>
        </div>
      </div>
    </>
  );
}
