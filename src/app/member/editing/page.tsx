"use client";

import { useState, useEffect, useCallback } from "react";
import { Video, CalendarDays } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chips, EmptyState, Group, ListRow, PageHeader, RowsSkeleton } from "@/components/ui/apple";

const ASSIGNMENT_STATUS: Record<string, { label: string; badge: string }> = {
  assigned:           { label: "Assigned",     badge: "bg-[#EEEDF2] text-[#4A4658]" },
  in_progress:        { label: "In progress",  badge: "bg-[#E6F0FB] text-[#1F5C99]" },
  submitted:          { label: "Submitted",    badge: "bg-[#FFF4E5] text-[#B45309]" },
  under_review:       { label: "Under review", badge: "bg-[#FFF4E5] text-[#B45309]" },
  revision_requested: { label: "Changes asked", badge: "bg-[#FDECEF] text-[#C2304F]" },
  resubmitted:        { label: "Sent again",   badge: "bg-[#FFF4E5] text-[#B45309]" },
  approved:           { label: "Approved",     badge: "bg-[#E9F5EF] text-[#1F8A5B]" },
  delivered:          { label: "Delivered",    badge: "bg-[#E9F5EF] text-[#1F8A5B]" },
};

interface EditingAssignment {
  id: string; role: string; status: string;
  editingDeadline?: string; deliveryDeadline?: string;
  booking: {
    id: string; bookingNumber: string; eventName?: string;
    eventDays?: { date?: string; location?: string }[];
    client: { firstName: string; lastName?: string };
  };
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "revision_requested", label: "Changes asked" },
  { value: "approved", label: "Approved" },
];

export default function EditingPage() {
  const [assignments, setAssignments] = useState<EditingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchEditing = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await apiFetch(`${API}/member/editing?${params}`);
      if (r.ok) { const d = await r.json(); setAssignments(d.data ?? d ?? []); }
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchEditing(); }, [fetchEditing]);

  return (
    <div>
      <PageHeader icon={Video} color="blue" title="Editing" sub="Photo and video editing given to you" />
      <Chips label="Filter by status" value={statusFilter} onChange={setStatusFilter} options={FILTERS} />

      {loading ? <RowsSkeleton n={4} /> : assignments.length === 0 ? (
        <EmptyState icon={Video} title="No editing work" text="When the studio gives you editing, it shows up here." />
      ) : (
        <Group>
          {assignments.map(a => {
            const st = ASSIGNMENT_STATUS[a.status] ?? { label: a.status, badge: "bg-[#EEEDF2] text-[#4A4658]" };
            const firstDate = a.booking.eventDays?.[0]?.date;
            const deadline = a.deliveryDeadline || a.editingDeadline;
            return (
              <ListRow key={a.id} href={`/member/editing/${a.id}`} icon={Video} color={a.role === "photo_editor" ? "deep" : "orchid"}
                title={a.booking.eventName ?? a.booking.bookingNumber}
                sub={<>{a.role === "photo_editor" ? "Photo editing" : "Video editing"} · {a.booking.client.firstName} {a.booking.client.lastName ?? ""}
                  {firstDate && <> · <CalendarDays className="inline w-3 h-3 -mt-0.5" /> {fmtDate(firstDate)}</>}
                  {deadline && <> · due {fmtDate(deadline)}</>}</>}
                right={<span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap", st.badge)}>{st.label}</span>} />
            );
          })}
        </Group>
      )}
    </div>
  );
}
