"use client";

/**
 * Pieces for full-page profiles (client, team member): cards, rows, chips,
 * quick actions and the tab bar. Keep both profiles looking the same.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Tile, type TileColor } from "@/components/ui/apple";

export const card = cn("bg-white rounded-[22px]", CARD_SHADOW);
export const CHIP: Record<string, string> = {
  green: "bg-[#E7F5EE] text-[#14613F]", red: "bg-[#FDECEF] text-[#9C2340]", amber: "bg-[#FFF3E0] text-[#7A4800]",
  violet: "bg-[#EEE8FD] text-[#5B3FD0]", grey: "bg-[#F1EFF6] text-[#4A4658]", blue: "bg-[#E8F0FA] text-[#1F5C99]", orchid: "bg-[#F7E9F4] text-[#823072]",
};
export const Chip = ({ tone, children }: { tone: keyof typeof CHIP; children: React.ReactNode }) => (
  <span className={cn("h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center whitespace-nowrap flex-shrink-0", CHIP[tone])}>{children}</span>
);

export function Section({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-6", className)}>
      {(title || action) && (
        <div className="px-1 mb-2 flex items-center justify-between gap-3 min-h-[24px]">
          {title && <h2 className="text-[13px] font-bold text-[#4A4658]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export const linkBtn = "inline-flex items-center gap-1 text-[13px] font-semibold text-[#5B3FD0] hover:text-[#4630A8]";

/** A row in a list card: tile, two lines of text, something on the right, chevron. */
export function Row({ href, external, onClick, icon, color, lead, title, sub, right }: {
  href?: string; external?: boolean; onClick?: () => void; icon?: React.ElementType; color?: TileColor; lead?: React.ReactNode;
  title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode;
}) {
  const inner = (
    <>
      {lead ?? (icon && <Tile icon={icon} color={color ?? "deep"} size={38} />)}
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{title}</span>
        {sub && <span className="block text-[12.5px] text-[#6B6680] truncate mt-0.5">{sub}</span>}
      </span>
      {right && <span className="flex flex-col items-end gap-1 flex-shrink-0 text-right">{right}</span>}
      {(href || onClick) && <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0 hidden sm:block" />}
    </>
  );
  const cls = "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F7F5FB]";
  if (href) return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className="flex items-center gap-3 px-4 py-3">{inner}</div>;
}
export const List = ({ children }: { children: React.ReactNode }) => <div className={cn(card, "overflow-hidden divide-y divide-[#EEEBF4]")}>{children}</div>;

export function Empty({ icon: Icon, title, text, children }: { icon: React.ElementType; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className={cn(card, "py-10 px-6 text-center")}>
      <span className="w-12 h-12 rounded-full bg-[#F1EFF6] text-[#6B6680] flex items-center justify-center mx-auto"><Icon className="w-5 h-5" /></span>
      <p className="mt-3 text-[15px] font-bold text-[#17151F]">{title}</p>
      {text && <p className="mt-1 text-[13px] text-[#6B6680]">{text}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export const softBtn = "h-10 px-4 rounded-full bg-[#EEE8FD] hover:bg-[#E2D9FC] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5";

export function QuickAction({ icon: Icon, label, tone, href, onClick, disabled }: {
  icon: React.ElementType; label: string; tone: string; href?: string; onClick?: () => void; disabled?: boolean;
}) {
  const inner = (<><span className={cn("w-11 h-11 rounded-full flex items-center justify-center", tone)}><Icon className="w-[18px] h-[18px]" /></span><span className="text-[12px] font-semibold text-[#4A4658] leading-tight text-center">{label}</span></>);
  const cls = cn("flex flex-col items-center gap-1.5 py-1 rounded-[14px] transition-opacity", disabled ? "opacity-40 pointer-events-none" : "hover:opacity-80");
  return href
    ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls} aria-disabled={disabled}>{inner}</a>
    : <button type="button" onClick={onClick} disabled={disabled} className={cls}>{inner}</button>;
}


export function ProfileSkeleton({ label = "Loading" }: { label?: string }) {
  const b = "bg-white/70 rounded-[22px] animate-pulse";
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="h-9 w-24 rounded-full bg-white/70 animate-pulse mb-3" />
      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5">
        <div className="space-y-4 mb-4"><div className={cn(b, "h-[210px]")} /><div className={cn(b, "h-[170px]")} /></div>
        <div className="space-y-4"><div className="h-10 w-full max-w-md rounded-full bg-white/70 animate-pulse" /><div className={cn(b, "h-[76px]")} /><div className={cn(b, "h-[200px]")} /></div>
      </div>
    </div>
  );
}


/** Tab kept in local state (instant) and mirrored in the address bar as ?tab=. */
export function useTab<T extends string>(base: string, all: readonly T[], initial: string | null): [T, (t: T) => void] {
  const [tab, set] = useState<T>(() => (all.includes(initial as T) ? (initial as T) : all[0]));
  return [tab, (t: T) => { set(t); window.history.replaceState(null, "", t === all[0] ? base : `${base}?tab=${t}`); }];
}

export function TabBar<T extends string>({ tabs, value, onChange, label }: {
  tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void; label: string;
}) {
  return (
    <div className="sticky top-16 z-10 -mx-3 sm:-mx-4 lg:mx-0 px-3 sm:px-4 lg:px-0 py-2 mb-3 sp-topbar lg:static lg:bg-transparent lg:backdrop-filter-none lg:py-0 lg:mb-4">
      <div role="tablist" aria-label={label} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {tabs.map(t => {
          const on = value === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={on} type="button" onClick={() => onChange(t.id)}
              className={cn("h-10 px-4 rounded-full text-[13.5px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0 transition-colors",
                on ? "bg-[#16141D] text-white" : "bg-white text-[#4A4658] hover:text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)]")}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className={cn("text-[12px] tabular-nums", on ? "text-white/70" : "text-[#8A8599]")}>{t.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const MENU_CLS = "bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1";
export const MENU_ITEM = "w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]";

/**
 * Close a small menu when the person clicks anywhere else or presses Escape.
 * Put the returned ref on the element that holds both the button and the menu.
 * (A full-screen backdrop inside a card does not work: cards blur what is behind them,
 * which keeps "fixed" children inside the card.)
 */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) closeRef.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return ref;
}
