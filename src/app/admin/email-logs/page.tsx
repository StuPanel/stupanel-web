"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, ChevronLeft, ChevronRight, Mail,
  CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { Authorization: `Bearer ${getToken()}` }; }

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const statusConfig: Record<string, { icon: any; color: string }> = {
  sent:      { icon: CheckCircle, color: "text-emerald-400" },
  delivered: { icon: CheckCircle, color: "text-teal-400" },
  pending:   { icon: Clock,       color: "text-amber-400" },
  bounced:   { icon: XCircle,     color: "text-red-400" },
  failed:    { icon: AlertTriangle, color: "text-red-400" },
  opened:    { icon: Mail,        color: "text-indigo-400" },
};

export default function AdminEmailLogsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1, s = search, st = status) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), ...(s && { search: s }), ...(st && { status: st }) });
    const res = await fetch(`${API}/admin/email-logs?${q}`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setData(await res.json());
    setPage(p);
    setLoading(false);
  }, [router, search, status]);

  useEffect(() => { load(); }, []);

  const stats = data?.stats ?? {};
  const statItems = [
    { label: "Sent",    key: "sent",    color: "text-emerald-400" },
    { label: "Pending", key: "pending", color: "text-amber-400" },
    { label: "Bounced", key: "bounced", color: "text-red-400" },
    { label: "Opened",  key: "opened",  color: "text-indigo-400" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Email Logs</h1>
        <p className="text-sm text-slate-400 mt-0.5">All transactional emails sent from StuPanel</p>
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statItems.map(s => (
            <div key={s.key} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className={cn("text-2xl font-bold", s.color)}>{stats[s.key] ?? 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") load(1, search, status); }}
            placeholder="Search email, subject..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-9" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); load(1, search, e.target.value); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 h-9 outline-none">
          <option value="">All Status</option>
          {["pending","sent","delivered","opened","bounced","failed"].map(st => (
            <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
          ))}
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
        ) : (data?.items ?? []).length === 0 ? (
          <div className="text-center py-16 text-slate-500">No email logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Status", "To", "Subject", "Template", "Studio", "Sent At"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {(data?.items ?? []).map((log: any) => {
                  const cfg = statusConfig[log.status] ?? { icon: Clock, color: "text-slate-400" };
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className={cn("flex items-center gap-1.5 text-xs font-medium capitalize", cfg.color)}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {log.status}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white text-xs truncate max-w-[160px]">{log.toEmail}</p>
                        {log.toName && <p className="text-xs text-slate-500">{log.toName}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-200 text-xs truncate max-w-[220px]">{log.subject}</p>
                      </td>
                      <td className="px-4 py-3">
                        {log.templateId ? (
                          <code className="text-[10px] bg-slate-900 text-indigo-300 px-1.5 py-0.5 rounded font-mono">{log.templateId}</code>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{log.company?.name ?? "System"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(log.sentAt ?? log.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data?.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {data.pages} ({data.total} total)</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />Prev
            </Button>
            <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => load(page + 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
              Next<ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
