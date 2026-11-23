"use client";

import { PanelSwitch } from "@/components/layout/panel-switch";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronsLeft, ChevronsRight, X, Settings, LifeBuoy, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_READ_EVENT, loadChatUnread } from "@/lib/chat-unread";
import { LEADS_SEEN_EVENT, loadLeadUnseen } from "@/lib/lead-unseen";
import { canOpen, homeFor } from "@/lib/access";
import { useAuth } from "@/context/auth-context";
import { StudioSwitcher } from "@/components/layout/studio-switcher";
import { Tile, type TileColor } from "@/components/ui/apple";
import { AccountMenu } from "@/components/layout/account-menu";
import { arrange, switchedOff, useStudioMenu, type MenuItem } from "@/lib/studio-menu";

/** Below the groups, the same for every studio: Settings (owners) and Support; WhatsApp templates for managers. */
const BOTTOM = [
  { id: "settings", name: "Settings", href: "/settings", icon: Settings, color: "ink" as TileColor },
  { id: "whatsapp", name: "WhatsApp", href: "/whatsapp", icon: MessageSquareText, color: "green" as TileColor, managersOnly: true },
  { id: "support", name: "Support", href: "/support", icon: LifeBuoy, color: "teal" as TileColor },
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
  // The studio's own menu (Settings → Menu); managers only see the parts the owner gave them;
  // features switched off in Settings are not in the menu.
  const { features, menu } = useStudioMenu();
  const groups = arrange(menu)
    .map(g => ({ ...g, items: g.items.filter(i => !i.hidden && canOpen(user, i.href) && !switchedOff(i.href, features)) }))
    .filter(g => g.items.length > 0);
  const bottom = BOTTOM.filter(i => canOpen(user, i.href) && !(i.managersOnly && user?.role !== "manager"));
  const [chatUnread, setChatUnread] = useState(0);
  /** New leads nobody has opened the Leads page for yet (website bookings…). */
  const [leadsNew, setLeadsNew] = useState(0);
  const leadsAllowed = canOpen(user, "/leads");

  // Chat unread — poll only when tab is visible, and right after something is read
  useEffect(() => {
    if (!localStorage.getItem("access_token")) return;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      loadChatUnread().then(d => { if (d) setChatUnread(d.total); });
    };
    load();
    document.addEventListener("visibilitychange", load);
    window.addEventListener(CHAT_READ_EVENT, load);
    const interval = setInterval(load, 60000);
    return () => {
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener(CHAT_READ_EVENT, load);
      clearInterval(interval);
    };
  }, []);

  // New leads — the same rhythm: when the tab is visible, every minute, and right after the Leads page opened.
  useEffect(() => {
    if (!leadsAllowed || !localStorage.getItem("access_token")) return;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      loadLeadUnseen().then(n => { if (n !== null) setLeadsNew(n); });
    };
    load();
    document.addEventListener("visibilitychange", load);
    window.addEventListener(LEADS_SEEN_EVENT, load);
    const interval = setInterval(load, 60000);
    return () => {
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener(LEADS_SEEN_EVENT, load);
      clearInterval(interval);
    };
  }, [leadsAllowed]);

  const wide = !collapsed;

  const navLink = (item: Pick<MenuItem, "id" | "name" | "href" | "icon" | "color">) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <li key={item.id}>
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
          {item.href === "/leads" && leadsNew > 0 && !isActive && (
            wide
              ? <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#E5484D] text-white text-xs font-bold flex items-center justify-center" aria-label={`${leadsNew} new lead${leadsNew > 1 ? "s" : ""}`}>
                  {leadsNew > 9 ? "9+" : leadsNew}
                </span>
              : <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E5484D] ring-2 ring-white" aria-label={`${leadsNew} new leads`} />
          )}
          {item.href === "/chat" && chatUnread > 0 && !isActive && (
            wide
              ? <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#7D5CEF] text-white text-xs font-bold flex items-center justify-center">
                  {chatUnread > 9 ? "9+" : chatUnread}
                </span>
              : <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#7D5CEF] ring-2 ring-white" />
          )}
        </Link>
      </li>
    );
  };

  return (
    <aside className={cn(
      "flex flex-col w-full h-full bg-white overflow-hidden",
      isMobile ? "" : "sp-glass rounded-2xl border border-[#E4E0EC]/80 shadow-[0_8px_30px_-12px_rgba(91,63,208,0.18)]"
    )}>
      {/* Brand */}
      <div className={cn("flex items-center flex-shrink-0 pt-4 pb-3", wide ? "px-4 justify-between" : "flex-col gap-2 px-2")}>
        <Link href="/dashboard" onClick={isMobile ? onClose : undefined} className="flex items-center gap-2.5 min-w-0">
          <BrandMark size={34} />
          {wide && <span className="font-extrabold text-[17px] tracking-tight text-[#17151F]">StuPanel</span>}
        </Link>
        {!isMobile && (
          <button
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1.5 rounded-lg text-[#8A8599] hover:text-[#5B3FD0] hover:bg-[#F7F4FE] transition-colors"
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        )}
        {isMobile && (
          <button onClick={onClose} className="p-2 -mr-1 rounded-lg hover:bg-[#F1EFF6]" aria-label="Close menu">
            <X className="w-5 h-5 text-[#6B6680]" />
          </button>
        )}
      </div>

      {/* Studio identity */}
      <div className={cn("flex-shrink-0", wide ? "px-3 pb-3" : "px-2 pb-3 flex justify-center")}>
        <StudioSwitcher name={companyName} logo={companyLogo} sub="Studio workspace" compact={!wide} />
      </div>
      {user?.role === "manager" && (
        <div className={cn("flex-shrink-0", wide ? "px-3 pb-3" : "px-2 pb-3 flex justify-center")}>
          <PanelSwitch current="studio" studioHref={homeFor(user)} compact={!wide} onNavigate={isMobile ? onClose : undefined} />
        </div>
      )}

      {/* Navigation: the studio's groups, then Settings and Support */}
      <nav className={cn("flex-1 overflow-y-auto pb-3 space-y-3.5", wide ? "px-2.5" : "px-2")}>
        {groups.map((group, gi) => (
          <div key={group.id}>
            {group.title && wide && <p className="text-xs font-bold text-[#6B6680] px-2.5 mb-1">{group.title}</p>}
            {!wide && gi > 0 && <div className="h-px bg-[#F1EFF6] mx-2 mb-2" />}
            <ul className="space-y-px">
              {group.items.map(navLink)}
            </ul>
          </div>
        ))}
        {bottom.length > 0 && (
          <div className="pt-2.5 border-t border-[#F1EFF6]">
            <ul className="space-y-px">
              {bottom.map(navLink)}
            </ul>
          </div>
        )}
      </nav>

      {/* You: profile, plan, settings, log out */}
      <div className={cn("flex-shrink-0 border-t border-[#F1EFF6]", wide ? "p-2" : "p-2 flex justify-center")}>
        <AccountMenu variant={wide ? "sidebar" : "collapsed"} side={isMobile ? "top" : "right"} onNavigate={isMobile ? onClose : undefined} />
      </div>
    </aside>
  );
}
