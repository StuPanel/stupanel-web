"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, ShieldAlert, CheckCircle, XCircle, Search,
  ChevronLeft, ChevronRight, Monitor, Globe, LogOut,
  RefreshCw, ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Tab = "overview" | "logins" | "sessions";

export default function AdminSecurityPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [logins, setLogins] = useState<any>(null);
  const [sessions, setSessions] = useState<any>(null);
  const [loginPage, setLoginPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loginFilter, setLoginFilter] = useState<"" | "true" | "false">("");
  const [search, setSearch] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function loadOverview() {
    const res = await fetch(`${API}/admin/security/overview`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setOverview(await res.json());
  }

  const loadLogins = useCallback(async (p = 1, f = loginFilter, s = search) => {
    const q = new URLSearchParams({ page: String(p), ...(f && { success: f }), ...(s && { search: s }) });
    const res = await fetch(`${API}/admin/security/login-history?${q}`, { headers: authH() });
    setLogins(await res.json());
    setLoginPage(p);
  }, [loginFilter, search]);

  const loadSessions = useCallback(async (p = 1) => {
    const res = await fetch(`${API}/admin/security/sessions?page=${p}`, { headers: authH() });
    setSessions(await res.json());
    setSessionPage(p);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadOverview();
      await loadLogins();
      await loadSessions();
      setLoading(false);
    })();
  }, []);

  async function revokeSession(id: string) {
    setRevokingId(id);
    await fetch(`${API}/admin/security/sessions/${id}`, { method: "DELETE", headers: authH() });
    await loadSessions(sessionPage);
    await loadOverview();
    setRevokingId(null);
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: ShieldCheck },
    { id: "logins",   label: "Login History", icon: Globe },
    { id: "sessions", label: "Active Sessions", icon: Monitor },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Security Center</h1>
        <p className="text-sm text-slate-400 mt-0.5">Login activity, active sessions, and suspicious IPs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            )}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && overview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Failed Logins (24h)", value: overview.failedLogins24h, icon: XCircle, color: "bg-red-600", alert: overview.failedLogins24h > 20 },
              { label: "Success Logins (24h)", value: overview.successLogins24h, icon: CheckCircle, color: "bg-emerald-600", alert: false },
              { label: "Failed Logins (7d)", value: overview.failedLogins7d, icon: ShieldAlert, color: "bg-orange-600", alert: false },
              { label: "Active Sessions", value: overview.activeSessions, icon: Monitor, color: "bg-indigo-600", alert: false },
            ].map(card => (
              <div key={card.label} className={cn(
                "bg-slate-800 border rounded-xl p-4",
                card.alert ? "border-red-600/50" : "border-slate-700"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.color)}>
                    <card.icon className="w-4 h-4 text-white" />
                  </div>
                  {card.alert && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                </div>
                <p className={cn("text-2xl font-bold", card.alert ? "text-red-400" : "text-white")}>{card.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Top failed IPs */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Top Failed Login IPs (Last 7 days)
            </h2>
            {overview.topFailedIps?.length === 0 ? (
              <p className="text-slate-500 text-sm">No failed login attempts</p>
            ) : (
              <div className="space-y-2">
                {overview.topFailedIps?.map((item: any, i: number) => (
                  <div key={item.ip} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 font-mono w-5">#{i + 1}</span>
                      <code className="text-sm font-mono text-slate-200">{item.ip ?? "Unknown"}</code>
                    </div>
                    <span className={cn("text-sm font-bold tabular-nums", item.count > 10 ? "text-red-400" : "text-amber-400")}>
                      {item.count} attempts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOGIN HISTORY */}
      {tab === "logins" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") loadLogins(1, loginFilter, search); }}
                placeholder="Search email, IP..." className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-9" />
            </div>
            <select value={loginFilter} onChange={e => { setLoginFilter(e.target.value as any); loadLogins(1, e.target.value as any, search); }}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 h-9 outline-none">
              <option value="">All</option>
              <option value="true">Success only</option>
              <option value="false">Failed only</option>
            </select>
            <Button onClick={() => loadLogins(1, loginFilter, search)} size="sm" variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-9 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </Button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["Result", "Email", "IP Address", "Device", "Time"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {(logins?.items ?? []).map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        {log.success ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                            <XCircle className="w-3.5 h-3.5" />Failed
                          </span>
                        )}
                        {log.failureReason && <p className="text-[10px] text-slate-500 mt-0.5">{log.failureReason}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-200 text-xs font-mono">{log.emailAttempted}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-300 font-mono">{log.ipAddress ?? "—"}</code>
                        {log.country && <p className="text-[10px] text-slate-500">{log.city ? `${log.city}, ` : ""}{log.country}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {log.deviceType ?? "—"}
                        {log.browser && <span className="text-slate-500"> · {log.browser}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {logins?.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Page {loginPage} of {logins.pages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={loginPage <= 1} onClick={() => loadLogins(loginPage - 1)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />Prev
                </Button>
                <Button size="sm" variant="outline" disabled={loginPage >= logins.pages} onClick={() => loadLogins(loginPage + 1)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
                  Next<ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE SESSIONS */}
      {tab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">{sessions?.total ?? 0} active sessions</p>
            <Button onClick={() => loadSessions(1)} size="sm" variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </Button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700/50">
            {(sessions?.items ?? []).length === 0 ? (
              <div className="text-center py-16 text-slate-500">No active sessions</div>
            ) : (
              (sessions?.items ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center gap-4 px-4 py-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Monitor className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm">
                        {s.user?.firstName} {s.user?.lastName ?? ""}
                      </p>
                      <span className="text-xs text-slate-500">{s.user?.company?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <code className="font-mono">{s.ipAddress ?? "—"}</code>
                      {s.deviceType && <span>· {s.deviceType}</span>}
                      {s.browser && <span>· {s.browser}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Last active: {fmtDate(s.lastUsedAt)} · Expires: {fmtDate(s.expiresAt)}</p>
                  </div>
                  <Button size="sm" variant="ghost"
                    onClick={() => revokeSession(s.id)}
                    disabled={revokingId === s.id}
                    className="text-red-400 hover:bg-red-900/20 hover:text-red-300 gap-1.5 h-8 flex-shrink-0">
                    {revokingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>

          {sessions?.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Page {sessionPage} of {sessions.pages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={sessionPage <= 1} onClick={() => loadSessions(sessionPage - 1)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />Prev
                </Button>
                <Button size="sm" variant="outline" disabled={sessionPage >= sessions.pages} onClick={() => loadSessions(sessionPage + 1)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
                  Next<ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
