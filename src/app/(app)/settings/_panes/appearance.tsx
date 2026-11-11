"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BACKDROPS, getBackdrop, setBackdrop, type BackdropKey } from "@/lib/backdrop";
import { useAuth } from "@/context/auth-context";
import { Group, useSettings } from "../_ui";

/** A tiny picture of the workspace in that backdrop: sidebar + two cards on the glow. */
function Preview({ base, a, b, plain }: { base: string; a: string; b: string; plain: boolean }) {
  const glass = plain ? "#FFFFFF" : "rgba(255,255,255,.66)";
  return (
    <div className="relative h-[86px] rounded-[14px] overflow-hidden"
      style={{ background: plain ? base : `radial-gradient(70% 70% at 0% 0%, ${a}, transparent 70%), radial-gradient(70% 70% at 100% 100%, ${b}, transparent 70%), ${base}` }}>
      <div className="absolute left-2 top-2 bottom-2 w-[22%] rounded-[8px]" style={{ background: glass, boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)" }} />
      <div className="absolute left-[30%] right-2 top-2 h-[34%] rounded-[8px]" style={{ background: glass }} />
      <div className="absolute left-[30%] right-[38%] bottom-2 h-[38%] rounded-[8px]" style={{ background: glass }} />
      <div className="absolute right-2 w-[32%] bottom-2 h-[38%] rounded-[8px]" style={{ background: glass }} />
    </div>
  );
}

export function AppearancePane() {
  const { studio, patchStudio } = useSettings();
  const { user } = useAuth();
  const owner = user?.role === "owner";
  const [current, setCurrent] = useState<BackdropKey>("violet");
  const [saving, setSaving] = useState(false);
  const saved = studio?.appearance?.backdrop ?? null;
  // The studio's choice once it is known; until then what this device shows.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!saving) setCurrent(saved ?? getBackdrop()); }, [saved, saving]);

  async function pick(k: BackdropKey) {
    if (!owner || saving || (k === current && k === saved)) return; // same as the studio already has
    const before = current;
    setCurrent(k);
    setBackdrop(k); // show it at once
    setSaving(true);
    const ok = await patchStudio("appearance", { backdrop: k });
    if (!ok) { setCurrent(before); setBackdrop(before); }
    setSaving(false);
  }

  return (
    <Group title="Backdrop" note={owner
      ? "The scene behind your workspace. Everyone in your studio sees the same one — in the studio app and in the team member panel."
      : "The scene behind your workspace, the same for the whole studio. Only the studio owner can change it."}>
      <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Backdrop">
        {BACKDROPS.map(bd => {
          const on = bd.key === current;
          return (
            <button key={bd.key} type="button" role="radio" aria-checked={on} disabled={!owner || saving} onClick={() => pick(bd.key)}
              className={cn("relative text-left rounded-[18px] p-2 bg-white transition-all disabled:cursor-default", !owner && !on && "opacity-60",
                on ? "ring-2 ring-[#7D5CEF] shadow-[0_8px_24px_-10px_rgba(125,92,239,.5)]" : "ring-1 ring-[#EEEBF4] hover:ring-[#D9D3EA]")}>
              <Preview base={bd.base} a={bd.a} b={bd.b} plain={bd.key === "plain"} />
              <p className="mt-2 px-1 text-[14px] font-bold text-[#17151F]">{bd.name}</p>
              <p className="px-1 pb-1 text-[12px] text-[#6B6680] leading-snug">{bd.sub}</p>
              {on && (
                <span className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-[#7D5CEF] text-white flex items-center justify-center shadow">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Group>
  );
}
