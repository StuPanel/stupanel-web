"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Search, X, Video, Package, Link2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { FILTER_TABS } from "./_components/constants";
import { DeliveryCard } from "./_components/delivery-card";
import { DeliveryModal } from "./_components/delivery-modal";
import type { Booking } from "./_components/types";

export default function DeliveryPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (search) params.set("search", search);
      const targetStatus = statusFilter !== "all" ? statusFilter : undefined;
      if (targetStatus) params.set("status", targetStatus);
      const r = await apiFetch(`${API}/bookings?${params}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) {
        const d = await r.json();
        const items = (d.data ?? []).filter((b: Booking) =>
          !["inquiry", "quote_sent", "cancelled", "refunded"].includes(b.status)
        );
        setBookings(items);
        setMeta(d.meta);
      }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function onSaved(updated: Booking) {
    setBookings(bs => bs.map(b => b.id === updated.id ? { ...b, ...updated } : b));
  }

  const delivered    = bookings.filter(b => b.status === "delivered" || b.status === "completed").length;
  const withLink     = bookings.filter(b => (b.deliveryLinks?.length ?? 0) > 0 || !!b.deliveryLink).length;
  const readyCount   = bookings.filter(b => b.status === "ready_for_delivery").length;
  const editingCount = bookings.filter(b => b.status === "editing" || b.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Delivery</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track photo &amp; video delivery for each program</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Editing",          value: editingCount,  icon: Video,          color: "text-orange-600", bg: "bg-orange-50"  },
          { label: "Ready to Deliver", value: readyCount,    icon: Package,        color: "text-indigo-600", bg: "bg-indigo-50"  },
          { label: "Links Added",      value: withLink,      icon: Link2,          color: "text-blue-600",   bg: "bg-blue-50"    },
          { label: "Delivered",        value: delivered,     icon: CheckCircle2,   color: "text-emerald-600",bg: "bg-emerald-50" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{s.value}</p>
              </div>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-4 h-4", s.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search programs or clients..." className="pl-9 h-10 border-slate-200" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                statusFilter === tab.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No programs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map(b => (
            <DeliveryCard key={b.id} b={b} onEdit={() => setEditTarget(b)} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">← Prev</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.totalPages}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40">Next →</button>
        </div>
      )}

      <DeliveryModal booking={editTarget} onClose={() => setEditTarget(null)} onSaved={onSaved} />
    </div>
  );
}
