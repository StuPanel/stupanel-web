"use client";

/**
 * The signed-in person at the bottom of the sidebar (and a small avatar in the phone top bar).
 * Opens a card: who you are, your plan (trial days left with a bar, renew date), and
 * Profile · Plan & billing · Settings · Appearance · Help & Support · Log out.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { Camera, ChevronRight, ChevronsUpDown, Crown, LifeBuoy, LogOut, Palette, Settings, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { Tile, type TileColor } from "@/components/ui/apple";
import { loadBillingStatus, type BillingAccess } from "@/components/billing/billing-banner";

const TRIAL_DAYS = 14;
const fmtDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function Avatar({ url, name, size }: { url?: string | null; name: string; size: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" width={size} height={size} className="rounded-full object-cover flex-shrink-0 ring-2 ring-white" style={{ width: size, height: size }} />
    : <span className="rounded-full flex-shrink-0 bg-gradient-to-br from-[#8E72F2] to-[#5B3FD0] text-white font-bold flex items-center justify-center ring-2 ring-white"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{initials}</span>;
}

/** Plan words shared by the trigger and the card. */
function planInfo(access: BillingAccess | null, planName: string | null, interval: string | null) {
  const mode = access?.mode ?? "trial";
  const days = access?.daysLeft ?? null;
  if (mode === "trial") return { mode, short: "Free trial", badge: "Trial", line: days !== null ? `${Math.max(0, days)} day${days === 1 ? "" : "s"} left` : "Explore everything", tone: "violet" as const,
    pct: days !== null ? Math.max(4, Math.min(100, (days / TRIAL_DAYS) * 100)) : 100, ends: access?.periodEndsAt ? `Trial ends ${fmtDay(access.periodEndsAt)}` : "", cta: "Choose a plan" };
  if (mode === "full") {
    const period = interval === "yearly" ? 365 : interval === "monthly" ? 30 : null;
    return { mode, short: planName ? `${planName} plan` : "Plan active", badge: interval === "yearly" ? "Yearly" : interval === "monthly" ? "Monthly" : "Active",
      line: days !== null ? `${Math.max(0, days)} day${days === 1 ? "" : "s"} left` : "No end date", tone: "green" as const,
      pct: days !== null && period ? Math.max(4, Math.min(100, (days / period) * 100)) : null,
      ends: access?.periodEndsAt ? `Renews ${fmtDay(access.periodEndsAt)}` : "", cta: "Manage plan" };
  }
  if (mode === "grace") return { mode, short: "Plan ended", badge: "Ended", line: "Pay now to keep working", tone: "red" as const, pct: null, ends: access?.graceEndsAt ? `View-only from ${fmtDay(access.graceEndsAt)}` : "", cta: "Renew plan" };
  return { mode, short: "View-only", badge: "View-only", line: "Renew to make changes", tone: "red" as const, pct: null, ends: "", cta: "Renew plan" };
}

export function AccountMenu({ variant, side = "right", onNavigate }: {
  /** sidebar = full row at the bottom of the sidebar · collapsed = avatar only · icon = small avatar for the phone top bar */
  variant: "sidebar" | "collapsed" | "icon";
  side?: "right" | "top" | "bottom";
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { user, companyName } = useAuth();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<BillingAccess | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [interval, setInterval_] = useState<string | null>(null);

  useEffect(() => {
    loadBillingStatus().then(d => {
      if (!d) return;
      const x = d as { plan?: { name?: string } | null; interval?: string | null };
      setAccess(d.access); setPlanName(x.plan?.name ?? null); setInterval_(x.interval ?? null);
    });
  }, []);

  const name = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "";
  const isOwner = user?.role === "owner";
  const role = user?.role === "owner" ? "Owner" : user?.role === "manager" ? "Manager" : user?.role === "staff" ? "Staff" : (user?.role ?? "");
  const plan = planInfo(access, planName, interval);
  const toneCls = { violet: "bg-[#EEE8FD] text-[#5B3FD0]", green: "bg-[#E7F5EE] text-[#1F8A5B]", red: "bg-[#FDECEF] text-[#C2304F]" }[plan.tone];

  function go(href: string) { setOpen(false); onNavigate?.(); router.push(href); }
  async function logout() {
    setOpen(false);
    try { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); } catch { /* still sign out here */ }
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
    router.push("/login");
  }

  const items: { label: string; icon: React.ElementType; color: TileColor; href: string; show: boolean }[] = [
    { label: "My profile", icon: User, color: "violet", href: isOwner ? "/settings?pane=profile" : "/account", show: true },
    { label: "Plan & billing", icon: Crown, color: "deep", href: "/billing", show: isOwner },
    { label: "Settings", icon: Settings, color: "ink", href: "/settings", show: isOwner },
    { label: "Appearance", icon: Palette, color: "orchid", href: "/settings?pane=appearance", show: isOwner },
    { label: "My work & pay", icon: Camera, color: "blue", href: "/member/dashboard", show: user?.role === "manager" },
    { label: "Help & Support", icon: LifeBuoy, color: "teal", href: "/support", show: true },
  ];

  const trigger = variant === "sidebar" ? (
    <button type="button" aria-label="Account menu"
      className={cn("w-full flex items-center gap-2.5 p-2 rounded-[14px] text-left transition-colors", open ? "bg-[#F3EFFE]" : "hover:bg-[#F5F3FA]")}>
      <Avatar url={user?.avatarUrl} name={name} size={36} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-[#17151F] truncate leading-tight">{name || "…"}</span>
        <span className="block text-[12px] text-[#6B6680] truncate leading-tight mt-0.5">{isOwner ? plan.short + ((plan.mode === "trial" || plan.mode === "full") && access?.daysLeft != null ? ` · ${Math.max(0, access.daysLeft)}d left` : "") : role}</span>
      </span>
      <ChevronsUpDown className="w-4 h-4 text-[#9893A8] flex-shrink-0" />
    </button>
  ) : (
    <button type="button" aria-label="Account menu" title={name}
      className={cn("rounded-full transition-transform hover:scale-105", variant === "icon" ? "p-0.5" : "p-1")}>
      <Avatar url={user?.avatarUrl} name={name} size={variant === "icon" ? 36 : 34} />
    </button>
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side={side} align={side === "right" ? "end" : "end"} sideOffset={12} collisionPadding={12}
          className="z-[70] w-[300px] max-w-[calc(100vw-24px)] rounded-[22px] bg-white/95 backdrop-blur-xl ring-1 ring-black/5 shadow-[0_24px_60px_-18px_rgba(22,18,40,.35)] outline-none overflow-hidden sp-pop-in">
          {/* Who */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <Avatar url={user?.avatarUrl} name={name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#17151F] truncate">{name}</p>
              <p className="text-[12.5px] text-[#6B6680] truncate">{user?.email}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#6B6680] min-w-0">
                <span className="font-semibold text-[#4A4658]">{role}</span>
                {companyName && <span className="truncate">· {companyName}</span>}
              </p>
            </div>
          </div>

          {/* Plan */}
          {isOwner && (
            <div className="mx-3 mb-2 p-3 rounded-2xl bg-gradient-to-br from-[#F6F2FF] to-[#EEF4FF] ring-1 ring-[#E7E0FB]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7D5CEF]" />
                <span className="text-[13.5px] font-bold text-[#17151F]">{plan.short}</span>
                <span className={cn("ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full", toneCls)}>{plan.badge}</span>
              </div>
              <p className="text-[12.5px] text-[#6B6680] mt-1">{plan.line}</p>
              {plan.pct !== null && (
                <div className="mt-2.5 h-1.5 rounded-full bg-white overflow-hidden" role="progressbar" aria-label={plan.mode === "trial" ? "Trial days left" : "Days left in this plan"} aria-valuenow={Math.round(plan.pct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-gradient-to-r from-[#8E72F2] to-[#5B3FD0]" style={{ width: `${plan.pct}%` }} />
                </div>
              )}
              <div className="mt-2.5 flex items-center gap-2">
                {plan.ends && <span className="text-[11.5px] text-[#9893A8] flex-1">{plan.ends}</span>}
                <Link href="/billing" onClick={() => { setOpen(false); onNavigate?.(); }}
                  className={cn("ml-auto h-8 px-3.5 rounded-full text-[12.5px] font-semibold inline-flex items-center",
                    plan.tone === "red" ? "bg-[#C2304F] text-white" : plan.mode === "full" ? "bg-white text-[#5B3FD0] ring-1 ring-[#E7E0FB]" : "bg-[#7D5CEF] text-white")}>
                  {plan.cta}
                </Link>
              </div>
            </div>
          )}

          {/* Links */}
          <nav className="px-2 pb-2">
            {items.filter(i => i.show).map(i => (
              <button key={i.label} type="button" onClick={() => go(i.href)}
                className="w-full flex items-center gap-3 px-2 h-11 rounded-xl text-left text-[14px] font-medium text-[#17151F] hover:bg-[#F5F3FA] focus-visible:bg-[#F5F3FA] outline-none">
                <Tile icon={i.icon} color={i.color} size={28} />
                <span className="flex-1">{i.label}</span>
                <ChevronRight className="w-4 h-4 text-[#C2BDD0]" />
              </button>
            ))}
            <div className="h-px bg-[#EEEBF4] my-1.5 mx-2" />
            <button type="button" onClick={logout}
              className="w-full flex items-center gap-3 px-2 h-11 rounded-xl text-left text-[14px] font-semibold text-[#C2304F] hover:bg-[#FDECEF] outline-none focus-visible:bg-[#FDECEF]">
              <span className="w-7 h-7 rounded-lg bg-[#FDECEF] flex items-center justify-center"><LogOut className="w-4 h-4" /></span>
              Log out
            </button>
          </nav>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
