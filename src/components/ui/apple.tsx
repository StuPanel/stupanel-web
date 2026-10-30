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
      {children && <div className="flex items-center gap-2 w-full sm:w-auto">{children}</div>}
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

// ─── List-page pieces ─────────────────────────────────────────────────────────

/** Calendar-style date block: "NOV / 15". */
export function DateBox({ date }: { date?: string | Date | null }) {
  const dt = date ? new Date(date) : null;
  const ok = dt && !isNaN(dt.getTime());
  return (
    <span className="w-12 flex-shrink-0 rounded-[12px] bg-[#FDECEF] text-center py-1.5" aria-hidden="true">
      <span className="block text-[11px] font-bold text-[#C2304F] leading-none">
        {ok ? new Intl.DateTimeFormat("en-GB", { month: "short" }).format(dt!).toUpperCase() : "—"}
      </span>
      <span className="block text-lg font-extrabold text-[#17151F] leading-tight tabular-nums">{ok ? dt!.getDate() : ""}</span>
    </span>
  );
}

/** Round initial avatar. */
export function Initial({ name, size = 40 }: { name?: string | null; size?: number }) {
  return (
    <span className="rounded-full bg-[#EEE8FD] text-[#5B3FD0] font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** White search pill for page headers. */
export function SearchField({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="w-full h-10 pl-10 pr-9 rounded-full bg-white text-sm text-[#17151F] placeholder:text-[#6B6680] shadow-[0_1px_2px_rgba(22,18,40,.06)] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}

/** Filter chips in one scrollable line (iOS segmented feel). */
export function Chips<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; label: string;
  options: { value: T; label: string; count?: number; dot?: string }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-4 [scrollbar-width:none]">
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} type="button" onClick={() => onChange(o.value)}
            className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors flex-shrink-0",
              on ? "bg-[#16141D] text-white" : "bg-white text-[#4A4658] hover:text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)]")}>
            {o.dot && <span className="w-2 h-2 rounded-full" style={{ background: o.dot }} />}
            {o.label}
            {o.count !== undefined && <span className={cn("tabular-nums", on ? "text-white/70" : "text-[#6B6680]")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function RowsSkeleton({ n = 5 }: { n?: number }) {
  return (
    <div className={cn("bg-white rounded-[20px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px]">
          <div className="sp-skel w-11 h-11 rounded-[12px]" />
          <div className="flex-1 space-y-2"><div className="sp-skel h-3.5 w-44 rounded-full" /><div className="sp-skel h-3 w-28 rounded-full" /></div>
          <div className="sp-skel h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: {
  icon: React.ElementType; title: string; text?: string; action?: React.ReactNode;
}) {
  return (
    <div className={cn("bg-white rounded-[20px] py-12 px-6 text-center", CARD_SHADOW)}>
      <span className="w-14 h-14 rounded-full bg-[#EEE8FD] flex items-center justify-center mx-auto"><Icon className="w-6 h-6 text-[#5B3FD0]" /></span>
      <p className="mt-4 text-base font-bold text-[#17151F]">{title}</p>
      {text && <p className="text-sm text-[#6B6680] mt-1">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = "h-10 px-4 rounded-full bg-white text-sm font-semibold text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)] disabled:opacity-40 hover:bg-[#F7F5FB]";
  return (
    <div className="flex items-center justify-center gap-3 mt-2 mb-6">
      <button className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="text-sm text-[#6B6680] tabular-nums">{page} of {pages}</span>
      <button className={btn} disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}

/** Violet main-action pill (one per screen). */
export function MainButton({ onClick, children, icon: Icon }: { onClick: () => void; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <button type="button" onClick={onClick}
      className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] active:scale-[.97] text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-all flex-shrink-0">
      {Icon && <Icon className="w-4 h-4" />}{children}
    </button>
  );
}
