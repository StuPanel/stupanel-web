"use client";
/** A side sheet for Website → Team (a member's website settings, choosing from the Team). */
import { useEffect } from "react";
import { X } from "lucide-react";

export function TeamSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = old; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#17151F]/40 backdrop-blur-[2px] cursor-default" />
      <div className="relative w-full max-w-[520px] h-full bg-[#F5F3FA] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-[#EEEBF3]">
          <h2 className="text-[18px] font-bold text-[#17151F]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full hover:bg-[#F5F3FA] text-[#6B6680] flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
