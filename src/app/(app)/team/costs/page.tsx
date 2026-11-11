"use client";

/** Studio: every cost the team claimed, across programs. Waiting ones first. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Chips, EmptyState, PageHeader, RowsSkeleton } from "@/components/ui/apple";
import { ClaimCard, type Claim } from "@/components/team-costs";

const FILTERS = [{ value: "pending", label: "To check" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Declined" }, { value: "all", label: "All" }];

export default function TeamCostsPage() {
  const [status, setStatus] = useState("pending");
  const [list, setList] = useState<Claim[] | null>(null);
  const load = useCallback(() => {
    apiFetch(`${API}/expense-claims${status === "all" ? "" : `?status=${status}`}`).then(r => (r.ok ? r.json() : [])).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  }, [status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setList(null); load(); }, [load]);
  const total = (list ?? []).reduce((s, c) => s + (c.approvedAmount ?? c.amount), 0);

  return (
    <div>
      <Link href="/team" className="h-9 pl-2.5 pr-3.5 mb-3 rounded-full bg-white hover:bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-1 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
        <ArrowLeft className="w-4 h-4" />Team
      </Link>
      <PageHeader icon={ReceiptText} color="orchid" title="Team costs" sub="Money your team paid for programs — approve to add it to their bill" />
      <Chips label="Show" value={status} onChange={setStatus} options={FILTERS.map(f => ({ ...f, count: f.value === status && list ? list.length : undefined }))} />
      {!list ? <RowsSkeleton n={3} /> : list.length === 0 ? (
        <EmptyState icon={ReceiptText} title={status === "pending" ? "Nothing to check" : "No costs here"} text="Team members add costs from their panel, on the program they worked." />
      ) : (
        <>
          {list.length > 1 && <p className="px-1 mb-3 text-[13px] text-[#6B6680]">{list.length} costs · {formatCurrency(total)}</p>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start [&>*]:min-w-0">
            {list.map(c => <ClaimCard key={c.id} c={c} showProgram onDone={load} />)}
          </div>
        </>
      )}
    </div>
  );
}
