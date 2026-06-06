"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Pencil, Trash2, X, Save, Flag, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return localStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

interface FFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  allowedPlans: string[];
  updatedAt: string;
}

const emptyForm = { key: "", name: "", description: "", isEnabled: false, allowedPlansText: "" };

export default function AdminFeatureFlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<FFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API}/admin/feature-flags`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setFlags(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleFlag(flag: FFlag) {
    setTogglingId(flag.id);
    await fetch(`${API}/admin/feature-flags/${flag.id}`, {
      method: "PATCH",
      headers: authH(),
      body: JSON.stringify({ isEnabled: !flag.isEnabled }),
    });
    await load();
    setTogglingId(null);
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(flag: FFlag) {
    setEditId(flag.id);
    setForm({
      key: flag.key,
      name: flag.name,
      description: flag.description ?? "",
      isEnabled: flag.isEnabled,
      allowedPlansText: flag.allowedPlans.join(", "),
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    const body = {
      key: form.key.trim().toLowerCase().replace(/\s+/g, "_"),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      isEnabled: form.isEnabled,
      allowedPlans: form.allowedPlansText.split(",").map(s => s.trim()).filter(Boolean),
    };
    if (editId) {
      await fetch(`${API}/admin/feature-flags/${editId}`, { method: "PATCH", headers: authH(), body: JSON.stringify(body) });
    } else {
      await fetch(`${API}/admin/feature-flags`, { method: "POST", headers: authH(), body: JSON.stringify(body) });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function deleteFlag(id: string) {
    setDeleteId(id);
    await fetch(`${API}/admin/feature-flags/${id}`, { method: "DELETE", headers: authH() });
    setDeleteId(null);
    load();
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
          <p className="text-sm text-slate-400 mt-0.5">Toggle platform features globally or per plan</p>
        </div>
        <Button onClick={openCreate} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          <Plus className="w-4 h-4" />New Flag
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : flags.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <Flag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500">No feature flags yet</p>
          <Button onClick={openCreate} size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            <Plus className="w-3.5 h-3.5" />Create First Flag
          </Button>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Flag", "Key", "Allowed Plans", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {flags.map(flag => (
                <tr key={flag.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{flag.name}</p>
                    {flag.description && <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-slate-900 text-indigo-300 px-2 py-0.5 rounded font-mono">{flag.key}</code>
                  </td>
                  <td className="px-4 py-3">
                    {flag.allowedPlans.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {flag.allowedPlans.map(p => (
                          <span key={p} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">{p}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">All plans</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleFlag(flag)} disabled={togglingId === flag.id}
                      className="flex items-center gap-1.5 text-sm font-medium transition-colors">
                      {togglingId === flag.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : flag.isEnabled ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-500" />
                      )}
                      <span className={flag.isEnabled ? "text-emerald-400" : "text-slate-500"}>
                        {flag.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(flag)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteFlag(flag.id)} disabled={deleteId === flag.id}
                        className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-400 hover:text-red-400">
                        {deleteId === flag.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">{editId ? "Edit Flag" : "New Feature Flag"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Flag Name *</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="WhatsApp Integration" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Key * (auto-lowercased)</label>
                <Input value={form.key} onChange={e => setForm(p => ({ ...p, key: e.target.value }))}
                  placeholder="whatsapp_integration" className="bg-slate-800 border-slate-700 text-white h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Description</label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Enables WhatsApp messaging for studios" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Allowed Plans (comma-separated slug, blank = all)</label>
                <Input value={form.allowedPlansText} onChange={e => setForm(p => ({ ...p, allowedPlansText: e.target.value }))}
                  placeholder="pro, enterprise" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="flagEnabled" checked={form.isEnabled}
                  onChange={e => setForm(p => ({ ...p, isEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <label htmlFor="flagEnabled" className="text-sm text-slate-300">Enable this flag immediately</label>
              </div>
            </div>

            <Button onClick={save} disabled={saving || !form.name || !form.key}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? "Update Flag" : "Create Flag"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
