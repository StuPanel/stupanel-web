"use client";
/**
 * "Client preview": the page a client or guest gets from the link, shown inside StuPanel (phone or computer size),
 * with a way to open it in a new tab. The page itself is opened in preview mode, so nothing is counted or saved.
 */
import { useEffect, useState } from "react";
import { ExternalLink, Monitor, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientPreview({ src, title, note, onClose }: { src: string; title: string; note?: string; onClose: () => void }) {
  const [size, setSize] = useState<"phone" | "computer">("phone");
  const [key, setKey] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("sp-locked");
    return () => { document.removeEventListener("keydown", onKey); document.documentElement.classList.remove("sp-locked"); };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] bg-[#17151F]/70 backdrop-blur-sm flex flex-col sp-fade-in">
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold truncate">{title}</p>
          {note && <p className="text-[12.5px] text-white/70 truncate">{note}</p>}
        </div>
        <div role="radiogroup" aria-label="Screen size" className="hidden sm:inline-flex p-1 rounded-full bg-white/10">
          {([["phone", Smartphone, "Phone"], ["computer", Monitor, "Computer"]] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" role="radio" aria-checked={size === v} onClick={() => { setSize(v); setKey(k => k + 1); }}
              className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5", size === v ? "bg-white text-[#17151F]" : "text-white/80 hover:text-white")}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
        <a href={src} target="_blank" rel="noopener noreferrer" className="h-10 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[13px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
          <ExternalLink className="w-4 h-4" /><span className="hidden sm:inline">New tab</span>
        </a>
        <button type="button" onClick={onClose} aria-label="Close preview" className="w-10 h-10 rounded-full bg-white text-[#17151F] flex items-center justify-center flex-shrink-0"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 min-h-0 flex items-start justify-center px-0 sm:px-5 pb-0 sm:pb-5" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={cn("bg-white overflow-hidden h-full w-full",
          size === "phone" ? "sm:w-[390px] sm:max-h-[844px] sm:rounded-[36px] sm:ring-[10px] sm:ring-[#0B0A10] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]" : "sm:max-w-[1280px] sm:rounded-[16px]")}>
          <iframe key={key} src={src} title={title} className="w-full h-full border-0 bg-white" />
        </div>
      </div>
    </div>
  );
}
