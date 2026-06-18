"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit3, Trash2, Loader2, X, AlertTriangle, Package, CheckCircle2, Eye, EyeOff, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";


interface StaffingLine { role: string; level: string; count: number; }

interface Pkg {
  id: string; name: string; description?: string; category?: string;
  basePrice: number; currency: string; priceIsNegotiable: boolean;
  durationHours?: number; deliveryDays?: number; deliverablesDescription?: string;
  eventTypesIncluded?: string[]; staffing?: StaffingLine[];
  photoEditCount?: number; trailerCount?: number; fullVideoCount?: number;
  ritualsIncluded?: string[]; deliveryMethod?: string;
  isActive: boolean; isVisibleInPortal: boolean; sortOrder: number;
}

const CATEGORIES = ["Wedding", "Portrait", "Corporate", "Video", "Birthday", "Maternity", "Event", "Other"];

const EVENT_TYPES = [
  { value: "holud", label: "Holud" },
  { value: "mehndi", label: "Mehndi" },
  { value: "wedding", label: "Wedding" },
  { value: "reception", label: "Reception" },
  { value: "engagement", label: "Engagement" },
  { value: "pre_wedding", label: "Pre-Wedding" },
  { value: "other", label: "Other" },
];
const ROLES = [
  { value: "photographer", label: "Photographer" },
  { value: "cinematographer", label: "Cinematographer" },
];
const LEVELS = [
  { value: "junior", label: "Junior" },
  { value: "associate", label: "Associate" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "top_senior", label: "Top Senior" },
];
const RITUAL_PRESETS = ["Dodhi Mangal", "Ghot Purano", "Briddhi", "Bashi Biye", "Bodhu Boron"];
const DELIVERY_METHODS = [
  { value: "pendrive", label: "Pendrive" },
  { value: "google_drive", label: "Google Drive" },
  { value: "both", label: "Pendrive & Google Drive" },
  { value: "other", label: "Other" },
];

const LEVEL_LABELS: Record<string, string> = { junior: "Junior", associate: "Associate", senior: "Senior", lead: "Lead", top_senior: "Top Senior" };
const ROLE_LABELS: Record<string, string> = { photographer: "Photographer", cinematographer: "Cinematographer" };
const DELIVERY_LABELS: Record<string, string> = { pendrive: "Pendrive", google_drive: "Google Drive", both: "Pendrive & Google Drive", other: "Custom delivery" };

// Renders structured package fields (staffing, deliverables) as bullet lines — shared by the card and the drawer's live preview.
function summaryLines(p: {
  staffing?: StaffingLine[]; durationHours?: number;
  photoEditCount?: number; trailerCount?: number; fullVideoCount?: number;
  ritualsIncluded?: string[]; deliveryMethod?: string;
}): string[] {
  const lines: string[] = [];
  (p.staffing ?? []).forEach(s => {
    const role = ROLE_LABELS[s.role] ?? s.role;
    lines.push(`${s.count} ${LEVEL_LABELS[s.level] ?? s.level} ${role}${s.count > 1 ? "s" : ""}`);
  });
  if (p.durationHours) lines.push(`${p.durationHours} Hours Coverage`);
  if (p.photoEditCount) lines.push(`${p.photoEditCount} Photo${p.photoEditCount > 1 ? "s" : ""} Edited`);
  if (p.trailerCount || p.fullVideoCount) {
    lines.push([
      p.trailerCount ? `${p.trailerCount} Trailer${p.trailerCount > 1 ? "s" : ""}` : null,
      p.fullVideoCount ? `${p.fullVideoCount} Full Video${p.fullVideoCount > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" + "));
  }
  if (p.ritualsIncluded?.length) lines.push(`Rituals: ${p.ritualsIncluded.join(", ")}`);
  if (p.deliveryMethod) lines.push(`Delivered via ${DELIVERY_LABELS[p.deliveryMethod] ?? p.deliveryMethod}`);
  return lines;
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function PackageDrawer({ open, onClose, onSaved, editing }: {
  open: boolean; onClose: () => void; onSaved: () => void; editing?: Pkg | null;
}) {
  const isEdit = !!editing;
  const blank: {
    name: string; description: string; category: string; basePrice: string; currency: string;
    priceIsNegotiable: boolean; durationHours: string; deliveryDays: string;
    deliverablesDescription: string; isActive: boolean; isVisibleInPortal: boolean;
    eventTypesIncluded: string[]; staffing: StaffingLine[];
    photoEditCount: string; trailerCount: string; fullVideoCount: string;
    ritualsIncluded: string[]; deliveryMethod: string;
  } = {
    name: "", description: "", category: "", basePrice: "", currency: "BDT",
    priceIsNegotiable: true, durationHours: "", deliveryDays: "",
    deliverablesDescription: "", isActive: true, isVisibleInPortal: false,
    eventTypesIncluded: [], staffing: [],
    photoEditCount: "", trailerCount: "", fullVideoCount: "",
    ritualsIncluded: [], deliveryMethod: "",
  };
  const [form, setForm] = useState(blank);
  const [customRitual, setCustomRitual] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      if (editing) {
        setForm({
          name: editing.name, description: editing.description ?? "",
          category: editing.category ?? "", basePrice: String(editing.basePrice),
          currency: editing.currency, priceIsNegotiable: editing.priceIsNegotiable,
          durationHours: editing.durationHours ? String(editing.durationHours) : "",
          deliveryDays: editing.deliveryDays ? String(editing.deliveryDays) : "",
          deliverablesDescription: editing.deliverablesDescription ?? "",
          isActive: editing.isActive, isVisibleInPortal: editing.isVisibleInPortal,
          eventTypesIncluded: editing.eventTypesIncluded ?? [],
          staffing: editing.staffing ?? [],
          photoEditCount: editing.photoEditCount ? String(editing.photoEditCount) : "",
          trailerCount: editing.trailerCount ? String(editing.trailerCount) : "",
          fullVideoCount: editing.fullVideoCount ? String(editing.fullVideoCount) : "",
          ritualsIncluded: editing.ritualsIncluded ?? [],
          deliveryMethod: editing.deliveryMethod ?? "",
        });
      } else {
        setForm(blank);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  function toggleEventType(v: string) {
    setForm(prev => ({
      ...prev,
      eventTypesIncluded: prev.eventTypesIncluded.includes(v)
        ? prev.eventTypesIncluded.filter(x => x !== v)
        : [...prev.eventTypesIncluded, v],
    }));
  }
  function toggleRitual(v: string) {
    setForm(prev => ({
      ...prev,
      ritualsIncluded: prev.ritualsIncluded.includes(v)
        ? prev.ritualsIncluded.filter(x => x !== v)
        : [...prev.ritualsIncluded, v],
    }));
  }
  function addCustomRitual(v: string) {
    const t = v.trim();
    if (!t || form.ritualsIncluded.includes(t)) return;
    setForm(prev => ({ ...prev, ritualsIncluded: [...prev.ritualsIncluded, t] }));
  }
  function addStaffingRow() {
    setForm(prev => ({ ...prev, staffing: [...prev.staffing, { role: "photographer", level: "junior", count: 1 }] }));
  }
  function updateStaffingRow(idx: number, patch: Partial<StaffingLine>) {
    setForm(prev => ({ ...prev, staffing: prev.staffing.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  }
  function removeStaffingRow(idx: number) {
    setForm(prev => ({ ...prev, staffing: prev.staffing.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Package name is required."); return; }
    setError(""); setLoading(true);
    const body = {
      name: form.name.trim(),
      description: form.description || undefined,
      category: form.category || undefined,
      basePrice: form.basePrice ? parseFloat(form.basePrice) : 0,
      currency: form.currency,
      priceIsNegotiable: form.priceIsNegotiable,
      durationHours: form.durationHours ? parseFloat(form.durationHours) : undefined,
      deliveryDays: form.deliveryDays ? parseInt(form.deliveryDays) : undefined,
      deliverablesDescription: form.deliverablesDescription || undefined,
      eventTypesIncluded: form.eventTypesIncluded.length ? form.eventTypesIncluded : undefined,
      staffing: form.staffing.length ? form.staffing : undefined,
      photoEditCount: form.photoEditCount ? parseInt(form.photoEditCount) : undefined,
      trailerCount: form.trailerCount ? parseInt(form.trailerCount) : undefined,
      fullVideoCount: form.fullVideoCount ? parseInt(form.fullVideoCount) : undefined,
      ritualsIncluded: form.ritualsIncluded.length ? form.ritualsIncluded : undefined,
      deliveryMethod: form.deliveryMethod || undefined,
      isActive: form.isActive,
      isVisibleInPortal: form.isVisibleInPortal,
    };
    try {
      const url = isEdit ? `${API}/packages/${editing!.id}` : `${API}/packages`;
      const res = await apiFetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save."); return; }
      onSaved(); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-lg">{isEdit ? "Edit Package" : "New Package"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <form id="pkg-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Package Name *</Label>
              <Input value={form.name} onChange={set("name")} placeholder="e.g. Wedding Premium" className="h-11 border-slate-200" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Category</Label>
                <select value={form.category} onChange={set("category")}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 cursor-pointer">
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Currency</Label>
                <select value={form.currency} onChange={set("currency")}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 cursor-pointer">
                  <option value="BDT">৳ BDT</option>
                  <option value="USD">$ USD</option>
                  <option value="INR">₹ INR</option>
                  <option value="GBP">£ GBP</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Base Price</Label>
                <Input type="number" min="0" placeholder="0" value={form.basePrice} onChange={set("basePrice")} className="h-11 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Delivery (days)</Label>
                <Input type="number" min="0" placeholder="e.g. 30" value={form.deliveryDays} onChange={set("deliveryDays")} className="h-11 border-slate-200" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Duration (hours) <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input type="number" min="0" step="0.5" placeholder="e.g. 8" value={form.durationHours} onChange={set("durationHours")} className="h-11 border-slate-200" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Event Days Included <span className="text-slate-400 font-normal">(optional — for multi-day packages)</span></Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(et => (
                  <button key={et.value} type="button" onClick={() => toggleEventType(et.value)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      form.eventTypesIncluded.includes(et.value) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                    )}>
                    {et.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-slate-700">Staffing</Label>
                <button type="button" onClick={addStaffingRow} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Role
                </button>
              </div>
              {form.staffing.length === 0 ? (
                <p className="text-xs text-slate-400">No staffing added yet — click &quot;Add Role&quot; to build the team for this package.</p>
              ) : (
                <div className="space-y-2">
                  {form.staffing.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={s.role} onChange={e => updateStaffingRow(idx, { role: e.target.value })}
                        className="flex-1 h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 cursor-pointer">
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <select value={s.level} onChange={e => updateStaffingRow(idx, { level: e.target.value })}
                        className="flex-1 h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 cursor-pointer">
                        {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                      <Input type="number" min="1" value={s.count}
                        onChange={e => updateStaffingRow(idx, { count: parseInt(e.target.value) || 1 })}
                        className="w-16 h-9 text-xs border-slate-200" />
                      <button type="button" onClick={() => removeStaffingRow(idx)}
                        className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <Label className="text-sm font-medium text-slate-700">Deliverables</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Photo Edits</Label>
                  <Input type="number" min="0" placeholder="0" value={form.photoEditCount} onChange={set("photoEditCount")} className="h-9 text-sm border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Trailer</Label>
                  <Input type="number" min="0" placeholder="0" value={form.trailerCount} onChange={set("trailerCount")} className="h-9 text-sm border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Full Video</Label>
                  <Input type="number" min="0" placeholder="0" value={form.fullVideoCount} onChange={set("fullVideoCount")} className="h-9 text-sm border-slate-200" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Rituals Included</Label>
                <div className="flex flex-wrap gap-2">
                  {RITUAL_PRESETS.map(r => (
                    <button key={r} type="button" onClick={() => toggleRitual(r)}
                      className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                        form.ritualsIncluded.includes(r) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                      )}>
                      {r}
                    </button>
                  ))}
                  {form.ritualsIncluded.filter(r => !RITUAL_PRESETS.includes(r)).map(r => (
                    <button key={r} type="button" onClick={() => toggleRitual(r)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-600 text-white border-emerald-600">
                      {r} ×
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-1.5">
                  <Input value={customRitual} onChange={e => setCustomRitual(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomRitual(customRitual); setCustomRitual(""); } }}
                    placeholder="Add custom ritual..." className="h-8 text-xs border-slate-200 flex-1" />
                  <Button type="button" variant="outline" onClick={() => { addCustomRitual(customRitual); setCustomRitual(""); }} className="h-8 text-xs px-3 border-slate-200">Add</Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Delivery Method</Label>
                <select value={form.deliveryMethod} onChange={set("deliveryMethod")}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 cursor-pointer">
                  <option value="">Select...</option>
                  {DELIVERY_METHODS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>

            {(form.staffing.length > 0 || form.eventTypesIncluded.length > 0) && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Live Preview</p>
                <p className="font-bold text-slate-900 text-sm">{form.name || "Package Name"}</p>
                <p className="text-sm font-bold text-emerald-600">
                  {formatCurrency(form.basePrice ? Number(form.basePrice) : 0, form.currency)}
                  {form.priceIsNegotiable && <span className="text-[10px] text-slate-400 font-normal ml-1">negotiable</span>}
                </p>
                {form.eventTypesIncluded.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.eventTypesIncluded.map(v => (
                      <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                        {EVENT_TYPES.find(e => e.value === v)?.label ?? v}
                      </span>
                    ))}
                  </div>
                )}
                <ul className="space-y-1 mt-1">
                  {summaryLines({
                    staffing: form.staffing,
                    durationHours: form.durationHours ? Number(form.durationHours) : undefined,
                    photoEditCount: form.photoEditCount ? Number(form.photoEditCount) : undefined,
                    trailerCount: form.trailerCount ? Number(form.trailerCount) : undefined,
                    fullVideoCount: form.fullVideoCount ? Number(form.fullVideoCount) : undefined,
                    ritualsIncluded: form.ritualsIncluded,
                    deliveryMethod: form.deliveryMethod,
                  }).map((line, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />{line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <textarea value={form.description} onChange={set("description")} rows={2} placeholder="Describe what's included..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Custom Note <span className="text-slate-400 font-normal">(optional — used only if no staffing is set above)</span></Label>
              <textarea value={form.deliverablesDescription} onChange={set("deliverablesDescription")} rows={2} placeholder="Free-text deliverables note for quick/simple packages..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
            <div className="space-y-2">
              {[
                { key: "priceIsNegotiable", label: "Price is negotiable" },
                { key: "isActive",          label: "Active (visible to staff)" },
                { key: "isVisibleInPortal", label: "Show in client portal" },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                  <div className={cn("w-9 h-5 rounded-full transition-colors relative",
                    (form as any)[opt.key] ? "bg-indigo-500" : "bg-slate-200"
                  )}>
                    <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      (form as any)[opt.key] ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </div>
                  <span className="text-sm text-slate-700">{opt.label}</span>
                  <input type="checkbox" checked={(form as any)[opt.key]}
                    onChange={e => setForm(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                    className="sr-only" />
                </label>
              ))}
            </div>
          </div>
        </form>
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
          <Button type="submit" form="pkg-form" disabled={loading} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{isEdit ? "Saving..." : "Creating..."}</> : isEdit ? "Save Changes" : "Create Package"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────
function DeleteDialog({ pkg, onClose, onDeleted }: { pkg: Pkg | null; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  if (!pkg) return null;
  async function doDelete() {
    setLoading(true);
    await apiFetch(`${API}/packages/${pkg!.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } }).catch(() => {});
    onDeleted(); onClose(); setLoading(false);
  }
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Delete Package?</h3>
          <p className="text-slate-500 text-sm mt-2"><span className="font-semibold text-slate-700">{pkg.name}</span> will be permanently deleted.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={doDelete} disabled={loading} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Package Card ─────────────────────────────────────────────────────────────
function PackageCard({ pkg, onEdit, onDelete, onToggle }: {
  pkg: Pkg; onEdit: (p: Pkg) => void; onDelete: (p: Pkg) => void; onToggle: (p: Pkg) => void;
}) {
  const fmt = (n: number) => formatCurrency(Number(n), pkg.currency);
  return (
    <div className={cn("bg-white border rounded-xl p-4 shadow-sm transition-opacity", !pkg.isActive && "opacity-60")}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-sm">{pkg.name}</h3>
            {!pkg.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactive</span>}
            {pkg.isVisibleInPortal && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">Portal</span>}
          </div>
          {pkg.category && <span className="text-xs text-slate-400">{pkg.category}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(pkg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onToggle(pkg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            {pkg.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onDelete(pkg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {pkg.description && <p className="text-xs text-slate-500 mb-3 leading-relaxed">{pkg.description}</p>}
      {pkg.staffing && pkg.staffing.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {pkg.eventTypesIncluded && pkg.eventTypesIncluded.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {pkg.eventTypesIncluded.map(v => (
                <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                  {EVENT_TYPES.find(e => e.value === v)?.label ?? v}
                </span>
              ))}
            </div>
          )}
          <ul className="space-y-1">
            {summaryLines(pkg).map((line, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />{line}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          {fmt(pkg.basePrice)}
          {pkg.priceIsNegotiable && <span className="text-[10px] text-slate-400 font-normal ml-0.5">negotiable</span>}
        </div>
        {pkg.durationHours && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />{pkg.durationHours}h
          </div>
        )}
        {pkg.deliveryDays && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <CheckCircle2 className="w-3 h-3" />{pkg.deliveryDays}d delivery
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PackagesPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Pkg | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Pkg | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/packages`, { headers: { "Content-Type": "application/json" } });
      if (res.ok) setPackages(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  async function toggle(pkg: Pkg) {
    await apiFetch(`${API}/packages/${pkg.id}/toggle`, { method: "PATCH", headers: { "Content-Type": "application/json" } }).catch(() => {});
    fetchPackages();
  }

  function openNew() { setEditTarget(null); setDrawer(true); }
  function openEdit(p: Pkg) { setEditTarget(p); setDrawer(true); }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Packages</h1>
          <p className="text-slate-400 text-xs mt-0.5">{packages.length} service packages</p>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Package</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No packages yet</p>
          <p className="text-slate-300 text-xs mt-1">Create service packages to attach to bookings</p>
          <Button onClick={openNew} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
            <Plus className="w-4 h-4" /> New Package
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packages.map(p => (
            <PackageCard key={p.id} pkg={p} onEdit={openEdit} onDelete={p => setDeleteTarget(p)} onToggle={toggle} />
          ))}
        </div>
      )}

      <PackageDrawer open={drawer} onClose={() => { setDrawer(false); setEditTarget(null); }} onSaved={fetchPackages} editing={editTarget} />
      <DeleteDialog pkg={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchPackages} />
    </div>
  );
}
