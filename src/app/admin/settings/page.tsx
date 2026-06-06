"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Pencil, Trash2, X, Save, Settings, CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return localStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

interface PSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  updatedAt: string;
}

const emptyForm = { key: "", value: "", description: "", category: "general" };
const CATEGORIES = ["general", "billing", "email", "security", "limits", "ui", "integrations"];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");

  async function load() {
    setLoading(true);
    const res = await fetch(`${API}/admin/settings`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setSettings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditKey(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(s: PSetting) {
    setEditKey(s.key);
    setForm({ key: s.key, value: s.value, description: s.description ?? "", category: s.category });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    await fetch(`${API}/admin/settings`, {
      method: "POST",
      headers: authH(),
      body: JSON.stringify({ key: form.key.trim(), value: form.value.trim(), description: form.description.trim() || undefined, category: form.category }),
    });
    setSaving(false);
    setSavedOk(true);
    setShowForm(false);
    load();
    setTimeout(() => setSavedOk(false), 2500);
  }

  async function deleteSetting(key: string) {
    setDeleteKey(key);
    await fetch(`${API}/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE", headers: authH() });
    setDeleteKey(null);
    load();
  }

  const grouped = settings.reduce<Record<string, PSetting[]>>((acc, s) => {
    const cat = s.category || "general";
    acc[cat] = [...(acc[cat] ?? []), s];
    return acc;
  }, {});

  const filteredGroups = filterCat === "all" ? grouped : { [filterCat]: grouped[filterCat] ?? [] };

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Key-value configuration for the entire platform</p>
        </div>
        <div className="flex items-center gap-2">
          {savedOk && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 animate-in fade-in">
              <CheckCircle className="w-3.5 h-3.5" />Saved
            </span>
          )}
          <Button onClick={openCreate} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Plus className="w-4 h-4" />New Setting
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={cn("text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors capitalize",
              filterCat === cat
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"
            )}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : Object.keys(filteredGroups).length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <Settings className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500">No settings yet</p>
          <Button onClick={openCreate} size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            <Plus className="w-3.5 h-3.5" />Add First Setting
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(filteredGroups).map(([cat, items]) => items.length === 0 ? null : (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 capitalize">{cat}</h2>
              <div className="bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700/50">
                {items.map(s => (
                  <div key={s.key} className="flex items-center gap-4 px-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <code className="text-sm text-indigo-300 font-mono">{s.key}</code>
                        {s.description && (
                          <span className="text-xs text-slate-500 truncate">{s.description}</span>
                        )}
                      </div>
                      <p className="text-sm text-white mt-0.5 truncate">{s.value}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteSetting(s.key)} disabled={deleteKey === s.key}
                        className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-400 hover:text-red-400">
                        {deleteKey === s.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">{editKey ? "Edit Setting" : "New Setting"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Key *</label>
                <Input value={form.key} onChange={e => setForm(p => ({ ...p, key: e.target.value }))}
                  disabled={!!editKey}
                  placeholder="platform.maintenance_mode" className="bg-slate-800 border-slate-700 text-white h-9 font-mono disabled:opacity-60" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Value *</label>
                <textarea value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  rows={3} placeholder="false"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Description</label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Whether the platform is in maintenance mode" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 h-9 outline-none capitalize">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <Button onClick={save} disabled={saving || !form.key || !form.value}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editKey ? "Update Setting" : "Save Setting"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
