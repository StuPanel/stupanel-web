"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Pencil, Trash2, X, Save, Tag, Copy, CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  maxUses?: number;
  useCount: number;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
  _count?: { usages: number };
}

const emptyForm = {
  code: "", description: "", discountType: "percent", discountValue: "",
  maxUses: "", validFrom: "", validUntil: "", isActive: true,
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminCouponsPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API}/admin/coupons`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setCoupons(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(c: Coupon) {
    setEditId(c.id);
    setForm({
      code: c.code,
      description: c.description ?? "",
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : "",
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
      isActive: c.isActive,
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    const body = {
      code: form.code.toUpperCase().trim(),
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue) || 0,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
      isActive: form.isActive,
    };
    if (editId) {
      await fetch(`${API}/admin/coupons/${editId}`, { method: "PATCH", headers: authH(), body: JSON.stringify(body) });
    } else {
      await fetch(`${API}/admin/coupons`, { method: "POST", headers: authH(), body: JSON.stringify(body) });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function deleteCoupon(id: string) {
    if (!confirm("Delete this coupon?")) return;
    setDeleteId(id);
    await fetch(`${API}/admin/coupons/${id}`, { method: "DELETE", headers: authH() });
    setDeleteId(null);
    load();
  }

  async function toggleActive(c: Coupon) {
    await fetch(`${API}/admin/coupons/${c.id}`, {
      method: "PATCH", headers: authH(),
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    load();
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Coupons</h1>
          <p className="text-sm text-slate-400 mt-0.5">Discount codes for studio subscriptions</p>
        </div>
        <Button onClick={openCreate} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          <Plus className="w-4 h-4" />New Coupon
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <Tag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 mb-3">No coupons yet</p>
          <Button onClick={openCreate} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            <Plus className="w-3.5 h-3.5" />Create First Coupon
          </Button>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Code", "Discount", "Uses", "Validity", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {coupons.map(c => (
                <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-bold text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded">{c.code}</code>
                      <button onClick={() => copyCode(c.code)} className="text-slate-500 hover:text-slate-300 transition-colors">
                        {copiedCode === c.code ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-white">
                      {c.discountType === "percent" ? `${c.discountValue}%` : `৳${c.discountValue}`}
                    </span>
                    <span className="text-xs text-slate-500 ml-1 capitalize">off</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {c._count?.usages ?? c.useCount}
                    {c.maxUses && <span className="text-slate-500">/{c.maxUses}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <div>{c.validFrom ? `From ${fmtDate(c.validFrom)}` : "Any time"}</div>
                    <div>{c.validUntil ? `Until ${fmtDate(c.validUntil)}` : "No expiry"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(c)}
                      className={cn("text-xs px-2 py-0.5 rounded-full border font-medium transition-colors",
                        c.isActive
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-600/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-600/30"
                          : "bg-red-500/20 text-red-400 border-red-600/30 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-600/30"
                      )}>
                      {c.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteCoupon(c.id)} disabled={deleteId === c.id}
                        className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-400 hover:text-red-400">
                        {deleteId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">{editId ? "Edit Coupon" : "New Coupon"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-slate-400">Coupon Code * (auto UPPERCASE)</label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="WELCOME50" className="bg-slate-800 border-slate-700 text-white h-9 font-mono tracking-widest" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-slate-400">Description</label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="50% off for new studios" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Discount Type</label>
                <select value={form.discountType} onChange={e => setForm(p => ({ ...p, discountType: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 h-9 outline-none">
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (৳)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Discount Value</label>
                <Input type="number" value={form.discountValue} onChange={e => setForm(p => ({ ...p, discountValue: e.target.value }))}
                  placeholder={form.discountType === "percent" ? "50" : "500"} className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Max Uses (blank=unlimited)</label>
                <Input type="number" value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                  placeholder="100" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Valid From</label>
                <Input type="date" value={form.validFrom} onChange={e => setForm(p => ({ ...p, validFrom: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Valid Until</label>
                <Input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" id="couponActive" checked={form.isActive}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
                <label htmlFor="couponActive" className="text-sm text-slate-300">Active (usable by studios)</label>
              </div>
            </div>

            <Button onClick={save} disabled={saving || !form.code || !form.discountValue}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? "Update Coupon" : "Create Coupon"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
