"use client";

/**
 * Member panel → My gear: for each item, whether it can be rented to the studio's other members,
 * its state, where it is going (with me or rented to someone) and the rent it earned on my bills.
 * Rent prices are the studio's; the member only decides whether to rent it out and marks it in service.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { timeRange } from "@/lib/shifts";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, Tile } from "@/components/ui/apple";
import { SwitchRow } from "@/components/ui/form-kit";
import { SETUP_CATS, gearRents } from "@/app/(app)/team/_components/rate-card";

type Use = { date: string; bookingId: string; number: string; name: string; day: string; shift: string; start: string | null; end: string | null; byMe: boolean; usedBy: string };
type Item = {
  itemId: string; name: string; kind: string; state: "ok" | "service" | "out"; lend: boolean; inside: string; rents: Record<string, number>;
  coming: Use[]; past: Use[]; timesOut: number; rentedOut: number;
  rent: { total: number; unpaid: number; programs: { bookingId: string; number: string; name: string; amount: number; paid: boolean }[] };
};
const STATES = [["ok", "OK"], ["service", "In service"], ["out", "Out of use"]] as const;
const when = (u: Use) => {
  const d = new Date(`${u.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return [d, u.shift, timeRange(u.start, u.end)].filter(Boolean).join(" · ");
};

/** `category` of the saved gear (camera, lens, kit…) → icon; the server's kind is only used for counting. */
export function MyGearCards({ categories, reloadKey }: { categories: Record<string, string>; reloadKey: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    apiFetch(`${API}/member/gear`).then(r => (r.ok ? r.json() : null)).then(d => d && setItems(d.items)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  async function set(it: Item, patch: Partial<Pick<Item, "lend" | "state">>) {
    if (busy) return;
    setBusy(it.itemId);
    setItems(list => list?.map(x => (x.itemId === it.itemId ? { ...x, ...patch } : x)) ?? list);
    try {
      const r = await apiFetch(`${API}/member/gear/${encodeURIComponent(it.itemId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save", { error: true }); load(); return; }
      notify(patch.lend !== undefined ? (patch.lend ? "Others can now rent it" : "Only you use it now") : "Saved");
    } catch { notify("Couldn't save — check your internet", { error: true }); load(); }
    finally { setBusy(""); }
  }

  if (!items) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#A29DB3]" /></div>;
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      {items.map(it => {
        const cat = SETUP_CATS.find(c => c.v === (categories[it.itemId] ?? "")) ?? SETUP_CATS[SETUP_CATS.length - 1];
        const rents = gearRents({ rent: 0, rentUnit: "per_shift", rents: it.rents });
        const next = it.coming[0];
        return (
          <section key={it.itemId} className={cn("bg-white rounded-[20px] overflow-hidden", CARD_SHADOW)} aria-label={it.name}>
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <Tile icon={cat.icon} color={cat.tile} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-[#17151F] truncate">{it.name}</p>
                <p className="text-[12.5px] text-[#6B6680] truncate">
                  {rents.length ? rents.map(x => `${formatCurrency(x.amount)} / ${x.short}`).join(" · ") : "Rent not set yet — the studio sets it"}
                </p>
              </div>
              {busy === it.itemId && <Loader2 className="w-4 h-4 animate-spin text-[#A29DB3]" />}
            </div>
            <div className="border-t border-[#EEEBF4]">
              <SwitchRow label="Can be rented to others" on={it.lend} onChange={v => set(it, { lend: v })}
                hint={it.lend ? "Other members can take it for a program; the studio pays you the rent." : "Only goes out when you work with it."} />
            </div>
            <div className="px-4 py-3 border-t border-[#EEEBF4] flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-[#4A4658] mr-1">State</span>
              {STATES.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={it.state === v} onClick={() => it.state !== v && set(it, { state: v })}
                  className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold", it.state === v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{l}</button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-[#EEEBF4]">
              <p className="text-[13px] font-semibold text-[#4A4658]">Where it goes</p>
              {it.coming.length === 0 ? <p className="text-[13px] text-[#6B6680] mt-0.5">Nothing coming up.</p> : (
                <ul className="mt-1 space-y-1.5">
                  {it.coming.slice(0, 5).map((u, i) => (
                    <li key={i} className="text-[13px] leading-snug">
                      <span className="font-semibold text-[#17151F]">{when(u)}</span>
                      <span className="block text-[#6B6680]">{u.byMe ? "With you" : <>Rented to <b className="text-[#1F5C99]">{u.usedBy}</b></>} · {[u.number, u.name, u.day].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                  {it.coming.length > 5 && <li className="text-[12.5px] text-[#6B6680]">+ {it.coming.length - 5} more</li>}
                </ul>
              )}
            </div>
            <div className="px-4 py-3 border-t border-[#EEEBF4] bg-[#FAF9FC] flex items-center gap-x-4 gap-y-1 flex-wrap text-[12.5px] text-[#6B6680]">
              <span>Went out <b className="text-[#17151F]">{it.timesOut}</b> time{it.timesOut === 1 ? "" : "s"}</span>
              {it.rentedOut > 0 && <span>Rented to others <b className="text-[#17151F]">{it.rentedOut}</b></span>}
              <span>Rent earned <b className="text-[#1F8A5B]">{formatCurrency(it.rent.total)}</b></span>
              {it.rent.unpaid > 0 && <span>Not paid yet <b className="text-[#7A4800]">{formatCurrency(it.rent.unpaid)}</b></span>}
              {next && !next.byMe && <Link href={`/member/programs/${next.bookingId}`} className="text-[#5B3FD0] font-semibold hover:underline ml-auto">Next rental</Link>}
            </div>
          </section>
        );
      })}
      <p className="text-[12.5px] text-[#6B6680] px-1">When someone else uses your gear, the studio pays you the rent on that program&apos;s team bill. The studio may take it from that person&apos;s pay — you are paid either way.</p>
    </div>
  );
}
