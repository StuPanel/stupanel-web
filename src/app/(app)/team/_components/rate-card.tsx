"use client";

/**
 * Team member "Work & pay" and "Setup" editors.
 *
 * Rate line = one price for (kind of work, unit, program type).
 *   rate      → work only (they use someone else's gear)
 *   withSetup → with their own gear (shoot roles only)
 *   workType  → "" = all programs, or a work type from Settings (e.g. Wedding)
 * Setup item = a piece of gear they own + rent paid to them when someone else uses it.
 */
import { useState } from "react";
import { Aperture, Box, Briefcase, Camera, Film, Image as ImageIcon, Lightbulb, Mic, Navigation, Package, Plus, Trash2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tile, type TileColor } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";
import { currencySymbol, currencyPad } from "@/lib/format";

export type RateLine = { id: string; roleId: string; unit: string; rate: string; withSetup: string; workType: string; label: string };
/** A piece of gear in the editor: one rent box per unit (shift / day / program). */
export type SetupItem = { id: string; category: string; name: string; rents: Record<string, string> };
/** A saved piece of gear (API shape). `rent` + `rentUnit` = the main price; `rents` = every unit that has a price. */
export type SavedGear = { id: string; category: string; name: string; rent: number; rentUnit: string; rents?: Record<string, number> };
export const RENT_UNITS = [{ v: "per_shift", l: "Per shift", s: "shift" }, { v: "per_day", l: "Per day", s: "day" }, { v: "per_program", l: "Per program", s: "program" }] as const;

/** Every rent a piece of gear has, in unit order. Old gear has a single rent. */
export function gearRents(g: Pick<SavedGear, "rent" | "rentUnit" | "rents">): { unit: string; short: string; amount: number }[] {
  const map: Record<string, number> = g.rents && Object.keys(g.rents).length ? g.rents : (Number(g.rent) > 0 ? { [g.rentUnit || "per_shift"]: Number(g.rent) } : {});
  return RENT_UNITS.filter(u => Number(map[u.v]) > 0).map(u => ({ unit: u.v, short: u.s, amount: Number(map[u.v]) }));
}
export function setupToItems(setup: SavedGear[] | undefined | null): SetupItem[] {
  return Array.isArray(setup) ? setup.map(g => ({
    id: g.id || uid(), category: g.category, name: g.name,
    rents: Object.fromEntries(gearRents(g).map(r => [r.unit, String(r.amount)])),
  })) : [];
}
export function itemsToSetup(items: SetupItem[]): SavedGear[] {
  return items.filter(g => g.name.trim()).map(g => {
    const rents: Record<string, number> = {};
    for (const u of RENT_UNITS) { const n = parseFloat(g.rents[u.v] ?? ""); if (n > 0) rents[u.v] = n; }
    const main = RENT_UNITS.find(u => rents[u.v] != null)?.v ?? "per_shift";
    return { id: g.id, category: g.category, name: g.name.trim(), rent: rents[main] ?? 0, rentUnit: main, rents };
  });
}
export const gearHasRent = (g: SetupItem) => RENT_UNITS.some(u => (g.rents[u.v] ?? "").trim() !== "");
export type RoleInfo = { id: string; label: string; icon: React.ElementType; tile: string };

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Built-in kinds of work (custom ones come from /team/custom-roles). */
export const TEAM_ROLES: RoleInfo[] = [
  { id: "photographer", label: "Photographer", icon: Camera, tile: "blue" },
  { id: "cinematographer", label: "Cinematographer", icon: Video, tile: "deep" },
  { id: "photo_editor", label: "Photo Editor", icon: ImageIcon, tile: "green" },
  { id: "video_editor", label: "Video Editor", icon: Film, tile: "orchid" },
  { id: "drone_pilot", label: "Drone Pilot", icon: Navigation, tile: "teal" },
  { id: "assistant", label: "Assistant", icon: Briefcase, tile: "ink" },
];

/** A saved rate line (API shape). */
export type SavedRate = { roleId: string; rateType: string; rate: number; withSetup?: number; workType?: string; label?: string; note?: string };

export function ratesToLines(rates: SavedRate[] | undefined | null): RateLine[] {
  return Array.isArray(rates) ? rates.map(r => ({
    id: uid(), roleId: r.roleId, unit: r.rateType || "per_program", rate: r.rate ? String(r.rate) : "",
    withSetup: r.withSetup != null ? String(r.withSetup) : "", workType: r.workType ?? "", label: r.label ?? "",
  })) : [];
}
export function linesToRates(lines: RateLine[], onlyRoles?: string[]): SavedRate[] {
  return lines
    .filter(l => (!onlyRoles || onlyRoles.includes(l.roleId)) && (l.rate.trim() !== "" || l.withSetup.trim() !== ""))
    .map(l => ({
      roleId: l.roleId, rateType: l.unit, rate: parseFloat(l.rate) || 0,
      ...(l.withSetup.trim() !== "" && !isEditorRole(l.roleId) ? { withSetup: parseFloat(l.withSetup) } : {}),
      ...(l.workType ? { workType: l.workType } : {}),
      ...(l.unit === "custom" && l.label.trim() ? { label: l.label.trim() } : {}),
    }));
}

/** Studio price for the same work + unit (+ program type, falling back to "all programs"). */
export function studioPrice(studio: SavedRate[] | undefined, l: Pick<RateLine, "roleId" | "unit" | "workType" | "label">) {
  if (!studio?.length) return undefined;
  const same = (r: SavedRate) => r.roleId === l.roleId && r.rateType === l.unit && (l.unit !== "custom" || (r.label ?? "") === l.label);
  return studio.find(r => same(r) && (r.workType ?? "") === l.workType) ?? (l.workType ? studio.find(r => same(r) && !r.workType) : undefined);
}

const SHOOT_UNITS = [
  { v: "per_shift", l: "Per shift" },
  { v: "per_day", l: "Full day" },
  { v: "per_program", l: "Whole program" },
  { v: "per_hour", l: "Per hour (overtime)" },
];
const UNITS_BY_ROLE: Record<string, { v: string; l: string }[]> = {
  photo_editor: [
    { v: "per_program", l: "Whole program" },
    { v: "per_album", l: "Album design" },
    { v: "per_photo", l: "Per photo" },
    { v: "per_hour", l: "Per hour" },
  ],
  video_editor: [
    { v: "per_program", l: "Whole program" },
    { v: "per_trailer", l: "Trailer / highlight" },
    { v: "per_full_video", l: "Full video" },
    { v: "per_reel", l: "Reel" },
    { v: "per_hour", l: "Per hour" },
  ],
};
const CUSTOM = { v: "custom", l: "Other (name it)" };

export const isEditorRole = (roleId: string) => roleId === "photo_editor" || roleId === "video_editor";
export function unitsFor(roleId: string) { return [...(UNITS_BY_ROLE[roleId] ?? SHOOT_UNITS), CUSTOM]; }
export function unitLabel(roleId: string, unit: string, label?: string) {
  if (unit === "custom") return label || "Other";
  return unitsFor(roleId).find(u => u.v === unit)?.l ?? unit.replace(/^per_/, "per ").replace(/_/g, " ");
}

/** First line for a newly picked role: per shift / per program by Settings, editors per program. */
export function firstLine(roleId: string, defaultUnit: string): RateLine {
  const unit = isEditorRole(roleId) ? "per_program" : (defaultUnit === "per_shift" ? "per_shift" : "per_program");
  return { id: uid(), roleId, unit, rate: "", withSetup: "", workType: "", label: "" };
}

// ─── Work & pay ─────────────────────────────────────────────────────────────
/**
 * One picker per kind of work: choose the unit (shift / day / program…) and the program type,
 * and the two boxes show the price for exactly that pair. Every pair keeps its own price;
 * all saved prices are listed underneath so nothing is hidden.
 */
export function RateEditor({ roles, lines, onChange, workTypes, fallback, emptyText }: {
  roles: RoleInfo[]; lines: RateLine[]; onChange: (lines: RateLine[]) => void; workTypes: { id: string; name: string }[];
  /** Studio prices — shown as grey hints in empty boxes. */
  fallback?: SavedRate[];
  emptyText?: string;
}) {
  if (!roles.length) return <p className="px-4 py-4 text-sm text-[#A29DB3]">{emptyText ?? "Pick what they do first — then set a price for each."}</p>;
  return (
    <div className="divide-y divide-[#EEEBF4]">
      {roles.map(r => <RoleRates key={r.id} role={r} lines={lines} onChange={onChange} workTypes={workTypes} fallback={fallback} />)}
    </div>
  );
}

type Sel = { unit: string; workType: string; label: string };
const hasPrice = (l: RateLine) => l.rate.trim() !== "" || l.withSetup.trim() !== "";
const fmtNum = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? `${currencySymbol().trim()}${n.toLocaleString("en-US")}` : ""; };

function RoleRates({ role: r, lines, onChange, workTypes, fallback }: {
  role: RoleInfo; lines: RateLine[]; onChange: (lines: RateLine[]) => void; workTypes: { id: string; name: string }[]; fallback?: SavedRate[];
}) {
  const Icon = r.icon;
  const editor = isEditorRole(r.id);
  const mine = lines.filter(l => l.roleId === r.id);
  // Until the person picks something, show the first saved price (lines can arrive after the first render).
  const [picked, setPicked] = useState<Sel | null>(null);
  const first = mine.find(hasPrice) ?? mine[0];
  const sel: Sel = picked ?? (first ? { unit: first.unit, workType: first.workType, label: first.label } : { unit: unitsFor(r.id)[0].v, workType: "", label: "" });
  const setSel = (next: Sel | ((s: Sel) => Sel)) => setPicked(typeof next === "function" ? next(sel) : next);
  const matches = (l: RateLine, s: Sel) => l.unit === s.unit && l.workType === s.workType && (s.unit !== "custom" || l.label === s.label);
  const current = mine.find(l => matches(l, sel));
  const typeName = (id: string) => (id ? workTypes.find(w => w.id === id)?.name ?? id : "All programs");

  /** Write a price for the pair that is picked now (makes the line the first time). */
  function setPrice(p: Partial<Pick<RateLine, "rate" | "withSetup">>) {
    if (current) onChange(lines.map(l => (l.id === current.id ? { ...l, ...p } : l)));
    else onChange([...lines, { id: uid(), roleId: r.id, unit: sel.unit, workType: sel.workType, label: sel.label, rate: "", withSetup: "", ...p }]);
  }
  /** Renaming a custom price keeps its amount. */
  function setLabel(label: string) {
    if (current) onChange(lines.map(l => (l.id === current.id ? { ...l, label } : l)));
    setSel(s => ({ ...s, label }));
  }
  const saved = mine.filter(hasPrice).sort((a, b) =>
    (a.workType ? 1 : 0) - (b.workType ? 1 : 0) || typeName(a.workType).localeCompare(typeName(b.workType))
    || unitsFor(r.id).findIndex(u => u.v === a.unit) - unitsFor(r.id).findIndex(u => u.v === b.unit));
  const hint = studioPrice(fallback, { roleId: r.id, ...sel });

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2.5 mb-3">
        <Tile icon={Icon} color={r.tile as TileColor} size={28} />
        <p className="flex-1 text-[15px] font-bold text-[#17151F]">{r.label}</p>
        {saved.length > 0 && <span className="text-[12px] font-semibold text-[#6B6680]">{saved.length} price{saved.length === 1 ? "" : "s"}</span>}
      </div>

      <div className="rounded-[16px] bg-[#FAF9FC] border border-[#EEEBF4] p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0">
            <span className="block px-0.5 mb-1 text-[12px] font-bold text-[#4A4658]">Price for</span>
            <select aria-label={`${r.label} — price unit`} value={sel.unit} onChange={e => setSel(s => ({ ...s, unit: e.target.value, label: "" }))}
              className={cn(inputCls, "h-10 text-sm pr-7 cursor-pointer w-full bg-white")}>
              {unitsFor(r.id).map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="block px-0.5 mb-1 text-[12px] font-bold text-[#4A4658]">Program type</span>
            <select aria-label={`${r.label} — for which programs`} value={sel.workType} onChange={e => setSel(s => ({ ...s, workType: e.target.value }))}
              className={cn(inputCls, "h-10 text-sm pr-7 cursor-pointer w-full bg-white", sel.workType && "bg-[#EEE8FD] text-[#5B3FD0] font-semibold")}>
              <option value="">All programs</option>
              {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              {sel.workType && !workTypes.some(w => w.id === sel.workType) && <option value={sel.workType}>{sel.workType}</option>}
            </select>
          </label>
        </div>
        {sel.unit === "custom" && (
          <input aria-label="Name of this price" value={sel.label} onChange={e => setLabel(e.target.value)}
            placeholder="Name it — e.g. Ceremony only, Same-day edit…" className={cn(inputCls, "h-10 text-sm mt-2 bg-white")} />
        )}
        <div className={cn("grid gap-2 mt-2.5", editor ? "grid-cols-1" : "grid-cols-2")}>
          <Money label={editor ? `${r.label} price` : `${r.label} — work only`} title={editor ? "Price" : "Work only"} sub={editor ? undefined : "Uses someone else's gear"}
            value={current?.rate ?? ""} onChange={v => setPrice({ rate: v })} hint={hint?.rate} />
          {!editor && <Money label={`${r.label} — with own setup`} title="With own setup" sub="Brings their own gear" accent
            value={current?.withSetup ?? ""} onChange={v => setPrice({ withSetup: v })} hint={hint?.withSetup} />}
        </div>
        <p className="mt-2 px-0.5 text-[11.5px] text-[#8A8599]" aria-live="polite">
          {current && hasPrice(current)
            ? <>Saved for <strong className="font-semibold text-[#4A4658]">{unitLabel(r.id, sel.unit, sel.label)} · {typeName(sel.workType)}</strong>. Pick another to set a different price.</>
            : <>No price yet for <strong className="font-semibold text-[#4A4658]">{unitLabel(r.id, sel.unit, sel.label)} · {typeName(sel.workType)}</strong>{hint ? " — the studio price is used." : "."}</>}
        </p>
      </div>

      {saved.length > 0 && (
        <ul className="mt-2.5 rounded-[16px] border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden" aria-label={`${r.label} — saved prices`}>
          {saved.map(l => {
            const on = current?.id === l.id;
            return (
              <li key={l.id} className={cn("flex items-center", on ? "bg-[#F3EFFE]" : "bg-white")}>
                <button type="button" onClick={() => setSel({ unit: l.unit, workType: l.workType, label: l.label })} aria-pressed={on}
                  className="flex-1 min-w-0 flex items-center gap-3 pl-3.5 pr-1 py-2.5 text-left hover:bg-[#F7F5FB]">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-[#17151F] truncate">{unitLabel(r.id, l.unit, l.label)}</span>
                    <span className={cn("block text-[12px] truncate", l.workType ? "text-[#5B3FD0] font-semibold" : "text-[#6B6680]")}>{typeName(l.workType)}</span>
                  </span>
                  <span className="text-right flex-shrink-0 leading-tight">
                    {l.rate.trim() !== "" && <span className="block text-[13.5px] font-bold text-[#17151F] tabular-nums">{fmtNum(l.rate)}</span>}
                    {!editor && l.withSetup.trim() !== "" && <span className="block text-[12px] font-semibold text-[#5B3FD0] tabular-nums">{fmtNum(l.withSetup)} with setup</span>}
                  </span>
                </button>
                <button type="button" onClick={() => onChange(lines.filter(x => x.id !== l.id))} aria-label={`Remove ${unitLabel(r.id, l.unit, l.label)} · ${typeName(l.workType)}`}
                  className="w-10 h-10 mr-1 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Money({ value, onChange, label, title, sub, accent, hint }: { value: string; onChange: (v: string) => void; label: string; title: string; sub?: string; accent?: boolean; hint?: number }) {
  return (
    <label className="block">
      <span className="block px-0.5 mb-1 min-w-0">
        <span className={cn("block text-[12px] font-bold whitespace-nowrap", accent ? "text-[#5B3FD0]" : "text-[#4A4658]")}>{title}</span>
        {sub && <span className="block text-[11px] text-[#9893A8] truncate">{sub}</span>}
      </span>
      <span className="relative block">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{currencySymbol().trim()}</span>
        <input style={{ paddingLeft: currencyPad() }} type="number" inputMode="numeric" min="0" step="100" aria-label={label} value={value} placeholder={hint != null ? `${hint} (studio)` : "0"}
          onChange={e => onChange(e.target.value)} className={cn(inputCls, "h-10 pl-7 pr-2 text-sm tabular-nums bg-white", accent && value && "text-[#5B3FD0] font-semibold")} />
      </span>
    </label>
  );
}

// ─── Setup (own gear) ───────────────────────────────────────────────────────
export const SETUP_CATS: { v: string; l: string; icon: React.ElementType; tile: TileColor; ph: string }[] = [
  { v: "camera", l: "Cameras", icon: Camera, tile: "blue", ph: "e.g. Sony A7 IV" },
  { v: "lens", l: "Lenses", icon: Aperture, tile: "deep", ph: "e.g. 24-70mm f/2.8" },
  { v: "light", l: "Lights", icon: Lightbulb, tile: "orchid", ph: "e.g. Godox SL60 ×2" },
  { v: "gimbal", l: "Gimbal / stabilizer", icon: Video, tile: "teal", ph: "e.g. DJI RS 3" },
  { v: "drone", l: "Drones", icon: Navigation, tile: "green", ph: "e.g. DJI Mini 4 Pro" },
  { v: "audio", l: "Audio", icon: Mic, tile: "red", ph: "e.g. Rode Wireless GO" },
  { v: "kit", l: "Full kits", icon: Package, tile: "violet", ph: "e.g. Photo kit: body + 2 lenses + light" },
  { v: "other", l: "Other", icon: Box, tile: "ink", ph: "e.g. Monitor, tripod" },
];

export function SetupEditor({ items, onChange }: { items: SetupItem[]; onChange: (items: SetupItem[]) => void }) {
  const set = (id: string, p: Partial<SetupItem>) => onChange(items.map(i => i.id === id ? { ...i, ...p } : i));
  const add = (category: string) => onChange([...items, { id: uid(), category, name: "", rents: {} }]);
  const used = SETUP_CATS.filter(c => items.some(i => i.category === c.v));
  const unused = SETUP_CATS.filter(c => !items.some(i => i.category === c.v));

  return (
    <div>
      {used.map(c => {
        const mine = items.filter(i => i.category === c.v);
        return (
          <section key={c.v} className="mb-5">
            <h3 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658] flex items-center gap-2"><Tile icon={c.icon} color={c.tile} size={20} />{c.l}</h3>
            <div className="bg-white rounded-[20px] divide-y divide-[#EEEBF4] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
              {mine.map(i => (
                <div key={i.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input aria-label={`${c.l} — name`} value={i.name} onChange={e => set(i.id, { name: e.target.value })} placeholder={c.ph} className={cn(inputCls, "h-10 text-sm flex-1 min-w-0")} />
                    <button type="button" onClick={() => onChange(items.filter(x => x.id !== i.id))} aria-label={`Remove ${i.name || c.l}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {RENT_UNITS.map(u => (
                      <label key={u.v} className="block min-w-0">
                        <span className="block px-0.5 mb-1 text-[11.5px] font-bold text-[#4A4658] truncate">{u.l}</span>
                        <span className="relative block">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{currencySymbol().trim()}</span>
                          <input style={{ paddingLeft: currencyPad() }} type="number" inputMode="numeric" min="0" step="100" aria-label={`${i.name || c.l} — rent ${u.l.toLowerCase()}`}
                            value={i.rents[u.v] ?? ""} onChange={e => set(i.id, { rents: { ...i.rents, [u.v]: e.target.value } })} placeholder="—"
                            className={cn(inputCls, "h-10 pl-7 pr-1.5 text-sm tabular-nums w-full", (i.rents[u.v] ?? "") !== "" && "font-semibold text-[#17151F]")} />
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => add(c.v)} className="w-full flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#F7F5FB] rounded-b-[20px]">
                <Plus className="w-3.5 h-3.5" />Add {c.l.toLowerCase().replace(/s$/, "")}
              </button>
            </div>
          </section>
        );
      })}

      <section>
        <h3 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">{used.length ? "Add more" : "What gear do they own?"}</h3>
        <div className="flex flex-wrap gap-2">
          {unused.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.v} type="button" onClick={() => add(c.v)}
                className="inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full bg-white text-[13px] font-semibold text-[#4A4658] hover:bg-[#EEEBF4] shadow-[0_1px_2px_rgba(22,18,40,.06)]">
                <Tile icon={Icon} color={c.tile} size={28} /><Plus className="w-3 h-3 -mr-1" />{c.l}
              </button>
            );
          })}
        </div>
        <p className="px-1 mt-3 text-xs text-[#6B6680] leading-relaxed">
          Each piece of gear can have its own rent <strong>per shift</strong>, <strong>per day</strong> and <strong>per program</strong> — fill the ones you use and leave the rest empty. The rent goes to this member when <strong>someone else</strong> works with their gear on a program. When they use it themselves, the &quot;With own setup&quot; price is used instead.
        </p>
      </section>
    </div>
  );
}
