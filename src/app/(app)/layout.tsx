"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { LayoutDashboard, Camera, Users, CreditCard, UserCog, MailWarning, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

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
      await apiFetch(`${API}/auth/resend-verification`, { method: "POST" });
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
          {sending && <Loader2 className="w-3 h-3 animate-spin" />}
          Resend email
        </button>
      )}
      <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    if (!token) { router.replace("/login"); return; }
    if (role === "staff") { router.replace("/member/dashboard"); return; }

    apiFetch(`${API}/auth/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setEmailVerified(data.emailVerified ?? true);
          setUserEmail(data.email ?? "");
          setReady(true);
        }
      })
      .catch(() => {});
  }, [router]);

  if (!ready) return null;

  return (
    <div className="h-full flex bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30">
        <AppSidebar />
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
      <div className="flex-1 flex flex-col lg:ml-64 min-h-full">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* Email verification banner */}
        {!emailVerified && <VerificationBanner email={userEmail} />}

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>

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
