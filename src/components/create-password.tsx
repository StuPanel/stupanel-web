"use client";

/**
 * One clear box to create a password: big label, Show/Hide written out, and a live check
 * (no second "type it again" box — people missed it; Show lets them check what they typed).
 */
import { Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const MIN_PASSWORD = 8;

export function CreatePassword({ value, onChange, show, onShow, label = "Create your password", autoFocus = true }: {
  value: string; onChange: (v: string) => void; show: boolean; onShow: (v: boolean) => void; label?: string; autoFocus?: boolean;
}) {
  const long = value.length >= MIN_PASSWORD;
  return (
    <div>
      <label htmlFor="sp-new-password" className="flex items-center gap-2 text-[15px] font-bold text-[#17151F] mb-2">
        <KeyRound className="w-4 h-4 text-[#7D5CEF]" />{label}
      </label>
      <div className={cn("flex items-center rounded-[14px] border-2 bg-white transition-colors focus-within:border-[#7D5CEF]", long ? "border-[#1F8A5B]/50" : "border-[#E4DCFB]")}>
        <input id="sp-new-password" type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
          autoComplete="new-password" autoFocus={autoFocus} placeholder="Type a password" spellCheck={false} autoCapitalize="off"
          className="flex-1 min-w-0 h-[52px] px-4 bg-transparent text-[16px] text-[#17151F] placeholder:text-[#A29DB3] !outline-none !ring-0 !shadow-none focus:!outline-none focus-visible:!outline-none" />
        <button type="button" onClick={() => onShow(!show)}
          className="h-[44px] mr-1 px-3 rounded-[10px] text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#F5F3FA] inline-flex items-center gap-1.5 flex-shrink-0">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{show ? "Hide" : "Show"}
        </button>
      </div>
      <p className={cn("mt-2 text-[13px] flex items-center gap-1.5", long ? "text-[#1F8A5B]" : "text-[#6B6680]")}>
        <span className={cn("w-4 h-4 rounded-full flex items-center justify-center", long ? "bg-[#1F8A5B] text-white" : "border border-[#C9C2DA]")}>
          {long && <Check className="w-3 h-3" strokeWidth={3} />}
        </span>
        At least {MIN_PASSWORD} characters{!long && value ? ` (${MIN_PASSWORD - value.length} more)` : ""}
      </p>
    </div>
  );
}
