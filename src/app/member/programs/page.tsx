"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera, Loader2, MapPin, Phone } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { Chips, DateBox, EmptyState, PageHeader, Pager, RowsSkeleton } from "@/components/ui/apple";
import { Card, StatusBadge } from "../_components/kit";
import Link from "next/link";

const NEXT_TRANSITIONS: Record<string, string> = {
  confirmed: "editing", advance_received: "editing", in_progress: "editing", editing: "ready_for_delivery",
};
const TRANSITION_LABELS: Record<string, string> = { editing: "Mark editing", ready_for_delivery: "Mark ready" };

interface Booking {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; eventLocation?: string; status: string;
  deliveryLink?: string;
  client: { id: string; firstName: string; lastName?: string; phone?: string };
  program?: { id: string; name: string; category?: string };
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "Shooting" },
  { value: "editing", label: "Editing" },
  { value: "ready_for_delivery", label: "Ready" },
  { value: "completed", label: "Completed" },
];

export default function MemberProgramsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "15" });
    if (statusFilter !== "all") qs.set("status", statusFilter);
    const res = await apiFetch(`${API}/member/programs?${qs}`);
    if (res.ok) {
      const d = await res.json();
      setBookings(d.data ?? []);
      setTotalPages(d.meta?.totalPages ?? 1);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(bookingId: string, newStatus: string) {
    setUpdatingId(bookingId);
    const res = await apiFetch(`${API}/member/programs/${bookingId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    setUpdatingId(null);
  }

  return (
    <div>
      <PageHeader icon={Camera} color="deep" title="My programs" sub="Every program you work on" />
      <Chips label="Filter by status" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} options={FILTERS} />

      {loading ? <RowsSkeleton /> : bookings.length === 0 ? (
        <EmptyState icon={Camera} title="No programs here" text={statusFilter === "all" ? "When the studio adds you to a program, it shows up here." : "Try another filter."} />
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const next = NEXT_TRANSITIONS[b.status];
            return (
              <Card key={b.id} className="overflow-hidden">
                <Link href={`/member/programs/${b.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-[#F7F5FB] transition-colors">
                  <DateBox date={b.eventDate} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-[#17151F] truncate">{b.eventName || "Program"}</span>
                    <span className="block text-xs text-[#6B6680] truncate">
                      {b.client.firstName} {b.client.lastName ?? ""}{b.program ? ` · ${b.program.name}` : ""}
                      {b.eventLocation && <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {b.eventLocation}</>}
                    </span>
                  </span>
                  <StatusBadge status={b.status} />
                </Link>
                {(b.client.phone || b.deliveryLink || next) && (
                  <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-t border-[#EEEBF4] bg-[#FAF9FC]">
                    {b.client.phone && (
                      <a href={`tel:${b.client.phone}`} className="h-8 px-3 rounded-full bg-white text-[12px] font-semibold text-[#4A4658] inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
                        <Phone className="w-3.5 h-3.5" />Call client
                      </a>
                    )}
                    {b.deliveryLink && (
                      <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer" className="h-8 px-3 rounded-full bg-white text-[12px] font-semibold text-[#5B3FD0] inline-flex items-center shadow-[0_1px_2px_rgba(22,18,40,.06)]">Delivery</a>
                    )}
                    <span className="flex-1" />
                    {next && (
                      <button type="button" onClick={() => updateStatus(b.id, next)} disabled={updatingId === b.id}
                        className="h-8 px-3.5 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                        {updatingId === b.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{TRANSITION_LABELS[next]}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <div className="mt-4"><Pager page={page} pages={totalPages} onChange={setPage} /></div>
    </div>
  );
}
