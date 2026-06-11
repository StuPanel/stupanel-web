"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Trash2, X, Save, Megaphone, ToggleRight, ToggleLeft,
  Info, AlertTriangle, CheckCircle, AlertOctagon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  targetAll: boolean;
  targetPlanIds: string[];
  isActive: boolean;
  publishedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

const typeConfig: Record<string, { icon: any; color: string; border: string; label: string }> = {
  info:     { icon: Info, color: "bg-blue-500/20 text-blue-400", border: "border-blue-600/30", label: "Info" },
  warning:  { icon: AlertTriangle, color: "bg-amber-500/20 text-amber-400", border: "border-amber-600/30", label: "Warning" },
  success:  { icon: CheckCircle, color: "bg-emerald-500/20 text-emerald-400", border: "border-emerald-600/30", label: "Success" },
  critical: { icon: AlertOctagon, color: "bg-red-500/20 text-red-400", border: "border-red-600/30", label: "Critical" },
};

const emptyForm = {
  title: "", content: "", type: "info",
  targetAll: true, targetPlanIds: "",
  expiresAt: "",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminBroadcastPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API}/admin/announcements`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setAnnouncements(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    await fetch(`${API}/admin/announcements`, {
      method: "POST",
      headers: authH(),
      body: JSON.stringify({
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        targetAll: form.targetAll,
        targetPlanIds: form.targetAll ? [] : form.targetPlanIds.split(",").map(s => s.trim()).filter(Boolean),
        expiresAt: form.expiresAt || undefined,
      }),
    });
    setSaving(false);
    setShowForm(false);
    setForm(emptyForm);
    load();
  }

  async function toggleActive(a: Announcement) {
    setTogglingId(a.id);
    await fetch(`${API}/admin/announcements/${a.id}`, {
      method: "PATCH", headers: authH(),
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    setTogglingId(null);
    load();
  }

  async function deleteAnnouncement(id: string) {
    if (!confirm("Delete this announcement?")) return;
    setDeleteId(id);
    await fetch(`${API}/admin/announcements/${id}`, { method: "DELETE", headers: authH() });
    setDeleteId(null);
    load();
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Broadcast</h1>
          <p className="text-sm text-slate-400 mt-0.5">Send announcements to all studios</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShowForm(true); }} size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          <Plus className="w-4 h-4" />New Announcement
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <Megaphone className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 mb-3">No announcements yet</p>
          <Button onClick={() => setShowForm(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            <Plus className="w-3.5 h-3.5" />Create First Announcement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const cfg = typeConfig[a.type] ?? typeConfig.info;
            const Icon = cfg.icon;
            return (
              <div key={a.id} className={cn(
                "bg-slate-800 border rounded-xl p-5",
                a.isActive ? cfg.border : "border-slate-700/40 opacity-60"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", cfg.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white">{a.title}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium border", cfg.color, cfg.border)}>
                          {cfg.label}
                        </span>
                        {!a.isActive && (
                          <span className="text-[10px] bg-slate-700 text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-2">{a.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>{a.targetAll ? "All Studios" : `Plans: ${a.targetPlanIds.join(", ")}`}</span>
                        <span>·</span>
                        <span>Published {fmtDate(a.publishedAt ?? a.createdAt)}</span>
                        {a.expiresAt && <><span>·</span><span>Expires {fmtDate(a.expiresAt)}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(a)} disabled={togglingId === a.id}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                      {togglingId === a.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : a.isActive ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-slate-500" />}
                    </button>
                    <button onClick={() => deleteAnnouncement(a.id)} disabled={deleteId === a.id}
                      className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors">
                      {deleteId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">New Announcement</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Live preview */}
            {form.title && (
              <div className={cn("rounded-xl p-4 border", typeConfig[form.type]?.border ?? "border-slate-700")}>
                <div className={cn("flex items-center gap-2 text-sm font-semibold mb-1", typeConfig[form.type]?.color ?? "text-slate-300")}>
                  {(() => { const I = typeConfig[form.type]?.icon ?? Info; return <I className="w-4 h-4" />; })()}
                  {form.title}
                </div>
                {form.content && <p className="text-xs text-slate-300">{form.content}</p>}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Title *</label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Scheduled maintenance on Jun 15" className="bg-slate-800 border-slate-700 text-white h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Content *</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  rows={4} placeholder="We will be performing scheduled maintenance..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 h-9 outline-none">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Expires At (optional)</label>
                  <Input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white h-9" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.targetAll} onChange={e => setForm(p => ({ ...p, targetAll: e.target.checked }))} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Target all studios</span>
                </label>
                {!form.targetAll && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Target Plan Slugs (comma-separated)</label>
                    <Input value={form.targetPlanIds} onChange={e => setForm(p => ({ ...p, targetPlanIds: e.target.value }))}
                      placeholder="pro, enterprise" className="bg-slate-800 border-slate-700 text-white h-9" />
                  </div>
                )}
              </div>
            </div>

            <Button onClick={save} disabled={saving || !form.title || !form.content}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              Publish Announcement
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
