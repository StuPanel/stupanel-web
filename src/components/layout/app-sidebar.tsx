"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Camera,
  CreditCard,
  Package,
  ImageIcon,
  BarChart3,
  Settings,
  Bell,
  Crown,
  ChevronRight,
  X,
  UserCog,
  MessageCircle,
  FileText,
  CircleUserRound,
  LifeBuoy,
  ClipboardList,
  Wrench,
  Banknote,
  Wallet,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navigation = [
  {
    title: "Main",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Programs", href: "/programs", icon: Camera },
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
      { name: "Chat", href: "/chat", icon: MessageCircle },
    ],
  },
  {
    title: "Studio",
    items: [
      { name: "Clients", href: "/clients", icon: Users },
      { name: "Referrals", href: "/referrals", icon: Handshake },
      { name: "Quotes", href: "/quotes", icon: FileText },
      { name: "Invoices", href: "/invoices", icon: CreditCard },
      { name: "Payments", href: "/payments", icon: BarChart3 },
      { name: "Team", href: "/team", icon: UserCog },
      { name: "Packages", href: "/packages", icon: Package },
      { name: "Delivery", href: "/delivery", icon: ImageIcon },
    ],
  },
  {
    title: "Tools",
    items: [
      { name: "Checklist", href: "/checklist", icon: ClipboardList },
      { name: "Equipment", href: "/equipment", icon: Wrench },
      { name: "Salary", href: "/salary", icon: Banknote },
      { name: "Expenses", href: "/expenses", icon: Wallet },
    ],
  },
  {
    title: "Manage",
    items: [
      { name: "Reports", href: "/reports", icon: BarChart3 },
      { name: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
      { name: "Notifications", href: "/notifications", icon: Bell },
      { name: "Support", href: "/support", icon: LifeBuoy },
      { name: "Settings", href: "/settings", icon: Settings },
      { name: "My Account", href: "/account", icon: CircleUserRound },
    ],
  },
];

interface AppSidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

function calcTrialDays(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function AppSidebar({ onClose, isMobile }: AppSidebarProps) {
  const pathname = usePathname();
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [subStatus, setSubStatus] = useState<string>("trialing");
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/companies/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setTrialDays(calcTrialDays(d.trialEndsAt));
          setSubStatus(d.subscriptionStatus ?? "trialing");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const load = () =>
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/chat/bookings`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then((d: any[]) => Array.isArray(d) ? setChatUnread(d.reduce((s, b) => s + (b.unreadCount ?? 0), 0)) : null)
        .catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="flex flex-col w-64 h-full bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-none">StuPanel</p>
            <p className="text-xs text-slate-500 mt-0.5">Studio Management</p>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navigation.map((group) => (
          <div key={group.title}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={isMobile ? onClose : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-indigo-600" : "text-slate-400")} />
                      <span className="flex-1">{item.name}</span>
                      {item.href === "/chat" && chatUnread > 0 && !isActive && (
                        <span className="h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                          {chatUnread > 9 ? "9+" : chatUnread}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3 h-3 text-indigo-400" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Trial / Plan Card */}
      <div className="p-3 border-t border-slate-200">
        {subStatus === "active" ? (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-3 text-white">
            <div className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-xs font-semibold">Active Plan</span>
            </div>
            <p className="text-xs text-emerald-100 mt-1">Your subscription is active</p>
          </div>
        ) : (
          <div className={cn(
            "rounded-lg p-3 text-white",
            trialDays !== null && trialDays <= 7
              ? "bg-gradient-to-br from-red-500 to-orange-600"
              : "bg-gradient-to-br from-indigo-500 to-purple-600"
          )}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-xs font-semibold">Free Trial</span>
              </div>
              <span className={cn(
                "text-xs font-bold",
                trialDays !== null && trialDays <= 7 ? "text-red-200" : "text-indigo-200"
              )}>
                {trialDays === null ? "—" : trialDays === 0 ? "Expired!" : `${trialDays}d left`}
              </span>
            </div>
            {trialDays !== null && trialDays <= 7 && trialDays > 0 && (
              <p className="text-xs text-red-200 mb-1">Trial ending soon!</p>
            )}
            <button className="w-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium py-1.5 rounded-md transition-colors mt-1">
              Upgrade Plan
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
