"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Pencil, Trash2, X, CreditCard, Save, Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  maxClients: number;
  maxTeamMembers: number;
  maxBookingsPerMonth: number;
  trialDays: number;
  isActive: boolean;
  isPopular: boolean;
  features?: any[];
}

const emptyForm = {
  name: "", slug: "",
  priceMonthly: "", priceYearly: "",
  maxClients: "50", maxTeamMembers: "3",
  maxBookingsPerMonth: "20", trialDays: "14",
  isActive: true, isPopular: false,
};

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API}/admin/plans`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setPlans(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(plan: Plan) {
    setEditId(plan.id);
    setForm({
      name: plan.name,
      slug: plan.slug,
      priceMonthly: String(plan.priceMonthly),
      priceYearly: String(plan.priceYearly),
      maxClients: String(plan.maxClients),
      maxTeamMembers: String(plan.maxTeamMembers),
      maxBookingsPerMonth: String(plan.maxBookingsPerMonth),
      trialDays: String(plan.trialDays),
      isActive: plan.isActive,
      isPopular: plan.isPopular,
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      priceMonthly: parseFloat(form.priceMonthly) || 0,
      priceYearly: parseFloat(form.priceYearly) || 0,
      maxClients: parseInt(form.maxClients) || 50,
      maxTeamMembers: parseInt(form.maxTeamMembers) || 3,
      maxBookingsPerMonth: parseInt(form.maxBookingsPerMonth) || 20,
      trialDays: parseInt(form.trialDays) || 14,
      isActive: form.isActive,
      isPopular: form.isPopular,
    };

    if (editId) {
      await fetch(`${API}/admin/plans/${editId}`, { method: "PATCH", headers: authH(), body: JSON.stringify(body) });
    } else {
      await fetch(`${API}/admin/plans`, { method: "POST", headers: authH(), body: JSON.stringify(body) });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function deletePlan(id: string) {
    if (!confirm("Delete this plan? Studios using it won't be affected.")) return;
    setDeleteId(id);
    await fetch(`${API}/admin/plans/${id}`, { method: "DELETE", headers: authH() });
    setDeleteId(null);
    load();
  }

  const f = (v: string | number) => Number(v).toLocaleString();

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage pricing tiers for all studios</p>
        </div>
        <Button onClick={openCreate} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          <Plus className="w-4 h-4" />New Plan
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className={cn(
              "bg-slate-800 border rounded-xl p-5 space-y-3 relative",
              plan.isPopular ? "border-indigo-500" : plan.isActive ? "border-slate-700" : "border-slate-700/40 opacity-50"
            )}>
              {plan.isPopular && (
                <div className="absolute -top-2.5 left-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-2.5 h-2.5" />POPULAR
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white">{plan.name}</span>
                    {!plan.isActive && (
                      <span className="text-[10px] bg-red-900/40 text-red-400 border border-red-800 px-1.5 py-0.5 rounded font-medium">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">/{plan.slug}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deletePlan(plan.id)} disabled={deleteId === plan.id}
                    className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors">
                    {deleteId === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-500">Monthly</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(Number(plan.priceMonthly))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Yearly</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(Number(plan.priceYearly))}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <span>👥 {plan.maxTeamMembers} team members</span>
                <span>🙍 {plan.maxClients} clients</span>
                <span>📅 {plan.maxBookingsPerMonth} bookings/mo</span>
                <span>🎁 {plan.trialDays}d trial</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">{editId ? "Edit Plan" : "New Plan"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-slate-400">Plan Name *</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Pro" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-slate-400">Slug *</label>
                <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="pro" className="bg-slate-800 border-slate-700 text-white h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Monthly Price</label>
                <Input type="number" value={form.priceMonthly} onChange={e => setForm(p => ({ ...p, priceMonthly: e.target.value }))}
                  placeholder="999" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Yearly Price</label>
                <Input type="number" value={form.priceYearly} onChange={e => setForm(p => ({ ...p, priceYearly: e.target.value }))}
                  placeholder="9999" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Max Clients</label>
                <Input type="number" value={form.maxClients} onChange={e => setForm(p => ({ ...p, maxClients: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Max Team Members</label>
                <Input type="number" value={form.maxTeamMembers} onChange={e => setForm(p => ({ ...p, maxTeamMembers: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Max Bookings/Month</label>
                <Input type="number" value={form.maxBookingsPerMonth} onChange={e => setForm(p => ({ ...p, maxBookingsPerMonth: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Trial Days</label>
                <Input type="number" value={form.trialDays} onChange={e => setForm(p => ({ ...p, trialDays: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPopular} onChange={e => setForm(p => ({ ...p, isPopular: e.target.checked }))} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Mark as Popular</span>
                </label>
              </div>
            </div>

            <Button onClick={save} disabled={saving || !form.name || !form.slug}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
