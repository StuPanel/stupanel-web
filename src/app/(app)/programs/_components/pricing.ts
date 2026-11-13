/**
 * Team bill for one program — built from who works which shift, with what setup,
 * and the member's / studio's prices. Result is written to booking.costEntries, so
 * every page that already reads costEntries (profile, salary, reports, profit) stays in sync.
 *
 * Price lookup (same as docs/03-Decisions/2026-10-31-team-pay-model.md):
 *   member + program type → member + all → studio + program type → studio + all
 * Unit order: the studio's "pay team by" unit first, then per shift → full day → whole program.
 */
import type { ShiftAssignment, EventDay, CostEntry, BillLine, TeamMember } from "./types";

export type Rate = { roleId: string; rateType: string; rate: number; withSetup?: number; workType?: string; label?: string };
export type GearItem = { id: string; category: string; name: string; rent: number; rentUnit: string; rents?: Record<string, number> };

/**
 * Which rent to use for a piece of gear on this program: the studio's "pay team by" unit first,
 * then per shift → full day → whole program — the first one that has a price.
 * Gear saved before per-unit rents has one rent + unit.
 */
export function gearRent(item: GearItem, unitOrder: string[]): { unit: string; price: number } {
  const rents = item.rents && Object.keys(item.rents).length ? item.rents : { [item.rentUnit]: item.rent };
  for (const u of unitOrder) if (Number(rents[u]) > 0) return { unit: u, price: Number(rents[u]) };
  return { unit: item.rentUnit, price: Number(item.rent) || 0 };
}

const SHOOT_UNITS = ["per_shift", "per_day", "per_program"] as const;
const UNIT_WORD: Record<string, [string, string]> = {
  per_shift: ["shift", "shifts"], per_day: ["day", "days"], per_program: ["program", "programs"],
};
export const ROLE_NAME: Record<string, string> = {
  photographer: "Photography", cinematographer: "Cinematography", drone_pilot: "Drone",
  assistant: "Assistant", photo_editor: "Photo editing", video_editor: "Video editing",
};
const roleName = (r: string) => ROLE_NAME[r] ?? r.replace(/_/g, " ");
const lid = () => Math.random().toString(36).slice(2, 10);

/** Find the price for work + unit + program type, member first, then studio. */
export function findRate(member: Rate[] | undefined, studio: Rate[] | undefined, roleId: string, unit: string, workType: string) {
  const pick = (list?: Rate[]) => {
    const same = (list ?? []).filter(r => r.roleId === roleId && r.rateType === unit);
    return (workType && same.find(r => r.workType === workType)) || same.find(r => !r.workType);
  };
  return pick(member) ?? pick(studio);
}

type Work = { day: EventDay; shiftLabel: string; a: ShiftAssignment };

/**
 * Build bill lines for everyone on the program.
 * `keep` = previous entries: manual lines (bonus, transport, cut…) and amounts the user
 * typed over an auto line are kept; paidAmount is kept.
 */
export const NO_PRICE_NOTE = "No price set — type the amount";
const KEPT_NOTE = "No price for this program type — kept the earlier amount";

/** The line this bill already had (saved before), when it had an amount. */
function keptLine(keep: CostEntry[], memberId: string, key: string): BillLine | undefined {
  const l = keep.find(e => e.memberId === memberId)?.lines?.find(x => x.key === key);
  return l && Number(l.amount) > 0 ? l : undefined;
}

export function buildBill(opts: {
  days: EventDay[]; team: TeamMember[]; studioRates: Rate[]; payMode: string; keep?: CostEntry[];
  /** Editing work (not tied to a shift). */
  editors?: { userId: string; role: string }[];
}): { entries: CostEntry[]; rentedFromOutside: number } {
  const { days, team, studioRates, payMode, keep = [], editors = [] } = opts;
  const unitOrder = [payMode, ...SHOOT_UNITS.filter(u => u !== payMode)];
  const byMember = new Map<string, Work[]>();
  for (const day of days) for (const s of day.shifts) for (const a of s.assignments) {
    if (!byMember.has(a.id)) byMember.set(a.id, []);
    byMember.get(a.id)!.push({ day, shiftLabel: s.label, a });
  }

  const lines = new Map<string, BillLine[]>(); // memberId → lines
  const names = new Map<string, string>();
  const add = (memberId: string, line: BillLine) => {
    if (!lines.has(memberId)) lines.set(memberId, []);
    lines.get(memberId)!.push(line);
  };
  let rentedFromOutside = 0;

  for (const [memberId, works] of byMember) {
    const m = team.find(t => t.id === memberId);
    names.set(memberId, m ? `${m.firstName} ${m.lastName ?? ""}`.trim() : (works[0].a.name ?? "Freelancer"));
    // group by role + setup
    const groups = new Map<string, Work[]>();
    for (const w of works) {
      const k = `${w.a.role}|${w.a.setup ?? "own"}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(w);
    }
    for (const [k, ws] of groups) {
      const [role, setup] = k.split("|");
      const type = ws[0].day.programType ?? "";
      const shifts = ws.length;
      const daysCount = new Set(ws.map(w => w.day.id)).size;
      let unit = "", rate: Rate | undefined;
      for (const u of unitOrder) { rate = findRate(m?.roleRates as Rate[], studioRates, role, u, type); if (rate) { unit = u; break; } }
      const qty = unit === "per_shift" ? shifts : unit === "per_day" ? daysCount : 1;
      const own = setup === "own";
      const price = rate ? (own ? (rate.withSetup ?? rate.rate) : rate.rate) : 0;
      const [one, many] = UNIT_WORD[unit] ?? ["", ""];
      const label = `${roleName(role)}${own ? " · own setup" : setup === "other" ? " · others' gear" : " · rented gear"}`;
      // No price for this work / program type: keep what this bill had before instead of dropping it to 0.
      const before = !rate ? keptLine(keep, memberId, `work|${k}`) : undefined;
      add(memberId, before ? { ...before, id: lid(), auto: true, role, setup: setup as BillLine["setup"], label, note: KEPT_NOTE } : {
        id: lid(), key: `work|${k}`, kind: "work", auto: true, role, setup: setup as BillLine["setup"], label,
        qty: rate ? qty : shifts, unit: rate ? unit : "per_shift", unitPrice: price, amount: Math.round(price * (rate ? qty : shifts)),
        note: rate ? `${qty} ${qty === 1 ? one : many}` : NO_PRICE_NOTE,
      });

      // Gear from someone else: rent goes to the owner
      if (setup === "other") {
        for (const w of ws) for (const g of w.a.gear ?? []) {
          if (!g.ownerId || g.ownerId === "studio") continue;
          const owner = team.find(t => t.id === g.ownerId);
          const key = `rent|${g.ownerId}|${g.itemId}`;
          const keptOwner = keep.find(e => e.memberId === g.ownerId);
          const before = keptOwner?.lines?.find(l => l.key === key);
          // The owner may have taken the item off their list (or left the team) after it was used.
          // The program still used it, so the rent stays: the price this bill had before, else none.
          const listed = (owner?.setup as GearItem[] | undefined)?.find(i => i.id === g.itemId);
          if (!listed && !owner && !before) continue; // unknown owner, never billed — nothing to keep
          const rent = listed ? gearRent(listed, unitOrder)
            : before?.unitPrice ? { unit: before.unit ?? "per_shift", price: before.unitPrice } : { unit: "per_shift", price: 0 };
          const ownerName = owner ? `${owner.firstName} ${owner.lastName ?? ""}`.trim() : keptOwner?.memberName ?? "Gear owner";
          names.set(g.ownerId, ownerName);
          const list = lines.get(g.ownerId) ?? [];
          const existing = list.find(l => l.key === key);
          const dayIds = new Set<string>(existing?.days ?? []);
          dayIds.add(w.day.id);
          const shiftsUsed = (existing?.shifts ?? 0) + 1;
          const users = new Set<string>(existing?.users ?? []);
          users.add(names.get(memberId) ?? "");
          const q = rent.unit === "per_shift" ? shiftsUsed : rent.unit === "per_day" ? dayIds.size : 1;
          const line: BillLine = {
            id: existing?.id ?? before?.id ?? lid(), key, kind: "gear_rent", auto: true, label: `Rent · ${listed?.name ?? g.name}`,
            qty: q, unit: rent.unit, unitPrice: rent.price, amount: Math.round(rent.price * q),
            note: [
              `${q} ${(UNIT_WORD[rent.unit] ?? ["", ""])[q === 1 ? 0 : 1]}`.trim(),
              `used by ${[...users].filter(Boolean).join(", ")}`,
              !listed ? "no longer on their gear list" : rent.price > 0 ? "" : "no rent set — type the amount",
            ].filter(Boolean).join(" · "),
            days: [...dayIds], shifts: shiftsUsed, users: [...users],
          };
          if (existing) Object.assign(existing, line); else add(g.ownerId, line);
        }
      }
      // Rented from outside
      if (setup === "rented") {
        for (const w of ws) {
          const r = w.a.rental;
          if (!r || !(r.amount > 0)) continue;
          if (r.paidBy === "member") {
            add(memberId, {
              id: lid(), key: `refund|${w.day.id}|${w.shiftLabel}|${role}`, kind: "refund", auto: true,
              label: `Refund · ${r.item || "rented gear"}${r.vendor ? ` (${r.vendor})` : ""}`, qty: 1, unit: "item", unitPrice: r.amount, amount: r.amount,
            });
          } else {
            rentedFromOutside += r.amount;
          }
        }
      }
    }
  }

  // Editing work: one line each, priced per program (or the first price they have for that work)
  const programType = days[0]?.programType ?? "";
  for (const e of editors) {
    const m = team.find(t => t.id === e.userId);
    if (!m) continue;
    names.set(m.id, `${m.firstName} ${m.lastName ?? ""}`.trim());
    const rate = findRate(m.roleRates as Rate[], studioRates, e.role, "per_program", programType)
      ?? (m.roleRates as Rate[] | undefined)?.find(r => r.roleId === e.role)
      ?? studioRates.find(r => r.roleId === e.role);
    const before = !rate ? keptLine(keep, m.id, `edit|${e.role}`) : undefined;
    if (before) { add(m.id, { ...before, id: lid(), auto: true, role: e.role, label: roleName(e.role), note: KEPT_NOTE }); continue; }
    add(m.id, {
      id: lid(), key: `edit|${e.role}`, kind: "work", auto: true, role: e.role,
      label: roleName(e.role), qty: 1, unit: rate?.rateType ?? "per_program", unitPrice: rate?.rate ?? 0, amount: rate?.rate ?? 0,
      note: rate ? (rate.rateType === "per_program" ? "whole program" : rate.label || rate.rateType.replace(/^per_/, "per ").replace(/_/g, " ")) : NO_PRICE_NOTE,
    });
  }

  // Merge with kept entries: keep paid amounts, manual lines and typed-over amounts
  const entries: CostEntry[] = [];
  // Kept too: people with lines typed by hand, and anyone already paid on this program — their payment
  // must not disappear when their work or gear is taken off it (they then show as paid more than their bill).
  const ids = new Set<string>([...lines.keys(), ...keep.filter(e => e.memberId && ((e.lines ?? []).some(l => !l.auto) || Number(e.paidAmount ?? 0) > 0)).map(e => e.memberId!)]);
  for (const memberId of ids) {
    const old = keep.find(e => e.memberId === memberId);
    const autoLines = (lines.get(memberId) ?? []).map(l => {
      // Same line as before keeps its id, so a box being typed in isn't rebuilt (phone keyboard closing).
      const same = l.key ? old?.lines?.find(o => o.key === l.key) : undefined;
      const prev = same?.edited ? same : undefined;
      const line = same ? { ...l, id: same.id } : l;
      return prev ? { ...line, amount: prev.amount, edited: true } : line;
    });
    const manual = (old?.lines ?? []).filter(l => !l.auto);
    const all = [...autoLines, ...manual];
    const roles = [...new Set(autoLines.filter(l => l.kind === "work").map(l => l.role!))];
    entries.push({
      id: old?.id ?? lid(), memberId, memberName: names.get(memberId) ?? old?.memberName ?? "",
      role: roles.join(", ") || old?.role || "", lines: all,
      totalBill: all.reduce((s, l) => s + (l.kind === "deduction" ? -l.amount : l.amount), 0),
      paidAmount: old?.paidAmount ?? 0,
    });
  }
  // Entries typed by hand in the old form (no lines) stay as they were
  for (const e of keep) if (!e.lines && !entries.some(x => x.memberId && x.memberId === e.memberId)) entries.push(e);
  return { entries, rentedFromOutside };
}

export const lineTotal = (lines: BillLine[]) => lines.reduce((s, l) => s + (l.kind === "deduction" ? -l.amount : l.amount), 0);
