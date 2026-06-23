"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Loader2, Search, X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { STATUS_CFG } from "./_components/constants";
import { ProgramCard, DeleteDialog } from "./_components/program-card";
import { ProgramDrawer } from "./_components/program-drawer";
import { ViewDrawer } from "./_components/view-drawer";
import type { Booking, Package, TeamMember } from "./_components/types";

export default function ProgramsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, statusCounts: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [packages, setPackages] = useState<Package[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [r2Enabled, setR2Enabled] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Booking | null>(null);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const [bRes, pkgRes, tmRes, compRes] = await Promise.all([
        apiFetch(`${API}/bookings?${params}`),
        apiFetch(`${API}/packages`),
        apiFetch(`${API}/team`),
        apiFetch(`${API}/companies/me`),
      ]);
      if (bRes.ok) { const d = await bRes.json(); setBookings(d.data ?? []); setMeta(d.meta); }
      if (pkgRes.ok) { const d = await pkgRes.json(); setPackages(d.data ?? d ?? []); }
      if (tmRes.ok) { setTeamMembers(await tmRes.json()); }
      if (compRes.ok) { const d = await compRes.json(); setR2Enabled(!!d.r2Enabled); }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-open drawer when navigating from search (?view=id)
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (!viewId || loading) return;
    const found = bookings.find((b) => b.id === viewId);
    if (found) {
      setViewTarget(found);
      router.replace("/programs", { scroll: false });
    } else {
      // Not in current page — fetch directly
      apiFetch(`${API}/bookings/${viewId}`).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setViewTarget(data);
          router.replace("/programs", { scroll: false });
        }
      });
    }
  }, [searchParams, bookings, loading, router]);

  const allStatuses = Object.entries(meta.statusCounts ?? {}).filter(([, c]) => c > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Programs</h1>
          <p className="text-slate-400 text-xs mt-0.5">{meta.total} total programs</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Program</span>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search programs..." className="pl-9 h-10 border-slate-200" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        {allStatuses.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setStatusFilter("all")}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                statusFilter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}>
              All · {meta.total}
            </button>
            {allStatuses.map(([s, c]) => {
              const sc = STATUS_CFG[s]; if (!sc) return null;
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                    statusFilter === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />{sc.label} · {c}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No programs yet</p>
          <Button onClick={() => setNewOpen(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
            <Plus className="w-4 h-4" />New Program
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map(b => (
            <ProgramCard key={b.id} b={b}
              onView={() => setViewTarget(b)}
              onEdit={() => setEditTarget(b)}
              onDelete={() => setDeleteTarget(b)} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:border-slate-300">← Prev</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.totalPages}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:border-slate-300">Next →</button>
        </div>
      )}

      <ProgramDrawer open={newOpen} onClose={() => setNewOpen(false)} onSaved={fetchAll} packages={packages} teamMembers={teamMembers} />
      <ProgramDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { fetchAll(); setEditTarget(null); }}
        packages={packages}
        teamMembers={teamMembers}
        initialBooking={editTarget}
      />
      <ViewDrawer
        booking={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={() => { setEditTarget(viewTarget); setViewTarget(null); }}
        onRefresh={fetchAll}
        r2Enabled={r2Enabled}
        teamMembers={teamMembers}
      />
      <DeleteDialog booking={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchAll} />
    </div>
  );
}
