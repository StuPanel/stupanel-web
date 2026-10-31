"use client";

/**
 * Team member "Work & pay" and "Setup" editors.
 *
 * Rate line = one price for (kind of work, unit, program type).
 *   rate      → work only (they use someone else's gear)
 *   withSetup → with their own gear (shoot roles only)
 *   workType  → "" = all programs, or a work type from Settings (e.g. Muslim wedding)
 * Setup item = a piece of gear they own + rent paid to them when someone else uses it.
 */
import { Aperture, Box, Briefcase, Camera, Film, Image as ImageIcon, Lightbulb, Mic, Navigation, Package, Plus, Trash2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tile, type TileColor } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";

export type RateLine = { id: string; roleId: string; unit: string; rate: string; withSetup: string; workType: string; label: string };
export type SetupItem = { id: string; category: string; name: string; rent: string; rentUnit: string };
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
export function RateEditor({ roles, lines, onChange, workTypes, fallback, emptyText }: {
  roles: RoleInfo[]; lines: RateLine[]; onChange: (lines: RateLine[]) => void; workTypes: { id: string; name: string }[];
  /** Studio prices — shown as grey hints in empty boxes. */
  fallback?: SavedRate[];
  emptyText?: string;
}) {
  const set = (id: string, p: Partial<RateLine>) => onChange(lines.map(l => l.id === id ? { ...l, ...p } : l));
  const remove = (id: string) => onChange(lines.filter(l => l.id !== id));
  function add(roleId: string) {
    const used = new Set(lines.filter(l => l.roleId === roleId && !l.workType).map(l => l.unit));
    const next = unitsFor(roleId).find(u => !used.has(u.v) && u.v !== "custom")?.v ?? "custom";
    onChange([...lines, { id: uid(), roleId, unit: next, rate: "", withSetup: "", workType: "", label: "" }]);
  }

  if (!roles.length) return <p className="px-4 py-4 text-sm text-[#A29DB3]">{emptyText ?? "Pick what they do first — then set a price for each."}</p>;

  return (
    <div className="divide-y divide-[#EEEBF4]">
      {roles.map(r => {
        const Icon = r.icon;
        const mine = lines.filter(l => l.roleId === r.id);
        const editor = isEditorRole(r.id);
        return (
          <div key={r.id} className="px-4 py-4">
            <div className="flex items-center gap-2.5 mb-3">
              <Tile icon={Icon} color={r.tile as TileColor} size={28} />
              <p className="flex-1 text-[15px] font-bold text-[#17151F]">{r.label}</p>
            </div>
            <div className="space-y-2.5">
              {mine.map(l => (
                <div key={l.id} className="rounded-[16px] bg-[#FAF9FC] border border-[#EEEBF4] p-3">
                  <div className="flex gap-2 items-center">
                    <select aria-label={`${r.label} — price unit`} value={l.unit} onChange={e => set(l.id, { unit: e.target.value })}
                      className={cn(inputCls, "h-10 text-sm pr-7 cursor-pointer min-w-0 flex-1 bg-white")}>
                      {unitsFor(r.id).map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                    </select>
                    <select aria-label={`${r.label} — for which programs`} value={l.workType} onChange={e => set(l.id, { workType: e.target.value })}
                      className={cn(inputCls, "h-10 text-sm pr-7 cursor-pointer min-w-0 flex-1 bg-white", l.workType && "bg-[#EEE8FD] text-[#5B3FD0] font-semibold")}>
                      <option value="">All programs</option>
                      {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      {l.workType && !workTypes.some(w => w.id === l.workType) && <option value={l.workType}>{l.workType}</option>}
                    </select>
                    <button type="button" onClick={() => remove(l.id)} aria-label="Remove this price"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {l.unit === "custom" && (
                    <input aria-label="Name of this price" value={l.label} onChange={e => set(l.id, { label: e.target.value })}
                      placeholder="Name it — e.g. Holud only, Same-day edit…" className={cn(inputCls, "h-10 text-sm mt-2 bg-white")} />
                  )}
                  <div className={cn("grid gap-2 mt-2", editor ? "grid-cols-1" : "grid-cols-2")}>
                    <Money label={editor ? `${r.label} price` : `${r.label} — work only`} title={editor ? "Price" : "Work only"} sub={editor ? undefined : "Uses someone else's gear"} value={l.rate} onChange={v => set(l.id, { rate: v })}
                      hint={studioPrice(fallback, l)?.rate} />
                    {!editor && <Money label={`${r.label} — with own setup`} title="With own setup" sub="Brings their own gear" value={l.withSetup} onChange={v => set(l.id, { withSetup: v })} accent
                      hint={studioPrice(fallback, l)?.withSetup} />}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => add(r.id)}
              className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[13px] font-semibold text-[#5B3FD0]">
              <Plus className="w-3.5 h-3.5" />Add a price
            </button>
          </div>
        );
      })}
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">৳</span>
        <input type="number" inputMode="numeric" min="0" step="100" aria-label={label} value={value} placeholder={hint != null ? `${hint} (studio)` : "0"}
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
const RENT_UNITS = [{ v: "per_shift", l: "per shift" }, { v: "per_day", l: "per day" }, { v: "per_program", l: "per program" }];

export function SetupEditor({ items, onChange }: { items: SetupItem[]; onChange: (items: SetupItem[]) => void }) {
  const set = (id: string, p: Partial<SetupItem>) => onChange(items.map(i => i.id === id ? { ...i, ...p } : i));
  const add = (category: string) => onChange([...items, { id: uid(), category, name: "", rent: "", rentUnit: "per_shift" }]);
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
                <div key={i.id} className="px-4 py-3 grid grid-cols-[1fr_36px] sm:grid-cols-[1fr_236px_36px] gap-2 items-center">
                  <input aria-label={`${c.l} — name`} value={i.name} onChange={e => set(i.id, { name: e.target.value })} placeholder={c.ph} className={cn(inputCls, "h-10 text-sm")} />
                  <button type="button" onClick={() => onChange(items.filter(x => x.id !== i.id))} aria-label="Remove"
                    className="sm:order-last w-9 h-9 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="col-span-2 sm:col-span-1 flex gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">৳</span>
                      <input type="number" inputMode="numeric" min="0" step="100" aria-label={`${i.name || c.l} — rent`} value={i.rent}
                        onChange={e => set(i.id, { rent: e.target.value })} placeholder="Rent" className={cn(inputCls, "h-10 pl-7 pr-2 text-sm tabular-nums")} />
                    </div>
                    <select aria-label="Rent per" value={i.rentUnit} onChange={e => set(i.id, { rentUnit: e.target.value })} className={cn(inputCls, "h-10 w-[124px] flex-shrink-0 text-sm pr-7 cursor-pointer")}>
                      {RENT_UNITS.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                    </select>
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
          The rent goes to this member when <strong>someone else</strong> works with their gear on a program. When they use it themselves, the &quot;With own setup&quot; price is used instead.
        </p>
      </section>
    </div>
  );
}
