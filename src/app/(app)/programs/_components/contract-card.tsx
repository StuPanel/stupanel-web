"use client";

/** In a program: its contract(s) and where each stands, or one button to make it. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileSignature, Plus } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Tile } from "@/components/ui/apple";
import { STATUS_META, ago, fmtDay, type ContractRow } from "@/lib/contracts";

export function ContractCard({ bookingId }: { bookingId: string }) {
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  useEffect(() => {
    let live = true;
    apiFetch(`${API}/contracts?bookingId=${bookingId}`).then(r => (r.ok ? r.json() : { data: [] })).then(d => { if (live) setRows(d.data ?? []); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [bookingId]);

  if (rows === null) return <div className="sp-skel h-[64px] rounded-[20px] mb-7" />;
  return (
    <section className="mb-7">
      <div className="px-1 mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-[#4A4658]">Contract</h2>
        {rows.length > 0 && <Link href={`/contracts/new?program=${bookingId}`} className="text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Another</Link>}
      </div>
      <div className={cn("bg-white rounded-[20px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
        {rows.length === 0 ? (
          <Link href={`/contracts/new?program=${bookingId}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F7F5FB]">
            <Tile icon={FileSignature} color="ink" size={32} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-[#17151F]">Make the contract</span>
              <span className="block text-xs text-[#6B6680]">Days, package and price fill in — the client signs on their phone</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#B5B0C4]" />
          </Link>
        ) : rows.map(c => {
          const st = STATUS_META[c.status];
          return (
            <Link key={c.id} href={`/contracts/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F7F5FB]">
              <Tile icon={FileSignature} color={c.status === "signed" ? "green" : "ink"} size={32} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[#17151F] truncate">{c.title}</span>
                <span className="block text-xs text-[#6B6680] truncate">
                  {c.status === "signed" ? `Signed ${fmtDay(c.signedAt)}` : c.status === "viewed" ? `Opened ${ago(c.lastViewedAt)}` : c.status === "sent" ? "Sent · not opened yet" : "Not sent yet"}
                </span>
              </span>
              <span className={cn("h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center flex-shrink-0", st.cls)}>{st.label}</span>
              <ChevronRight className="w-4 h-4 text-[#B5B0C4]" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
