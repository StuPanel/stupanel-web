"use client";

/**
 * Tabs that join pages which belong together (Payments + Revenue, Plans + Coupons,
 * Emails + Email log, Admin actions + Team activity). Each tab is its own page and link,
 * so old links keep working; the menu shows the group once.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { can, getPlatformUser } from "@/lib/platform-api";

export type AdminTab = { label: string; href: string; perm?: string };

export const TAB_SETS: Record<string, AdminTab[]> = {
  payments: [
    { label: "Payments", href: "/admin/billing", perm: "billing.view" },
    { label: "Revenue", href: "/admin/revenue", perm: "billing.view" },
  ],
  plans: [
    { label: "Plans", href: "/admin/plans", perm: "billing.view" },
    { label: "Coupons", href: "/admin/coupons", perm: "billing.view" },
  ],
  emails: [
    { label: "Emails sent", href: "/admin/emails", perm: "reports.view" },
    { label: "Email log", href: "/admin/email-logs", perm: "reports.view" },
  ],
  logs: [
    { label: "Admin actions", href: "/admin/audit-logs", perm: "audit.view" },
    { label: "Team sign-ins & changes", href: "/admin/activity", perm: "audit.view" },
  ],
};

export function AdminTabs({ set, className }: { set: keyof typeof TAB_SETS; className?: string }) {
  const pathname = usePathname();
  const me = getPlatformUser();
  const tabs = TAB_SETS[set].filter(t => !t.perm || !me || can(me, t.perm));
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Sections" className={cn("px-6 md:px-8 pt-6 md:pt-8 -mb-2", className)}>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-700 bg-slate-800/70 p-1">
        {tabs.map(t => {
          const on = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={cn("px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                on ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700/60")}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
