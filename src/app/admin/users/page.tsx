"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, ChevronLeft, ChevronRight, ShieldCheck, RefreshCw,
  Crown, UserX, UserCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return localStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

function fmtDate(d?: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async (p = 1, s = search) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), limit: "20", ...(s && { search: s }) });
    const res = await fetch(`${API}/admin/users?${q}`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    const d = await res.json();
    setItems(d.items ?? []);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
    setPage(p);
    setLoading(false);
  }, [router, search]);

  useEffect(() => { load(); }, []);

  async function toggleActive(user: any) {
    setActionLoading(user.id);
    await fetch(`${API}/admin/users/${user.id}`, {
      method: "PATCH",
      headers: authH(),
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    await load(page);
    setActionLoading(null);
  }

  async function toggleSuperAdmin(user: any) {
    setActionLoading(user.id);
    await fetch(`${API}/admin/users/${user.id}`, {
      method: "PATCH",
      headers: authH(),
      body: JSON.stringify({ isSuperAdmin: !user.isSuperAdmin }),
    });
    await load(page);
    setActionLoading(null);
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-slate-400 mt-0.5">{total} users across all studios</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") load(1, search); }}
            placeholder="Search name, email..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-9" />
        </div>
        <Button onClick={() => load(1, search)} size="sm" variant="outline"
          className="border-slate-700 text-slate-300 hover:bg-slate-800 h-9 gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Search
        </Button>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["User", "Studio", "Role", "Last Login", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {items.map(u => (
                  <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-200 flex-shrink-0">
                          {u.firstName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white text-sm">{u.firstName} {u.lastName ?? ""}</span>
                            {u.isSuperAdmin && (
                              <span className="text-[10px] bg-indigo-600/30 text-indigo-400 border border-indigo-600/40 px-1.5 py-0.5 rounded font-bold">ADMIN</span>
                            )}
                            {u.isOwner && (
                              <Crown className="w-3 h-3 text-amber-400" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-300">{u.company?.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">/{u.company?.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400 capitalize">{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                        u.isActive
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-600/30"
                          : "bg-red-500/20 text-red-400 border-red-600/30"
                      )}>
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost"
                          onClick={() => toggleActive(u)}
                          disabled={actionLoading === u.id}
                          className={cn("h-7 px-2 gap-1 text-xs",
                            u.isActive
                              ? "text-red-400 hover:bg-red-900/20"
                              : "text-emerald-400 hover:bg-emerald-900/20"
                          )}>
                          {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                            u.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {u.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => toggleSuperAdmin(u)}
                          disabled={actionLoading === u.id}
                          className={cn("h-7 px-2 gap-1 text-xs",
                            u.isSuperAdmin
                              ? "text-amber-400 hover:bg-amber-900/20"
                              : "text-slate-400 hover:bg-slate-700"
                          )}>
                          <ShieldCheck className="w-3 h-3" />
                          {u.isSuperAdmin ? "Revoke" : "Make Admin"}
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
