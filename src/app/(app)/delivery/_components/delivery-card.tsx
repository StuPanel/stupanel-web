"use client";

import { useState, useEffect, useRef } from "react";
import {
  MoreHorizontal, Copy, ExternalLink, UploadCloud, CheckCircle2, MapPin,
} from "lucide-react";
import { DateBox } from "@/components/ui/apple";
import { cn } from "@/lib/utils";
import { DEL_STATUS, fmtDate, daysFromNow } from "./constants";
import type { Booking } from "./types";
import { formatCurrency } from "@/lib/format";

export function DeliveryCard({ b, onEdit }: { b: Booking; onEdit: () => void }) {
  const cfg = DEL_STATUS[b.status] ?? DEL_STATUS.confirmed;
  const StatusIcon = cfg.icon;
  const due = Number(b.grandTotal) - Number(b.paidAmount);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const allLinks = b.deliveryLinks?.filter(l => l.url) ?? (b.deliveryLink ? [{ id: "legacy", title: "Delivery Link", url: b.deliveryLink }] : []);

  function copyFirstLink() {
    if (!allLinks[0]?.url) return;
    navigator.clipboard.writeText(allLinks[0].url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const daysLeft = b.eventDate ? daysFromNow(b.eventDate) : null;

  return (
    <div role="button" tabIndex={0} onClick={onEdit} onKeyDown={e => { if (e.key === "Enter") onEdit(); }}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[72px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <DateBox date={b.eventDate} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate">{b.eventName ?? b.bookingNumber}</p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">
          {b.client.firstName} {b.client.lastName ?? ""}
          {b.eventLocation ? <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {b.eventLocation}</> : null}
        </p>
        <p className="text-xs mt-0.5 truncate">
          {b.deliveryDate
            ? <span className="text-[#1F8A5B] font-semibold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Delivered {fmtDate(b.deliveryDate)}</span>
            : allLinks.length > 0
              ? <span className="text-[#5B3FD0] font-semibold">{allLinks.length} link{allLinks.length > 1 ? "s" : ""} added</span>
              : <span className="text-[#6B6680]">Nothing uploaded yet</span>}
          {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && !b.deliveryDate && <span className="text-[#9E3A8C] font-semibold"> · event in {daysLeft}d</span>}
        </p>
      </div>
      {due > 0 && <span className="hidden sm:block text-xs font-bold text-[#C2304F] tabular-nums flex-shrink-0">{formatCurrency(due, b.currency)} due</span>}
      <span className={cn("hidden md:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap items-center gap-1", cfg.badge)}>
        <StatusIcon className="w-3 h-3" />{cfg.label}
      </span>
      <span className={cn("md:hidden w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot)} title={cfg.label} />
      <div className="relative flex-shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(o => !o)} aria-label="More" aria-expanded={menuOpen}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-10 w-48 bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1">
            <button role="menuitem" onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]">
              <UploadCloud className="w-4 h-4 text-[#6B6680]" />Upload / manage
            </button>
            {allLinks[0] && (
              <>
                <button role="menuitem" onClick={() => { copyFirstLink(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]">
                  <Copy className="w-4 h-4 text-[#6B6680]" />{copied ? "Copied" : "Copy link"}
                </button>
                <a role="menuitem" href={allLinks[0].url} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]">
                  <ExternalLink className="w-4 h-4 text-[#6B6680]" />Open link
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
