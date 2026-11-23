"use client";

/**
 * Admin Settings: every platform setting in one place, one part per page.
 * New settings get a line here (and their own page), not a new menu item.
 * Face Search and Music keep their settings inside their own pages; these links open them.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, ExternalLink, Flag, Music2, ScanFace, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { can, getPlatformUser } from "@/lib/platform-api";

type Part = { label: string; sub: string; href: string; icon: React.ElementType; /** "" = everyone on the admin team */ perm: string; away?: boolean };
const PARTS: { group: string; items: Part[] }[] = [
  { group: "Security", items: [
    { label: "Sign-in & security", sub: "Stay signed in, app code, password, devices", href: "/admin/settings/security", icon: ShieldCheck, perm: "" },
    { label: "Team & roles", sub: "Who can sign in here and what they can do", href: "/admin/settings/team", icon: UsersRound, perm: "team.manage" },
  ] },
  { group: "Platform", items: [
    { label: "Payments", sub: "Numbers studios pay to", href: "/admin/settings/payments", icon: CreditCard, perm: "settings.manage" },
    { label: "Feature flags", sub: "Turn features on for some plans", href: "/admin/settings/features", icon: Flag, perm: "settings.manage" },
  ] },
  { group: "Products", items: [
    { label: "AI Face Search", sub: "On or off, welcome credits, limits", href: "/admin/face-search?tab=settings", icon: ScanFace, perm: "settings.manage", away: true },
    { label: "Music tags", sub: "Events, kinds of video, moods", href: "/admin/music?tab=tags", icon: Music2, perm: "content.manage", away: true },
  ] },
  { group: "Other", items: [
    { label: "Advanced", sub: "Every stored setting, as keys", href: "/admin/settings/advanced", icon: SlidersHorizontal, perm: "settings.manage" },
  ] },
];

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = getPlatformUser();
  const parts = PARTS.map(g => ({ ...g, items: g.items.filter(i => !me || !i.perm || can(me, i.perm)) })).filter(g => g.items.length);
  return (
    <div className="lg:flex lg:items-start">
      <nav aria-label="Settings" className="lg:w-64 lg:flex-shrink-0 px-6 md:px-8 lg:pr-0 pt-6 md:pt-8">
        <h1 className="text-2xl font-bold text-white mb-4">Settings</h1>
        <div className="flex lg:flex-col gap-4 overflow-x-auto pb-2 lg:pb-0 lg:overflow-visible">
          {parts.map(g => (
            <div key={g.group} className="flex-shrink-0">
              <p className="hidden lg:block text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">{g.group}</p>
              <div className="flex lg:flex-col gap-1">
                {g.items.map(i => {
                  const on = !i.away && (pathname === i.href || pathname.startsWith(i.href + "/"));
                  return (
                    <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
                      className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap lg:whitespace-normal",
                        on ? "bg-indigo-600/20 text-indigo-300 border border-indigo-600/30" : "text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent")}>
                      <i.icon className={cn("w-4 h-4 flex-shrink-0", on ? "text-indigo-400" : "text-slate-500")} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium">{i.label}</span>
                        <span className="hidden lg:block text-xs text-slate-500">{i.sub}</span>
                      </span>
                      {i.away && <ExternalLink className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" aria-label="Opens its own page" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
