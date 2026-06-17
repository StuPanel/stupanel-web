"use client";

import { useState, useEffect, use } from "react";
import { Loader2, Printer, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
function sym(cur = "BDT") { return cur === "BDT" ? "৳" : cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "INR" ? "₹" : cur + " "; }

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Viewed",
  paid: "PAID", partially_paid: "Partially Paid", overdue: "OVERDUE", void: "VOID",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-300",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  viewed: "bg-violet-50 text-violet-700 border-violet-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-300",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-300",
  overdue: "bg-red-50 text-red-700 border-red-300",
  void: "bg-slate-100 text-slate-400 border-slate-300",
};

interface InvoiceData {
  id: string; invoiceNumber: string; status: string;
  subtotal: number; discountAmount: number; taxLabel?: string;
  taxPercent: number; taxAmount: number; grandTotal: number;
  paidAmount: number; balanceDue: number; currency: string;
  issueDate: string; dueDate?: string;
  notes?: string; termsConditions?: string;
  client: { firstName: string; lastName?: string; phone?: string; email?: string };
  booking?: { bookingNumber: string; eventName?: string; eventDate?: string };
  items: { id: string; name: string; description?: string; quantity: number; unitPrice: number; total: number }[];
  company: {
    name: string; email?: string; phone?: string; address?: string;
    city?: string; country?: string; logoUrl?: string; primaryColor?: string; currency: string;
    bankName?: string; bankBranch?: string; bankAccountName?: string; bankAccountNumber?: string;
    bkashNumber?: string; nagadNumber?: string;
    facebookUrl?: string; instagramUrl?: string;
  };
}

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/public/invoices/${token}`)
      .then(r => { if (!r.ok) throw new Error("not_found"); return r.json(); })
      .then(setData)
      .catch(() => setError("Invoice not found or has been removed."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-slate-500 text-lg font-medium">{error || "Invoice not found"}</p>
      </div>
    </div>
  );

  const c = sym(data.currency);
  const brandColor = data.company.primaryColor || "#4F46E5";
  const s = STATUS_LABEL[data.status] ?? data.status;
  const sc = STATUS_COLOR[data.status] ?? STATUS_COLOR.draft;
  const hasPaymentInfo = data.company.bankName || data.company.bkashNumber || data.company.nagadNumber;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      {/* Print Button */}
      <div className="no-print fixed bottom-6 right-6 z-50">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: brandColor }}>
          <Printer className="w-4 h-4" />Download / Print PDF
        </button>
      </div>

      <div className="min-h-screen bg-slate-100 py-8 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Header Bar */}
          <div className="h-2" style={{ backgroundColor: brandColor }} />

          <div className="p-8">
            {/* Top: Company + Invoice Info */}
            <div className="flex items-start justify-between gap-6 mb-8">
              <div className="flex items-start gap-4">
                {data.company.logoUrl && (
                  <img src={data.company.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-1" />
                )}
                <div>
                  <h1 className="text-2xl font-extrabold" style={{ color: brandColor }}>{data.company.name}</h1>
                  {data.company.address && <p className="text-sm text-slate-500 mt-0.5">{data.company.address}{data.company.city ? `, ${data.company.city}` : ""}</p>}
                  <div className="flex flex-wrap gap-3 mt-1">
                    {data.company.phone && <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{data.company.phone}</span>}
                    {data.company.email && <span className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{data.company.email}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <h2 className="text-2xl font-extrabold text-slate-900">INVOICE</h2>
                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-bold border uppercase", sc)}>{s}</span>
                </div>
                <p className="text-base font-bold text-slate-700">{data.invoiceNumber}</p>
                <p className="text-xs text-slate-400 mt-1">Issued: {fmtDate(data.issueDate)}</p>
                {data.dueDate && <p className="text-xs text-slate-400">Due: {fmtDate(data.dueDate)}</p>}
              </div>
            </div>

            {/* Bill To + Booking */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</p>
                <p className="font-bold text-slate-900">{data.client.firstName} {data.client.lastName ?? ""}</p>
                {data.client.phone && <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{data.client.phone}</p>}
                {data.client.email && <p className="text-sm text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{data.client.email}</p>}
              </div>
              {data.booking && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Program</p>
                  <p className="font-bold text-slate-900">{data.booking.eventName || "Event"}</p>
                  <p className="text-sm text-slate-500 font-mono">{data.booking.bookingNumber}</p>
                  {data.booking.eventDate && <p className="text-sm text-slate-500 mt-1">{fmtDate(data.booking.eventDate)}</p>}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="rounded-xl" style={{ backgroundColor: brandColor + "15" }}>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-600 uppercase rounded-l-xl">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-bold text-slate-600 uppercase w-16">Qty</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-600 uppercase w-28">Unit Price</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-600 uppercase w-28 rounded-r-xl">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{c}{Number(item.unitPrice).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{c}{Number(item.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{c}{Number(data.subtotal).toLocaleString()}</span></div>
                {Number(data.discountAmount) > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span>−{c}{Number(data.discountAmount).toLocaleString()}</span></div>}
                {Number(data.taxAmount) > 0 && <div className="flex justify-between text-sm text-slate-500"><span>{data.taxLabel || "Tax"} ({data.taxPercent}%)</span><span>+{c}{Number(data.taxAmount).toLocaleString()}</span></div>}
                <div className="flex justify-between font-extrabold text-lg border-t border-slate-200 pt-2" style={{ color: brandColor }}>
                  <span>Grand Total</span><span>{c}{Number(data.grandTotal).toLocaleString()}</span>
                </div>
                {Number(data.paidAmount) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-semibold"><span>Paid</span><span>−{c}{Number(data.paidAmount).toLocaleString()}</span></div>
                )}
                {Number(data.balanceDue) > 0 ? (
                  <div className="flex justify-between font-bold text-base text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">
                    <span>Balance Due</span><span>{c}{Number(data.balanceDue).toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                    <span className="font-bold text-sm">✓ Fully Paid</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Info */}
            {hasPaymentInfo && (
              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Payment Instructions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {data.company.bankName && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" />Bank Transfer</p>
                      <p className="text-slate-700"><span className="text-slate-400">Bank:</span> {data.company.bankName}{data.company.bankBranch ? ` · ${data.company.bankBranch}` : ""}</p>
                      {data.company.bankAccountName && <p className="text-slate-700"><span className="text-slate-400">A/C Name:</span> {data.company.bankAccountName}</p>}
                      {data.company.bankAccountNumber && <p className="text-slate-700 font-mono"><span className="text-slate-400">A/C No:</span> {data.company.bankAccountNumber}</p>}
                    </div>
                  )}
                  {(data.company.bkashNumber || data.company.nagadNumber) && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" />Mobile Banking</p>
                      {data.company.bkashNumber && <p className="text-slate-700"><span className="text-pink-600 font-semibold">bKash:</span> {data.company.bkashNumber}</p>}
                      {data.company.nagadNumber && <p className="text-slate-700"><span className="text-orange-600 font-semibold">Nagad:</span> {data.company.nagadNumber}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {data.notes && (
              <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm text-slate-600 whitespace-pre-line">{data.notes}</p>
              </div>
            )}

            {/* Terms */}
            {data.termsConditions && (
              <div className="mb-6 p-4 border border-slate-200 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Terms & Conditions</p>
                <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">{data.termsConditions}</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-slate-200 pt-5 flex items-center justify-between text-xs text-slate-400">
              <p>Thank you for choosing <span className="font-semibold" style={{ color: brandColor }}>{data.company.name}</span></p>
              <p className="font-mono">{data.invoiceNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
