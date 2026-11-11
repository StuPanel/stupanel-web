"use client";

/** Shared bits for the member panel (same look as the studio app). */
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";

export const PROGRAM_STATUS: Record<string, { label: string; badge: string }> = {
  inquiry:            { label: "Inquiry",      badge: "bg-[#FDECEF] text-[#C2304F]" },
  quote_sent:         { label: "Quote sent",   badge: "bg-[#FBF2FA] text-[#9E3A8C]" },
  confirmed:          { label: "Confirmed",    badge: "bg-[#EEE8FD] text-[#5B3FD0]" },
  // Client money is the studio's business — for the team an advance just means "confirmed".
  advance_received:   { label: "Confirmed",    badge: "bg-[#EEE8FD] text-[#5B3FD0]" },
  in_progress:        { label: "Shooting",     badge: "bg-[#E0F2F1] text-[#126B66]" },
  editing:            { label: "Editing",      badge: "bg-[#E6F0FB] text-[#1F5C99]" },
  ready_for_delivery: { label: "Ready",        badge: "bg-[#7D5CEF] text-white" },
  delivered:          { label: "Delivered",    badge: "bg-[#E9F5EF] text-[#1F8A5B]" },
  completed:          { label: "Completed",    badge: "bg-[#EEEDF2] text-[#4A4658]" },
  cancelled:          { label: "Cancelled",    badge: "bg-[#F3E3E3] text-[#8A2E2E]" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = PROGRAM_STATUS[status] ?? { label: status.replace(/_/g, " "), badge: "bg-[#EEEDF2] text-[#4A4658]" };
  return <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap capitalize", c.badge)}>{c.label}</span>;
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0); dt.setHours(0, 0, 0, 0);
  return Math.ceil((dt.getTime() - now.getTime()) / 86400000);
}

/** "Next program in N days" card. */
export function NextUp({ days, title, sub, href }: { days: number; title: string; sub: string; href?: string }) {
  const tone = days === 0 ? { bg: "bg-[#FDECEF]", num: "bg-[#C2304F] text-white", txt: "text-[#C2304F]" }
    : days <= 3 ? { bg: "bg-[#FBF2FA]", num: "bg-[#9E3A8C] text-white", txt: "text-[#823072]" }
    : { bg: "bg-[#EEE8FD]", num: "bg-[#7D5CEF] text-white", txt: "text-[#5B3FD0]" };
  const body = (
    <>
      <span className={cn("w-14 h-14 rounded-[16px] flex flex-col items-center justify-center flex-shrink-0 font-extrabold", tone.num)}>
        <span className="text-xl leading-none">{days === 0 ? "!" : days}</span>
        <span className="text-[10px] uppercase tracking-wide mt-0.5 font-bold">{days === 0 ? "Today" : days === 1 ? "day" : "days"}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className={cn("block text-xs font-bold", tone.txt)}>{days === 0 ? "Program today" : days <= 3 ? "Coming up soon" : "Next program"}</span>
        <span className="block text-[17px] font-extrabold text-[#17151F] truncate">{title}</span>
        <span className="block text-xs text-[#6B6680] truncate">{sub}</span>
      </span>
    </>
  );
  const cls = cn("flex items-center gap-4 rounded-[20px] p-4 mb-6", tone.bg);
  return href ? <a href={href} className={cn(cls, "transition-transform hover:-translate-y-0.5")}>{body}</a> : <div className={cls}>{body}</div>;
}

/** Fired after the member changes their name or photo, so the sidebar shows it at once. */
export const PROFILE_EVENT = "sp-member-profile";

/** The member's photo, or the first letter of their name on violet. */
export function MemberPhoto({ url, name, size = 32, round = false, className }: { url?: string | null; name?: string | null; size?: number; round?: boolean; className?: string }) {
  const radius = round ? size / 2 : Math.round(size * 0.28);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={cn("object-cover flex-shrink-0 bg-[#EEE8FD]", className)} style={{ width: size, height: size, borderRadius: radius }} />
  ) : (
    <span aria-hidden="true" className={cn("bg-[#7D5CEF] text-white font-bold flex items-center justify-center flex-shrink-0", className)}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}>
      {(name?.trim()?.[0] ?? "M").toUpperCase()}
    </span>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white rounded-[20px]", CARD_SHADOW, className)}>{children}</div>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center h-64" aria-busy="true">
      <span className="w-7 h-7 rounded-full border-2 border-[#EEE8FD] border-t-[#7D5CEF] animate-spin" />
    </div>
  );
}
