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
export type GearItem = { id: string; category: string; name: string; rent: number; rentUnit: string };

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
      add(memberId, {
        id: lid(), key: `work|${k}`, kind: "work", auto: true, role, setup: setup as BillLine["setup"],
        label: `${roleName(role)}${own ? " · own setup" : setup === "other" ? " · others' gear" : " · rented gear"}`,
        qty: rate ? qty : shifts, unit: rate ? unit : "per_shift", unitPrice: price, amount: Math.round(price * (rate ? qty : shifts)),
        note: rate ? `${qty} ${qty === 1 ? one : many}` : "No price set — type the amount",
      });

      // Gear from someone else: rent goes to the owner
      if (setup === "other") {
        for (const w of ws) for (const g of w.a.gear ?? []) {
          if (!g.ownerId || g.ownerId === "studio") continue;
          const owner = team.find(t => t.id === g.ownerId);
          const item = (owner?.setup as GearItem[] | undefined)?.find(i => i.id === g.itemId);
          if (!owner || !item) continue;
          names.set(owner.id, `${owner.firstName} ${owner.lastName ?? ""}`.trim());
          const key = `rent|${owner.id}|${item.id}`;
          const list = lines.get(owner.id) ?? [];
          const existing = list.find(l => l.key === key);
          const dayIds = new Set<string>(existing?.days ?? []);
          dayIds.add(w.day.id);
          const shiftsUsed = (existing?.shifts ?? 0) + 1;
          const q = item.rentUnit === "per_shift" ? shiftsUsed : item.rentUnit === "per_day" ? dayIds.size : 1;
          const line: BillLine = {
            id: existing?.id ?? lid(), key, kind: "gear_rent", auto: true, label: `Rent · ${item.name}`,
            qty: q, unit: item.rentUnit, unitPrice: item.rent, amount: Math.round(item.rent * q),
            note: `used by ${names.get(memberId)}`, days: [...dayIds], shifts: shiftsUsed,
          };
          if (existing) Object.assign(existing, line); else add(owner.id, line);
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
    add(m.id, {
      id: lid(), key: `edit|${e.role}`, kind: "work", auto: true, role: e.role,
      label: roleName(e.role), qty: 1, unit: rate?.rateType ?? "per_program", unitPrice: rate?.rate ?? 0, amount: rate?.rate ?? 0,
      note: rate ? (rate.rateType === "per_program" ? "whole program" : rate.label || rate.rateType.replace(/^per_/, "per ").replace(/_/g, " ")) : "No price set — type the amount",
    });
  }

  // Merge with kept entries: keep paid amounts, manual lines and typed-over amounts
  const entries: CostEntry[] = [];
  const ids = new Set<string>([...lines.keys(), ...keep.filter(e => e.memberId && (e.lines ?? []).some(l => !l.auto)).map(e => e.memberId!)]);
  for (const memberId of ids) {
    const old = keep.find(e => e.memberId === memberId);
    const autoLines = (lines.get(memberId) ?? []).map(l => {
      const prev = old?.lines?.find(o => o.key === l.key && o.edited);
      return prev ? { ...l, amount: prev.amount, edited: true } : l;
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
