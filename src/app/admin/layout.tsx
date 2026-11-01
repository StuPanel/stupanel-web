"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Building2, Users, CreditCard, Flag,
  Settings, LogOut, Menu, X, ChevronRight,   ClipboardList, Tag, BarChart2, MessageCircle, Megaphone,
  HardDrive, Mail, ShieldAlert, Wallet, UserCog, UsersRound, History, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/app-sidebar";
import { API_URL } from "@/lib/api";
import {
  can, getPlatformUser, installAdminFetchShim, isAdminHost, isPlatformMode, platformLogout, refreshPlatform,
  type PlatformUser,
} from "@/lib/platform-api";

function getAdminToken() {
  return typeof window !== "undefined" ? sessionStorage.getItem("admin_token") ?? "" : "";
}

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; perm?: string; platformOnly?: boolean }

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard",  href: "/admin/dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
      { label: "Revenue",    href: "/admin/revenue", icon: BarChart2, perm: "billing.view" },
      { label: "Payments",   href: "/admin/billing", icon: Wallet, perm: "billing.view" },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Studios",       href: "/admin/studios", icon: Building2, perm: "studios.view" },
      { label: "Users",         href: "/admin/users", icon: Users, perm: "users.view" },
      { label: "Plans",         href: "/admin/plans", icon: CreditCard, perm: "billing.view" },
      { label: "Coupons",       href: "/admin/coupons", icon: Tag, perm: "billing.view" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Feature Flags", href: "/admin/feature-flags", icon: Flag, perm: "settings.manage" },
      { label: "Settings",      href: "/admin/settings", icon: Settings, perm: "settings.manage" },
      { label: "Broadcast",     href: "/admin/broadcast", icon: Megaphone, perm: "content.manage" },
      { label: "Support",       href: "/admin/support", icon: MessageCircle, perm: "support.view" },
      { label: "Audit Logs",    href: "/admin/audit-logs", icon: ClipboardList, perm: "audit.view" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Team",         href: "/admin/team",     icon: UsersRound, perm: "team.manage", platformOnly: true },
      { label: "Activity log", href: "/admin/activity", icon: History,    perm: "audit.view",  platformOnly: true },
      { label: "My account",   href: "/admin/account",  icon: UserCog,    platformOnly: true },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { label: "Storage",    href: "/admin/storage", icon: HardDrive, perm: "reports.view" },
      { label: "Email Logs", href: "/admin/email-logs", icon: Mail, perm: "reports.view" },
      { label: "Security",   href: "/admin/security", icon: ShieldAlert, perm: "security.manage" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState<PlatformUser | null>(null);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    let alive = true;
    installAdminFetchShim();
    (async () => {
      // On admin.stupanel.com only the new team sign-in exists
      if (isAdminHost() && isLogin) { router.replace("/login"); return; }
      if (isLogin) { setReady(true); return; }
      let mode: "platform" | "legacy" | null = null;
      if (isPlatformMode() && getAdminToken()) mode = "platform";
      else if (getAdminToken()) mode = "legacy";
      else if (await refreshPlatform()) mode = "platform"; // new tab: the sign-in cookie is still valid
      if (!alive) return;
      if (!mode || (mode === "legacy" && isAdminHost())) { router.replace(isAdminHost() ? "/login" : "/admin/login"); return; }
      const u = mode === "platform" ? getPlatformUser() : null;
      setStaff(u);
      setAdminName(u?.name ?? localStorage.getItem("admin_name") ?? "Admin");
      setReady(true);
    })();
    return () => { alive = false; };
  }, [router, pathname, isLogin]);

  // Keep the 15-minute token fresh while the panel is open
  useEffect(() => {
    if (!staff) return;
    const t = setInterval(() => { refreshPlatform().then(ok => { if (ok) setStaff(getPlatformUser()); }); }, 12 * 60 * 1000);
    return () => clearInterval(t);
  }, [staff]);

  if (isLogin) {
    return <>{children}</>;
  }
  if (!ready) {
    return <div className="h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;
  }

  const visibleGroups = navGroups
    .map(g => ({ ...g, items: g.items.filter(i => staff ? (!i.perm || can(staff, i.perm)) : !i.platformOnly) }))
    .filter(g => g.items.length);
  const roleLabel = staff ? (staff.isOwner ? "Owner" : staff.role?.name ?? "Staff") : "Super Admin";

  function logout() {
    if (staff) { platformLogout(); return; }
    sessionStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    router.replace("/admin/login");
  }

  function Sidebar() {
    return (
      <aside className="flex flex-col w-60 h-full bg-slate-950 border-r border-slate-800">
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <BrandMark size={34} />
            <div>
              <p className="font-bold text-white text-sm leading-none">StuPanel</p>
              <p className="text-xs text-slate-500 mt-0.5">Admin Panel</p>
            </div>
          </div>
          <button className="lg:hidden p-1 rounded-lg hover:bg-slate-800" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Admin badge */}
        <div className="px-4 py-3 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-700 flex items-center justify-center font-bold text-xs text-white">
              {adminName?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">{adminName}</p>
              <span className="text-xs text-indigo-400 font-medium">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {visibleGroups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 mb-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        active
                          ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      )}>
                      <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-indigo-400" : "text-slate-500")} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="w-3 h-3 text-indigo-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-950/30 transition-colors">
            <LogOut className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-800">
            <Menu className="w-5 h-5 text-slate-400" />
          </button>
          <span className="font-bold text-white text-sm">Admin Panel</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-700 flex items-center justify-center font-bold text-xs text-white">
            {adminName?.[0]?.toUpperCase() ?? "A"}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {!staff && <TeamSetupBanner />}
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Old super-admin login only: one-time button that sends the first Owner invite
 * for the new team sign-in (works only while the team is still empty).
 */
function TeamSetupBanner() {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "hidden">("idle");
  const [msg, setMsg] = useState("");
  useEffect(() => { try { if (localStorage.getItem("platform_setup_hidden") === "1") setState("hidden"); } catch {} }, []);
  if (state === "hidden") return null;
  async function start() {
    setState("loading"); setMsg("");
    try {
      const r = await fetch(`${API_URL}/platform/auth/bootstrap`, { method: "POST", headers: { Authorization: `Bearer ${getAdminToken()}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.message || "Could not start the setup."); setState("idle"); return; }
      setMsg(`Invite sent to ${d.email}. Open the email (or the link below) to create your Owner account with two-step sign-in.`);
      if (d.link) setMsg(m => m + "|" + d.link);
      setState("sent");
    } catch { setMsg("Could not reach the server."); setState("idle"); }
  }
  const [text, link] = msg.split("|");
  return (
    <div className="m-4 mb-0 rounded-xl border border-indigo-800/60 bg-indigo-950/40 p-4 text-sm text-indigo-100 flex flex-col sm:flex-row sm:items-center gap-3">
      <Sparkles className="w-5 h-5 text-indigo-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">New: StuPanel Admin team sign-in</p>
        <p className="text-xs text-indigo-200/80 mt-0.5">{text || "Separate admin accounts with two-step sign-in, roles for your staff and a full activity log. Start by creating your Owner account."}</p>
        {link && <a href={link} className="text-xs font-semibold text-indigo-300 underline break-all">Open my invite</a>}
      </div>
      {state !== "sent" && (
        <div className="flex gap-2">
          <button onClick={start} disabled={state === "loading"} className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
            {state === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Set up team sign-in
          </button>
          <button onClick={() => { try { localStorage.setItem("platform_setup_hidden", "1"); } catch {} setState("hidden"); }} className="h-9 px-3 rounded-lg text-xs text-indigo-300 hover:bg-indigo-900/40">Later</button>
        </div>
      )}
    </div>
  );
}
