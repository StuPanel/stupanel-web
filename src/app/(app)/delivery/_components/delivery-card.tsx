"use client";

import { useState, useEffect, useRef } from "react";
import {
  MoreVertical, Copy, ExternalLink, UploadCloud,
  CheckCircle2, CalendarDays, MapPin,
} from "lucide-react";
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
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1", cfg.badge)}>
              <StatusIcon className="w-2.5 h-2.5" />{cfg.label}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{b.bookingNumber}</span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm truncate">{b.eventName ?? "—"}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{b.client.firstName} {b.client.lastName ?? ""}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <UploadCloud className="w-4 h-4 text-slate-400" />Manage Delivery
              </button>
              {allLinks[0] && (
                <>
                  <button onClick={() => { copyFirstLink(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <Copy className="w-4 h-4 text-slate-400" />Copy Link
                  </button>
                  <a href={allLinks[0].url} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <ExternalLink className="w-4 h-4 text-slate-400" />Open Link
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-3">
        {b.eventDate && (
          <span className={cn("flex items-center gap-1", daysLeft !== null && daysLeft < 0 ? "text-red-500" : daysLeft !== null && daysLeft <= 7 ? "text-amber-500" : "")}>
            <CalendarDays className="w-3 h-3" />{fmtDate(b.eventDate)}
            {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && <span className="font-semibold">· {daysLeft}d</span>}
          </span>
        )}
        {b.eventLocation && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.eventLocation}</span>}
      </div>

      <button onClick={onEdit}
        className="w-full flex items-center justify-center gap-1.5 h-9 mb-3 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
        <UploadCloud className="w-3.5 h-3.5" />
        {allLinks.length > 0
          ? <span><span className="font-semibold text-indigo-500">{allLinks.length} link{allLinks.length > 1 ? "s" : ""} added</span> · click to manage</span>
          : "Upload files or add link"}
      </button>

      {b.deliveryNote && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3 line-clamp-2">{b.deliveryNote}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {b.deliveryDate && (
            <span className="flex items-center gap-1 text-teal-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />Delivered {fmtDate(b.deliveryDate)}
            </span>
          )}
        </div>
        {due > 0 && (
          <span className="text-xs font-bold text-red-600">{formatCurrency(due, b.currency)} due</span>
        )}
      </div>
      <span className="hidden">{String(copied)}</span>
    </div>
  );
}
