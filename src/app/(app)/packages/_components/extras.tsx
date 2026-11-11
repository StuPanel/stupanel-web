"use client";

/**
 * Packages → Extras: paid add-ons on top of a package (extra photographer, drone, album…).
 * Picked in a quote with one tap; the price fills in. Saved in the service catalog.
 */
import { useState } from "react";
import { EyeOff, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { CARD_SHADOW, EmptyState, Tile } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { askConfirm, notify } from "@/components/feedback";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { currencyPad, currencySymbol, formatCurrency, getStudioCurrency } from "@/lib/format";
import { jumpToField } from "@/lib/jump-to-field";
import { EXTRA_CATEGORIES, EXTRA_IDEAS, EXTRA_UNITS, extraLook, unitLabel, type Extra } from "@/lib/extras";

export type Draft = { id: string | null; name: string; category: string; unit: string; price: string; description: string; isActive: boolean };
const blank = (): Draft => ({ id: null, name: "", category: "", unit: "day", price: "", description: "", isActive: true });

export function ExtrasList({ extras, all = extras, searching, loading, onAdd, onEdit }: {
  extras: Extra[]; all?: Extra[]; searching?: boolean; loading: boolean; onAdd: (d?: Partial<Draft>) => void; onEdit: (x: Extra) => void;
}) {
  const ideas = searching ? [] : EXTRA_IDEAS.filter(i => !all.some(x => x.name.trim().toLowerCase() === i.name.toLowerCase()));
  const ideaChips = ideas.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {ideas.map(i => {
        const L = extraLook(i.category);
        return (
          <button key={i.name} type="button" onClick={() => onAdd({ name: i.name, category: i.category, unit: i.unit, description: i.description ?? "" })}
            className="h-10 pl-1.5 pr-3.5 rounded-full bg-white hover:bg-[#F7F4FE] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-2 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
            <Tile icon={L.icon} color={L.color} size={28} />{i.name}<Plus className="w-3.5 h-3.5 text-[#5B3FD0]" />
          </button>
        );
      })}
    </div>
  );

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" aria-label="Loading" /></div>;
  if (!extras.length) return (
    <div className="space-y-4">
      <EmptyState icon={Sparkles} title="No extras yet" text="Things you sell on top of a package — an extra photographer, drone, album. Set the price once; in a quote they're one tap."
        action={<button type="button" onClick={() => onAdd()} className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />New extra</button>} />
      {ideaChips && <div><p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Quick start — tap one and set your price</p>{ideaChips}</div>}
    </div>
  );
  return (
    <div className="space-y-5">
      <div className={cn("bg-white rounded-[20px] divide-y divide-[#EEEBF4] overflow-hidden", CARD_SHADOW)}>
        {extras.map(x => {
          const L = extraLook(x.category);
          return (
            <button key={x.id} type="button" onClick={() => onEdit(x)} aria-label={`Edit ${x.name}`}
              className={cn("w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-[#F7F5FB]", !x.isActive && "opacity-60")}>
              <Tile icon={L.icon} color={L.color} size={36} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-[#17151F] truncate">{x.name}</span>
                  {!x.isActive && <span className="text-[11px] font-bold text-[#6B6680] bg-[#EEEDF2] px-1.5 py-0.5 rounded-full flex-shrink-0">Hidden</span>}
                </span>
                <span className="block text-[12.5px] text-[#6B6680] truncate">{[x.category, x.description].filter(Boolean).join(" · ") || "—"}</span>
              </span>
              <span className="text-right flex-shrink-0">
                <span className="block text-[15px] font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(x.defaultPrice), x.currency)}</span>
                <span className="block text-[12px] text-[#6B6680]">{unitLabel(x.unit)}</span>
              </span>
              <Pencil className="w-4 h-4 text-[#A29DB3] flex-shrink-0" />
            </button>
          );
        })}
      </div>
      {ideaChips && <div><p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">More ideas</p>{ideaChips}</div>}
    </div>
  );
}

/** Mount it with a key per opening, so each one starts from its own draft. */
export function ExtraDrawer({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF(p => ({ ...p, [k]: v }));
  const cur = getStudioCurrency();

  async function save() {
    if (!f.name.trim()) { setError("Give the extra a name."); jumpToField("name"); return; }
    const price = Number(f.price);
    if (f.price.trim() === "" || isNaN(price) || price < 0) { setError("Write the price."); jumpToField("price"); return; }
    setSaving(true); setError("");
    try {
      const body = { name: f.name.trim(), category: f.category || undefined, unit: f.unit, defaultPrice: price, description: f.description.trim(), isActive: f.isActive, ...(f.id ? {} : { currency: cur }) };
      const r = await apiFetch(f.id ? `${API}/service-catalog/${f.id}` : `${API}/service-catalog`, {
        method: f.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save."); return; }
      notify(f.id ? "Extra saved" : "Extra added");
      onSaved(); onClose();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!f.id) return;
    if (!(await askConfirm({ title: `Delete "${f.name}"?`, message: "It won't be offered in new quotes. Quotes and invoices that already have it don't change.", confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/service-catalog/${f.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't delete", { error: true }); return; }
    notify("Extra deleted"); onSaved(); onClose();
  }

  const chip = (on: boolean) => cn("h-9 px-3.5 rounded-full text-[13px] font-semibold transition-colors", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]");
  return (
    <FormDrawer open onClose={onClose} icon={Sparkles} color="violet" title={f.id ? "Edit extra" : "New extra"} sub="Sold on top of a package"
      footer={<>
        {f.id && <button type="button" onClick={remove} aria-label="Delete extra" className="w-11 h-11 rounded-full bg-[#FDECEF] text-[#C2304F] inline-flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
        <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-sm font-semibold">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="flex-1 h-11 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{f.id ? "Save changes" : "Add extra"}
        </button>
      </>}>
      {error && <p role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-sm">{error}</p>}
      <FormGroup>
        <Field label="Name" required name="name">{id => <input id={id} value={f.name} maxLength={255} onChange={e => set("name", e.target.value)} placeholder="e.g. Drone" className={inputCls} />}</Field>
        <div className="grid grid-cols-[1fr_150px]">
          <Field label="Price" required name="price">{id => (
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{currencySymbol(cur).trim()}</span>
              <input id={id} inputMode="decimal" value={f.price} onChange={e => set("price", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" className={inputCls} style={{ paddingLeft: currencyPad(cur) }} />
            </div>
          )}</Field>
          <Field label="Counted">{id => (
            <select id={id} value={f.unit} onChange={e => set("unit", e.target.value)} className={cn(inputCls, "cursor-pointer px-2.5")}>
              {EXTRA_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              {!EXTRA_UNITS.some(u => u.id === f.unit) && <option value={f.unit}>{unitLabel(f.unit)}</option>}
            </select>
          )}</Field>
        </div>
      </FormGroup>
      <FormGroup title="Kind" note={f.unit === "day" ? "Per day: in a quote you pick the days, and the price counts each one." : undefined}>
        <div className="p-4 flex flex-wrap gap-2">
          {EXTRA_CATEGORIES.map(c => <button key={c} type="button" aria-pressed={f.category === c} onClick={() => set("category", f.category === c ? "" : c)} className={chip(f.category === c)}>{c}</button>)}
        </div>
      </FormGroup>
      <FormGroup>
        <Field label="What the client gets (optional)">{id => <textarea id={id} rows={2} value={f.description} onChange={e => set("description", e.target.value)} placeholder="e.g. Aerial photos and video of the venue" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}</Field>
        <SwitchRow label="Offer it" hint="Shows in quotes. Off = hidden there." on={f.isActive} onChange={v => set("isActive", v)} />
      </FormGroup>
      {!f.isActive && <p className="px-1 text-[12.5px] text-[#6B6680] flex items-center gap-1.5"><EyeOff className="w-3.5 h-3.5" />Hidden extras stay on old quotes.</p>}
    </FormDrawer>
  );
}

export const draftOf = (x?: Extra | null, seed?: Partial<Draft>): Draft => x
  ? { id: x.id, name: x.name, category: x.category ?? "", unit: x.unit || "service", price: String(Number(x.defaultPrice)), description: x.description ?? "", isActive: x.isActive }
  : { ...blank(), ...seed };

export async function loadExtras(): Promise<Extra[]> {
  const r = await apiFetch(`${API}/service-catalog`);
  if (!r.ok) return [];
  const d = await r.json().catch(() => []);
  return Array.isArray(d) ? d : (d?.data ?? []);
}
