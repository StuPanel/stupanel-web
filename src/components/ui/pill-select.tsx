"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** White pill <select> used in page toolbars (Apple style). */
export function PillSelect({ value, onChange, options, label, small, className }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  label: string; small?: boolean; className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}
        className={cn("appearance-none rounded-full bg-white font-semibold text-[#17151F] pl-4 pr-9 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40",
          "shadow-[0_1px_2px_rgba(22,18,40,.06)]", small ? "h-8 text-xs" : "h-10 text-sm")}
        style={{ WebkitAppearance: "none" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680] pointer-events-none" />
    </div>
  );
}
