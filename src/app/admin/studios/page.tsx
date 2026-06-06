"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, Building2, ChevronLeft, ChevronRight,
  CheckCircle, AlertTriangle, Clock, Ban, ExternalLink,
  UserCheck, RefreshCw,
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

export default function AdminStudiosPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

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
    if (selected?.id === studio.id) setSelected({ ...selected, isActive: !studio.isActive });
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

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Studios</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} studios on the platform</p>
        </div>
      </div>

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
                  {["Studio", "Owner Email", "Status", "Users", "Bookings", "Created", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {items.map(studio => (
                  <tr key={studio.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{studio.name}</p>
                        <p className="text-xs text-slate-500">/{studio.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{studio.ownerEmail ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium",
                        statusColors[studio.subscriptionStatus] ?? "bg-slate-700 text-slate-400 border-slate-600")}>
                        {studio.subscriptionStatus}
                      </span>
                      {!studio.isActive && (
                        <span className="ml-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800 font-medium">
                          <Ban className="w-2.5 h-2.5" />Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{studio._count?.users ?? 0}</td>
                    <td className="px-4 py-3 text-slate-300">{studio._count?.bookings ?? 0}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(studio.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost"
                          onClick={() => impersonate(studio.id)}
                          disabled={actionLoading === studio.id}
                          className="h-7 px-2 text-indigo-400 hover:bg-indigo-600/20 hover:text-indigo-300 gap-1 text-xs">
                          {actionLoading === studio.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                          View
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => toggleSuspend(studio)}
                          disabled={actionLoading === studio.id}
                          className={cn("h-7 px-2 gap-1 text-xs",
                            studio.isActive
                              ? "text-red-400 hover:bg-red-900/20 hover:text-red-300"
                              : "text-emerald-400 hover:bg-emerald-900/20 hover:text-emerald-300"
                          )}>
                          {studio.isActive
                            ? <><Ban className="w-3 h-3" />Suspend</>
                            : <><CheckCircle className="w-3 h-3" />Activate</>
                          }
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

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {pages} ({total} total)</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />Prev
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => load(page + 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
              Next<ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
