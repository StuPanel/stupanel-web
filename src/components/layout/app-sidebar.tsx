"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, CalendarDays, Users, Camera, CreditCard, Package, ImageIcon, BarChart3,
  Settings, Bell, Crown, ChevronsLeft, ChevronsRight, X, UserCog, MessageCircle, FileText,
  CircleUserRound, LifeBuoy, ClipboardList, Wrench, Banknote, Wallet, Handshake, Receipt,
  MessageSquareText, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { canOpen } from "@/lib/access";
import { useAuth } from "@/context/auth-context";
import { loadBillingStatus, type BillingAccess } from "@/components/billing/billing-banner";
import { StudioLogo } from "@/components/studio-logo";
import { Tile, type TileColor } from "@/components/ui/apple";

export const navigation = [
  {
    title: "Main",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "violet" as TileColor },
      { name: "Programs", href: "/programs", icon: Camera, color: "deep" as TileColor },
      { name: "Calendar", href: "/calendar", icon: CalendarDays, color: "red" as TileColor },
      { name: "Chat", href: "/chat", icon: MessageCircle, color: "green" as TileColor },
    ],
  },
  {
    title: "Studio",
    items: [
      { name: "Clients", href: "/clients", icon: Users, color: "blue" as TileColor },
      { name: "Referrals", href: "/referrals", icon: Handshake, color: "teal" as TileColor },
      { name: "Quotes", href: "/quotes", icon: FileText, color: "deep" as TileColor },
      { name: "Invoices", href: "/invoices", icon: Receipt, color: "orchid" as TileColor },
      { name: "Payments", href: "/payments", icon: CreditCard, color: "green" as TileColor },
      { name: "Team", href: "/team", icon: UserCog, color: "blue" as TileColor },
      { name: "Packages", href: "/packages", icon: Package, color: "violet" as TileColor },
      { name: "Delivery", href: "/delivery", icon: ImageIcon, color: "teal" as TileColor },
    ],
  },
  {
    title: "Tools",
    items: [
      { name: "Checklist", href: "/checklist", icon: ClipboardList, color: "orchid" as TileColor },
      { name: "Equipment", href: "/equipment", icon: Wrench, color: "ink" as TileColor },
      { name: "Salary", href: "/salary", icon: Banknote, color: "green" as TileColor },
      { name: "Expenses", href: "/expenses", icon: Wallet, color: "red" as TileColor },
    ],
  },
  {
    title: "Manage",
    items: [
      { name: "Reports", href: "/reports", icon: BarChart3, color: "blue" as TileColor },
      { name: "WhatsApp", href: "/whatsapp", icon: MessageSquareText, color: "green" as TileColor },
      { name: "Notifications", href: "/notifications", icon: Bell, color: "red" as TileColor },
      { name: "Support", href: "/support", icon: LifeBuoy, color: "teal" as TileColor },
      { name: "Plan & Billing", href: "/billing", icon: Crown, color: "violet" as TileColor },
      { name: "Settings", href: "/settings", icon: Settings, color: "ink" as TileColor },
      { name: "My Account", href: "/account", icon: CircleUserRound, color: "deep" as TileColor },
    ],
  },
];

interface AppSidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/stupanel-icon-128.png"
      alt="StuPanel"
      width={size}
      height={size}
      className={cn("object-contain flex-shrink-0", className)}
      priority
    />
  );
}

export function AppSidebar({ onClose, isMobile, collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const { companyLogo, companyName, user } = useAuth();
  // Managers only see the parts the owner gave them.
  const groups = navigation
    .map(g => ({ ...g, items: g.items.filter(i => canOpen(user, i.href)) }))
    .filter(g => g.items.length > 0);
  const [access, setAccess] = useState<BillingAccess | null>(null);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    loadBillingStatus().then((d) => { if (d) setAccess(d.access); });
  }, []);

  // Chat unread — poll only when tab is visible
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`${API}/chat/bookings`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then((d: { unreadCount?: number }[]) => Array.isArray(d) ? setChatUnread(d.reduce((s, b) => s + (b.unreadCount ?? 0), 0)) : null)
        .catch(() => {});
    };
    load();
    document.addEventListener("visibilitychange", load);
    const interval = setInterval(load, 60000);
    return () => {
      document.removeEventListener("visibilitychange", load);
      clearInterval(interval);
    };
  }, []);

  const wide = !collapsed;

  return (
    <aside className={cn(
      "flex flex-col w-full h-full bg-white overflow-hidden",
      isMobile ? "" : "rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(91,63,208,0.18)]"
    )}>
      {/* Brand */}
      <div className={cn("flex items-center flex-shrink-0 pt-4 pb-3", wide ? "px-4 justify-between" : "flex-col gap-2 px-2")}>
        <Link href="/dashboard" onClick={isMobile ? onClose : undefined} className="flex items-center gap-2.5 min-w-0">
          <BrandMark size={34} />
          {wide && <span className="font-extrabold text-[17px] tracking-tight text-slate-900">StuPanel</span>}
        </Link>
        {!isMobile && (
          <button
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-700 hover:bg-violet-50 transition-colors"
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        )}
        {isMobile && (
          <button onClick={onClose} className="p-2 -mr-1 rounded-lg hover:bg-slate-100" aria-label="Close menu">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}
      </div>

      {/* Studio identity */}
      <div className={cn("flex-shrink-0", wide ? "px-3 pb-3" : "px-2 pb-3 flex justify-center")}>
        <div className={cn("flex items-center rounded-xl bg-slate-50 border border-slate-100", wide ? "gap-2.5 p-2" : "p-1.5")}>
          <StudioLogo url={companyLogo} name={companyName} size={32} className="rounded-lg" />
          {wide && (
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">{companyName || "Your studio"}</p>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">Studio workspace</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto pb-3 space-y-3.5", wide ? "px-2.5" : "px-2")}>
        {groups.map((group) => (
          <div key={group.title}>
            {wide
              ? <p className="text-xs font-bold text-[#6B6680] px-2.5 mb-1">{group.title}</p>
              : <div className="h-px bg-slate-100 mx-2 mb-2" />}
            <ul className="space-y-px">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.name : undefined}
                      onClick={isMobile ? onClose : undefined}
                      className={cn(
                        "group relative flex items-center rounded-[12px] text-sm transition-colors",
                        wide ? "gap-3 px-2 h-10" : "justify-center p-1.5",
                        isActive ? "bg-[#EEE8FD] text-[#5B3FD0] font-bold" : "text-[#17151F] font-medium hover:bg-[#F5F3FA]"
                      )}
                    >
                      <Tile icon={item.icon} color={item.color} size={wide ? 26 : 30}
                        className={cn("transition-transform", !isActive && "group-hover:scale-105")} />
                      {wide && <span className="flex-1 truncate">{item.name}</span>}
                      {item.href === "/chat" && chatUnread > 0 && !isActive && (
                        wide
                          ? <span className="h-5 min-w-5 px-1.5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                              {chatUnread > 9 ? "9+" : chatUnread}
                            </span>
                          : <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Plan card */}
      <div className={cn("flex-shrink-0 border-t border-slate-100", wide ? "p-3" : "p-2 flex justify-center")}>
        <PlanCard access={access} collapsed={!!collapsed} onNavigate={isMobile ? onClose : undefined} />
      </div>
    </aside>
  );
}

function PlanCard({ access, collapsed, onNavigate }: { access: BillingAccess | null; collapsed: boolean; onNavigate?: () => void }) {
  const mode = access?.mode ?? "trial";
  const days = access?.daysLeft ?? null;
  const ended = mode === "grace" || mode === "read_only";

  const title = mode === "full" ? "Plan active" : mode === "trial" ? "Free trial" : mode === "grace" ? "Plan ended" : "View-only";
  const sub = mode === "full"
    ? (access?.periodEndsAt ? `Renews ${new Date(access.periodEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Thanks for being with us")
    : mode === "trial"
      ? (days !== null ? `${Math.max(0, days)} day${days === 1 ? "" : "s"} left` : "Explore everything")
      : mode === "grace" ? "Pay now to keep working" : "Renew to make changes";

  if (collapsed) {
    return (
      <Link href="/billing" onClick={onNavigate} title={`${title} · ${sub}`}
        className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
          ended ? "bg-rose-50 text-[#C2304F]" : "bg-violet-50 text-violet-700")}>
        <Crown className="w-4 h-4" />
      </Link>
    );
  }

  return (
    <Link href="/billing" onClick={onNavigate}
      className={cn("block rounded-xl p-3 text-white relative overflow-hidden transition-transform hover:-translate-y-0.5",
        ended ? "bg-gradient-to-br from-[#C2304F] to-[#8A1F37]" : "bg-gradient-to-br from-violet-600 to-[#4E35B4]")}>
      <Sparkles className="absolute -right-2 -top-2 w-14 h-14 text-white/10" />
      <div className="flex items-center gap-1.5">
        <Crown className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <p className="text-xs text-white/80 mt-0.5">{sub}</p>
      {mode !== "full" && (
        <span className="mt-2 block text-center w-full bg-white/20 hover:bg-white/25 text-white text-xs font-semibold py-1.5 rounded-lg">
          {ended ? "Renew plan" : "Choose a plan"}
        </span>
      )}
    </Link>
  );
}
