"use client";
/**
 * A team member's own referral pay (My earnings), when the studio pays for referrals (Settings → Referrals).
 * Data: GET /referrers/mine. Shows nothing when referral pay is off or the member has brought no paid programs.
 */
import { useEffect, useState } from "react";
import { Clock, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate, formatCurrency } from "@/lib/format";
import { Group } from "@/components/ui/apple";

type Mine = {
  on: boolean; earned: number; paid: number; owed: number; waiting: number;
  programs: { id: string; number: string; name: string; date: string | null; status: string; earned: number; paid: number; owed: number; waiting: number }[];
  payouts: { id: string; date: string; amount: number; parts: { bookingNumber: string }[] }[];
};

export function MyReferralPay() {
  const [d, setD] = useState<Mine | null>(null);
  useEffect(() => {
    apiFetch(`${API}/referrers/mine`).then(r => (r.ok ? r.json() : null)).then(x => { if (x) setD(x); }).catch(() => {});
  }, []);
  if (!d?.on || (!d.programs.length && !d.payouts.length)) return null;
  const toGet = Math.round((d.owed + d.waiting) * 100) / 100;
  return (
    <Group title="Referral pay" note="For programs you brought to the studio. It can be paid as soon as the client has paid the program in full."
      action={<span className="text-[12.5px] text-[#6B6680] tabular-nums">Earned {formatCurrency(d.earned)} · Got {formatCurrency(d.paid)}</span>}>
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 bg-[#EEE8FD]/50">
        <span className="w-9 h-9 rounded-full bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0"><Handshake className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-[#17151F]">Still to get</span>
          <span className="block text-xs text-[#6B6680]">{d.owed > 0 ? `${formatCurrency(d.owed)} ready` : "Nothing ready yet"}{d.waiting > 0 ? ` · ${formatCurrency(d.waiting)} waiting for programs to finish` : ""}</span>
        </span>
        <span className="text-[15px] font-bold text-[#5B3FD0] tabular-nums">{formatCurrency(toGet)}</span>
      </div>
      {d.programs.map(p => (
        <div key={p.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{p.name}</span>
            <span className="block text-xs text-[#6B6680] truncate">{p.number}{p.date ? ` · ${fmtDate(p.date)}` : ""}</span>
          </span>
          <span className="text-right flex-shrink-0">
            <span className="block text-[14.5px] font-bold tabular-nums text-[#17151F]">{formatCurrency(p.earned)}</span>
            <span className={cn("block text-[11.5px] font-semibold", p.owed > 0 ? "text-[#1F8A5B]" : p.waiting > 0 ? "text-[#9A5B00]" : "text-[#8A859A]")}>
              {p.owed > 0 ? `${formatCurrency(p.owed)} ready` : p.waiting > 0 ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Waiting</span> : "Paid"}
            </span>
          </span>
        </div>
      ))}
    </Group>
  );
}
