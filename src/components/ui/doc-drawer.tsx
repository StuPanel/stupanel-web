"use client";

/**
 * Side drawer for looking at one document (an invoice, a quote, a payment…):
 * the same lavender page and header as FormDrawer, white cards inside,
 * round pill buttons for actions, and an optional sticky footer.
 */
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Tile, type TileColor } from "./apple";

export function DocDrawer({ onClose, icon, color, title, badge, sub, children, footer, onTop, label }: {
  onClose: () => void;
  icon: React.ElementType; color: TileColor;
  title: React.ReactNode;
  /** A status chip shown next to the title. */
  badge?: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Opened from inside another drawer — sit above it. */
  onTop?: boolean;
  /** Name read out by screen readers. */
  label?: string;
}) {
  return (
    <>
      <div className={cn("sp-backdrop", onTop ? "z-[60]" : "z-40")} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={label ?? (typeof title === "string" ? title : undefined)}
        className={cn("sp-drawer sm:max-w-[560px] flex flex-col bg-[#F5F3FA]", onTop ? "z-[70]" : "z-50")}>
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <Tile icon={icon} color={color} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight truncate">{title}</h2>
              {badge}
            </div>
            {sub && <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white hover:bg-[#EEEBF4] text-[#6B6680] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-1 pb-8 space-y-5">{children}</div>
        {footer && <div className="px-4 sm:px-5 py-4 bg-white/80 backdrop-blur border-t border-[#EEEBF4] flex gap-3">{footer}</div>}
      </div>
    </>
  );
}

/** A titled white card inside a DocDrawer. `flush` drops the inner padding (for row lists). */
export function DocCard({ title, action, children, className, flush }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-1 mb-2">
          {title && <h3 className="text-[13px] font-bold text-[#4A4658]">{title}</h3>}
          {action}
        </div>
      )}
      <div className={cn("bg-white rounded-[20px]", CARD_SHADOW, flush ? "divide-y divide-[#EEEBF4] overflow-hidden" : "p-4", className)}>{children}</div>
    </section>
  );
}

/** "Label ........ value" line used in totals and detail lists. */
export function DocLine({ label, value, tone, strong, className }: {
  label: React.ReactNode; value: React.ReactNode;
  tone?: "green" | "red" | "amber" | "muted"; strong?: boolean; className?: string;
}) {
  const color = { green: "text-[#1F8A5B]", red: "text-[#C2304F]", amber: "text-[#9A5B00]", muted: "text-[#6B6680]" }[tone ?? "muted"];
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-[14px]", strong ? "font-extrabold text-[#17151F] text-[16px]" : color, className)}>
      <span className="min-w-0">{label}</span>
      <span className="tabular-nums text-right flex-shrink-0">{value}</span>
    </div>
  );
}

const PILL: Record<string, string> = {
  primary: "bg-[#7D5CEF] hover:bg-[#6143CF] text-white",
  green: "bg-[#1F8A5B] hover:bg-[#18724A] text-white",
  dark: "bg-[#17151F] hover:bg-[#2B2836] text-white",
  soft: "bg-white hover:bg-[#EEEBF4] text-[#33303F] shadow-[0_1px_2px_rgba(22,18,40,.06)]",
  danger: "bg-white hover:bg-[#FDECEF] text-[#C2304F] shadow-[0_1px_2px_rgba(22,18,40,.06)]",
};

/** Round action button; renders a link when `href` is given. */
export function PillButton({ icon: Icon, children, onClick, href, tone = "soft", disabled, external, className }: {
  icon?: React.ElementType; children: React.ReactNode; onClick?: () => void; href?: string;
  tone?: keyof typeof PILL; disabled?: boolean; external?: boolean; className?: string;
}) {
  const cls = cn("h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap", PILL[tone], className);
  const inner = <>{Icon && <Icon className="w-4 h-4" />}{children}</>;
  if (href) {
    return external
      ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
      : <Link href={href} className={cls}>{inner}</Link>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{inner}</button>;
}

/** Small coloured status chip. */
export function StatusChip({ label, bg, text }: { label: string; bg: string; text: string }) {
  return <span className="flex-shrink-0 h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center" style={{ background: bg, color: text }}>{label}</span>;
}
