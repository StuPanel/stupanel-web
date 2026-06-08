"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, CalendarDays, AlertTriangle, Clock, DollarSign, Plus,
  Loader2, RefreshCw, CheckCheck, ChevronRight, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

const DISMISSED_KEY = "notif_dismissed";
function getDismissed(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")); } catch { return new Set(); } }
function saveDismissed(s: Set<string>) { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s].slice(-200))); }

interface Notif {
  id: string; type: string; priority: "high" | "medium" | "low";
  title: string; body: string; bookingId: string; bookingNumber: string; createdAt: string;
}
interface NotifResponse { total: number; unread: number; items: Notif[]; }

const TYPE_CFG: Record<string, { icon: typeof Bell; bg: string; iconColor: string; border: string }> = {
  upcoming: { icon: CalendarDays, bg: "bg-indigo-50",  iconColor: "text-indigo-600", border: "border-indigo-100" },
  overdue:  { icon: AlertTriangle, bg: "bg-red-50",    iconColor: "text-red-500",    border: "border-red-100"   },
  stuck:    { icon: Clock,         bg: "bg-amber-50",  iconColor: "text-amber-600",  border: "border-amber-100" },
  payment:  { icon: DollarSign,   bg: "bg-orange-50", iconColor: "text-orange-600", border: "border-orange-100"},
  new:      { icon: Plus,          bg: "bg-emerald-50",iconColor: "text-emerald-600",border: "border-emerald-100"},
};
const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500", medium: "bg-amber-400", low: "bg-slate-300",
};
const TYPE_LABEL: Record<string, string> = {
  upcoming: "Upcoming", overdue: "Overdue", stuck: "Stuck", payment: "Payment Due", new: "New",
};
const FILTER_TABS = [
  { key: "all",      label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue",  label: "Overdue" },
  { key: "payment",  label: "Payments" },
  { key: "stuck",    label: "Stuck" },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [data, setData] = useState<NotifResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { setDismissed(getDismissed()); }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await apiFetch(`${API}/dashboard/notifications`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function dismiss(id: string) {
    const next = new Set(dismissed); next.add(id);
    setDismissed(next); saveDismissed(next);
  }
  function dismissAll() {
    const next = new Set(dismissed);
    visible.forEach(n => next.add(n.id));
    setDismissed(next); saveDismissed(next);
  }

  const allItems = data?.items ?? [];
  const visible = allItems.filter(n => !dismissed.has(n.id) && (filter === "all" || n.type === filter));
  const highCount = allItems.filter(n => !dismissed.has(n.id) && n.priority === "high").length;

  const grouped: Record<string, Notif[]> = {};
  for (const n of visible) {
    if (!grouped[n.type]) grouped[n.type] = [];
    grouped[n.type].push(n);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Notifications
            {highCount > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {highCount}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {visible.length} active · {dismissed.size} dismissed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {visible.length > 0 && (
            <button onClick={dismissAll}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <CheckCheck className="w-3.5 h-3.5" />Clear all
            </button>
          )}
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map(tab => {
          const count = tab.key === "all"
            ? allItems.filter(n => !dismissed.has(n.id)).length
            : allItems.filter(n => !dismissed.has(n.id) && n.type === tab.key).length;
          if (tab.key !== "all" && count === 0) return null;
          return (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                filter === tab.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {tab.label} · {count}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <CheckCheck className="w-7 h-7 text-emerald-500" />
          </div>
          <p className="font-semibold text-slate-700">All clear!</p>
          <p className="text-sm text-slate-400 mt-1">No active notifications</p>
          <button onClick={() => fetchData(true)}
            className="mt-4 flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-600 mx-auto">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </button>
        </div>
      )}

      {/* Notifications grouped by type */}
      {Object.entries(grouped).map(([type, items]) => {
        const cfg = TYPE_CFG[type] ?? TYPE_CFG.upcoming;
        const Icon = cfg.icon;
        return (
          <div key={type} className="space-y-2">
            {/* Group header */}
            <div className="flex items-center gap-2">
              <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", cfg.bg)}>
                <Icon className={cn("w-3 h-3", cfg.iconColor)} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {TYPE_LABEL[type] ?? type}
              </span>
              <span className="text-xs text-slate-400">· {items.length}</span>
            </div>

            {/* Items */}
            {items.map(n => {
              const cfg2 = TYPE_CFG[n.type] ?? TYPE_CFG.upcoming;
              const Icon2 = cfg2.icon;
              return (
                <div key={n.id}
                  className={cn("flex items-start gap-3 p-4 rounded-2xl border transition-all hover:shadow-sm",
                    cfg2.bg, cfg2.border)}>
                  {/* Icon + priority dot */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm")}>
                      <Icon2 className={cn("w-4 h-4", cfg2.iconColor)} />
                    </div>
                    <span className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white", PRIORITY_DOT[n.priority])} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-mono text-slate-400 bg-white/70 px-1.5 py-0.5 rounded-md">{n.bookingNumber}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => router.push("/programs")}
                      className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-white/80 hover:bg-white border border-white/50 text-xs font-medium text-slate-700 transition-colors shadow-sm">
                      View <ChevronRight className="w-3 h-3" />
                    </button>
                    <button onClick={() => dismiss(n.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors px-1">
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Legend */}
      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
          {Object.entries(PRIORITY_DOT).map(([p, color]) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", color)} />
              <span className="text-xs text-slate-400 capitalize">{p} priority</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
