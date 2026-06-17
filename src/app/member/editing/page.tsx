"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Video, CalendarDays, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";

function getToken() { return localStorage.getItem("access_token") ?? ""; }
function authFetch(url: string, opts?: RequestInit) {
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts?.headers ?? {}) } });
}

const ASSIGNMENT_STATUS: Record<string, { label: string; color: string }> = {
  assigned:           { label: "Assigned",       color: "bg-slate-100 text-slate-600" },
  in_progress:        { label: "In Progress",    color: "bg-blue-100 text-blue-700" },
  submitted:          { label: "Submitted",      color: "bg-amber-100 text-amber-700" },
  under_review:       { label: "Under Review",   color: "bg-yellow-100 text-yellow-700" },
  revision_requested: { label: "Revision",       color: "bg-red-100 text-red-700" },
  resubmitted:        { label: "Resubmitted",    color: "bg-orange-100 text-orange-700" },
  approved:           { label: "Approved",       color: "bg-emerald-100 text-emerald-700" },
  delivered:          { label: "Delivered",      color: "bg-green-100 text-green-700" },
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

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "revision_requested", label: "Revision" },
  { value: "approved", label: "Approved" },
];

export default function EditingPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<EditingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchEditing = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await authFetch(`${API}/member/editing?${params}`);
      if (r.ok) {
        const d = await r.json();
        setAssignments(d.data ?? d ?? []);
      }
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchEditing(); }, [fetchEditing]);

  return (
    <div className="p-5 md:p-7 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Editing</h1>
        <p className="text-xs text-slate-400 mt-0.5">Your editing assignments</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusFilter === f.value ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300")}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-16">
          <Video className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No editing assignments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const asc = ASSIGNMENT_STATUS[a.status] ?? { label: a.status, color: "bg-slate-100 text-slate-600" };
            const firstDate = a.booking.eventDays?.[0]?.date;
            const firstLocation = a.booking.eventDays?.[0]?.location;
            return (
              <button key={a.id}
                onClick={() => router.push(`/member/editing/${a.id}`)}
                className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{a.booking.eventName ?? a.booking.bookingNumber}</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", asc.color)}>{asc.label}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      <span className={cn("px-1.5 py-0.5 rounded font-medium", a.role === "photo_editor" ? "bg-indigo-50 text-indigo-600" : "bg-purple-50 text-purple-600")}>
                        {a.role === "photo_editor" ? "Photo Editor" : "Video Editor"}
                      </span>
                      <span>{a.booking.client.firstName} {a.booking.client.lastName ?? ""}</span>
                      {firstDate && (
                        <span className="flex items-center gap-0.5"><CalendarDays className="w-3 h-3" />{fmtDate(firstDate)}</span>
                      )}
                    </div>
                    {(a.editingDeadline || a.deliveryDeadline) && (
                      <div className="flex gap-3 mt-1.5 text-[10px] text-slate-400">
                        {a.editingDeadline && <span>✏️ {fmtDate(a.editingDeadline)}</span>}
                        {a.deliveryDeadline && <span>📦 {fmtDate(a.deliveryDeadline)}</span>}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
