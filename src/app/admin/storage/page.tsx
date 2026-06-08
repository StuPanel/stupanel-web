"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HardDrive, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { Authorization: `Bearer ${getToken()}` }; }

function fmtBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function UsageBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / (max * 1024 * 1024 * 1024)) * 100, 100) : 0;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function AdminStoragePage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const res = await fetch(`${API}/admin/storage?page=${p}&limit=20`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    const d = await res.json();
    setData(d);
    setPage(p);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, []);

  const total = data?.platformTotal;

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Storage Monitor</h1>
        <p className="text-sm text-slate-400 mt-0.5">File storage usage across all studios</p>
      </div>

      {/* Platform total card */}
      {total && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Total Platform Storage</p>
              <p className="text-xs text-slate-400">Across all {data?.total ?? 0} studios</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-white">{fmtBytes(total.bytes)}</p>
              <p className="text-xs text-slate-400">{total.gb} GB total</p>
            </div>
          </div>
        </div>
      )}

      {/* Studios table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Studio", "Plan", "Used", "Limit", "Usage", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {(data?.studios ?? []).map((s: any) => {
                  const pct = s.maxGb > 0 ? (s.storageGb / s.maxGb) * 100 : 0;
                  const isHigh = pct > 90;
                  return (
                    <tr key={s.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{s.name}</p>
                        <p className="text-xs text-slate-500">/{s.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{s.plan?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-mono text-sm", isHigh ? "text-red-400" : "text-white")}>
                          {fmtBytes(s.storageUsedBytes)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm">{s.maxGb} GB</td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <UsageBar used={s.storageUsedBytes} max={s.maxGb} />
                      </td>
                      <td className="px-4 py-3">
                        {isHigh ? (
                          <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                            <AlertTriangle className="w-3 h-3" />Near limit
                          </span>
                        ) : (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                            s.subscriptionStatus === "active"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-600/30"
                              : "bg-amber-500/20 text-amber-400 border-amber-600/30"
                          )}>
                            {s.subscriptionStatus}
                          </span>
                        )}
                      </td>
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
          <p className="text-xs text-slate-500">Page {page} of {data.pages}</p>
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
