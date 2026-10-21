"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Camera, LogOut, X, UserCircle, Video,
  Wallet, CalendarDays, MessageCircle, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { BrandMark } from "@/components/layout/app-sidebar";

const navItems = [
  { label: "Dashboard",   href: "/member/dashboard", icon: LayoutDashboard },
  { label: "My Programs", href: "/member/programs",  icon: Camera },
  { label: "Editing",     href: "/member/editing",   icon: Video },
  { label: "Schedule",    href: "/member/schedule",  icon: CalendarDays },
  { label: "My Earnings", href: "/member/earnings",  icon: Wallet },
  { label: "Chat",        href: "/member/chat",      icon: MessageCircle },
  { label: "My Profile",  href: "/member/profile",   icon: UserCircle },
];

const mobileTabs = [
  { label: "Home",     href: "/member/dashboard", icon: LayoutDashboard },
  { label: "Programs", href: "/member/programs",  icon: Camera },
  { label: "Editing",  href: "/member/editing",   icon: Video },
  { label: "Schedule", href: "/member/schedule",  icon: CalendarDays },
];

type Profile = { firstName?: string; lastName?: string; memberRoles?: string[] };

function MemberSidebar({ profile, chatUnread, pathname, isMobile, onClose, onLogout }: {
  profile: Profile | null; chatUnread: number; pathname: string; isMobile?: boolean; onClose?: () => void; onLogout: () => void;
}) {
  return (
    <aside className={cn("flex flex-col w-full h-full bg-white overflow-hidden",
      !isMobile && "rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(91,63,208,0.18)]")}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href="/member/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <BrandMark size={34} />
          <div>
            <p className="font-extrabold text-[17px] tracking-tight text-slate-900 leading-none">StuPanel</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-none">Team member</p>
          </div>
        </Link>
        {isMobile && (
          <button className="p-2 -mr-1 rounded-lg hover:bg-slate-100" onClick={onClose} aria-label="Close menu">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}
      </div>

      {profile && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 p-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center font-bold text-sm text-violet-700">
              {(profile.firstName?.[0] ?? "M").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                {profile.firstName} {profile.lastName ?? ""}
              </p>
              {profile.memberRoles?.[0] && (
                <p className="text-[11px] text-slate-500 capitalize leading-tight mt-0.5">{profile.memberRoles[0]}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} onClick={onClose}
              className={cn(
                "group relative flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors",
                active ? "bg-violet-50 text-violet-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}>
              {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-violet-600" />}
              <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                active ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30" : "text-slate-400 group-hover:text-violet-600")}>
                <item.icon className="w-[17px] h-[17px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/member/chat" && chatUnread > 0 && !active && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {chatUnread > 9 ? "9+" : chatUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center"><LogOut className="w-[17px] h-[17px]" /></span>
          Log out
        </button>
      </div>
    </aside>
  );
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const load = () => apiFetch(`${API}/member/admin-chat/unread`)
      .then(r => r.ok ? r.json() : 0)
      .then(n => setChatUnread(typeof n === "number" ? n : 0))
      .catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
    router.replace("/login");
  }

  const moreActive = !mobileTabs.some(t => pathname === t.href || pathname.startsWith(t.href + "/"));

  return (
    <div className="min-h-full bg-slate-50">
      {/* Desktop floating sidebar */}
      <div className="hidden lg:block fixed top-3 bottom-3 left-3 w-[248px] z-30">
        <MemberSidebar profile={profile} chatUnread={chatUnread} pathname={pathname} onLogout={logout} />
      </div>

      {/* Mobile drawer */}
      <div className={cn("lg:hidden fixed inset-0 z-50", menuOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!menuOpen}>
        <div className={cn("absolute inset-0 bg-[#16141D]/45 backdrop-blur-[2px] transition-opacity duration-300", menuOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMenuOpen(false)} />
        <div className={cn("absolute top-0 bottom-0 left-0 w-[86%] max-w-[320px] bg-white shadow-2xl rounded-r-2xl transition-transform duration-300",
          menuOpen ? "translate-x-0" : "-translate-x-full")}>
          <MemberSidebar profile={profile} chatUnread={chatUnread} pathname={pathname} isMobile onClose={() => setMenuOpen(false)} onLogout={logout} />
        </div>
      </div>

      <div className="lg:ml-[272px] lg:mr-3 min-h-full flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-slate-50/85 backdrop-blur-md flex items-center justify-between px-4 h-16">
          <Link href="/member/dashboard" className="flex items-center gap-2">
            <BrandMark size={30} />
            <span className="font-extrabold text-[16px] tracking-tight text-slate-900">StuPanel</span>
          </Link>
          <Link href="/member/profile" className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center font-bold text-sm text-violet-700">
            {(profile?.firstName?.[0] ?? "M").toUpperCase()}
          </Link>
        </div>

        <main className="flex-1 min-w-0 pb-28 lg:pb-6 lg:pt-3">
          <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300">{children}</div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-md flex items-stretch justify-around rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-[0_10px_30px_-10px_rgba(22,20,29,0.25)] px-1.5 py-1.5">
            {mobileTabs.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}
                  className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
                    active ? "bg-violet-50 text-violet-700" : "text-slate-500")}>
                  <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                  <span className={cn("text-[11px] leading-none", active ? "font-semibold" : "font-medium")}>{item.label}</span>
                </Link>
              );
            })}
            <button onClick={() => setMenuOpen(true)}
              className={cn("relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
                moreActive ? "bg-violet-50 text-violet-700" : "text-slate-500")}>
              <LayoutGrid className="w-5 h-5" strokeWidth={moreActive ? 2.4 : 2} />
              <span className={cn("text-[11px] leading-none", moreActive ? "font-semibold" : "font-medium")}>More</span>
              {chatUnread > 0 && <span className="absolute top-1 right-[30%] w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white" />}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
