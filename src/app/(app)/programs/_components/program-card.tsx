"use client";

import { useState, useEffect, useRef } from "react";
import {
  MoreHorizontal, Eye, Edit3, Trash2, AlertTriangle, Loader2, MapPin, Check,
} from "lucide-react";
import { DateBox } from "@/components/ui/apple";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { STATUS_CFG, STATUS_PIPELINE } from "./constants";
import { formatCurrency } from "@/lib/format";
import type { Booking } from "./types";
import { askConfirm } from "@/components/feedback";

/** One program as a row (Apple style). Tap opens it; "…" has Edit / Delete. */
export function ProgramRow({ b, onView, onEdit, onDelete }: {
  b: Booking;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const sc = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
  const due = Number(b.grandTotal) - Number(b.paidAmount);
  const days = b.eventDays?.length ?? 0;
  const client = `${b.client.firstName} ${b.client.lastName ?? ""}`.trim();

  return (
    <div role="button" tabIndex={0} onClick={onView} onKeyDown={e => { if (e.key === "Enter") onView(); }}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[72px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <DateBox date={b.eventDate} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate">{b.eventName || "Untitled program"}</p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">
          {client}
          {b.eventLocation ? <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {b.eventLocation}</> : null}
          {days > 1 ? ` · ${days} days` : ""}
        </p>
        <p className="text-xs text-[#9893A8] font-mono mt-0.5 sm:hidden">{b.bookingNumber}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(b.grandTotal), b.currency)}</p>
        {due > 0
          ? <p className="text-xs font-semibold text-[#C2304F] tabular-nums">{formatCurrency(due, b.currency)} due</p>
          : <p className="text-xs font-semibold text-[#1F8A5B]">Paid</p>}
      </div>
      <span className={cn("hidden md:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", sc.badge)}>{sc.label}</span>
      <span className={cn("md:hidden w-2.5 h-2.5 rounded-full flex-shrink-0", sc.dot)} title={sc.label} />
      <div className="relative flex-shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(o => !o)} aria-label={`More for ${b.eventName ?? b.bookingNumber}`} aria-expanded={menuOpen}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-10 w-44 bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 overflow-hidden p-1">
            <button role="menuitem" onClick={() => { onView(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><Eye className="w-4 h-4 text-[#6B6680]" />Open</button>
            <button role="menuitem" onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><Edit3 className="w-4 h-4 text-[#6B6680]" />Edit</button>
            <button role="menuitem" onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#C2304F] hover:bg-[#FDECEF]"><Trash2 className="w-4 h-4" />Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DeleteDialog({ booking, onClose, onDeleted }: {
  booking: Booking | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  if (!booking) return null;
  async function doDelete() {
    setLoading(true);
    await apiFetch(`${API}/bookings/${booking!.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } }).catch(() => {});
    onDeleted(); onClose(); setLoading(false);
  }
  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="sp-modal w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Delete Program?</h3>
          <p className="text-slate-500 text-sm mt-2"><span className="font-semibold text-slate-700">{booking.eventName ?? booking.bookingNumber}</span> will be permanently deleted.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={doDelete} disabled={loading} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function StatusPipeline({ current, bookingId, onChanged, hideTitle }: {
  current: string;
  hideTitle?: boolean;
  bookingId: string;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const isCancelled = current === "cancelled" || current === "refunded";

  async function changeStatus(s: string) {
    if (s === current || loading) return;
    setLoading(s);
    try {
      await apiFetch(`${API}/bookings/${bookingId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }),
      });
      onChanged();
    } finally { setLoading(null); }
  }

  return (
    <div className="space-y-2">
      {!hideTitle && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>}
      {isCancelled ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="text-sm font-semibold text-red-700 capitalize">{current}</span>
          <button onClick={() => changeStatus("confirmed")}
            className="text-xs text-slate-500 hover:text-indigo-600 underline">Reopen</button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {STATUS_PIPELINE.map((s, i) => {
            const sc = STATUS_CFG[s];
            const idx = STATUS_PIPELINE.indexOf(current);
            const done = i < idx;
            const active = s === current;
            return (
              <button key={s} onClick={() => changeStatus(s)}
                disabled={loading !== null}
                className={cn("flex-shrink-0 flex flex-col items-center justify-start gap-1 px-1 py-1.5 rounded-xl transition-all min-w-0",
                  active ? "bg-indigo-600" : done ? "bg-indigo-100 hover:bg-indigo-200" : "bg-slate-100 hover:bg-slate-200")}>
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center",
                  active ? "bg-white" : done ? "bg-indigo-500" : "bg-slate-300")}>
                  {loading === s
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-600" />
                    : done ? <Check className="w-2.5 h-2.5 text-white" />
                    : <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-indigo-600" : "bg-slate-400")} />}
                </div>
                <span className={cn("text-xs font-semibold leading-tight text-center max-w-[52px]",
                  active ? "text-white" : done ? "text-indigo-700" : "text-slate-400")}>
                  {sc?.label ?? s}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {!isCancelled && (
        <div className="flex gap-2 mt-1">
          <button onClick={async () => { if (await askConfirm({ title: "Cancel this program?", message: "The program will be marked as cancelled. You can reopen it later.", confirmLabel: "Mark cancelled", danger: true })) changeStatus("cancelled"); }}
            className="text-xs text-red-500 hover:text-red-700 underline">Mark Cancelled</button>
          {current !== "completed" && (
            <button onClick={() => changeStatus("completed")}
              className="text-xs text-emerald-600 hover:text-emerald-700 underline">Mark Completed</button>
          )}
        </div>
      )}
    </div>
  );
}
