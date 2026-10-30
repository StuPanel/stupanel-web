/**
 * StuPanel "Apple style" building blocks (DESIGN_SYSTEM v2).
 * The look of the Settings screen, for every page:
 *   - each section/menu has its own coloured icon tile (TILE colours only)
 *   - content sits in white grouped cards with hairline rows
 *   - a page header = big tile + title + one line, actions on the right
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** The only tile colours (all from the design tokens). */
export const TILE = {
  violet: "#7D5CEF",
  deep: "#5B3FD0",
  ink: "#16141D",
  teal: "#126B66",
  blue: "#1F5C99",
  orchid: "#9E3A8C",
  green: "#1F8A5B",
  red: "#C2304F",
} as const;
export type TileColor = keyof typeof TILE;

export const CARD_SHADOW = "shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]";

export function Tile({ icon: Icon, color, size = 28, className }: {
  icon: React.ElementType; color: string; size?: number; className?: string;
}) {
  const bg = color in TILE ? TILE[color as TileColor] : color;
  return (
    <span className={cn("inline-flex items-center justify-center flex-shrink-0 shadow-[inset_0_-1px_0_rgba(0,0,0,.12)]", className)}
      style={{ width: size, height: size, borderRadius: size * 0.28, background: bg }} aria-hidden="true">
      <Icon className="text-white" style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2.2} />
    </span>
  );
}

/** Page title block: big tile + title + one line; actions (buttons, search) on the right. */
export function PageHeader({ icon, color, title, sub, children, className }: {
  icon: React.ElementType; color: string; title: string; sub?: React.ReactNode;
  children?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-4 mb-6", className)}>
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Tile icon={icon} color={color} size={52} />
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight truncate">{title}</h1>
          {sub && <p className="text-sm text-[#6B6680] mt-0.5">{sub}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">{children}</div>}
    </div>
  );
}

/** White grouped card. Children are rows separated by hairlines. */
export function Group({ title, note, action, children, className, flush }: {
  title?: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode;
  children: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={cn("mb-7", className)}>
      {(title || action) && (
        <div className="px-1 mb-2 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-bold text-[#4A4658]">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn("bg-white rounded-[20px] overflow-hidden", CARD_SHADOW, !flush && "divide-y divide-[#EEEBF4]")}>
        {children}
      </div>
      {note && <p className="px-1 mt-2 text-xs text-[#6B6680] leading-relaxed">{note}</p>}
    </section>
  );
}

/** A tappable row with tile, title, subtitle and something on the right. */
export function ListRow({ href, onClick, icon, color, title, sub, right, chevron = true, className }: {
  href?: string; onClick?: () => void; icon?: React.ElementType; color?: string;
  title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; chevron?: boolean; className?: string;
}) {
  const inner = (
    <>
      {icon && color && <Tile icon={icon} color={color} size={32} />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-[#17151F] truncate">{title}</span>
        {sub && <span className="block text-xs text-[#6B6680] truncate mt-0.5">{sub}</span>}
      </span>
      {right && <span className="flex-shrink-0 text-right">{right}</span>}
      {chevron && (href || onClick) && <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />}
    </>
  );
  const cls = cn("w-full flex items-center gap-3 px-4 sm:px-5 min-h-[60px] py-3 text-left transition-colors",
    (href || onClick) && "hover:bg-[#F7F5FB] active:bg-[#F5F3FA]", className);
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

/** Small number card: tile + label + big value. */
export function StatCard({ icon, color, label, value, sub, href }: {
  icon: React.ElementType; color: string; label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <Tile icon={icon} color={color} size={28} />
        <p className="text-[13px] font-semibold text-[#4A4658] truncate">{label}</p>
      </div>
      <p className="mt-3 text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] tabular-nums leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-[#6B6680]">{sub}</p>}
    </>
  );
  const cls = cn("block bg-white rounded-[20px] p-4", CARD_SHADOW, href && "transition-transform hover:-translate-y-0.5");
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
