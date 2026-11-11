"use client";

import { use, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { PublicLoading, PublicMessage } from "@/components/public/public-shell";
import { withDefaults } from "@/components/invoice-doc/design";
import { DocViewer } from "@/components/invoice-doc/doc-viewer";
import type { DocData } from "@/components/invoice-doc/invoice-document";

/* eslint-disable @typescript-eslint/no-explicit-any */
function toDoc(r: any): DocData {
  const name = `${r.client?.firstName ?? ""} ${r.client?.lastName ?? ""}`.trim();
  return {
    kind: "receipt", number: r.receiptNumber ?? "—", issueDate: r.paymentDate,
    currency: r.currency ?? "BDT", studio: r.company ?? { name: "" },
    client: { name: name || "Client", phone: r.client?.phone, email: r.client?.email },
    programName: r.program?.name ?? null, programRef: r.program?.number ?? r.invoice?.number ?? null,
    items: [], subtotal: r.total, discount: 0, taxAmount: 0, total: r.total, paid: r.paidSoFar, due: r.dueAfter,
    receipt: {
      amount: r.amount, method: r.paymentMethod, trxId: r.transactionId, account: r.account,
      paidSoFar: r.paidSoFar, dueAfter: r.dueAfter,
      forText: r.program ? `${r.program.name ?? "Program"} (${r.program.number})` : r.invoice ? `Invoice ${r.invoice.number}` : null,
    },
  };
}

export default function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/receipts/${encodeURIComponent(token)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setRaw)
      .catch(() => setError(true));
  }, [token]);

  if (error) return <PublicMessage icon={FileText} title="Receipt not found" text="This receipt isn't available. It may have been cancelled and replaced — please ask the studio for the new one." />;
  if (!raw) return <PublicLoading />;

  const data = toDoc(raw);
  const design = withDefaults(raw.design);
  const share = `Money receipt ${data.number} from ${data.studio.name} — received ${Number(raw.amount).toLocaleString("en-IN")} ${data.currency}`;
  return (
    <DocViewer data={data} design={design} fileName={`Receipt-${data.number}`} shareText={share}
      extra={raw.invoice?.publicToken && (
        <a href={`/inv/${raw.invoice.publicToken}`} className="flex items-center justify-center gap-2 h-11 rounded-full bg-white text-sm font-semibold text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <FileText className="w-4 h-4" />See the full invoice {raw.invoice.number}
        </a>
      )} />
  );
}
