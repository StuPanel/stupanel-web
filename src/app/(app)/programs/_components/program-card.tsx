"use client";

import { useState, useRef } from "react";
import {
  MoreHorizontal, Eye, Edit3, Trash2, AlertTriangle, Loader2, MapPin, Check,
} from "lucide-react";
import { DateBox } from "@/components/ui/apple";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FloatMenu } from "@/components/ui/float-menu";
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
        <FloatMenu anchor={menuRef} open={menuOpen} onClose={() => setMenuOpen(false)} width={176}>
            <button role="menuitem" onClick={() => { onView(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><Eye className="w-4 h-4 text-[#6B6680]" />Open</button>
            <button role="menuitem" onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><Edit3 className="w-4 h-4 text-[#6B6680]" />Edit</button>
            <button role="menuitem" onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#C2304F] hover:bg-[#FDECEF]"><Trash2 className="w-4 h-4" />Delete</button>
          </FloatMenu>
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
          <div className="w-14 h-14 rounded-full bg-[#FDECEF] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-[#C2304F]" />
          </div>
          <h3 className="font-bold text-[#17151F] text-lg">Delete Program?</h3>
          <p className="text-[#6B6680] text-sm mt-2"><span className="font-semibold text-[#33303F]">{booking.eventName ?? booking.bookingNumber}</span> will be permanently deleted.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-[#E4E0EC]">Cancel</Button>
            <Button onClick={doDelete} disabled={loading} className="flex-1 h-11 bg-[#C2304F] hover:bg-[#C2304F] text-white gap-2">
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
      {!hideTitle && <p className="text-xs font-semibold text-[#8A8599] uppercase tracking-wider">Status</p>}
      {isCancelled ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#F6CFD8] bg-[#FEF5F7]">
          <span className="text-sm font-semibold text-[#C2304F] capitalize">{current}</span>
          <button onClick={() => changeStatus("confirmed")}
            className="text-xs text-[#6B6680] hover:text-[#7D5CEF] underline">Reopen</button>
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
                  active ? "bg-[#7D5CEF]" : done ? "bg-[#EEE8FD] hover:bg-indigo-200" : "bg-[#F1EFF6] hover:bg-[#E4E0EC]")}>
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center",
                  active ? "bg-white" : done ? "bg-[#7D5CEF]" : "bg-[#B5B0C4]")}>
                  {loading === s
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin text-[#7D5CEF]" />
                    : done ? <Check className="w-2.5 h-2.5 text-white" />
                    : <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-[#7D5CEF]" : "bg-[#8A8599]")} />}
                </div>
                <span className={cn("text-xs font-semibold leading-tight text-center max-w-[52px]",
                  active ? "text-white" : done ? "text-[#5B3FD0]" : "text-[#8A8599]")}>
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
            className="text-xs text-[#C2304F] hover:text-[#C2304F] underline">Mark Cancelled</button>
          {current !== "completed" && (
            <button onClick={() => changeStatus("completed")}
              className="text-xs text-[#1F8A5B] hover:text-[#1F8A5B] underline">Mark Completed</button>
          )}
        </div>
      )}
    </div>
  );
}
