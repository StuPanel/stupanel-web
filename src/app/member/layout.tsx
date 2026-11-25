"use client";

import { PanelSwitch, rememberPanel } from "@/components/layout/panel-switch";
import { IdleSignOut } from "@/components/idle-sign-out";
import { useEffect, useRef, useState } from "react";
import { FloatingUploadPanel } from "@/components/floating-upload-panel";
import { StudioBackdrop } from "@/components/studio-backdrop";
import { StudioSwitcher } from "@/components/layout/studio-switcher";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Camera, LogOut, X, UserCircle,
  Wallet, CalendarDays, MessageCircle, LayoutGrid, BadgeDollarSign, Music2, Wand2, ChevronsUpDown,
} from "lucide-react";
import { MemberPhoto, PROFILE_EVENT } from "./_components/kit";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API, LOCKED_EVENT, studioLocked } from "@/lib/api";
import { LockedForTeam } from "@/components/billing/locked-studio";
import { BrandMark } from "@/components/layout/app-sidebar";
import { Tile, type TileColor } from "@/components/ui/apple";
import { useBackClose } from "@/lib/back-stack";

// Same look as the studio app sidebar: each page has its own coloured tile.
// Short list, so no group names (Faisal): everyday work, then editing (editors only), then money, with a little space between. Profile and log out sit in the account button at the bottom.
const navGroups: { id: string; title: string; items: { label: string; href: string; icon: React.ElementType; color: TileColor }[] }[] = [
  { id: "top", title: "", items: [
    { label: "Dashboard",   href: "/member/dashboard", icon: LayoutDashboard, color: "violet" },
    { label: "My Programs", href: "/member/programs",  icon: Camera,          color: "deep" },
    { label: "Schedule",    href: "/member/schedule",  icon: CalendarDays,    color: "red" },
    { label: "Chat",        href: "/member/chat",      icon: MessageCircle,   color: "teal" },
  ] },
  { id: "editing", title: "", items: [
    { label: "Editing",     href: "/member/editing",   icon: Wand2,           color: "blue" },
    { label: "Music",       href: "/member/music",     icon: Music2,          color: "orchid" },
  ] },
  { id: "money", title: "", items: [
    { label: "Earnings",    href: "/member/earnings",  icon: Wallet,          color: "green" },
    { label: "Rates & gear", href: "/member/rates",    icon: BadgeDollarSign, color: "ink" },
  ] },
];

/** Phone bar: Home, Programs, Schedule, then Editing for editors or Earnings for everyone else, and More. */
function phoneTabs(profile: Profile | null) {
  const editor = !hiddenPages(profile).has("/member/editing");
  return [
    { label: "Home",     href: "/member/dashboard", icon: LayoutDashboard },
    { label: "Programs", href: "/member/programs",  icon: Camera },
    { label: "Schedule", href: "/member/schedule",  icon: CalendarDays },
    editor ? { label: "Editing", href: "/member/editing", icon: Wand2 } : { label: "Earnings", href: "/member/earnings", icon: Wallet },
  ];
}

type Profile = { firstName?: string; lastName?: string; memberRoles?: string[]; avatarUrl?: string | null; editingCount?: number };

/**
 * Which pages this person gets. Editing: tagged Photo / Video editor in Team, or given editing or album work.
 * Music: tagged Video editor. While the profile loads, both stay hidden (no flash of a page they can't use).
 */
function hiddenPages(profile: Profile | null) {
  const roles = profile?.memberRoles ?? [];
  const editing = roles.includes("photo_editor") || roles.includes("video_editor") || (profile?.editingCount ?? 0) > 0;
  const music = roles.includes("video_editor");
  return new Set([...(editing ? [] : ["/member/editing"]), ...(music ? [] : ["/member/music"])]);
}

/** Bottom-left: who you are; opens My profile and Log out (same place as the studio's account menu). */
function MemberAccount({ profile, onClose, onLogout }: { profile: Profile | null; onClose?: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  const roles = (profile?.memberRoles ?? []).map(r => r.replace(/_/g, " ")).join(" · ");
  return (
    <div ref={box} className="relative">
      {open && (
        <div role="menu" aria-label="Account" className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[18px] p-1.5 shadow-[0_18px_40px_-14px_rgba(22,18,40,.35),0_0_0_1px_rgba(22,18,40,.05)] z-10">
          <Link href="/member/profile" role="menuitem" onClick={() => { setOpen(false); onClose?.(); }}
            className="flex items-center gap-3 px-2 h-10 rounded-[12px] text-sm font-medium text-[#17151F] hover:bg-[#F5F3FA]">
            <Tile icon={UserCircle} color="orchid" size={26} />My profile
          </Link>
          <button type="button" role="menuitem" onClick={onLogout}
            className="w-full flex items-center gap-3 px-2 h-10 rounded-[12px] text-sm font-medium text-[#C2304F] hover:bg-[#FDECEF]">
            <span className="w-[26px] h-[26px] rounded-[8px] bg-[#FDECEF] flex items-center justify-center"><LogOut className="w-[15px] h-[15px]" /></span>
            Log out
          </button>
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu"
        className="w-full flex items-center gap-2.5 rounded-xl p-2 text-left hover:bg-[#F5F3FA] transition-colors">
        <MemberPhoto url={profile?.avatarUrl} name={profile?.firstName} size={34} round />
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-[#17151F] truncate leading-tight">{profile ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() : " "}</span>
          <span className="block text-xs text-[#6B6680] capitalize truncate leading-tight mt-0.5">{roles || "Team member"}</span>
        </span>
        <ChevronsUpDown className="w-4 h-4 text-[#8A8599] flex-shrink-0" />
      </button>
    </div>
  );
}

function MemberSidebar({ profile, chatUnread, pathname, isMobile, onClose, onLogout }: {
  profile: Profile | null; chatUnread: number; pathname: string; isMobile?: boolean; onClose?: () => void; onLogout: () => void;
}) {
  const [isManager, setIsManager] = useState(false);
  useEffect(() => { try { setIsManager(localStorage.getItem("user_role") === "manager"); } catch { /* ignore */ } }, []);
  return (
    <aside className={cn("flex flex-col w-full h-full bg-white overflow-hidden",
      !isMobile && "sp-glass rounded-2xl border border-[#E4E0EC]/80 shadow-[0_8px_30px_-12px_rgba(91,63,208,0.18)]")}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href="/member/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <BrandMark size={34} />
          <div>
            <p className="font-extrabold text-[17px] tracking-tight text-[#17151F] leading-none">StuPanel</p>
            <p className="text-xs text-[#6B6680] mt-1 leading-none">Team member</p>
          </div>
        </Link>
        {isMobile && (
          <button className="p-2 -mr-1 rounded-lg hover:bg-[#F1EFF6]" onClick={onClose} aria-label="Close menu">
            <X className="w-5 h-5 text-[#6B6680]" />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <StudioSwitcher name="" sub="Your studio" />
      </div>
      {isManager && (
        <div className="px-3 pb-3"><PanelSwitch current="member" onNavigate={onClose} /></div>
      )}

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-3.5">
        {navGroups.map(g => ({ ...g, items: g.items.filter(i => !hiddenPages(profile).has(i.href)) })).filter(g => g.items.length > 0).map(group => (
          <div key={group.id}>
            {group.title && <p className="text-xs font-bold text-[#6B6680] px-2.5 mb-1">{group.title}</p>}
            <ul className="space-y-px">
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={onClose}
                      className={cn("group relative flex items-center gap-3 px-2 h-10 rounded-[12px] text-sm transition-colors",
                        active ? "bg-[#EEE8FD] text-[#5B3FD0] font-bold" : "text-[#17151F] font-medium hover:bg-[#F5F3FA]")}>
                      <Tile icon={item.icon} color={item.color} size={26} className={cn("transition-transform", !active && "group-hover:scale-105")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.href === "/member/chat" && chatUnread > 0 && !active && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#7D5CEF] text-white text-xs font-bold flex items-center justify-center">
                          {chatUnread > 9 ? "9+" : chatUnread}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-[#F1EFF6]">
        <MemberAccount profile={profile} onClose={onClose} onLogout={onLogout} />
      </div>
    </aside>
  );
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Phone Back closes the menu
  useBackClose(menuOpen, () => setMenuOpen(false));
  const [chatUnread, setChatUnread] = useState(0);
  // The studio's plan ended and was not renewed: the member area is locked too.
  const [locked, setLocked] = useState(studioLocked());
  useEffect(() => {
    const on = () => setLocked(true);
    window.addEventListener(LOCKED_EVENT, on);
    return () => window.removeEventListener(LOCKED_EVENT, on);
  }, []);
  // Phone top bar: clear at rest, soft glass once the page scrolls under it (same as the studio).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

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
    if (!token) { router.replace(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const role = localStorage.getItem("user_role");
    if (role !== "staff" && role !== "manager") { router.replace("/dashboard"); return; }
    if (role === "manager") rememberPanel("member");
    // Made a manager (or no longer one) since signing in → show the right menu.
    apiFetch(`${API}/auth/me`).then(r => (r.ok ? r.json() : null)).then(me => {
      const now = me?.role ?? me?.user?.role;
      if ((now === "staff" || now === "manager") && now !== role) { localStorage.setItem("user_role", now); window.location.reload(); }
    }).catch(() => {});

    const load = () => apiFetch(`${API}/member/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProfile(d); })
      .catch(() => {});
    load();
    window.addEventListener(PROFILE_EVENT, load);
    return () => window.removeEventListener(PROFILE_EVENT, load);
  }, [router]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  async function logout() {
    // End the session on the server too: otherwise the sign-in cookie that stays could
    // quietly sign this person back in (a request still running, another tab).
    try { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); } catch { /* still sign out here */ }
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
    // A full page load, so nothing of this session keeps running.
    window.location.href = "/login";
  }

  const mobileTabs = phoneTabs(profile);
  const moreActive = !mobileTabs.some(t => pathname === t.href || pathname.startsWith(t.href + "/"));

  return (
    <div className="min-h-full sp-shell">
      <IdleSignOut />
      <div className="sp-scene" aria-hidden="true" />
      <StudioBackdrop />
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
        <div className="lg:hidden sticky top-0 z-20 sp-appbar flex items-center justify-between px-4 h-16" data-scrolled={scrolled ? "" : undefined}>
          <Link href="/member/dashboard" className="flex items-center gap-2">
            <BrandMark size={30} />
            <span className="font-extrabold text-[16px] tracking-tight text-[#17151F]">StuPanel</span>
          </Link>
          <Link href="/member/profile" aria-label="My profile" className="rounded-full">
            <MemberPhoto url={profile?.avatarUrl} name={profile?.firstName} size={40} round />
          </Link>
        </div>

        <main className="flex-1 min-w-0 px-3 sm:px-4 lg:px-0 pt-1 lg:pt-6 pb-28 lg:pb-8">
          <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300">{locked ? <LockedForTeam /> : children}</div>
          <FloatingUploadPanel />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none">
          <div className="sp-glass pointer-events-auto mx-auto max-w-md flex items-stretch justify-around rounded-2xl bg-white/95 backdrop-blur border border-[#E4E0EC] shadow-[0_10px_30px_-10px_rgba(22,20,29,0.25)] px-1.5 py-1.5">
            {mobileTabs.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}
                  className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
                    active ? "bg-[#F7F4FE] text-[#5B3FD0]" : "text-[#6B6680]")}>
                  <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                  <span className={cn("text-xs leading-none", active ? "font-semibold" : "font-medium")}>{item.label}</span>
                </Link>
              );
            })}
            <button onClick={() => setMenuOpen(true)}
              className={cn("relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
                moreActive ? "bg-[#F7F4FE] text-[#5B3FD0]" : "text-[#6B6680]")}>
              <LayoutGrid className="w-5 h-5" strokeWidth={moreActive ? 2.4 : 2} />
              <span className={cn("text-xs leading-none", moreActive ? "font-semibold" : "font-medium")}>More</span>
              {chatUnread > 0 && <span className="absolute top-1 right-[30%] w-2 h-2 rounded-full bg-[#7D5CEF] ring-2 ring-white" />}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
