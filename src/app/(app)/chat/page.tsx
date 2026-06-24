"use client";

import { useState } from "react";
import { Camera, Users, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgramsChat } from "./_components/programs-chat";
import { DirectChat } from "./_components/direct-chat";

type Tab = "programs" | "team" | "clients";

const TABS: { key: Tab; label: string; icon: typeof Camera }[] = [
  { key: "programs", label: "Programs", icon: Camera },
  { key: "team", label: "Team", icon: Users },
  { key: "clients", label: "Clients", icon: Handshake },
];

export default function ChatPage() {
  const [tab, setTab] = useState<Tab>("programs");

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-1 px-3 pt-3 border-b border-slate-100 flex-shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t.key ? "border-indigo-600 text-indigo-700 bg-indigo-50/60" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50",
            )}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "programs" && <ProgramsChat />}
      {tab === "team" && <DirectChat kind="team" />}
      {tab === "clients" && <DirectChat kind="clients" />}
    </div>
  );
}
