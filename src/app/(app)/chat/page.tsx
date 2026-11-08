"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Camera, Check, Handshake, SlidersHorizontal, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_READ_EVENT, loadChatUnread, type ChatUnread } from "@/lib/chat-unread";
import { ProgramsChat } from "./_components/programs-chat";
import { DirectChat } from "./_components/direct-chat";

type Tab = "programs" | "team" | "clients";

const TABS: Record<Tab, { label: string; icon: typeof Camera }> = {
  programs: { label: "Programs", icon: Camera },
  team: { label: "Team", icon: Users },
  clients: { label: "Clients", icon: Handshake },
};
const DEFAULT_ORDER: Tab[] = ["programs", "team", "clients"];
const ORDER_KEY = "sp_chat_tab_order";

/** The order is this person's own choice, kept on this device. The first tab opens by default. */
function readOrder(): Tab[] {
  try {
    const v = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null");
    if (Array.isArray(v) && v.length === 3 && DEFAULT_ORDER.every(t => v.includes(t))) return v as Tab[];
  } catch { /* storage blocked */ }
  return DEFAULT_ORDER;
}

export default function ChatPage() {
  const [order, setOrder] = useState<Tab[]>(DEFAULT_ORDER);
  const [tab, setTab] = useState<Tab>("programs");
  const [arranging, setArranging] = useState(false);
  const [unread, setUnread] = useState<ChatUnread | null>(null);

  useEffect(() => {
    const o = readOrder();
    setOrder(o);
    setTab(o[0]);
  }, []);

  useEffect(() => {
    const load = () => loadChatUnread().then(d => { if (d) setUnread(d); });
    load();
    window.addEventListener(CHAT_READ_EVENT, load);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
    return () => { window.removeEventListener(CHAT_READ_EVENT, load); clearInterval(t); };
  }, []);

  function moveTab(t: Tab, dir: -1 | 1) {
    const i = order.indexOf(t), j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  }

  return (
    <div className="h-[calc(100dvh-11rem)] lg:h-[calc(100vh-6.5rem)] flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="relative flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
        <div role="tablist" aria-label="Chat" className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] flex-1 min-w-0">
          {order.map(key => {
            const t = TABS[key];
            const n = unread?.[key] ?? 0;
            const on = tab === key;
            return (
              <button key={key} role="tab" aria-selected={on} onClick={() => setTab(key)}
                className={cn(
                  "h-9 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors",
                  on ? "bg-[#7D5CEF] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]",
                )}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
                {n > 0 && (
                  <span className={cn("h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center",
                    on ? "bg-white text-[#5B3FD0]" : "bg-[#C2304F] text-white")}>
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setArranging(v => !v)} aria-expanded={arranging} aria-label="Change tab order"
          title="Change tab order"
          className={cn("h-9 w-9 flex-shrink-0 rounded-full inline-flex items-center justify-center transition-colors",
            arranging ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#6B6680] hover:bg-[#EEEBF4]")}>
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {arranging && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setArranging(false)} />
            <div className="absolute right-3 top-[calc(100%+6px)] z-40 w-64 bg-white rounded-[18px] p-2 shadow-[0_12px_40px_rgba(22,18,40,.18)] border border-[#EEEBF4]">
              <p className="px-2 pt-1 pb-2 text-[12px] text-[#6B6680]">Tab order — the first one opens when you come to Chat.</p>
              {order.map((key, i) => {
                const t = TABS[key];
                return (
                  <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-[12px] hover:bg-[#F5F3FA]">
                    <span className="w-5 text-[12px] font-bold text-[#A29DB3]">{i + 1}</span>
                    <t.icon className="w-4 h-4 text-[#5B3FD0]" />
                    <span className="flex-1 text-[14px] font-semibold text-[#17151F]">{t.label}</span>
                    <button type="button" onClick={() => moveTab(key, -1)} disabled={i === 0} aria-label={`Move ${t.label} up`}
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#4A4658] hover:bg-white disabled:opacity-25"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => moveTab(key, 1)} disabled={i === order.length - 1} aria-label={`Move ${t.label} down`}
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#4A4658] hover:bg-white disabled:opacity-25"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
              <button type="button" onClick={() => setArranging(false)}
                className="mt-1 w-full h-9 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />Done
              </button>
            </div>
          </>
        )}
      </div>

      {tab === "programs" && <ProgramsChat />}
      {tab === "team" && <DirectChat kind="team" />}
      {tab === "clients" && <DirectChat kind="clients" />}
    </div>
  );
}
