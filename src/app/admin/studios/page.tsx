"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, ChevronLeft, ChevronRight,
  CheckCircle, Ban, ExternalLink, RefreshCw,
  HardDrive, X, Check, Trash2, Archive,
  RotateCcw, AlertTriangle, Download, Eye, EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return localStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

const statusColors: Record<string, string> = {
  active:   "bg-emerald-500/20 text-emerald-400 border-emerald-600/30",
  trialing: "bg-amber-500/20 text-amber-400 border-amber-600/30",
  canceled: "bg-red-500/20 text-red-400 border-red-600/30",
  past_due: "bg-orange-500/20 text-orange-400 border-orange-600/30",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtBytes(b: number): string {
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

// ─── R2 Settings Modal ────────────────────────────────────────────────────────
function R2Modal({ studio, onClose, onSaved }: {
  studio: any; onClose: () => void; onSaved: (updated: any) => void;
}) {
  const [enabled, setEnabled] = useState(studio.r2Enabled ?? false);
  const [limitGb, setLimitGb] = useState(
    studio.r2StorageLimitMb ? String(Math.round(studio.r2StorageLimitMb / 1024 * 10) / 10) : "5"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const usedBytes = Number(studio.storageUsedBytes ?? 0);
  const limitBytes = (studio.r2StorageLimitMb ?? 0) * 1024 * 1024;
  const usedPct = limitBytes > 0 ? Math.min(100, Math.round(usedBytes / limitBytes * 100)) : 0;

  async function save() {
    const gb = parseFloat(limitGb);
    if (enabled && (isNaN(gb) || gb <= 0)) { setError("Please enter a valid storage limit"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/admin/studios/${studio.id}/r2`, {
        method: "PATCH", headers: authH(),
        body: JSON.stringify({ r2Enabled: enabled, r2StorageLimitMb: enabled ? Math.round(gb * 1024) : 0 }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.message || "Failed to save"); return; }
      onSaved(d); onClose();
    } catch { setError("Something went wrong"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <div><p className="font-bold text-white text-sm">Cloud Storage (R2)</p><p className="text-xs text-slate-400 mt-0.5">{studio.name}</p></div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 space-y-5">
            {studio.r2Enabled && usedBytes > 0 && (
              <div className="bg-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Storage Used</span>
                  <span className="text-white font-medium">{fmtBytes(usedBytes)} / {studio.r2StorageLimitMb ? (studio.r2StorageLimitMb / 1024).toFixed(1) + " GB" : "—"}</span>
                </div>
                {limitBytes > 0 && (
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${usedPct}%` }} />
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white">Enable R2 Storage</p><p className="text-xs text-slate-400 mt-0.5">Allow this studio to upload delivery files</p></div>
              <button onClick={() => setEnabled((v: boolean) => !v)} className={cn("relative w-11 h-6 rounded-full transition-colors", enabled ? "bg-indigo-600" : "bg-slate-700")}>
                <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0")} />
              </button>
            </div>
            {enabled && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Storage Limit (GB)</label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0.5" step="0.5" value={limitGb} onChange={e => setLimitGb(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-10 flex-1" placeholder="e.g. 5" />
                  <span className="text-sm text-slate-400 whitespace-nowrap">GB</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {["1", "5", "10", "20", "50"].map(v => (
                    <button key={v} onClick={() => setLimitGb(v)} className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors", limitGb === v ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white")}>{v} GB</button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">≈ ${(parseFloat(limitGb) * 0.015).toFixed(3)}/month max</p>
              </div>
            )}
            {error && <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1 h-10 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button onClick={save} disabled={saving} className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ studio, onClose, onDeleted, onArchived }: {
  studio: any; onClose: () => void;
  onDeleted: (id: string) => void;
  onArchived: (id: string) => void;
}) {
  const [deleteType, setDeleteType] = useState<"instant" | "archive" | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch(`${API}/admin/studios/${studio.id}/export`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { setError("Export failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${studio.name}_export.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Export failed"); }
    finally { setExporting(false); }
  }

  async function proceed() {
    if (!deleteType) { setError("Please choose a delete option"); return; }
    if (!password.trim()) { setError("Admin password is required"); return; }
    setLoading(true); setError("");
    try {
      const endpoint = deleteType === "instant" ? "instant-delete" : "archive";
      const res = await fetch(`${API}/admin/studios/${studio.id}/${endpoint}`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ adminPassword: password }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.message || "Operation failed"); return; }
      if (deleteType === "instant") onDeleted(studio.id);
      else onArchived(studio.id);
      onClose();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-900/50 rounded-2xl shadow-2xl w-full max-w-md">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Delete Studio</p>
                <p className="text-xs text-slate-400 mt-0.5">{studio.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* Export */}
            <button onClick={exportExcel} disabled={exporting}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-700 hover:border-indigo-600/50 hover:bg-indigo-500/5 transition-colors text-left">
              <Download className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-200">{exporting ? "Exporting..." : "Export Data (Excel)"}</p>
                <p className="text-xs text-slate-500">Download all studio data before deletion</p>
              </div>
              {exporting && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 ml-auto" />}
            </button>

            {/* Delete options */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Choose Delete Type</p>

              <button onClick={() => setDeleteType("archive")}
                className={cn("w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left",
                  deleteType === "archive" ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700 hover:border-slate-600")}>
                <Archive className={cn("w-4 h-4 mt-0.5 flex-shrink-0", deleteType === "archive" ? "text-amber-400" : "text-slate-500")} />
                <div>
                  <p className="text-sm font-medium text-slate-200">Archive (30 days)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Studio deactivated, data kept for 30 days. Restore করা যাবে।</p>
                </div>
                {deleteType === "archive" && <Check className="w-4 h-4 text-amber-400 ml-auto mt-0.5 flex-shrink-0" />}
              </button>

              <button onClick={() => setDeleteType("instant")}
                className={cn("w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left",
                  deleteType === "instant" ? "border-red-500/50 bg-red-500/5" : "border-slate-700 hover:border-slate-600")}>
                <Trash2 className={cn("w-4 h-4 mt-0.5 flex-shrink-0", deleteType === "instant" ? "text-red-400" : "text-slate-500")} />
                <div>
                  <p className="text-sm font-medium text-slate-200">Instant Delete</p>
                  <p className="text-xs text-slate-500 mt-0.5">সব data + R2 files এখনই permanently delete। Restore সম্ভব না।</p>
                </div>
                {deleteType === "instant" && <Check className="w-4 h-4 text-red-400 ml-auto mt-0.5 flex-shrink-0" />}
              </button>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Admin Password (Verification)</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your admin password"
                  className="bg-slate-800 border-slate-600 text-white h-10 pr-10"
                />
                <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg border border-red-900/30">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1 h-10 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button onClick={proceed} disabled={loading || !deleteType}
                className={cn("flex-1 h-10 gap-2 text-white", deleteType === "instant" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700")}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : deleteType === "instant" ? <Trash2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                {deleteType === "instant" ? "Delete Now" : deleteType === "archive" ? "Archive Studio" : "Proceed"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Archived Studios Tab ─────────────────────────────────────────────────────
function ArchivedTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/studios/archived`, { headers: authH() });
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function restore(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/admin/studios/${id}/restore`, { method: "POST", headers: authH() });
      if (res.ok) setItems(prev => prev.filter(s => s.id !== id));
    } finally { setActionLoading(null); }
  }

  async function permanentDelete() {
    if (!deleteTarget || !password.trim()) { setPwError("Password required"); return; }
    setActionLoading(deleteTarget.id);
    setPwError("");
    try {
      const res = await fetch(`${API}/admin/studios/${deleteTarget.id}/permanent-delete`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ adminPassword: password }),
      });
      const d = await res.json();
      if (!res.ok) { setPwError(d.message || "Failed"); setActionLoading(null); return; }
      setItems(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null); setPassword("");
    } finally { setActionLoading(null); }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl">No archived studios</div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Studio", "Email", "Archived On", "Auto-Delete In", "Data", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {items.map(s => (
                <tr key={s.id} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3"><p className="font-medium text-white">{s.name}</p><p className="text-xs text-slate-500">/{s.slug}</p></td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{s.email}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(s.archivedAt)}</td>
                  <td className="px-4 py-3">
                    {s.expired ? (
                      <span className="text-xs text-red-400 font-semibold">Expired</span>
                    ) : (
                      <span className={cn("text-xs font-semibold", s.daysLeft <= 7 ? "text-red-400" : s.daysLeft <= 15 ? "text-amber-400" : "text-slate-300")}>
                        {s.daysLeft} days
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {s._count.bookings}B · {s._count.clients}C · {s._count.users}U
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => restore(s.id)} disabled={actionLoading === s.id}
                        className="h-7 px-2 text-emerald-400 hover:bg-emerald-900/20 gap-1 text-xs">
                        {actionLoading === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}Restore
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setDeleteTarget(s); setPassword(""); setPwError(""); }}
                        disabled={actionLoading === s.id}
                        className="h-7 px-2 text-red-400 hover:bg-red-900/20 gap-1 text-xs">
                        <Trash2 className="w-3 h-3" />Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Permanent Delete confirm modal */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-900/50 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Permanently Delete</p>
                  <p className="text-xs text-slate-400">{deleteTarget.name}</p>
                </div>
              </div>
              <p className="text-xs text-red-300 bg-red-900/20 px-3 py-2 rounded-lg">This will permanently delete all data. Cannot be undone.</p>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Admin Password</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Enter admin password" className="bg-slate-800 border-slate-600 text-white h-10 pr-10" />
                  <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1 h-10 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
                <Button onClick={permanentDelete} disabled={actionLoading === deleteTarget.id}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white gap-2">
                  {actionLoading === deleteTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Delete
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminStudiosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [r2Target, setR2Target] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const load = useCallback(async (p = 1, s = search, st = status) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), limit: "15", ...(s && { search: s }), ...(st && { status: st }) });
    const res = await fetch(`${API}/admin/studios?${q}`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    const d = await res.json();
    setItems(d.items ?? []);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
    setPage(p);
    setLoading(false);
  }, [router, search, status]);

  useEffect(() => { load(); }, []);

  async function toggleSuspend(studio: any) {
    setActionLoading(studio.id);
    const endpoint = studio.isActive ? "suspend" : "reactivate";
    await fetch(`${API}/admin/studios/${studio.id}/${endpoint}`, { method: "PATCH", headers: authH() });
    await load(page);
    setActionLoading(null);
  }

  async function impersonate(studioId: string) {
    setActionLoading(studioId);
    const res = await fetch(`${API}/admin/studios/${studioId}/impersonate`, { method: "POST", headers: authH() });
    const d = await res.json();
    setActionLoading(null);
    if (d.token) {
      localStorage.setItem("access_token", d.token);
      localStorage.setItem("user_role", "admin");
      window.open("/dashboard", "_blank");
    }
  }

  function onR2Saved(updated: any) {
    setItems(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
  }

  function onDeleted(id: string) { setItems(prev => prev.filter(s => s.id !== id)); setTotal(t => t - 1); }
  function onArchived(id: string) { setItems(prev => prev.filter(s => s.id !== id)); setTotal(t => t - 1); }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Studios</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} studios on the platform</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        {([["active", "Active Studios"], ["archived", "Archived"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === key ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "archived" ? <ArchivedTab /> : (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") load(1, search, status); }}
                placeholder="Search by name, email..."
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-9" />
            </div>
            <select value={status} onChange={e => { setStatus(e.target.value); load(1, search, e.target.value); }}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 h-9 outline-none">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="canceled">Canceled</option>
              <option value="past_due">Past Due</option>
            </select>
            <Button onClick={() => load(1, search, status)} size="sm" variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-9 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </Button>
          </div>

          {/* Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 text-slate-500">No studios found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {["Studio", "Email", "Status", "R2 Storage", "Users", "Bookings", "Created", "Actions"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {items.map(studio => (
                      <tr key={studio.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3"><div><p className="font-medium text-white">{studio.name}</p><p className="text-xs text-slate-500">/{studio.slug}</p></div></td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{studio.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", statusColors[studio.subscriptionStatus] ?? "bg-slate-700 text-slate-400 border-slate-600")}>
                            {studio.subscriptionStatus}
                          </span>
                          {!studio.isActive && (
                            <span className="ml-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800 font-medium">
                              <Ban className="w-2.5 h-2.5" />Suspended
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setR2Target(studio)}
                            className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors",
                              studio.r2Enabled ? "bg-indigo-500/15 text-indigo-400 border-indigo-600/30 hover:bg-indigo-500/25" : "bg-slate-700/50 text-slate-500 border-slate-600 hover:bg-slate-700")}>
                            <HardDrive className="w-3 h-3" />
                            {studio.r2Enabled ? `ON · ${studio.r2StorageLimitMb ? (studio.r2StorageLimitMb / 1024).toFixed(0) + " GB" : "—"}` : "OFF"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{studio._count?.users ?? 0}</td>
                        <td className="px-4 py-3 text-slate-300">{studio._count?.bookings ?? 0}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(studio.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => impersonate(studio.id)} disabled={actionLoading === studio.id}
                              className="h-7 px-2 text-indigo-400 hover:bg-indigo-600/20 gap-1 text-xs">
                              {actionLoading === studio.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}View
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleSuspend(studio)} disabled={actionLoading === studio.id}
                              className={cn("h-7 px-2 gap-1 text-xs", studio.isActive ? "text-orange-400 hover:bg-orange-900/20" : "text-emerald-400 hover:bg-emerald-900/20")}>
                              {studio.isActive ? <><Ban className="w-3 h-3" />Suspend</> : <><CheckCircle className="w-3 h-3" />Activate</>}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(studio)}
                              className="h-7 px-2 text-red-400 hover:bg-red-900/20 gap-1 text-xs">
                              <Trash2 className="w-3 h-3" />Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Page {page} of {pages} ({total} total)</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)} className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => load(page + 1)} className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
                  Next<ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {r2Target && <R2Modal studio={r2Target} onClose={() => setR2Target(null)} onSaved={onR2Saved} />}
      {deleteTarget && (
        <DeleteModal
          studio={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={onDeleted}
          onArchived={onArchived}
        />
      )}
    </div>
  );
}
