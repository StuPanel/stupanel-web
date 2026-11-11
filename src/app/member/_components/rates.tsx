"use client";

/** Member panel: showing my prices and my gear (used on the dashboard and on "My rates & gear"). */
import { Tag } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Row } from "@/components/ui/profile-page";
import { SETUP_CATS, TEAM_ROLES, gearRents, unitLabel, type SavedGear, type SavedRate } from "@/app/(app)/team/_components/rate-card";

export type MyRates = { memberRoles: string[]; monthly: number; rates: SavedRate[]; setup: SavedGear[]; workTypes: Record<string, string> };

export const roleInfo = (id: string) => TEAM_ROLES.find(r => r.id === id)
  ?? { id, label: id.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()), icon: Tag, tile: "violet" };

/** One price line: with-setup price first (when there is one), work-only below — same as the studio's view. */
export function RatePrice({ r }: { r: SavedRate }) {
  return r.withSetup != null && r.withSetup > 0 ? (
    <>
      <span className="text-[14.5px] font-bold text-[#17151F] tabular-nums whitespace-nowrap">{formatCurrency(r.withSetup)}<span className="text-[12px] font-medium text-[#6B6680]"> with setup</span></span>
      {r.rate > 0 && <span className="text-[12px] font-semibold text-[#6B6680] tabular-nums whitespace-nowrap">{formatCurrency(r.rate)} work only</span>}
    </>
  ) : <span className="text-[14.5px] font-bold text-[#17151F] tabular-nums whitespace-nowrap">{formatCurrency(r.rate)}</span>;
}
export const rateSub = (r: SavedRate, workTypes: Record<string, string>) =>
  `${unitLabel(r.roleId, r.rateType, r.label)} · ${r.workType ? (workTypes[r.workType] ?? "One program type") : "All programs"}`;

export function GearRow({ g }: { g: SavedGear }) {
  const cat = SETUP_CATS.find(c => c.v === g.category) ?? SETUP_CATS[SETUP_CATS.length - 1];
  const rents = gearRents(g);
  return (
    <Row icon={cat.icon} color={cat.tile} title={g.name} sub={cat.l}
      right={rents.length ? rents.map(x => (
        <span key={x.unit} className="text-[13.5px] font-bold text-[#17151F] tabular-nums whitespace-nowrap">{formatCurrency(x.amount)}<span className="text-[12px] font-medium text-[#6B6680]"> / {x.short}</span></span>
      )) : <span className="text-[12.5px] text-[#8A8599] whitespace-nowrap">Rent not set yet</span>} />
  );
}
