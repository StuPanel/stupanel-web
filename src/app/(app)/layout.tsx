"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Camera, Users, CreditCard, LayoutGrid, MailWarning, X } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { FloatingUploadPanel } from "@/components/floating-upload-panel";
import { BillingBanner } from "@/components/billing/billing-banner";
import { cn } from "@/lib/utils";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { canOpen, homeFor } from "@/lib/access";

// Mobile bottom tab bar — labels always visible; "More" opens the full menu.
const mobileTabs = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Programs", href: "/programs", icon: Camera },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
];

// Desktop sidebar geometry (floating card with a 12px gap from the screen edge)
const SIDEBAR_W = "lg:w-[248px]";
const SIDEBAR_W_COLLAPSED = "lg:w-[76px]";
const CONTENT_ML = "lg:ml-[272px]";
const CONTENT_ML_COLLAPSED = "lg:ml-[100px]";

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
    <div className="mx-3 sm:mx-4 lg:mx-0 mb-3 rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <MailWarning className="w-4 h-4 text-violet-700 flex-shrink-0" />
      <p className="text-sm text-violet-900 flex-1">
        Please verify your email <span className="font-semibold">{email}</span> to unlock all features.
      </p>
      {sent ? (
        <span className="text-sm text-emerald-700 font-medium">Email sent! Check your inbox.</span>
      ) : (
        <button onClick={resend} disabled={sending}
          className="text-sm font-semibold text-violet-700 hover:text-violet-900 underline underline-offset-2 flex items-center gap-1 disabled:opacity-60">
          {sending && <span className="w-3 h-3 border-2 border-violet-600 border-t-transparent rounded-full animate-spin inline-block" />}
          Resend email
        </button>
      )}
      <button onClick={() => setDismissed(true)} className="text-violet-400 hover:text-violet-700 flex-shrink-0" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Layout skeleton shown while auth loads
function AppLayoutSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="min-h-full bg-slate-50">
      <div className={cn("hidden lg:block fixed top-3 bottom-3 left-3 z-30", collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W)}>
        <div className="h-full rounded-2xl bg-white border border-slate-200/80 p-3 space-y-2">
          <div className="h-9 rounded-xl bg-slate-100 animate-pulse mb-4" />
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-9 rounded-xl bg-slate-50 animate-pulse" />)}
        </div>
      </div>
      <div className={cn(collapsed ? CONTENT_ML_COLLAPSED : CONTENT_ML, "lg:mr-3")}>
        <div className="h-16 flex items-center px-4 lg:px-0 gap-3">
          <div className="h-10 w-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
        <main className="px-3 sm:px-4 lg:px-0 space-y-4">
          <div className="h-8 w-48 bg-slate-200/70 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
          </div>
          <div className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        </main>
      </div>
    </div>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, ready, emailVerified } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar_collapsed") === "true"); } catch { /* ignore */ }
  }, []);

  // Close the mobile menu whenever the route changes
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Lock page scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  function toggleCollapsed() {
    setCollapsed(prev => {
      try { localStorage.setItem("sidebar_collapsed", String(!prev)); } catch { /* ignore */ }
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
    if (user?.role === "manager" && !canOpen(user, pathname)) { router.replace(homeFor(user)); return; }
    if (!user) {
      // auth/me failed (bad token)
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      router.replace("/login");
    }
  }, [ready, user, router, pathname]);

  if (!ready) return <AppLayoutSkeleton collapsed={collapsed} />;

  const moreActive = !mobileTabs.some(t => pathname === t.href || pathname.startsWith(t.href + "/"));

  return (
    <div className="min-h-full bg-slate-50">
      {/* Desktop floating sidebar */}
      <div className={cn(
        "hidden lg:block fixed top-3 bottom-3 left-3 z-30 transition-[width] duration-300",
        collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W
      )}>
        <AppSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>

      {/* Mobile menu drawer */}
      <div className={cn("lg:hidden fixed inset-0 z-50", menuOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!menuOpen}>
        <div
          className={cn("absolute inset-0 bg-[#16141D]/45 backdrop-blur-[2px] transition-opacity duration-300", menuOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMenuOpen(false)}
        />
        <div className={cn(
          "absolute top-0 bottom-0 left-0 w-[86%] max-w-[320px] bg-white shadow-2xl rounded-r-2xl transition-transform duration-300",
          menuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <AppSidebar isMobile onClose={() => setMenuOpen(false)} />
        </div>
      </div>

      {/* Main */}
      <div className={cn(
        "flex flex-col min-h-full transition-[margin] duration-300 lg:mr-3",
        collapsed ? CONTENT_ML_COLLAPSED : CONTENT_ML
      )}>
        <AppHeader onMenuClick={() => setMenuOpen(true)} />

        {!emailVerified && <VerificationBanner email={user?.email ?? ""} />}

        {/* Trial / plan ending / view-only banner */}
        <div className="lg:rounded-xl lg:overflow-hidden lg:mb-3 empty:hidden">
          <BillingBanner />
        </div>

        <main className="flex-1 min-w-0 overflow-x-clip px-3 sm:px-4 lg:px-0 pt-1 pb-28 lg:pb-8">
          <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <ErrorBoundary>{canOpen(user, pathname) ? children : null}</ErrorBoundary>
          </div>
        </main>

        <FloatingUploadPanel />

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-md flex items-stretch justify-around rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-[0_10px_30px_-10px_rgba(22,20,29,0.25)] px-1.5 py-1.5">
            {mobileTabs.filter(t => canOpen(user, t.href)).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.name} href={item.href}
                  className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
                    isActive ? "bg-violet-50 text-violet-700" : "text-slate-500 active:bg-slate-50")}>
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 2} />
                  <span className={cn("text-xs leading-none", isActive ? "font-semibold" : "font-medium")}>{item.name}</span>
                </Link>
              );
            })}
            <button onClick={() => setMenuOpen(true)}
              className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
                moreActive ? "bg-violet-50 text-violet-700" : "text-slate-500 active:bg-slate-50")}>
              <LayoutGrid className="w-5 h-5" strokeWidth={moreActive ? 2.4 : 2} />
              <span className={cn("text-xs leading-none", moreActive ? "font-semibold" : "font-medium")}>More</span>
            </button>
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
