"use client";

import { useState, useEffect } from "react";
import {
  X, Edit3, DollarSign, MessageCircle, FileText,
  Loader2, MapPin, TrendingUp, HardDrive, Link2, Cloud,
  ExternalLink, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { useRouter } from "next/navigation";
import { STATUS_CFG, fmtDate } from "./constants";
import { StatusPipeline } from "./program-card";
import { PaymentModal } from "./payment-modal";
import { WhatsAppModal } from "./whatsapp-modal";
import { DeliveryModal } from "../../delivery/_components/delivery-modal";
import type { Booking } from "./types";

function DeliveryOverview({ booking }: { booking: Booking }) {
  const [r2FileCount, setR2FileCount] = useState<number | null>(null);

  useEffect(() => {
    if (booking.deliveryMethod !== "r2") return;
    apiFetch(`${API}/deliveries/${booking.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) setR2FileCount(data.length); })
      .catch(() => {});
  }, [booking.id, booking.deliveryMethod]);

  const method = booking.deliveryMethod;
  const linksCount = (booking.deliveryLinks as any[])?.length ?? 0;

  if (!method) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center">
        <p className="text-xs text-slate-400">No delivery set yet</p>
      </div>
    );
  }

  const methodMeta = {
    drive_auto: { icon: <HardDrive className="w-4 h-4 text-emerald-600" />, label: "Drive Auto", color: "text-emerald-700" },
    drive_link: { icon: <Link2 className="w-4 h-4 text-indigo-600" />, label: "Drive Link", color: "text-indigo-700" },
    r2: { icon: <Cloud className="w-4 h-4 text-blue-600" />, label: "R2 Cloud", color: "text-blue-700" },
  }[method] ?? { icon: <HardDrive className="w-4 h-4 text-slate-500" />, label: method, color: "text-slate-600" };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Method header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          {methodMeta.icon}
          <span className={`text-xs font-semibold ${methodMeta.color}`}>{methodMeta.label}</span>
        </div>
        {method === "drive_auto" && booking.driveFolderUrl && (
          <a href={booking.driveFolderUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
            <ExternalLink className="w-3 h-3" /> Open Folder
          </a>
        )}
        {method === "drive_link" && (booking.deliveryLink || linksCount > 0) && (
          <a href={booking.deliveryLink ?? "#"} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
            <ExternalLink className="w-3 h-3" /> Open
          </a>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-slate-200">
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-base font-bold text-slate-800">
            {method === "r2" ? (r2FileCount ?? "—") : (method === "drive_auto" ? "✓" : linksCount)}
          </span>
          <span className="text-[10px] text-slate-400">
            {method === "r2" ? "Files" : method === "drive_auto" ? "Folder" : "Links"}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-base font-bold text-slate-800">{linksCount}</span>
          <span className="text-[10px] text-slate-400">Links</span>
        </div>
        <div className="flex flex-col items-center justify-center py-3 gap-0.5 px-1">
          <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
            {booking.deliveryDate ? fmtDate(booking.deliveryDate) : "—"}
          </span>
          <span className="text-[10px] text-slate-400">Date</span>
        </div>
      </div>
    </div>
  );
}

export function ViewDrawer({ booking, onClose, onEdit, onRefresh, r2Enabled }: {
  booking: Booking | null;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  r2Enabled: boolean;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [genInvoicing, setGenInvoicing] = useState(false);
  const [localBooking, setLocalBooking] = useState<Booking | null>(null);
  const router = useRouter();

  useEffect(() => { setLocalBooking(booking); }, [booking]);

  async function refreshBooking() {
    if (!localBooking) return;
    try {
      const r = await apiFetch(`${API}/bookings/${localBooking.id}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) setLocalBooking(await r.json());
    } catch { /* silent */ }
    onRefresh();
  }

  const b = localBooking;
  if (!b) return null;
  const sc = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
  const sym = b.currency === "BDT" ? "৳" : "$";
  const due = Number(b.grandTotal) - Number(b.paidAmount);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{b.eventName ?? b.bookingNumber}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 font-mono">{b.bookingNumber}</span>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sc.badge)}>{sc.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {due > 0 && (
              <button onClick={() => setPaymentOpen(true)}
                className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />Pay
              </button>
            )}
            <button
              disabled={genInvoicing}
              onClick={async () => {
                setGenInvoicing(true);
                try {
                  const r = await apiFetch(`${API}/studio-invoices/generate/${b.id}`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` } });
                  const d = await r.json();
                  if (r.ok || d.message?.includes("already exists")) {
                    router.push("/invoices");
                  }
                } catch { /* silent */ } finally { setGenInvoicing(false); }
              }}
              className="h-8 px-3 rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 disabled:opacity-50">
              {genInvoicing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}Invoice
            </button>
            {b.client?.phone && (
              <button onClick={() => setWaOpen(true)}
                className="h-8 px-3 rounded-lg border border-green-300 bg-green-50 text-xs font-semibold text-green-700 hover:bg-green-100 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />WA
              </button>
            )}
            <button onClick={onEdit} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />Edit
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <StatusPipeline current={b.status} bookingId={b.id} onChanged={refreshBooking} />

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Client</p>
            <p className="font-bold text-slate-900">{b.client.firstName} {b.client.lastName ?? ""}</p>
            {b.client.phone && <p className="text-sm text-slate-500">{b.client.phone}</p>}
          </div>

          {b.eventDays?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Days</p>
              {b.eventDays.map((day, i) => (
                <div key={day.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="font-semibold text-sm text-slate-800">{day.eventType}</span>
                    {day.date && <span className="text-xs text-slate-400">{fmtDate(day.date)}</span>}
                  </div>
                  {day.location && <p className="text-xs text-slate-400 ml-7 flex items-center gap-1"><MapPin className="w-3 h-3" />{day.location}</p>}
                  {day.shifts.map(s => (
                    <div key={s.id} className="ml-7 mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{s.label}</span>
                      <span className="text-[10px] text-slate-400">{s.memberIds.length} members</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Financials</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Contract</span><span className="font-semibold">{sym}{Number(b.totalAmount).toLocaleString()}</span></div>
              {Number(b.discountAmount) > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-red-500">− {sym}{Number(b.discountAmount).toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold"><span>Net</span><span>{sym}{Number(b.grandTotal).toLocaleString()}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="text-slate-500">Paid</span>
                <span className="text-emerald-600 font-semibold">{sym}{Number(b.paidAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due</span>
                <span className={cn("font-bold", due > 0 ? "text-red-600" : "text-emerald-600")}>{sym}{due.toLocaleString()}</span>
              </div>
            </div>
            {due > 0 && (
              <button onClick={() => setPaymentOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                <DollarSign className="w-4 h-4" />Record Payment
              </button>
            )}
          </div>

          {b.costEntries?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Team Costs</p>
              {b.costEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{e.memberName}</p>
                    {e.note && <p className="text-xs text-slate-400">{e.note}</p>}
                  </div>
                  <span className="font-bold text-slate-800">{sym}{Number(e.totalBill).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {Number(b.profitAmount) !== 0 && (
            <div className={cn("rounded-xl p-4 flex items-center justify-between", Number(b.profitAmount) >= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")}>
              <div className="flex items-center gap-2">
                <TrendingUp className={cn("w-5 h-5", Number(b.profitAmount) >= 0 ? "text-emerald-600" : "text-red-500")} />
                <span className="font-semibold text-sm text-slate-800">Net Profit</span>
              </div>
              <span className={cn("font-extrabold text-lg", Number(b.profitAmount) >= 0 ? "text-emerald-700" : "text-red-600")}>
                {sym}{Number(b.profitAmount).toLocaleString()}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery</p>
            <DeliveryOverview booking={b} />
            <button
              onClick={() => setDeliveryOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors"
            >
              Manage Delivery →
            </button>
          </div>

          {b.internalNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-600 mb-1 uppercase tracking-wider">Internal Notes</p>
              <p className="text-sm text-amber-900">{b.internalNotes}</p>
            </div>
          )}
        </div>
      </div>

      <PaymentModal
        booking={paymentOpen ? b : null}
        onClose={() => setPaymentOpen(false)}
        onSaved={refreshBooking}
      />
      <WhatsAppModal
        booking={waOpen ? b : null}
        onClose={() => setWaOpen(false)}
      />
      <DeliveryModal
        booking={deliveryOpen ? (b as any) : null}
        onClose={() => setDeliveryOpen(false)}
        onSaved={(updated) => { refreshBooking(); setDeliveryOpen(false); }}
      />
    </>
  );
}
