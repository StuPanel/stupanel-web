"use client";

/**
 * Face Search credits: what the studio has, how credits work, where they went and the history.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Group, PageHeader } from "@/components/ui/apple";
import { day, num, type Credits } from "@/lib/face";
import { BuyCredits } from "./buy-credits";

type Page = {
  balance: Credits;
  prices: { what: string; cost: string }[];
  usedThisMonth: { galleryId: string | null; title: string; used: number }[];
  entries: { id: string; at: string; delta: number; bucket: string; kind: string; note: string | null; balanceAfter: number; gallery: string | null }[];
};
const KIND: Record<string, string> = { grant: "Plan credits", use: "Photos added", purchase: "Credits bought", adjust: "Added by StuPanel", refund: "Given back", expire: "Plan credits ended" };

export default function FaceCreditsPage() {
  const [d, setD] = useState<Page | null>(null);
  const load = useCallback(() => { apiFetch(`${API}/face-search/credits`).then(r => (r.ok ? r.json() : null)).then(v => { if (v) setD(v); }).catch(() => null); }, []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="py-24 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const b = d.balance;
  const top = Math.max(1, ...d.usedThisMonth.map(u => u.used));
  const usedTotal = d.usedThisMonth.reduce((n, u) => n + u.used, 0);

  return (
    <div>
      <PageHeader icon={Coins} color="violet" title="Credits" sub="For AI Face Search">
        <Link href="/face-search" className={cn("h-11 px-4 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5", CARD_SHADOW)}><ArrowLeft className="w-4 h-4" />AI Face Search</Link>
      </PageHeader>

      <div className="grid lg:grid-cols-2 gap-5 items-start mb-2">
        <div className={cn("bg-white rounded-[20px] p-5 mb-5", CARD_SHADOW)}>
          <p className="text-[13px] font-semibold text-[#6B6680]">Credits you can use now</p>
          <p className="text-[48px] leading-[1.05] font-extrabold tracking-[-0.04em] text-[#17151F] tabular-nums">{num(b.total)}</p>
          <p className="text-[13px] text-[#6B6680]">{b.total ? `Enough for ${num(b.total)} more photos` : "Add credits to start adding photos"}</p>
          {b.total > 0 && (
            <div role="img" aria-label={`${num(b.plan)} plan credits and ${num(b.purchased)} purchased credits`} className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mt-4">
              {b.plan > 0 && <div style={{ flex: b.plan }} className="bg-[#C98A1B]" />}
              {b.purchased > 0 && <div style={{ flex: b.purchased }} className="bg-[#7D5CEF]" />}
            </div>
          )}
          <div className="flex gap-6 flex-wrap mt-3">
            <div><p className="text-[20px] font-bold tabular-nums">{num(b.plan)}</p><p className="text-xs text-[#6B6680]"><span className="inline-block w-2 h-2 rounded-full bg-[#C98A1B] mr-1.5" />Plan credits{b.planResetAt ? ` · new on ${day(b.planResetAt)}` : " · end with the month"}</p></div>
            <div><p className="text-[20px] font-bold tabular-nums">{num(b.purchased)}</p><p className="text-xs text-[#6B6680]"><span className="inline-block w-2 h-2 rounded-full bg-[#7D5CEF] mr-1.5" />Purchased · never expire</p></div>
          </div>
          <p className="mt-4 text-[12.5px] leading-snug rounded-[12px] bg-[#EEE8FD] text-[#3A2796] px-3 py-2.5">Plan credits are used first, so the credits you bought are not wasted.</p>
        </div>

        <Group title="How credits work" note="The same list for every studio.">
          {d.prices.map(p => (
            <div key={p.what} className="px-4 py-3 flex items-center gap-3">
              <p className="flex-1 text-[14px] text-[#17151F]">{p.what}</p>
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", p.cost === "Free" ? "bg-[#E2F4EA] text-[#176B47]" : p.cost === "Not counted" ? "bg-[#F1EFF6] text-[#4A4658]" : "bg-[#EEE8FD] text-[#4B32B8]")}>{p.cost}</span>
            </div>
          ))}
        </Group>
      </div>

      <BuyCredits onBought={load} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-5 items-start">
        <Group title="This month by gallery" action={<span className="text-xs text-[#6B6680] tabular-nums">{num(usedTotal)} used</span>} flush>
          <div className="p-4 space-y-3.5">
            {d.usedThisMonth.length === 0 ? <p className="text-sm text-[#6B6680]">Nothing used this month.</p> : d.usedThisMonth.map(u => (
              <div key={u.galleryId ?? "x"}>
                <p className="flex justify-between gap-3 text-[13px] mb-1.5"><span className="font-semibold truncate">{u.title}</span><b className="tabular-nums">{num(u.used)}</b></p>
                <div className="h-1.5 rounded-full bg-[#F1EFF6] overflow-hidden"><div className="h-full rounded-full bg-[#7D5CEF]" style={{ width: `${Math.round((u.used / top) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Group>

        <Group title="History" flush>
          {d.entries.length === 0 ? <p className="p-4 text-sm text-[#6B6680]">No changes yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-xs text-[#6B6680]">
                  <th className="font-semibold px-4 py-2.5">Date</th><th className="font-semibold px-4 py-2.5">What</th><th className="font-semibold px-4 py-2.5">Gallery</th>
                  <th className="font-semibold px-4 py-2.5 text-right">Credits</th><th className="font-semibold px-4 py-2.5 text-right">Balance</th>
                </tr></thead>
                <tbody>
                  {d.entries.map(e => (
                    <tr key={e.id} className="border-t border-[#EEEBF4]">
                      <td className="px-4 py-2.5 text-[#6B6680] whitespace-nowrap">{day(e.at)}</td>
                      <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{e.note || KIND[e.kind] || e.kind}</td>
                      <td className="px-4 py-2.5 text-[#6B6680] whitespace-nowrap">{e.gallery ?? (e.kind === "use" ? "Removed gallery" : "")}</td>
                      <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap", e.delta > 0 ? "text-[#176B47]" : "text-[#17151F]")}>{e.delta > 0 ? "+" : ""}{num(e.delta)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{num(e.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Group>
      </div>
    </div>
  );
}
