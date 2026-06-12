"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Monitor, FolderOpen, Link2, ExternalLink,
  Camera, Video, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function getToken() { return localStorage.getItem("access_token") ?? ""; }
function authFetch(url: string, opts?: RequestInit) {
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts?.headers ?? {}) } });
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  editing:            { label: "Editing",  color: "bg-purple-100 text-purple-700" },
  ready_for_delivery: { label: "Ready",    color: "bg-indigo-100 text-indigo-700" },
  completed:          { label: "Completed",color: "bg-emerald-100 text-emerald-700" },
  confirmed:          { label: "Confirmed",color: "bg-blue-100 text-blue-700" },
  in_progress:        { label: "Shooting", color: "bg-amber-100 text-amber-700" },
};

interface RawFilesInfo { pcName?: string; folderPath?: string; driveLink?: string; notes?: string }
interface Booking {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; status: string; currency: string;
  rawFilesInfo?: RawFilesInfo;
  client: { firstName: string; lastName?: string; phone?: string };
  team?: { roleInBooking: string; notes?: string }[];
}

function SubmitForm({ booking, onSubmitted }: { booking: Booking; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ deliveryLink: "", deliveryNote: "", deliveryDate: "", editingNote: "" });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(["ready_for_delivery", "completed"].includes(booking.status));

  async function submit() {
    if (!form.deliveryLink.trim() && !form.editingNote.trim()) return;
    setSaving(true);
    try {
      const r = await authFetch(`${API}/member/editing/${booking.id}/submit`, {
        method: "PATCH",
        body: JSON.stringify({
          deliveryMethod: form.deliveryLink ? "drive_link" : undefined,
          deliveryLink: form.deliveryLink || undefined,
          deliveryNote: form.deliveryNote || undefined,
          deliveryDate: form.deliveryDate || undefined,
          editingNote: form.editingNote || undefined,
        }),
      });
      if (r.ok) { setDone(true); setOpen(false); onSubmitted(); }
    } finally { setSaving(false); }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-200">
        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm text-emerald-700 font-medium">Editing submitted — awaiting studio review</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
      >
        <span className="text-sm font-semibold text-indigo-700">Submit Edited Output</span>
        {open ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />}
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-white">
          <div>
            <p className="text-xs text-slate-500 mb-1">Delivery Link (Drive / WeTransfer / Dropbox)</p>
            <input
              value={form.deliveryLink}
              onChange={e => setForm(f => ({ ...f, deliveryLink: e.target.value }))}
              placeholder="https://drive.google.com/..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Delivery Date</p>
              <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Note (optional)</p>
              <input value={form.deliveryNote} onChange={e => setForm(f => ({ ...f, deliveryNote: e.target.value }))}
                placeholder="200 photos, 2 reels..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Message to Studio</p>
            <textarea value={form.editingNote} onChange={e => setForm(f => ({ ...f, editingNote: e.target.value }))}
              placeholder="Editing complete. Color grading শেষ, review করুন।"
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <button onClick={submit} disabled={saving}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Submit to Studio
          </button>
        </div>
      )}
    </div>
  );
}

function EditingCard({ booking, onRefresh }: { booking: Booking; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CFG[booking.status] ?? { label: booking.status, color: "bg-slate-100 text-slate-600" };
  const rawInfo = booking.rawFilesInfo ?? {};
  const hasRaw = rawInfo.pcName || rawInfo.folderPath || rawInfo.driveLink || rawInfo.notes;
  const myRole = booking.team?.[0]?.roleInBooking;
  const sym = booking.currency === "BDT" ? "৳" : "$";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900 text-sm">{booking.eventName ?? booking.bookingNumber}</h3>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sc.color)}>{sc.label}</span>
                {myRole && (
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", myRole === "photo_editor" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700")}>
                    {myRole === "photo_editor" ? "Photo Editor" : "Video Editor"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {booking.client.firstName} {booking.client.lastName ?? ""} · {fmtDate(booking.eventDate)}
              </p>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Raw Files Info */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw Files</p>
            {hasRaw ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                {rawInfo.pcName && (
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-sm text-slate-700">{rawInfo.pcName}</span>
                  </div>
                )}
                {rawInfo.folderPath && (
                  <div className="flex items-start gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 font-mono break-all">{rawInfo.folderPath}</span>
                  </div>
                )}
                {rawInfo.driveLink && (
                  <a href={rawInfo.driveLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                    <Link2 className="w-3.5 h-3.5 shrink-0" />Open Drive Folder
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {rawInfo.notes && (
                  <p className="text-xs text-slate-500 bg-amber-50 rounded-lg px-3 py-2">{rawInfo.notes}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">Studio এখনো raw files info add করেনি</p>
            )}
          </div>

          {/* Submit Form */}
          <SubmitForm booking={booking} onSubmitted={onRefresh} />
        </div>
      )}
    </div>
  );
}

export default function EditingPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchEditing = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      const r = await authFetch(`${API}/member/editing?${params}`);
      if (r.ok) { const d = await r.json(); setBookings(d.data ?? []); }
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchEditing(); }, [fetchEditing]);

  const filters = [
    { value: "all", label: "All" },
    { value: "editing", label: "Editing" },
    { value: "ready_for_delivery", label: "Submitted" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Editing</h1>
        <p className="text-xs text-slate-400 mt-0.5">Programs assigned to you for editing</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", statusFilter === f.value ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300")}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16">
          <Video className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No editing assignments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => <EditingCard key={b.id} booking={b} onRefresh={fetchEditing} />)}
        </div>
      )}
    </div>
  );
}
