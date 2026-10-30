"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, CalendarDays, Camera } from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField } from "@/components/ui/apple";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { STATUS_CFG } from "./_components/constants";

const STATUS_HEX: Record<string, string> = {
  inquiry: "#C2304F", quote_sent: "#9E3A8C", confirmed: "#7D5CEF", advance_received: "#5B3FD0", in_progress: "#126B66",
  editing: "#1F5C99", ready_for_delivery: "#7D5CEF", delivered: "#4A4658", completed: "#1F8A5B", cancelled: "#8A2E2E", refunded: "#8A2E2E",
};
import { ProgramRow, DeleteDialog } from "./_components/program-card";
import { ProgramDrawer } from "./_components/program-drawer";
import { ViewDrawer } from "./_components/view-drawer";
import type { Booking, Package, TeamMember } from "./_components/types";

// Module-level cache: packages/team/company rarely change, no need to re-fetch on every filter/page change
let _cachedPackages: Package[] = [];
let _cachedTeam: TeamMember[] = [];
let _cachedR2Enabled = false;
let _staticLoaded = false;

export default function ProgramsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, statusCounts: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [packages, setPackages] = useState<Package[]>(_cachedPackages);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(_cachedTeam);
  const [r2Enabled, setR2Enabled] = useState(_cachedR2Enabled);

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

      // Only fetch static data once per session
      const staticFetches = _staticLoaded ? [] : [
        apiFetch(`${API}/packages`),
        apiFetch(`${API}/team`),
        apiFetch(`${API}/companies/me`),
      ];

      const [bRes, ...staticRes] = await Promise.all([
        apiFetch(`${API}/bookings?${params}`),
        ...staticFetches,
      ]);

      if (bRes.ok) { const d = await bRes.json(); setBookings(d.data ?? []); setMeta(d.meta); }

      if (!_staticLoaded && staticRes.length === 3) {
        const [pkgRes, tmRes, compRes] = staticRes;
        if (pkgRes.ok) { const d = await pkgRes.json(); _cachedPackages = d.data ?? d ?? []; setPackages(_cachedPackages); }
        if (tmRes.ok) { _cachedTeam = await tmRes.json(); setTeamMembers(_cachedTeam); }
        if (compRes.ok) { const d = await compRes.json(); _cachedR2Enabled = !!d.r2Enabled; setR2Enabled(_cachedR2Enabled); }
        _staticLoaded = true;
      }
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
    <div className="max-w-[1180px]">
      <PageHeader icon={Camera} color="deep" title="Programs"
        sub={meta.total ? `${meta.total} program${meta.total === 1 ? "" : "s"}` : "All your shoots and events"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} placeholder="Search programs"
          onChange={v => { setSearch(v); setPage(1); }} />
        <MainButton icon={Plus} onClick={() => setNewOpen(true)}>New program</MainButton>
      </PageHeader>

      {allStatuses.length > 0 && (
        <Chips label="Filter by status" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
          options={[
            { value: "all", label: "All", count: Object.values(meta.statusCounts ?? {}).reduce((a, b) => a + b, 0) },
            ...allStatuses.filter(([s]) => STATUS_CFG[s]).map(([s, c]) => ({ value: s, label: STATUS_CFG[s].label, count: c, dot: STATUS_HEX[s] })),
          ]} />
      )}

      {loading ? (
        <RowsSkeleton n={6} />
      ) : bookings.length === 0 ? (
        search || statusFilter !== "all" ? (
          <EmptyState icon={Search} title={search ? `No programs match "${search}"` : "No programs here"} text="Try another word or filter." />
        ) : (
          <EmptyState icon={CalendarDays} title="No programs yet" text="Add your first wedding, event or shoot."
            action={<MainButton icon={Plus} onClick={() => setNewOpen(true)}>New program</MainButton>} />
        )
      ) : (
        <Group>
          {bookings.map(b => (
            <ProgramRow key={b.id} b={b}
              onView={() => setViewTarget(b)}
              onEdit={() => setEditTarget(b)}
              onDelete={() => setDeleteTarget(b)} />
          ))}
        </Group>
      )}

      <Pager page={page} pages={meta.totalPages} onChange={setPage} />

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
