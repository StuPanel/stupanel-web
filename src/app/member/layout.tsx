"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import {
  LayoutDashboard, Camera, LogOut, Menu, X, ChevronRight, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : ""; }

const navItems = [
  { label: "Dashboard",   href: "/member/dashboard", icon: LayoutDashboard },
  { label: "My Programs", href: "/member/programs",  icon: Camera },
  { label: "My Profile",  href: "/member/profile",   icon: UserCircle },
];

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ firstName?: string; lastName?: string; memberRoles?: string[] } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    const role = localStorage.getItem("user_role");
    if (role !== "staff") { router.replace("/dashboard"); return; }

    apiFetch(`${API}/member/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProfile(d); })
      .catch(() => {});
  }, [router]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
    router.replace("/login");
  }

  function Sidebar() {
    return (
      <aside className="flex flex-col w-60 h-full bg-white border-r border-slate-200">
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-none">StuPanel</p>
              <p className="text-xs text-slate-400 mt-0.5">Member Portal</p>
            </div>
          </div>
          <button className="lg:hidden p-1 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Profile */}
        {profile && (
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-sm text-indigo-700">
                {(profile.firstName?.[0] ?? "M").toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 leading-none">
                  {profile.firstName} {profile.lastName ?? ""}
                </p>
                {profile.memberRoles?.[0] && (
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{profile.memberRoles[0]}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(item => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                )}>
                <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-indigo-600" : "text-slate-400")} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 text-indigo-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-200">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <span className="font-bold text-slate-900 text-sm">StuPanel</span>
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-sm text-indigo-700">
            {(profile?.firstName?.[0] ?? "M").toUpperCase()}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
