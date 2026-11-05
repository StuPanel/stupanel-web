"use client";

/** A client's account statement (studio only — needs sign-in). Print / PDF in the studio's design. */
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { withDefaults } from "@/components/invoice-doc/design";
import { DocViewer } from "@/components/invoice-doc/doc-viewer";
import { StatementDocument, type StatementData } from "@/components/invoice-doc/statement-document";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function StatementPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const q = new URLSearchParams({ ...(from && { from }), ...(to && { to }) });
    apiFetch(`${API}/studio-invoices/statement/${encodeURIComponent(clientId)}?${q}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { setRaw(d); setError(false); })
      .catch(() => setError(true));
  }, [clientId, from, to]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="min-h-screen flex items-center justify-center bg-[#ECE9F2] text-[#6B6680]">Couldn&apos;t load the statement. Please sign in and try again.</div>;
  if (!raw) return <div className="min-h-screen flex items-center justify-center bg-[#ECE9F2]"><Loader2 className="w-7 h-7 animate-spin text-[#7D5CEF]" /></div>;

  const d0 = withDefaults(raw.design);
  const design = d0.paper === "pos80" ? { ...d0, paper: "a4" as const } : d0;
  const data: StatementData = { ...raw, studio: raw.company, currency: raw.company?.currency ?? "BDT" };
  const name = `${raw.client.firstName} ${raw.client.lastName ?? ""}`.trim();
  const inp = "h-10 px-3 rounded-full bg-white border border-[#E6E2EE] text-sm";

  return (
    <DocViewer design={design} fileName={`Statement-${name.replace(/\s+/g, "-")}`}
      doc={<StatementDocument data={data} design={design} />}
      top={
        <div className="flex flex-wrap items-center gap-2 justify-center mb-5">
          <Link href="/clients" className="h-10 px-3 rounded-full bg-white text-sm font-semibold inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" />Clients</Link>
          <label className="text-sm text-[#4A4658] inline-flex items-center gap-1.5">From <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} /></label>
          <label className="text-sm text-[#4A4658] inline-flex items-center gap-1.5">To <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} /></label>
          {(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="h-10 px-3 rounded-full text-sm font-semibold text-[#5B3FD0]">All time</button>}
        </div>
      } />
  );
}
