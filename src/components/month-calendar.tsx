"use client";

/**
 * A month calendar used by the studio (Calendar) and by team members (My schedule).
 * Swipe left / right on the month (phone or trackpad drag) to go to the next / previous month;
 * the month follows the finger and slides in. Arrow buttons and the keyboard (← →) do the same.
 * Each entry is one day of a program; a day opens a list of its entries.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";

export type CalEntry = {
  key: string;
  /** yyyy-mm-dd */
  date: string;
  title: string;
  sub?: string;
  /** Tailwind classes for the small dot and the chip on wide screens */
  dot: string;
  chip: string;
  badge?: { label: string; cls: string };
  href?: string;
};

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** First and last day (yyyy-mm-dd) of a month, for asking the server. */
export const monthRange = (year: number, month: number) => [dayKey(new Date(year, month, 1)), dayKey(new Date(year, month + 1, 0))] as const;

function grid(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - first + i));
}

export function MonthCalendar({ year, month, onMonth, entries, loading, emptyDay, weekendDay = 5 }: {
  year: number; month: number;
  onMonth: (year: number, month: number) => void;
  entries: CalEntry[];
  loading?: boolean;
  /** What to show on a day with nothing (e.g. an "Add program" button). */
  emptyDay?: (date: string) => React.ReactNode;
  /** The weekly day off shown in red (Friday in Bangladesh). */
  weekendDay?: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState<"" | "in-left" | "in-right">("");
  const start = useRef<{ x: number; y: number; t: number; locked?: "x" | "y" } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEntry[]>();
    for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [entries]);
  const cells = useMemo(() => grid(year, month), [year, month]);
  const today = dayKey(new Date());

  const go = (step: number) => {
    const d = new Date(year, month + step, 1);
    setAnim(step > 0 ? "in-right" : "in-left");
    onMonth(d.getFullYear(), d.getMonth());
  };
  useEffect(() => { if (!anim) return; const t = setTimeout(() => setAnim(""), 260); return () => clearTimeout(t); }, [anim, year, month]);

  // Keyboard: ← → change the month while the calendar has focus.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  };

  // Swipe: follow the finger sideways; a clear sideways move of 50 px (or a quick flick) changes the month.
  const down = (x: number, y: number) => { start.current = { x, y, t: Date.now() }; };
  const move = (x: number, y: number, prevent: () => void) => {
    const s = start.current; if (!s) return;
    const mx = x - s.x, my = y - s.y;
    if (!s.locked) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.locked = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    }
    if (s.locked === "x") { prevent(); setDx(mx); }
  };
  const up = () => {
    const s = start.current; start.current = null;
    if (!s || s.locked !== "x") { setDx(0); return; }
    const w = box.current?.offsetWidth ?? 360;
    const fast = Math.abs(dx) > 30 && Date.now() - s.t < 250;
    if (Math.abs(dx) > Math.min(90, w * 0.18) || fast) go(dx < 0 ? 1 : -1);
    setDx(0);
  };
  // A swipe must not open the day under the finger.
  const swiped = useRef(false);

  // Touch move needs a non-passive listener to stop the page scrolling sideways while swiping.
  useEffect(() => {
    const el = box.current; if (!el) return;
    const tm = (e: TouchEvent) => { const t = e.touches[0]; move(t.clientX, t.clientY, () => { e.preventDefault(); swiped.current = true; }); };
    el.addEventListener("touchmove", tm, { passive: false });
    return () => el.removeEventListener("touchmove", tm);
  });

  const openList = open ? byDay.get(open) ?? [] : [];
  const monthCount = entries.filter(e => e.date.slice(0, 7) === `${year}-${pad(month + 1)}`).length;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#17151F] leading-tight">{MONTH_NAMES[month]} {year}</h2>
          <p className="text-[12.5px] text-[#6B6680]">{loading ? "Loading…" : `${monthCount} program day${monthCount === 1 ? "" : "s"} · swipe to change month`}</p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-[0_1px_2px_rgba(22,18,40,.06)] flex-shrink-0">
          <button type="button" onClick={() => go(-1)} aria-label="Previous month" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F3FA] text-[#4A4658]"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => { const n = new Date(); if (n.getFullYear() !== year || n.getMonth() !== month) { setAnim(new Date(year, month, 1) < n ? "in-right" : "in-left"); onMonth(n.getFullYear(), n.getMonth()); } }}
            className="h-9 px-3 rounded-full text-sm font-semibold text-[#17151F] hover:bg-[#F5F3FA]">Today</button>
          <button type="button" onClick={() => go(1)} aria-label="Next month" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F3FA] text-[#4A4658]"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div ref={box} tabIndex={0} onKeyDown={onKey} aria-label={`${MONTH_NAMES[month]} ${year} — use left and right arrows to change month`}
        className={cn("bg-white rounded-[20px] overflow-hidden mb-7 outline-none focus-visible:ring-2 focus-visible:ring-[#7D5CEF] select-none touch-pan-y", CARD_SHADOW)}
        onTouchStart={e => { swiped.current = false; down(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={up} onTouchCancel={up}
        onPointerDown={e => { if (e.pointerType === "mouse" && e.button === 0) { swiped.current = false; down(e.clientX, e.clientY); } }}
        onPointerMove={e => { if (e.pointerType === "mouse" && start.current) move(e.clientX, e.clientY, () => { swiped.current = true; }); }}
        onPointerUp={e => { if (e.pointerType === "mouse") up(); }}
        onPointerLeave={e => { if (e.pointerType === "mouse" && start.current) up(); }}>
        <div className="grid grid-cols-7 border-b border-[#EEEBF4]">
          {DAY_NAMES.map((d, i) => <div key={d} className={cn("py-2.5 text-center text-xs font-bold", i === weekendDay ? "text-[#C2304F]" : "text-[#6B6680]")}>{d}</div>)}
        </div>
        <div className="relative">
          <div className={cn("grid grid-cols-7", anim === "in-right" && "animate-[cal-in-right_.24s_ease-out]", anim === "in-left" && "animate-[cal-in-left_.24s_ease-out]")}
            style={dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.35, 1 - Math.abs(dx) / 500) } : { transition: "transform .2s ease-out" }}>
            {cells.map((d, i) => {
              const k = dayKey(d);
              const inMonth = d.getMonth() === month;
              const list = byDay.get(k) ?? [];
              const isToday = k === today;
              return (
                <button key={k} type="button"
                  onClick={() => { if (swiped.current) { swiped.current = false; return; } if (inMonth) setOpen(k); else go(d < new Date(year, month, 1) ? -1 : 1); }}
                  aria-label={`${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${list.length ? `, ${list.length} program${list.length > 1 ? "s" : ""}` : ""}`}
                  className={cn("min-h-[64px] sm:min-h-[104px] p-1.5 sm:p-2 text-left border-b border-r border-[#EEEBF4] transition-colors flex flex-col",
                    inMonth ? "hover:bg-[#F7F5FB]" : "bg-[#FBFAFD]", open === k && "bg-[#EEE8FD] hover:bg-[#EEE8FD]", i % 7 === 6 && "border-r-0")}>
                  <span className={cn("w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-semibold mx-auto sm:mx-0 sm:ml-auto tabular-nums",
                    !inMonth && "text-[#CFC8DC]", inMonth && !isToday && "text-[#17151F]", isToday && "bg-[#C2304F] text-white")}>{d.getDate()}</span>
                  {list.length > 0 && (
                    <span className={cn("flex flex-wrap gap-0.5 justify-center mt-1 sm:hidden", !inMonth && "opacity-40")}>
                      {list.slice(0, 3).map(e => <span key={e.key} className={cn("w-1.5 h-1.5 rounded-full", e.dot)} />)}
                      {list.length > 3 && <span className="text-[9px] leading-none font-bold text-[#6B6680]">+</span>}
                    </span>
                  )}
                  <span className={cn("hidden sm:block space-y-1 mt-1 w-full", !inMonth && "opacity-40")}>
                    {list.slice(0, 2).map(e => <span key={e.key} className={cn("block text-xs px-1.5 py-0.5 rounded-[6px] font-semibold truncate leading-tight", e.chip)}>{e.title}</span>)}
                    {list.length > 2 && <span className="block text-xs font-semibold text-[#6B6680] pl-1">+{list.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {loading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center pointer-events-none"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>}
        </div>
      </div>

      {open && (() => {
        const d = new Date(`${open}T12:00:00`);
        const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
        return (
          <>
            <div className="sp-backdrop" onClick={() => setOpen(null)} />
            <aside className="sp-drawer flex flex-col" role="dialog" aria-modal="true" aria-label={label}>
              <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3 border-b border-[#EEEBF4]">
                <div>
                  <p className="text-xs font-semibold text-[#6B6680]">{openList.length} {openList.length === 1 ? "program" : "programs"}</p>
                  <h2 className="text-lg font-bold text-[#17151F]">{label}</h2>
                </div>
                <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                {openList.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="w-12 h-12 rounded-full bg-[#EEE8FD] flex items-center justify-center mx-auto"><CalendarDays className="w-5 h-5 text-[#5B3FD0]" /></span>
                    <p className="mt-3 text-sm font-bold text-[#17151F]">Free day</p>
                    <p className="text-xs text-[#6B6680] mt-1">No programs on this date.</p>
                    {emptyDay?.(open)}
                  </div>
                ) : (
                  <div className={cn("bg-white rounded-[20px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
                    {openList.map(e => <EntryRow key={e.key} e={e} />)}
                  </div>
                )}
              </div>
            </aside>
          </>
        );
      })()}
    </>
  );
}

export function EntryRow({ e, withDate }: { e: CalEntry; withDate?: boolean }) {
  const inner = (
    <>
      {withDate ? (
        <span className="w-11 flex-shrink-0 text-center">
          <span className="block text-[17px] font-bold text-[#17151F] leading-none tabular-nums">{Number(e.date.slice(8, 10))}</span>
          <span className="block text-[11px] font-semibold text-[#6B6680] mt-0.5">{new Date(`${e.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" })}</span>
        </span>
      ) : <span className={cn("w-1.5 self-stretch rounded-full flex-shrink-0", e.dot)} />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-[#17151F] truncate">{e.title}</span>
        {e.sub && <span className="block text-xs text-[#6B6680] truncate mt-0.5">{e.sub}</span>}
      </span>
      {e.badge && <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0", e.badge.cls)}>{e.badge.label}</span>}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-3 min-h-[64px] transition-colors";
  return e.href ? <Link href={e.href} className={cn(cls, "hover:bg-[#F7F5FB]")}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
