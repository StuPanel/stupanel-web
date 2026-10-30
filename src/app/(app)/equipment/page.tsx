"use client";

import { Wrench as HeaderIcon } from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, RowsSkeleton, SearchField, StatCard, Tile } from "@/components/ui/apple";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Camera, Plus, Search, Loader2, X, CheckCircle2, AlertCircle,
  Wrench, Trash2, Edit2, Package, TrendingDown, CircleOff,
  Aperture, Plane, Lightbulb, Mic, Briefcase, Laptop, HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { EditableSelect } from "@/components/ui/editable-select";
import { askConfirm } from "@/components/feedback";


const CATEGORIES = ["camera", "lens", "drone", "lighting", "audio", "tripod", "bag", "computer", "storage", "accessories", "other"];
const STATUS_CFG: Record<string, { label: string; color: string; dot: string; hex: string }> = {
  available:   { label: "Available",   color: "bg-[#E9F5EF] text-[#1F8A5B]", dot: "bg-[#1F8A5B]", hex: "#1F8A5B" },
  in_use:      { label: "In use",      color: "bg-[#E6F0FB] text-[#1F5C99]", dot: "bg-[#1F5C99]", hex: "#1F5C99" },
  maintenance: { label: "Repair",      color: "bg-[#FBF2FA] text-[#9E3A8C]", dot: "bg-[#9E3A8C]", hex: "#9E3A8C" },
  retired:     { label: "Retired",     color: "bg-[#EEEDF2] text-[#4A4658]", dot: "bg-[#6B6680]", hex: "#6B6680" },
};

const CAT_ICON: Record<string, { icon: React.ElementType; tile: string }> = {
  camera: { icon: Camera, tile: "ink" }, lens: { icon: Aperture, tile: "deep" }, drone: { icon: Plane, tile: "teal" },
  lighting: { icon: Lightbulb, tile: "orchid" }, audio: { icon: Mic, tile: "blue" }, tripod: { icon: Wrench, tile: "ink" },
  bag: { icon: Briefcase, tile: "violet" }, computer: { icon: Laptop, tile: "blue" }, storage: { icon: HardDrive, tile: "green" },
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
    try {
      const [eq, st] = await Promise.all([
        apiFetch(`${API}/equipment?search=${search}&status=${statusFilter}`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/equipment/stats`).then(r => r.ok ? r.json() : null),
      ]);
      setItems(Array.isArray(eq) ? eq : []);
      setStats(st);
    } catch {
      setToast({ msg: "Failed to load equipment data", ok: false });
    } finally {
      setLoading(false);
    }
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
    if (!(await askConfirm({ message: "Delete this equipment?", danger: true }))) return;
    const r = await apiFetch(`${API}/equipment/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { loadAll(); setToast({ msg: "Deleted.", ok: true }); }
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {toast && (
        <div className={cn("sp-toast",
          toast.ok ? "" : "sp-toast--err")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <PageHeader icon={HeaderIcon} color="ink" title="Equipment" sub={<>Camera, lens, drone, lighting — your full kit</>}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search equipment" />
        <MainButton icon={Plus} onClick={openAdd}>Add equipment</MainButton>
      </PageHeader>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
          <StatCard icon={Package} color="ink" label="Items" value={String(stats.total)} />
          <StatCard icon={CheckCircle2} color="green" label="Available" value={String(stats.available)} />
          <StatCard icon={Camera} color="blue" label="In use" value={String(stats.inUse)} sub={stats.maintenance ? `${stats.maintenance} in repair` : undefined} />
          <StatCard icon={TrendingDown} color="violet" label="Kit value" value={fmt(stats.totalValue)} />
        </div>
      )}

      <Chips label="Filter by status" value={statusFilter || "all"} onChange={v => setStatusFilter(v === "all" ? "" : v)}
        options={[{ value: "all", label: "All" }, ...Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label, dot: v.hex }))]} />

      {loading ? (
        <RowsSkeleton n={5} />
      ) : items.length === 0 ? (
        search || statusFilter
          ? <EmptyState icon={Search} title="Nothing matches" text="Try another word or status." />
          : <EmptyState icon={Wrench} title="No equipment yet" text="Add cameras, lenses, drones and other gear."
              action={<MainButton icon={Plus} onClick={openAdd}>Add equipment</MainButton>} />
      ) : (
        <Group>
          {items.map(item => {
            const sc = STATUS_CFG[item.status] ?? STATUS_CFG.available;
            const cat = CAT_ICON[item.category] ?? { icon: Package, tile: "ink" };
            const active = item.assignments?.[0];
            return (
              <div key={item.id} role="button" tabIndex={0} onClick={() => openEdit(item)} onKeyDown={e => { if (e.key === "Enter") openEdit(item); }}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
                <Tile icon={cat.icon} color={cat.tile} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#17151F] truncate">{item.name}</p>
                  <p className="text-xs text-[#6B6680] truncate mt-0.5">
                    <span className="capitalize">{item.category}</span>
                    {(item.brand || item.model) && <> · {[item.brand, item.model].filter(Boolean).join(" ")}</>}
                    {item.serialNumber && <span className="font-mono"> · #{item.serialNumber}</span>}
                  </p>
                  {active && <p className="text-xs font-semibold text-[#1F5C99] truncate mt-0.5">With {active.booking.eventName || active.booking.bookingNumber}</p>}
                </div>
                <span className="hidden sm:block text-sm font-bold text-[#17151F] tabular-nums flex-shrink-0">{fmt(item.currentValue ?? item.purchasePrice)}</span>
                <span className={cn("hidden md:inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0", sc.color)}>{sc.label}</span>
                <span className={cn("md:hidden w-2.5 h-2.5 rounded-full flex-shrink-0", sc.dot)} title={sc.label} />
                <button onClick={e => { e.stopPropagation(); deleteItem(item.id); }} aria-label={`Delete ${item.name}`}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </Group>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="sp-backdrop z-50" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="sp-drawer pointer-events-auto sm:max-w-lg flex flex-col overflow-y-auto">
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
                  <EditableSelect value={form.category} onChange={v => setForm(p => ({ ...p, category: v }))}
                    options={CATEGORIES.map(c => ({ value: c, label: c }))} className="rounded-xl capitalize" />
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
