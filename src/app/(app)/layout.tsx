"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { LayoutDashboard, Camera, Users, CreditCard, UserCog, MailWarning, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { FloatingUploadPanel } from "@/components/floating-upload-panel";
import { cn } from "@/lib/utils";
import { AuthProvider, useAuth } from "@/context/auth-context";


const mobileNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Programs", href: "/programs", icon: Camera },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Team", href: "/team", icon: UserCog },
  { name: "Payments", href: "/payments", icon: CreditCard },
];

function VerificationBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      const { apiFetch, API_URL } = await import("@/lib/api");
      await apiFetch(`${API_URL}/auth/resend-verification`, { method: "POST" });
      setSent(true);
    } catch { /* silent */ }
    setSending(false);
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <MailWarning className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-800 flex-1">
        Please verify your email address <span className="font-semibold">{email}</span> to unlock all features.
      </p>
      {sent ? (
        <span className="text-sm text-emerald-700 font-medium">Email sent! Check your inbox.</span>
      ) : (
        <button onClick={resend} disabled={sending}
          className="text-sm font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 flex items-center gap-1 disabled:opacity-60">
          {sending && <span className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin inline-block" />}
          Resend email
        </button>
      )}
      <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Layout skeleton shown while auth loads
function AppLayoutSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="h-full flex bg-slate-50">
      <div className={cn("hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-30", collapsed ? "lg:w-16" : "lg:w-64")}>
        <div className="flex flex-col w-full h-full bg-white border-r border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 animate-pulse flex-shrink-0" />
            {!collapsed && <div className="flex-1 space-y-1.5"><div className="h-3.5 bg-slate-200 rounded animate-pulse w-24" /><div className="h-2.5 bg-slate-100 rounded animate-pulse w-32" /></div>}
          </div>
          <div className="flex-1 p-3 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn("h-9 rounded-lg bg-slate-100 animate-pulse", i % 3 === 0 && "opacity-60")} />
            ))}
          </div>
        </div>
      </div>
      <div className={cn("flex-1 flex flex-col", collapsed ? "lg:ml-16" : "lg:ml-64")}>
        <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4">
          <div className="h-9 w-72 bg-slate-100 rounded-md animate-pulse" />
          <div className="flex-1" />
          <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
          <div className="w-28 h-9 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <main className="flex-1 p-6">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
            </div>
            <div className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, ready, emailVerified } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar_collapsed") === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      localStorage.setItem("sidebar_collapsed", String(!prev));
      return !prev;
    });
  }

  // Auth guard — runs after AuthProvider has resolved
  useEffect(() => {
    if (!ready) return;
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    if (!token) { router.replace("/login"); return; }
    if (role === "staff") { router.replace("/member/dashboard"); return; }
    if (!user) {
      // auth/me failed (bad token)
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      router.replace("/login");
    }
  }, [ready, user, router]);

  if (!ready) return <AppLayoutSkeleton collapsed={collapsed} />;

  return (
    <div className="h-full flex bg-slate-50">
      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-30 transition-all duration-300",
        collapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <AppSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex flex-col w-64 h-full bg-white shadow-xl z-10">
            <AppSidebar isMobile onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-h-full transition-all duration-300",
        collapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* Email verification banner */}
        {!emailVerified && <VerificationBanner email={user?.email ?? ""} />}

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>

        <FloatingUploadPanel />

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20">
          <div className="flex items-center justify-around h-16 px-2">
            {mobileNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.name} href={item.href}
                  className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                    isActive ? "text-indigo-600" : "text-slate-400")}>
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AuthProvider>
  );
}
