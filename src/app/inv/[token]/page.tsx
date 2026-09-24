"use client";

import { useState, useEffect, use } from "react";
import { Loader2, Printer } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { InvoicePreview, type InvoicePreviewData } from "@/components/invoice-preview";

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<any>(null);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <p className="text-slate-500 text-lg font-medium">{error || "Invoice not found"}</p>
      </div>
    </div>
  );

  const brandColor = data.company?.primaryColor || "#4F46E5";

  const previewData: InvoicePreviewData = {
    company: data.company,
    invoiceNumber: data.invoiceNumber,
    status: data.status,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    currency: data.currency ?? data.company?.currency ?? "BDT",
    clientName: `${data.client?.firstName ?? ""} ${data.client?.lastName ?? ""}`.trim(),
    clientPhone: data.client?.phone,
    clientEmail: data.client?.email,
    bookingName: data.booking?.eventName,
    bookingRef: data.booking?.bookingNumber,
    bookingDate: data.booking?.eventDate,
    items: (data.items ?? []).map((i: any) => ({
      name: i.name,
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    subtotal: Number(data.subtotal),
    discountAmount: Number(data.discountAmount ?? 0),
    taxLabel: data.taxLabel,
    taxPercent: Number(data.taxPercent ?? 0),
    taxAmount: Number(data.taxAmount ?? 0),
    grandTotal: Number(data.grandTotal),
    paidAmount: Number(data.paidAmount ?? 0),
    balanceDue: Number(data.balanceDue ?? 0),
    notes: data.notes,
    termsConditions: data.termsConditions,
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>

      {/* Print Button */}
      <div className="no-print fixed bottom-6 right-6 z-50">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: brandColor }}
        >
          <Printer className="w-4 h-4" />
          Download / Print PDF
        </button>
      </div>

      {/* Page background */}
      <div className="no-print min-h-screen bg-slate-200 py-8 px-4">
        <div className="max-w-[850px] mx-auto rounded-2xl overflow-hidden shadow-2xl">
          <InvoicePreview data={previewData} />
        </div>
      </div>

      {/* Print-only version (no container/shadow) */}
      <div className="print-only hidden print:block">
        <InvoicePreview data={previewData} />
      </div>
    </>
  );
}
