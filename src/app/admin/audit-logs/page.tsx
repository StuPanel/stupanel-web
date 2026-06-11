"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, ChevronLeft, ChevronRight, ClipboardList, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_URL as API } from "@/lib/api";

function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const actionColors: Record<string, string> = {
  CREATE: "bg-emerald-500/20 text-emerald-400",
  UPDATE: "bg-blue-500/20 text-blue-400",
  DELETE: "bg-red-500/20 text-red-400",
  LOGIN:  "bg-indigo-500/20 text-indigo-400",
  LOGOUT: "bg-slate-500/20 text-slate-400",
};

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1, cId = companyId) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), ...(cId && { companyId: cId }) });
    const res = await fetch(`${API}/admin/audit-logs?${q}`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    const d = await res.json();
    setItems(d.items ?? []);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
    setPage(p);
    setLoading(false);
  }, [router, companyId]);

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-sm text-slate-400 mt-0.5">{total} system events recorded</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input value={companyId} onChange={e => setCompanyId(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") load(1, companyId); }}
            placeholder="Filter by Studio ID..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-9" />
        </div>
        <Button onClick={() => load(1, companyId)} size="sm" variant="outline"
          className="border-slate-700 text-slate-300 hover:bg-slate-800 h-9">
          Filter
        </Button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Time", "Action", "Entity", "Studio", "IP"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {items.map(log => (
                  <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${actionColors[log.action] ?? "bg-slate-700 text-slate-400"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.entityType && (
                        <div>
                          <span className="text-xs text-slate-300 font-medium">{log.entityType}</span>
                          {log.entityId && <p className="text-xs text-slate-600 font-mono">{log.entityId.slice(0, 8)}…</p>}
                        </div>
                      )}
                      {log.description && <p className="text-xs text-slate-400 mt-0.5">{log.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{log.company?.name ?? "System"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{log.ipAddress ?? "—"}</td>
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
