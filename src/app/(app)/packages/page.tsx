"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit3, Trash2, Loader2, X, AlertTriangle, Package, CheckCircle2, Eye, EyeOff, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function token() { return localStorage.getItem("access_token") ?? ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }; }

interface Pkg {
  id: string; name: string; description?: string; category?: string;
  basePrice: number; currency: string; priceIsNegotiable: boolean;
  durationHours?: number; deliveryDays?: number; deliverablesDescription?: string;
  isActive: boolean; isVisibleInPortal: boolean; sortOrder: number;
}

const CATEGORIES = ["Wedding", "Portrait", "Corporate", "Video", "Birthday", "Maternity", "Event", "Other"];

// ─── Drawer ───────────────────────────────────────────────────────────────────
function PackageDrawer({ open, onClose, onSaved, editing }: {
  open: boolean; onClose: () => void; onSaved: () => void; editing?: Pkg | null;
}) {
  const isEdit = !!editing;
  const blank = {
    name: "", description: "", category: "", basePrice: "", currency: "BDT",
    priceIsNegotiable: true, durationHours: "", deliveryDays: "",
    deliverablesDescription: "", isActive: true, isVisibleInPortal: false,
  };
  const [form, setForm] = useState<typeof blank & { priceIsNegotiable: boolean; isActive: boolean; isVisibleInPortal: boolean }>(blank);
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
      isActive: form.isActive,
      isVisibleInPortal: form.isVisibleInPortal,
    };
    try {
      const url = isEdit ? `${API}/packages/${editing!.id}` : `${API}/packages`;
      const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: authHeaders(), body: JSON.stringify(body) });
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
              <Label className="text-sm font-medium text-slate-700">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <textarea value={form.description} onChange={set("description")} rows={2} placeholder="Describe what's included..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Deliverables <span className="text-slate-400 font-normal">(optional)</span></Label>
              <textarea value={form.deliverablesDescription} onChange={set("deliverablesDescription")} rows={2} placeholder="Photos, albums, videos..."
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
    await fetch(`${API}/packages/${pkg!.id}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
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
  const fmt = (n: number) => (pkg.currency === "BDT" ? "৳" : "$") + Number(n).toLocaleString();
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
      const res = await fetch(`${API}/packages`, { headers: authHeaders() });
      if (res.ok) setPackages(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  async function toggle(pkg: Pkg) {
    await fetch(`${API}/packages/${pkg.id}/toggle`, { method: "PATCH", headers: authHeaders() }).catch(() => {});
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
