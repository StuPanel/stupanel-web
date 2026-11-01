"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Megaphone, X } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Ann { id: string; title: string; content: string; type: string }

const KEY = "stupanel:dismissed-announcements";
const TONE: Record<string, { box: string; icon: React.ComponentType<{ className?: string }>; iconCls: string }> = {
  info: { box: "bg-[#EEE8FD] border-[#DCD2FB]", icon: Megaphone, iconCls: "text-[#5B3FD0]" },
  success: { box: "bg-[#E9F5EF] border-[#CDE8DA]", icon: CheckCircle2, iconCls: "text-[#1F8A5B]" },
  warning: { box: "bg-[#FFF4E5] border-[#F7DDB5]", icon: AlertTriangle, iconCls: "text-[#B45309]" },
  critical: { box: "bg-[#FDECEF] border-[#F6CDD6]", icon: Info, iconCls: "text-[#C2304F]" },
};

function readDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

/** Messages from the StuPanel team, shown at the top of the studio app until closed. */
export function AnnouncementBanner() {
  const [items, setItems] = useState<Ann[]>([]);

  useEffect(() => {
    let alive = true;
    apiFetch(`${API_URL}/announcements`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Ann[]) => { if (alive) { const gone = readDismissed(); setItems(rows.filter(a => !gone.includes(a.id))); } })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function close(id: string) {
    setItems(list => list.filter(a => a.id !== id));
    try { localStorage.setItem(KEY, JSON.stringify([...readDismissed(), id].slice(-50))); } catch { /* private mode */ }
  }

  if (!items.length) return null;
  const a = items[0];
  const t = TONE[a.type] ?? TONE.info;
  const Icon = t.icon;
  return (
    <div role="status" className={cn("flex items-start gap-3 border px-4 py-3 lg:rounded-xl animate-in fade-in slide-in-from-top-1 duration-300", t.box)}>
      <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", t.iconCls)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F]">{a.title}</p>
        <p className="text-[13px] text-[#4A4658] whitespace-pre-wrap mt-0.5">{a.content}</p>
        {items.length > 1 && <p className="text-[11px] text-[#6B6680] mt-1">{items.length - 1} more message{items.length > 2 ? "s" : ""} after this one</p>}
      </div>
      <button onClick={() => close(a.id)} aria-label="Close message" className="p-1 rounded-lg text-[#6B6680] hover:bg-black/5"><X className="w-4 h-4" /></button>
    </div>
  );
}
