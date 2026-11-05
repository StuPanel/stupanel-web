"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { withDefaults } from "@/components/invoice-doc/design";
import { DocViewer } from "@/components/invoice-doc/doc-viewer";
import { docDate, type DocData } from "@/components/invoice-doc/invoice-document";

/* eslint-disable @typescript-eslint/no-explicit-any */
function toDoc(d: any): DocData {
  const c = d.company ?? {};
  const days = Array.isArray(d.booking?.eventDays) ? d.booking.eventDays : [];
  const name = `${d.client?.firstName ?? ""} ${d.client?.lastName ?? ""}`.trim();
  return {
    kind: d.docType === "quotation" ? "quotation" : "invoice",
    number: d.invoiceNumber, issueDate: d.issueDate, dueDate: d.dueDate, state: d.state,
    currency: d.currency ?? c.currency ?? "BDT",
    studio: c,
    client: { name: name || "Client", phone: d.client?.phone, email: d.client?.email },
    programName: d.booking?.eventName ?? null,
    programRef: d.booking?.bookingNumber ?? null,
    eventDays: [...days].filter((x: any) => x?.date || x?.location)
      .sort((a: any, b: any) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      .map((x: any, i: number) => ({ label: x.eventType || x.label || `Day ${i + 1}`, date: x.date, place: x.location })),
    items: (d.items ?? []).map((i: any) => ({ name: i.name, description: i.description, qty: Number(i.quantity), rate: Number(i.unitPrice), total: Number(i.total) })),
    subtotal: Number(d.subtotal), discount: Number(d.discountAmount ?? 0),
    taxLabel: d.taxLabel, taxPercent: Number(d.taxPercent ?? 0), taxAmount: Number(d.taxAmount ?? 0),
    total: Number(d.grandTotal), paid: Number(d.paidAmount ?? 0), due: Number(d.balanceDue ?? 0),
    payments: (d.payments ?? []).map((p: any) => ({ date: p.paymentDate, amount: Number(p.amount), method: p.paymentMethod, receiptNumber: p.receiptNumber })),
    terms: d.termsConditions, note: d.notes,
  };
}

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/invoices/${encodeURIComponent(token)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setRaw)
      .catch(() => setError(true));
  }, [token]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECE9F2] px-6">
      <p className="text-[#6B6680] text-center">This invoice link isn&apos;t working. Please ask the studio for a new link.</p>
    </div>
  );
  if (!raw) return <div className="min-h-screen flex items-center justify-center bg-[#ECE9F2]"><Loader2 className="w-7 h-7 animate-spin text-[#7D5CEF]" /></div>;

  const data = toDoc(raw);
  const design = withDefaults(raw.company?.invoiceDesign);
  const title = data.kind === "quotation" ? "Quotation" : "Invoice";
  const receipts = (raw.payments ?? []).filter((p: any) => p.receiptToken);
  const share = `${title} ${data.number} from ${data.studio.name}` + (data.kind === "invoice" ? ` — total ${data.total.toLocaleString("en-IN")} ${data.currency}, due ${data.due.toLocaleString("en-IN")}` : "");

  return (
    <DocViewer data={data} design={design} fileName={`${title}-${data.number}`} shareText={share}
      extra={receipts.length > 0 && (
        <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-[13px] font-bold text-[#4A4658]">Money receipts</p>
          {receipts.map((p: any) => (
            <a key={p.id} href={`/r/${p.receiptToken}`} className="flex items-center gap-3 px-5 py-3 border-t border-[#EEEBF4] hover:bg-[#F7F5FB]">
              <Receipt className="w-4 h-4 text-[#6B6680]" />
              <span className="font-semibold text-sm">{p.receiptNumber}</span>
              <span className="flex-1 text-xs text-[#6B6680]">{docDate(p.paymentDate)}</span>
              <span className="text-sm font-bold text-[#1F8A5B]">{Number(p.amount).toLocaleString("en-IN")} {data.currency}</span>
            </a>
          ))}
        </div>
      )} />
  );
}
