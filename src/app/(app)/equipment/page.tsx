"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Camera, Plus, Search, Loader2, X, CheckCircle2, AlertCircle,
  Wrench, Trash2, Edit2, Package, TrendingDown, CircleOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";


const CATEGORIES = ["camera", "lens", "drone", "lighting", "audio", "tripod", "bag", "computer", "storage", "accessories", "other"];
const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  available:   { label: "Available",    color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  in_use:      { label: "In Use",       color: "bg-blue-100 text-blue-700",      dot: "bg-blue-500"    },
  maintenance: { label: "Maintenance",  color: "bg-amber-100 text-amber-700",    dot: "bg-amber-500"   },
  retired:     { label: "Retired",      color: "bg-slate-100 text-slate-500",    dot: "bg-slate-400"   },
};

function fmt(n?: number | null, currency = "BDT") { return n != null ? formatCurrency(Math.round(n), currency) : "—"; }

interface Equipment {
  id: string; name: string; category: string; brand?: string; model?: string;
  serialNumber?: string; purchaseDate?: string; purchasePrice?: number;
  currentValue?: number; status: string; notes?: string;
  assignments?: { id: string; booking: { id: string; bookingNumber: string; eventName?: string } }[];
}
interface Stats { total: number; available: number; inUse: number; maintenance: number; totalValue: number; }

const EMPTY_FORM = { name: "", category: "camera", brand: "", model: "", serialNumber: "", purchaseDate: "", purchasePrice: "", currentValue: "", status: "available", notes: "" };

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [editItem, setEditItem] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [eq, st] = await Promise.all([
      fetch(`${API}/equipment?search=${search}&status=${statusFilter}`, { headers: { "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/equipment/stats`, { headers: { "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : null),
    ]);
    setItems(Array.isArray(eq) ? eq : []);
    setStats(st);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  function openAdd() { setForm({ ...EMPTY_FORM }); setEditItem(null); setModal("add"); }
  function openEdit(item: Equipment) {
    setForm({
      name: item.name, category: item.category, brand: item.brand ?? "", model: item.model ?? "",
      serialNumber: item.serialNumber ?? "", purchaseDate: item.purchaseDate?.slice(0, 10) ?? "",
      purchasePrice: item.purchasePrice?.toString() ?? "", currentValue: item.currentValue?.toString() ?? "",
      status: item.status, notes: item.notes ?? "",
    });
    setEditItem(item); setModal("edit");
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const body = {
      ...form,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
      currentValue: form.currentValue ? Number(form.currentValue) : undefined,
      purchaseDate: form.purchaseDate || undefined,
    };
    const url = modal === "edit" && editItem ? `${API}/equipment/${editItem.id}` : `${API}/equipment`;
    const method = modal === "edit" ? "PATCH" : "POST";
    const r = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { setToast({ msg: modal === "edit" ? "Updated!" : "Equipment added!", ok: true }); setModal(null); loadAll(); }
    else setToast({ msg: "Failed to save.", ok: false });
    setSaving(false);
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this equipment?")) return;
    const r = await apiFetch(`${API}/equipment/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { loadAll(); setToast({ msg: "Deleted.", ok: true }); }
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      {toast && (
        <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2",
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            Equipment
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Camera, lens, drone, lighting — full inventory</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />Add Equipment
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Package, color: "bg-indigo-50 text-indigo-600" },
            { label: "Available", value: stats.available, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
            { label: "In Use", value: stats.inUse, icon: Camera, color: "bg-blue-50 text-blue-600" },
            { label: "Total Value", value: fmt(stats.totalValue), icon: TrendingDown, color: "bg-amber-50 text-amber-600" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", s.color)}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className="text-lg font-extrabold text-slate-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
          <option value="">All Status</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Wrench className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No equipment yet</p>
          <p className="text-sm text-slate-400 mt-1">Add cameras, lenses, drones and other gear</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Equipment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Assigned To</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(item => {
                  const sc = STATUS_CFG[item.status] ?? STATUS_CFG.available;
                  const activeAssignment = item.assignments?.[0];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          {(item.brand || item.model) && (
                            <p className="text-xs text-slate-400 mt-0.5">{[item.brand, item.model].filter(Boolean).join(" · ")}</p>
                          )}
                          {item.serialNumber && <p className="text-xs text-slate-400 font-mono"># {item.serialNumber}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500 capitalize">{item.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", sc.color)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmt(item.currentValue ?? item.purchasePrice)}</td>
                      <td className="px-4 py-3">
                        {activeAssignment ? (
                          <div>
                            <p className="text-xs font-medium text-blue-600">{activeAssignment.booking.eventName || activeAssignment.booking.bookingNumber}</p>
                            <p className="text-[10px] text-slate-400">{activeAssignment.booking.bookingNumber}</p>
                          </div>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{modal === "edit" ? "Edit Equipment" : "Add Equipment"}</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Name *</label>
                <input value={form.name} onChange={set("name")} placeholder="e.g. Canon EOS R5"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Category</label>
                  <select value={form.category} onChange={set("category")}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 capitalize">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Status</label>
                  <select value={form.status} onChange={set("status")}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Brand</label>
                  <input value={form.brand} onChange={set("brand")} placeholder="Canon" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Model</label>
                  <input value={form.model} onChange={set("model")} placeholder="EOS R5" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Serial Number</label>
                <input value={form.serialNumber} onChange={set("serialNumber")} placeholder="SN-XXXXXXXXX"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Purchase Price</label>
                  <input type="number" value={form.purchasePrice} onChange={set("purchasePrice")} placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Current Value</label>
                  <input type="number" value={form.currentValue} onChange={set("currentValue")} placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Purchase Date</label>
                <input type="date" value={form.purchaseDate} onChange={set("purchaseDate")}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Any notes…"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : modal === "edit" ? "Update" : "Add Equipment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
