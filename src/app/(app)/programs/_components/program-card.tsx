"use client";

import { useState, useEffect, useRef } from "react";
import {
  MoreVertical, Eye, Edit3, Trash2, AlertTriangle, Loader2,
  CalendarDays, MapPin, Layers, DollarSign, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { STATUS_CFG, STATUS_PIPELINE, fmtDate } from "./constants";
import { formatCurrency } from "@/lib/format";
import type { Booking } from "./types";

export function ProgramCard({ b, onView, onEdit, onDelete }: {
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

  return (
    <div onClick={onView} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sc.badge)}>{sc.label}</span>
            <span className="text-[10px] text-slate-400 font-mono">{b.bookingNumber}</span>
            {days > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />{days}d
              </span>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-sm truncate">{b.eventName ?? "—"}</h3>
          <p className="text-xs text-slate-400">{b.client.firstName} {b.client.lastName ?? ""}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { onView(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Eye className="w-4 h-4 text-slate-400" />View Details</button>
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Edit3 className="w-4 h-4 text-slate-400" />Edit</button>
              <div className="border-t border-slate-100" />
              <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" />Delete</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-3">
        {b.eventDate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(b.eventDate)}</span>}
        {b.eventLocation && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.eventLocation}</span>}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-400">Contract</p>
          <p className="font-bold text-slate-900 text-sm">{formatCurrency(Number(b.grandTotal), b.currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Due</p>
          <p className={cn("font-bold text-sm", due > 0 ? "text-red-600" : "text-emerald-600")}>{formatCurrency(due, b.currency)}</p>
        </div>
        {Number(b.profitAmount) !== 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Profit</p>
            <p className={cn("font-bold text-sm", Number(b.profitAmount) >= 0 ? "text-emerald-600" : "text-red-600")}>
              {formatCurrency(Number(b.profitAmount), b.currency)}
            </p>
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
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
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

export function StatusPipeline({ current, bookingId, onChanged }: {
  current: string;
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
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>
      {isCancelled ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="text-sm font-semibold text-red-700 capitalize">{current}</span>
          <button onClick={() => changeStatus("confirmed")}
            className="text-xs text-slate-500 hover:text-indigo-600 underline">Reopen</button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
          {STATUS_PIPELINE.map((s, i) => {
            const sc = STATUS_CFG[s];
            const idx = STATUS_PIPELINE.indexOf(current);
            const done = i < idx;
            const active = s === current;
            return (
              <button key={s} onClick={() => changeStatus(s)}
                disabled={loading !== null}
                className={cn("flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all",
                  active ? "bg-indigo-600" : done ? "bg-indigo-100 hover:bg-indigo-200" : "bg-slate-100 hover:bg-slate-200")}>
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center",
                  active ? "bg-white" : done ? "bg-indigo-500" : "bg-slate-300")}>
                  {loading === s
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-600" />
                    : done ? <Check className="w-2.5 h-2.5 text-white" />
                    : <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-indigo-600" : "bg-slate-400")} />}
                </div>
                <span className={cn("text-[9px] font-semibold leading-tight text-center max-w-[52px]",
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
          <button onClick={() => changeStatus("cancelled")}
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
