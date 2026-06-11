"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2, Camera, CalendarDays, Clock,
  MapPin, Phone, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function getToken() { return localStorage.getItem("access_token") ?? ""; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  inquiry:            { label: "Inquiry",      color: "bg-slate-100 text-slate-600",   dot: "bg-slate-400" },
  confirmed:          { label: "Confirmed",    color: "bg-blue-100 text-blue-700",     dot: "bg-blue-500" },
  advance_received:   { label: "Advance Paid", color: "bg-cyan-100 text-cyan-700",     dot: "bg-cyan-500" },
  in_progress:        { label: "In Progress",  color: "bg-amber-100 text-amber-700",   dot: "bg-amber-500" },
  editing:            { label: "Editing",      color: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  ready_for_delivery: { label: "Ready",        color: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  completed:          { label: "Completed",    color: "bg-emerald-100 text-emerald-700",dot:"bg-emerald-500" },
  cancelled:          { label: "Cancelled",    color: "bg-red-100 text-red-600",       dot: "bg-red-500" },
};

interface DashData {
  total: number;
  upcoming: number;
  statusCounts: Record<string, number>;
  recentUpcoming: {
    id: string; bookingNumber: string; eventName?: string;
    eventDate?: string; eventLocation?: string; status: string;
    deliveryLink?: string;
    client: { firstName: string; lastName?: string; phone?: string };
  }[];
}

function StatCard({ icon: Icon, label, value, color, bg, className }: {
  icon: React.ElementType; label: string; value: number;
  color: string; bg: string; className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 p-4", className)}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", bg)}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function MemberDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/member/dashboard`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
    </div>
  );

  if (!data) return (
    <div className="p-6 text-center text-slate-400">Could not load dashboard.</div>
  );

  const activeStatuses = ["confirmed","advance_received","in_progress","editing","ready_for_delivery"];
  const activeCount = activeStatuses.reduce((s, k) => s + (data.statusCounts[k] ?? 0), 0);

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your assigned programs overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Camera} label="Total Programs" value={data.total} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard icon={CalendarDays} label="Upcoming (30d)" value={data.upcoming} color="text-blue-600" bg="bg-blue-50" />
        <StatCard icon={Clock} label="Active" value={activeCount} color="text-amber-600" bg="bg-amber-50" className="col-span-2 md:col-span-1" />
      </div>

      {/* Status breakdown */}
      {Object.keys(data.statusCounts).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Status Breakdown</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.statusCounts).map(([status, count]) => {
              const cfg = STATUS_CFG[status] ?? { label: status, color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
              return (
                <span key={status} className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold", cfg.color)}>
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                  {cfg.label} · {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-800">Upcoming Programs</p>
          <Link href="/member/programs" className="text-xs text-indigo-600 font-semibold flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {data.recentUpcoming.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-slate-200">
            <Camera className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No upcoming programs</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.recentUpcoming.map(b => {
              const cfg = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
              return (
                <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{b.eventName || "Event"}</p>
                      <p className="text-xs text-slate-400 font-mono">{b.bookingNumber}</p>
                    </div>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0", cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-2">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />{fmtDate(b.eventDate)}
                    </span>
                    {b.eventLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{b.eventLocation}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {b.client.firstName[0]}
                      </div>
                      {b.client.firstName} {b.client.lastName ?? ""}
                      {b.client.phone && (
                        <a href={`tel:${b.client.phone}`} className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 ml-1">
                          <Phone className="w-3 h-3" />{b.client.phone}
                        </a>
                      )}
                    </div>
                    {b.deliveryLink && (
                      <a href={b.deliveryLink} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                        Delivery <ArrowRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
