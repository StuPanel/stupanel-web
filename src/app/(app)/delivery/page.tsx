"use client";

import { ImageIcon as HeaderIcon } from "lucide-react";
import { Chips, EmptyState, Group, PageHeader, Pager, RowsSkeleton, SearchField, StatCard } from "@/components/ui/apple";

import { useState, useEffect, useCallback } from "react";
import { Search, Video, Package, Link2, CheckCircle2 } from "lucide-react";
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
    <div>
      <PageHeader icon={HeaderIcon} color="teal" title="Delivery" sub={<>Track photo &amp; video delivery for each program</>}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search programs or clients" />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <StatCard icon={Video} color="blue" label="Editing" value={String(editingCount)} sub="Shooting or editing" />
        <StatCard icon={Package} color="violet" label="Ready to deliver" value={String(readyCount)} />
        <StatCard icon={Link2} color="teal" label="Links added" value={String(withLink)} />
        <StatCard icon={CheckCircle2} color="green" label="Delivered" value={String(delivered)} />
      </div>

      <Chips label="Filter by stage" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
        options={FILTER_TABS.map(t => ({ value: t.key, label: t.label }))} />

      {loading ? (
        <RowsSkeleton n={6} />
      ) : bookings.length === 0 ? (
        <EmptyState icon={search ? Search : Package} title={search ? `No programs match "${search}"` : "Nothing to deliver here"}
          text={search ? "Try another name." : "Confirmed programs show here when it's time to deliver."} />
      ) : (
        <Group>
          {bookings.map(b => <DeliveryCard key={b.id} b={b} onEdit={() => setEditTarget(b)} />)}
        </Group>
      )}

      <Pager page={page} pages={meta.totalPages} onChange={setPage} />

      <DeliveryModal booking={editTarget} onClose={() => setEditTarget(null)} onSaved={onSaved} />
    </div>
  );
}
