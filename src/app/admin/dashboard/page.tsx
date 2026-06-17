"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  Building2, Users, TrendingUp, BookOpen,
  Activity, AlertTriangle, Loader2, DollarSign,
} from "lucide-react";

function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface DashData {
  totalStudios: number;
  activeStudios: number;
  trialingStudios: number;
  suspendedStudios: number;
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  newStudiosThisMonth: number;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/admin/dashboard`, { headers: authHeaders() })
      .then(r => {
        if (r.status === 401 || r.status === 403) { router.replace("/admin/login"); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => { if (d) setData(d); else setError("Failed to load"); })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-red-400 flex items-center gap-2">
      <AlertTriangle className="w-5 h-5" />{error}
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-slate-400 mt-0.5">Real-time stats across all StuPanel studios</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Studios" value={data?.totalStudios ?? 0} color="bg-indigo-600" />
        <StatCard icon={Activity} label="Active Studios" value={data?.activeStudios ?? 0} color="bg-emerald-600" />
        <StatCard icon={AlertTriangle} label="On Trial" value={data?.trialingStudios ?? 0} color="bg-amber-600" />
        <StatCard icon={AlertTriangle} label="Suspended" value={data?.suspendedStudios ?? 0} color="bg-red-600" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={data?.totalUsers ?? 0} color="bg-purple-600" />
        <StatCard icon={BookOpen} label="Total Bookings" value={data?.totalBookings ?? 0} color="bg-sky-600" />
        <StatCard icon={DollarSign} label="Total Revenue" value={formatCurrency(Number(data?.totalRevenue ?? 0))} color="bg-teal-600" />
        <StatCard icon={TrendingUp} label="New This Month" value={data?.newStudiosThisMonth ?? 0} color="bg-violet-600" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Manage Studios", href: "/admin/studios", desc: "View & control all studios", color: "from-indigo-600 to-blue-600" },
          { label: "Manage Plans", href: "/admin/plans", desc: "Create & update pricing plans", color: "from-emerald-600 to-teal-600" },
          { label: "Feature Flags", href: "/admin/feature-flags", desc: "Toggle platform features", color: "from-purple-600 to-violet-600" },
        ].map(item => (
          <a key={item.href} href={item.href}
            className={`bg-gradient-to-br ${item.color} rounded-xl p-5 block hover:opacity-90 transition-opacity`}>
            <p className="font-bold text-white text-sm">{item.label}</p>
            <p className="text-xs text-white/70 mt-1">{item.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
