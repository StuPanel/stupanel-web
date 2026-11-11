"use client";

/**
 * Packages — ready-made offers a studio sells (e.g. "Wedding Premium").
 * A package follows the studio's own setup: its days are the parts of a Program type
 * (Settings → Program types), its team uses the studio's roles (incl. custom ones).
 * Picking a package in a program fills price, type and days; in a quote it fills the first line.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Package as HeaderIcon, Plus, Edit3, Trash2, Loader2, Package, CheckCircle2, Eye, EyeOff, Search, X } from "lucide-react";
import { CARD_SHADOW, EmptyState, MainButton, PageHeader, RowsSkeleton, SearchField, Tile } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { askConfirm, notify } from "@/components/feedback";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CURRENCY_OPTIONS, currencySymbol, formatCurrency, getStudioCurrency } from "@/lib/format";
import { matches } from "@/components/list-ui";
import { TEAM_ROLES } from "../team/_components/rate-card";

interface StaffingLine { role: string; level?: string; count: number; }

interface Pkg {
  id: string; name: string; description?: string; category?: string;
  basePrice: number; currency: string; priceIsNegotiable: boolean;
  durationHours?: number; durationDays?: number; durationUnit?: "hours" | "days";
  deliveryDays?: number; deliverablesDescription?: string;
  eventTypesIncluded?: string[]; staffing?: StaffingLine[];
  photoEditCount?: number; trailerCount?: number; fullVideoCount?: number;
  ritualsIncluded?: string[]; deliveryMethod?: string;
  isActive: boolean; isVisibleInPortal: boolean; sortOrder: number;
}

type WorkType = { id: string; name: string; active: boolean; events: { id: string; name: string }[] };

const DELIVERY_METHODS = [
  { value: "google_drive", label: "Online (Google Drive)" },
  { value: "pendrive", label: "USB drive" },
  { value: "both", label: "Online + USB drive" },
  { value: "other", label: "Other" },
];
const DELIVERY_LABELS: Record<string, string> = Object.fromEntries(DELIVERY_METHODS.map(d => [d.value, d.value === "other" ? "Custom delivery" : d.label]));

/** Old packages saved day keys like "pre_wedding"; show them readable. */
const dayLabel = (v: string) => (/^[a-z_]+$/.test(v) ? v.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ") : v);
const roleLabel = (r: string) => TEAM_ROLES.find(x => x.id === r)?.label ?? r;
/** Levels were dropped (the team has none); old ones still show. */
const LEVEL_LABELS: Record<string, string> = { junior: "Junior", associate: "Associate", senior: "Senior", lead: "Lead", top_senior: "Top Senior" };

/** "What you get" lines — shared by the card and the drawer preview. */
function summaryLines(p: Partial<Pkg>): string[] {
  const lines: string[] = [];
  (p.staffing ?? []).forEach(s => {
    const level = s.level ? `${LEVEL_LABELS[s.level] ?? s.level} ` : "";
    lines.push(`${s.count} ${level}${roleLabel(s.role)}${s.count > 1 ? "s" : ""}`);
  });
  if (p.durationUnit === "days" && p.durationDays) lines.push(`${p.durationDays} day${p.durationDays > 1 ? "s" : ""} coverage`);
  else if (p.durationHours) lines.push(`${p.durationHours} hours coverage`);
  if (p.photoEditCount) lines.push(`${p.photoEditCount} edited photo${p.photoEditCount > 1 ? "s" : ""}`);
  if (p.trailerCount || p.fullVideoCount) {
    lines.push([
      p.trailerCount ? `${p.trailerCount} trailer${p.trailerCount > 1 ? "s" : ""}` : null,
      p.fullVideoCount ? `${p.fullVideoCount} full video${p.fullVideoCount > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" + "));
  }
  if (p.ritualsIncluded?.length) lines.push(`Also: ${p.ritualsIncluded.join(", ")}`);
  if (p.deliveryMethod) lines.push(`Delivered via ${DELIVERY_LABELS[p.deliveryMethod] ?? p.deliveryMethod}`);
  return lines;
}

type Form = {
  name: string; description: string; category: string; basePrice: string; currency: string; priceIsNegotiable: boolean;
  durationUnit: "hours" | "days"; durationHours: string; durationDays: string; deliveryDays: string;
  days: string[]; staffing: StaffingLine[]; photoEditCount: string; trailerCount: string; fullVideoCount: string;
  extras: string[]; deliveryMethod: string; note: string; isActive: boolean; isVisibleInPortal: boolean;
};
const num = (v: string) => (v.trim() === "" ? null : Number(v));
const str = (v: number | undefined | null) => (v == null ? "" : String(v));

// ─── Drawer ───────────────────────────────────────────────────────────────────
function PackageDrawer({ open, onClose, onSaved, editing, workTypes, customRoles }: {
  open: boolean; onClose: () => void; onSaved: () => void; editing?: Pkg | null;
  workTypes: WorkType[]; customRoles: string[];
}) {
  const isEdit = !!editing;
  const blank = (): Form => ({
    name: "", description: "", category: "", basePrice: "", currency: getStudioCurrency(), priceIsNegotiable: true,
    durationUnit: "hours", durationHours: "", durationDays: "", deliveryDays: "",
    days: [], staffing: [], photoEditCount: "", trailerCount: "", fullVideoCount: "",
    extras: [], deliveryMethod: "", note: "", isActive: true, isVisibleInPortal: false,
  });
  const [f, setF] = useState<Form>(blank);
  const [newDay, setNewDay] = useState("");
  const [newExtra, setNewExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(""); setNewDay(""); setNewExtra("");
    setF(editing ? {
      name: editing.name, description: editing.description ?? "", category: editing.category ?? "",
      basePrice: str(editing.basePrice), currency: editing.currency || getStudioCurrency(), priceIsNegotiable: editing.priceIsNegotiable,
      durationUnit: editing.durationUnit ?? "hours", durationHours: str(editing.durationHours), durationDays: str(editing.durationDays),
      deliveryDays: str(editing.deliveryDays), days: (editing.eventTypesIncluded ?? []).map(dayLabel),
      staffing: editing.staffing ?? [], photoEditCount: str(editing.photoEditCount), trailerCount: str(editing.trailerCount),
      fullVideoCount: str(editing.fullVideoCount), extras: editing.ritualsIncluded ?? [], deliveryMethod: editing.deliveryMethod ?? "",
      note: (editing.staffing?.length ? "" : editing.deliverablesDescription) ?? "",
      isActive: editing.isActive, isVisibleInPortal: editing.isVisibleInPortal,
    } : blank());
  }, [open, editing]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));
  const type = workTypes.find(w => w.name.toLowerCase() === f.category.trim().toLowerCase());
  const typeParts = type ? (type.events.length ? type.events.map(e => e.name) : [type.name]) : [];
  const roles = [...TEAM_ROLES.map(r => ({ id: r.id, label: r.label })), ...customRoles.filter(c => !TEAM_ROLES.some(r => r.id === c)).map(c => ({ id: c, label: c }))];

  function pickType(name: string) {
    const w = workTypes.find(x => x.name === name);
    const parts = w ? (w.events.length ? w.events.map(e => e.name) : [w.name]) : [];
    // A new type brings its parts as the package's days (keep any extra day the studio typed)
    setF(p => ({ ...p, category: name, days: name ? [...new Set([...parts, ...p.days.filter(d => !typeParts.includes(d))])] : p.days }));
  }
  const toggleDay = (d: string) => set("days", f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d]);
  function addTo(k: "days" | "extras", v: string) {
    const t = v.trim();
    if (!t || f[k].some(x => x.toLowerCase() === t.toLowerCase())) return;
    set(k, [...f[k], t]);
  }

  async function save() {
    if (!f.name.trim()) { setError("Give the package a name."); return; }
    for (const [k, label] of [["basePrice", "Price"], ["deliveryDays", "Delivery days"], ["durationHours", "Hours"], ["durationDays", "Days"], ["photoEditCount", "Edited photos"], ["trailerCount", "Trailers"], ["fullVideoCount", "Full videos"]] as const) {
      const v = f[k] as string;
      if (v.trim() && (isNaN(Number(v)) || Number(v) < 0)) { setError(`${label} should be a number.`); return; }
    }
    // A day / extra still in its box counts too — no need to press Add first
    const withTyped = (list: string[], typed: string) => {
      const t = typed.trim();
      return t && !list.some(x => x.toLowerCase() === t.toLowerCase()) ? [...list, t] : list;
    };
    const days = withTyped(f.days, newDay), extras = withTyped(f.extras, newExtra);
    setSaving(true); setError("");
    // Send every field (null / [] clears it) so an edit can remove things too
    const body = {
      name: f.name.trim(), description: f.description.trim() || null, category: f.category.trim() || null,
      basePrice: num(f.basePrice) ?? 0, currency: f.currency, priceIsNegotiable: f.priceIsNegotiable,
      durationUnit: f.durationUnit,
      durationHours: f.durationUnit === "hours" ? num(f.durationHours) : null,
      durationDays: f.durationUnit === "days" && num(f.durationDays) != null ? Math.round(num(f.durationDays)!) : null,
      deliveryDays: num(f.deliveryDays) == null ? null : Math.round(num(f.deliveryDays)!),
      eventTypesIncluded: days, staffing: f.staffing.map(s => ({ role: s.role, count: s.count, ...(s.level ? { level: s.level } : {}) })),
      photoEditCount: num(f.photoEditCount) == null ? null : Math.round(num(f.photoEditCount)!),
      trailerCount: num(f.trailerCount) == null ? null : Math.round(num(f.trailerCount)!),
      fullVideoCount: num(f.fullVideoCount) == null ? null : Math.round(num(f.fullVideoCount)!),
      ritualsIncluded: extras, deliveryMethod: f.deliveryMethod || null,
      deliverablesDescription: f.note.trim() || null,
      isActive: f.isActive, isVisibleInPortal: f.isVisibleInPortal,
    };
    try {
      const r = await apiFetch(isEdit ? `${API}/packages/${editing!.id}` : `${API}/packages`, {
        method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save."); return; }
      notify(isEdit ? "Saved" : "Package added");
      onSaved(); onClose();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSaving(false); }
  }

  const sym = currencySymbol(f.currency).trim();
  const chip = (on: boolean) => cn("inline-flex items-center gap-1 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-colors",
    on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]");
  const smallIn = "w-full h-10 px-3 rounded-[10px] bg-[#F5F3FA] text-[15px] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF]";
  const preview = summaryLines({
    staffing: f.staffing, durationUnit: f.durationUnit, durationHours: num(f.durationHours) ?? undefined, durationDays: num(f.durationDays) ?? undefined,
    photoEditCount: num(f.photoEditCount) ?? undefined, trailerCount: num(f.trailerCount) ?? undefined, fullVideoCount: num(f.fullVideoCount) ?? undefined,
    ritualsIncluded: f.extras, deliveryMethod: f.deliveryMethod,
  });

  return (
    <FormDrawer open={open} onClose={onClose} icon={Package} color="violet" title={isEdit ? "Edit package" : "New package"} sub={isEdit ? editing!.name : "A ready-made offer for programs and quotes"}
      footer={<>
        <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-sm font-semibold">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
          className="flex-1 h-11 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{isEdit ? "Save changes" : "Add package"}
        </button>
      </>}>
      {error && <p role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-sm">{error}</p>}

      <FormGroup>
        <Field label="Name" required>{id => <input id={id} value={f.name} maxLength={255} onChange={e => set("name", e.target.value)} placeholder="e.g. Wedding Premium" className={inputCls} />}</Field>
        <Field label="Program type" hint={workTypes.length ? "Its parts become the days of this package. Set types in Settings → Program types." : "Add program types in Settings → Program types to fill days by type."}>
          {id => (
            <select id={id} value={type ? type.name : f.category} onChange={e => pickType(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
              <option value="">No type</option>
              {workTypes.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
              {f.category && !type && <option value={f.category}>{f.category}</option>}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_130px]">
          <Field label="Price">{id => (
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{sym}</span>
              <input id={id} inputMode="decimal" value={f.basePrice} onChange={e => set("basePrice", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0"
                className={inputCls} style={{ paddingLeft: sym.length > 1 ? "3.25rem" : "2rem" }} />
            </div>
          )}</Field>
          <Field label="Currency">{id => (
            <select id={id} value={f.currency} onChange={e => set("currency", e.target.value)} className={cn(inputCls, "cursor-pointer px-2.5")}>
              {CURRENCY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          )}</Field>
        </div>
        <SwitchRow label="Price can change" hint="Shows “negotiable” next to the price" on={f.priceIsNegotiable} onChange={v => set("priceIsNegotiable", v)} />
      </FormGroup>

      <FormGroup title="Days included" note="When you pick this package in a program, these days are added to it.">
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {[...new Set([...typeParts, ...f.days])].map(d => (
              <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={f.days.includes(d)} className={chip(f.days.includes(d))}>
                {d}{!typeParts.includes(d) && f.days.includes(d) && <X className="w-3 h-3" />}
              </button>
            ))}
            {!typeParts.length && !f.days.length && <p className="text-[13px] text-[#6B6680]">No days yet — pick a program type or add a day.</p>}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); addTo("days", newDay); setNewDay(""); }}>
            <input value={newDay} onChange={e => setNewDay(e.target.value)} maxLength={60} placeholder="Add a day, e.g. Reception" aria-label="New day" className={smallIn} />
            <button type="submit" disabled={!newDay.trim()} className="h-10 px-4 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold disabled:opacity-50">Add</button>
          </form>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3 px-4 py-3.5">
          <div>
            <p className="text-[13px] font-semibold text-[#4A4658] mb-1.5">Coverage</p>
            <input inputMode="decimal" aria-label={f.durationUnit === "days" ? "Coverage in days" : "Coverage in hours"}
              value={f.durationUnit === "days" ? f.durationDays : f.durationHours}
              onChange={e => set(f.durationUnit === "days" ? "durationDays" : "durationHours", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={f.durationUnit === "days" ? "e.g. 2" : "e.g. 8"} className={inputCls} />
          </div>
          <div role="radiogroup" aria-label="Coverage unit" className="flex h-11 p-1 rounded-full bg-[#F5F3FA]">
            {(["hours", "days"] as const).map(u => (
              <button key={u} type="button" role="radio" aria-checked={f.durationUnit === u} onClick={() => set("durationUnit", u)}
                className={cn("px-3.5 rounded-full text-[13px] font-semibold capitalize", f.durationUnit === u ? "bg-white text-[#17151F] shadow-sm" : "text-[#6B6680]")}>{u}</button>
            ))}
          </div>
        </div>
      </FormGroup>

      <FormGroup title="Team" note="Roles come from your team (incl. your own roles).">
        <div className="p-4 space-y-2">
          {f.staffing.length === 0 && <p className="text-[13px] text-[#6B6680]">Who goes to the shoot? e.g. 2 Photographers, 1 Cinematographer.</p>}
          {f.staffing.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input inputMode="numeric" aria-label={`How many ${roleLabel(s.role)}`} value={String(s.count)}
                onChange={e => set("staffing", f.staffing.map((x, j) => j === i ? { ...x, count: Math.max(1, Math.min(99, parseInt(e.target.value.replace(/\D/g, "")) || 1)) } : x))}
                className={cn(smallIn, "w-14 text-center")} />
              <select aria-label="Role" value={s.role} onChange={e => set("staffing", f.staffing.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} className={cn(smallIn, "flex-1 cursor-pointer")}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                {!roles.some(r => r.id === s.role) && <option value={s.role}>{s.role}</option>}
              </select>
              {s.level && <span className="text-[12px] text-[#6B6680]">{LEVEL_LABELS[s.level] ?? s.level}</span>}
              <button type="button" onClick={() => set("staffing", f.staffing.filter((_, j) => j !== i))} aria-label={`Remove ${roleLabel(s.role)}`}
                className="w-9 h-9 rounded-full text-[#C2304F] hover:bg-[#FDECEF] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => set("staffing", [...f.staffing, { role: f.staffing.some(s => s.role === "photographer") ? "cinematographer" : "photographer", count: 1 }])}
            className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#EEE8FD]">
            <Plus className="w-4 h-4" />Add role
          </button>
        </div>
      </FormGroup>

      <FormGroup title="What the client gets">
        <div className="grid grid-cols-3">
          <Field label="Edited photos">{id => <input id={id} inputMode="numeric" value={f.photoEditCount} onChange={e => set("photoEditCount", e.target.value.replace(/\D/g, ""))} placeholder="0" className={inputCls} />}</Field>
          <Field label="Trailers">{id => <input id={id} inputMode="numeric" value={f.trailerCount} onChange={e => set("trailerCount", e.target.value.replace(/\D/g, ""))} placeholder="0" className={inputCls} />}</Field>
          <Field label="Full videos">{id => <input id={id} inputMode="numeric" value={f.fullVideoCount} onChange={e => set("fullVideoCount", e.target.value.replace(/\D/g, ""))} placeholder="0" className={inputCls} />}</Field>
        </div>
        <div className="grid grid-cols-2">
          <Field label="Delivery in (days)">{id => <input id={id} inputMode="numeric" value={f.deliveryDays} onChange={e => set("deliveryDays", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 30" className={inputCls} />}</Field>
          <Field label="Delivered via">{id => (
            <select id={id} value={f.deliveryMethod} onChange={e => set("deliveryMethod", e.target.value)} className={cn(inputCls, "cursor-pointer")}>
              <option value="">—</option>
              {DELIVERY_METHODS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              {f.deliveryMethod && !DELIVERY_METHODS.some(d => d.value === f.deliveryMethod) && <option value={f.deliveryMethod}>{f.deliveryMethod}</option>}
            </select>
          )}</Field>
        </div>
        <div className="p-4">
          <p className="text-[13px] font-semibold text-[#4A4658] mb-1.5">Also included</p>
          {f.extras.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {f.extras.map(x => (
                <button key={x} type="button" onClick={() => set("extras", f.extras.filter(y => y !== x))} aria-label={`Remove ${x}`} className={chip(true)}>{x}<X className="w-3 h-3" /></button>
              ))}
            </div>
          )}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); addTo("extras", newExtra); setNewExtra(""); }}>
            <input value={newExtra} onChange={e => setNewExtra(e.target.value)} maxLength={80} placeholder="e.g. Drone shots, Photo album, Same-day edit" aria-label="Also included" className={smallIn} />
            <button type="submit" disabled={!newExtra.trim()} className="h-10 px-4 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold disabled:opacity-50">Add</button>
          </form>
        </div>
      </FormGroup>

      {preview.length > 0 && (
        <FormGroup title="Preview" note="Quotes copy these lines as the package's description.">
          <div className="p-4">
            <p className="font-bold text-[#17151F]">{f.name || "Package name"}</p>
            <p className="text-[#17151F] font-extrabold mt-0.5">{formatCurrency(num(f.basePrice) ?? 0, f.currency)}{f.priceIsNegotiable && <span className="ml-1.5 text-xs font-semibold text-[#6B6680]">negotiable</span>}</p>
            {f.days.length > 0 && <p className="text-[13px] text-[#5B3FD0] font-semibold mt-1.5">{f.days.join(" · ")}</p>}
            <ul className="mt-2 space-y-1">
              {preview.map((l, i) => <li key={i} className="text-sm text-[#17151F] flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F8A5B] mt-0.5 flex-shrink-0" />{l}</li>)}
            </ul>
          </div>
        </FormGroup>
      )}

      <FormGroup title="Notes">
        <Field label="Description (optional)">{id => <textarea id={id} value={f.description} rows={2} onChange={e => set("description", e.target.value)} placeholder="Anything to say about this package" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}</Field>
        {f.staffing.length === 0 && (
          <Field label="What's included (short text)" hint="Used when no team is set above — quotes copy it as the description.">
            {id => <textarea id={id} value={f.note} rows={2} onChange={e => set("note", e.target.value)} placeholder="e.g. 1 photographer, 200 edited photos" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}
          </Field>
        )}
      </FormGroup>

      <FormGroup>
        <SwitchRow label="Offer it" hint="Shows when you add a program or a quote. Off = hidden there." on={f.isActive} onChange={v => set("isActive", v)} />
        <SwitchRow label="Show on your website" hint="Coming soon — for the studio website" on={f.isVisibleInPortal} onChange={v => set("isVisibleInPortal", v)} />
      </FormGroup>
    </FormDrawer>
  );
}

// ─── Package Card ─────────────────────────────────────────────────────────────
function PackageCard({ pkg, onEdit, onDelete, onToggle }: {
  pkg: Pkg; onEdit: (p: Pkg) => void; onDelete: (p: Pkg) => void; onToggle: (p: Pkg) => void;
}) {
  const lines = summaryLines(pkg);
  const duration = pkg.durationUnit === "days" && pkg.durationDays ? `${pkg.durationDays} day${pkg.durationDays > 1 ? "s" : ""}` : pkg.durationHours ? `${pkg.durationHours} hours` : null;
  return (
    <div className={cn("bg-white rounded-[20px] flex flex-col overflow-hidden transition-transform hover:-translate-y-0.5", CARD_SHADOW, !pkg.isActive && "opacity-60")}>
      <button onClick={() => onEdit(pkg)} className="text-left p-5 flex-1 flex flex-col justify-start items-stretch">
        <div className="flex items-start gap-3">
          <Tile icon={Package} color="violet" size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[#17151F] truncate">{pkg.name}</p>
            <p className="text-xs text-[#6B6680] mt-0.5 flex items-center gap-1.5 flex-wrap">
              {pkg.category && <span>{pkg.category}</span>}
              {!pkg.isActive && <span className="font-bold text-[#6B6680] bg-[#EEEDF2] px-1.5 py-0.5 rounded-full">Hidden</span>}
            </p>
          </div>
        </div>
        <p className="mt-4 text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums leading-none">
          {formatCurrency(Number(pkg.basePrice), pkg.currency)}
          {pkg.priceIsNegotiable && <span className="ml-2 text-xs font-semibold text-[#6B6680] tracking-normal">negotiable</span>}
        </p>
        <p className="mt-1.5 text-xs text-[#6B6680]">
          {[duration, pkg.deliveryDays ? `delivery in ${pkg.deliveryDays} days` : null].filter(Boolean).join(" · ") || " "}
        </p>
        {pkg.description && <p className="mt-3 text-sm text-[#4A4658] leading-relaxed line-clamp-2">{pkg.description}</p>}
        {pkg.eventTypesIncluded && pkg.eventTypesIncluded.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {pkg.eventTypesIncluded.map(v => (
              <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] font-semibold">{dayLabel(v)}</span>
            ))}
          </div>
        )}
        {lines.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {lines.map((line, i) => (
              <li key={i} className="text-sm text-[#17151F] flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F8A5B] mt-0.5 flex-shrink-0" />{line}</li>
            ))}
          </ul>
        ) : pkg.deliverablesDescription ? <p className="mt-3 text-sm text-[#4A4658]">{pkg.deliverablesDescription}</p> : null}
      </button>
      <div className="flex border-t border-[#EEEBF4] divide-x divide-[#EEEBF4]">
        <button onClick={() => onEdit(pkg)} className="flex-1 h-11 text-sm font-semibold text-[#5B3FD0] hover:bg-[#F7F4FE] inline-flex items-center justify-center gap-1.5"><Edit3 className="w-4 h-4" />Edit</button>
        <button onClick={() => onToggle(pkg)} className="flex-1 h-11 text-sm font-semibold text-[#4A4658] hover:bg-[#F7F5FB] inline-flex items-center justify-center gap-1.5">
          {pkg.isActive ? <><EyeOff className="w-4 h-4" />Hide</> : <><Eye className="w-4 h-4" />Offer again</>}
        </button>
        <button onClick={() => onDelete(pkg)} aria-label={`Delete ${pkg.name}`} className="w-14 h-11 text-[#C2304F] hover:bg-[#FDECEF] inline-flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PackagesPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Pkg | null>(null);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/packages`);
      if (res.ok) setPackages(await res.json());
    } catch { /* keep the old list */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchPackages();
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null))
      .then(d => d && setWorkTypes((d.workTypes ?? []).filter((w: WorkType) => w.active))).catch(() => {});
    apiFetch(`${API}/team/custom-roles`).then(r => (r.ok ? r.json() : [])).then(d => setCustomRoles(Array.isArray(d) ? d : [])).catch(() => {});
  }, [fetchPackages]);

  async function toggle(pkg: Pkg) {
    const r = await apiFetch(`${API}/packages/${pkg.id}/toggle`, { method: "PATCH" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't change it", { error: true }); return; }
    notify(pkg.isActive ? `${pkg.name} hidden from programs and quotes` : `${pkg.name} offered again`);
    fetchPackages();
  }

  async function remove(pkg: Pkg) {
    if (!(await askConfirm({ title: `Delete "${pkg.name}"?`, message: "It won't be offered any more. Programs and quotes that already use it keep their price and details.", confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/packages/${pkg.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't delete", { error: true }); return; }
    notify("Package deleted");
    fetchPackages();
  }

  const shown = useMemo(() => packages.filter(p => matches(q, p.name, p.category, p.description)), [packages, q]);
  const openNew = () => { setEditTarget(null); setDrawer(true); };

  return (
    <div className="space-y-4">
      <PageHeader icon={HeaderIcon} color="violet" title="Packages" sub={<>{packages.length} package{packages.length === 1 ? "" : "s"} you offer</>}>
        {packages.length > 0 && <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={q} onChange={setQ} placeholder="Search packages" />}
        <MainButton icon={Plus} onClick={openNew}>New package</MainButton>
      </PageHeader>

      {loading ? (
        <RowsSkeleton n={4} />
      ) : packages.length === 0 ? (
        <EmptyState icon={Package} title="No packages yet" text="Make ready-made packages — pick one when you add a program or a quote and its price and days fill in."
          action={<MainButton icon={Plus} onClick={openNew}>New package</MainButton>} />
      ) : shown.length === 0 ? (
        <EmptyState icon={Search} title={`No packages match "${q}"`} text="Try another name." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {shown.map(p => <PackageCard key={p.id} pkg={p} onEdit={x => { setEditTarget(x); setDrawer(true); }} onDelete={remove} onToggle={toggle} />)}
        </div>
      )}

      <PackageDrawer open={drawer} onClose={() => { setDrawer(false); setEditTarget(null); }} onSaved={fetchPackages} editing={editTarget}
        workTypes={workTypes} customRoles={customRoles} />
    </div>
  );
}
