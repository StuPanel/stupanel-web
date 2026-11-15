"use client";
/**
 * A manager is also a team member: they have the studio panel and their own
 * "My work" panel (programs, editing, pay). This switch moves between the two
 * and the last one used opens first after signing in.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Camera, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API, apiFetch } from "@/lib/api";

export type Panel = "studio" | "member";
const KEY = "sp_last_panel";

export function rememberPanel(p: Panel) { try { localStorage.setItem(KEY, p); } catch { /* ignore */ } }
/** Where a manager starts: the panel they used last (the studio the first time). */
export function managerStartsInMember(): boolean {
  try { return localStorage.getItem("user_role") === "manager" && localStorage.getItem(KEY) === "member"; } catch { return false; }
}

/** Things waiting in "My work" (editing to do). 0 while loading or on error. */
export function useMyWorkCount(on: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    let live = true;
    apiFetch(`${API}/member/home`).then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && Array.isArray(d?.todos)) setN(d.todos.length); }).catch(() => {});
    return () => { live = false; };
  }, [on]);
  return n;
}

export function PanelSwitch({ current, studioHref = "/dashboard", compact, onNavigate }: {
  current: Panel; studioHref?: string; compact?: boolean; onNavigate?: () => void;
}) {
  const todo = useMyWorkCount(current === "studio");
  const tabs = [
    { id: "studio" as const, label: "Studio", icon: LayoutGrid, href: studioHref },
    { id: "member" as const, label: "My work", icon: Camera, href: "/member/dashboard" },
  ];
  if (compact) {
    const other = tabs.find(t => t.id !== current)!;
    return (
      <Link href={other.href} onClick={() => { rememberPanel(other.id); onNavigate?.(); }} title={`Go to ${other.label}`} aria-label={`Go to ${other.label}`}
        className="relative w-10 h-10 rounded-xl bg-[#F5F3FA] text-[#5B3FD0] flex items-center justify-center hover:bg-[#EEE8FD]">
        <other.icon className="w-[18px] h-[18px]" />
        {other.id === "member" && todo > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[#C2304F] text-white text-[10px] font-bold flex items-center justify-center">{todo > 9 ? "9+" : todo}</span>}
      </Link>
    );
  }
  return (
    <nav aria-label="Switch panel" className="grid grid-cols-2 gap-1 p-1 rounded-[14px] bg-[#F1EFF6]">
      {tabs.map(t => {
        const on = t.id === current;
        return (
          <Link key={t.id} href={t.href} aria-current={on ? "page" : undefined}
            onClick={() => { rememberPanel(t.id); onNavigate?.(); }}
            className={cn("h-9 rounded-[10px] text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors",
              on ? "bg-white text-[#17151F] font-bold shadow-[0_1px_3px_rgba(22,18,40,.12)]" : "text-[#6B6680] font-semibold hover:text-[#17151F]")}>
            <t.icon className="w-4 h-4" />{t.label}
            {t.id === "member" && !on && todo > 0 && (
              <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-[#C2304F] text-white text-[11px] font-bold flex items-center justify-center" aria-label={`${todo} to do`}>{todo > 9 ? "9+" : todo}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
