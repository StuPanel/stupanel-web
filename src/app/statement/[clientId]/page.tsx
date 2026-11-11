"use client";

/** A client's account statement (studio only — needs sign-in). Print / PDF in the studio's design. */
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { PublicLoading, PublicMessage } from "@/components/public/public-shell";
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

  if (error) return <PublicMessage icon={FileText} title="Couldn't load the statement" text="Please sign in and try again." />;
  if (!raw) return <PublicLoading />;

  const d0 = withDefaults(raw.design);
  const design = d0.paper === "pos80" ? { ...d0, paper: "a4" as const } : d0;
  const data: StatementData = { ...raw, studio: raw.company, currency: raw.company?.currency ?? "BDT" };
  const name = `${raw.client.firstName} ${raw.client.lastName ?? ""}`.trim();
  const inp = "h-10 px-3 rounded-full bg-white/85 border border-white text-sm text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)]";

  return (
    <DocViewer design={design} fileName={`Statement-${name.replace(/\s+/g, "-")}`}
      doc={<StatementDocument data={data} design={design} />}
      top={
        <div className="flex flex-wrap items-center gap-2 justify-center mb-5">
          <Link href="/clients" className="h-10 px-3.5 rounded-full bg-white/85 hover:bg-white text-sm font-semibold text-[#17151F] inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)]"><ArrowLeft className="w-4 h-4" />Clients</Link>
          <label className="text-sm text-[#4A4658] inline-flex items-center gap-1.5">From <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} /></label>
          <label className="text-sm text-[#4A4658] inline-flex items-center gap-1.5">To <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} /></label>
          {(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="h-10 px-3 rounded-full text-sm font-semibold text-[#5B3FD0]">All time</button>}
        </div>
      } />
  );
}
