"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle, Camera, Loader2, MapPin, CalendarDays, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";


interface Step { key: string; label: string; done: boolean; current: boolean; }
interface TrackData {
  bookingNumber: string; eventName?: string; clientFirstName: string;
  status: string; statusLabel: string; eventDate?: string; eventLocation?: string;
  steps?: Step[]; isCancelled?: boolean;
  studio: { name: string; logoUrl?: string; primaryColor?: string; phone?: string; };
}

export default function TrackPage() {
  const { bookingId } = useParams() as { bookingId: string };
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/track/${bookingId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center">
        <XCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-700">Booking Not Found</h1>
        <p className="text-slate-400 mt-2">This tracking link may be invalid or expired.</p>
      </div>
    </div>
  );

  const accent = data.studio.primaryColor ?? "#4F46E5";
  const steps = data.steps ?? [];
  const currentStep = steps.find(s => s.current);
  const doneCount = steps.filter(s => s.done).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Studio Header */}
      <div className="text-white px-4 py-6 shadow-sm" style={{ backgroundColor: accent }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {data.studio.logoUrl ? (
            <img src={data.studio.logoUrl} alt={data.studio.name} className="w-10 h-10 rounded-xl object-contain bg-white/20 p-1" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <p className="font-bold text-lg leading-tight">{data.studio.name}</p>
            <p className="text-xs text-white/70">Booking Tracker</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Booking Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-mono text-slate-400 mb-1">{data.bookingNumber}</p>
              <h1 className="text-lg font-bold text-slate-900">{data.eventName || "Your Booking"}</h1>
              <p className="text-sm text-slate-500 mt-0.5">Hello, {data.clientFirstName} 👋</p>
            </div>
            {data.isCancelled ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-red-500 bg-red-50 px-3 py-1.5 rounded-xl flex-shrink-0">
                <XCircle className="w-4 h-4" />Cancelled
              </div>
            ) : (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-400 mb-0.5">{doneCount} / {steps.length} steps</p>
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${steps.length > 0 ? (doneCount / steps.length) * 100 : 0}%`, backgroundColor: accent }} />
                </div>
              </div>
            )}
          </div>

          {(data.eventDate || data.eventLocation) && (
            <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 pt-3 border-t border-slate-100">
              {data.eventDate && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  {data.eventDate}
                </div>
              )}
              {data.eventLocation && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {data.eventLocation}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Current Status */}
        {!data.isCancelled && currentStep && (
          <div className="rounded-2xl p-4 border-2 text-white" style={{ backgroundColor: accent, borderColor: accent }}>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Current Status</p>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-white/80" />
              <p className="text-lg font-bold">{currentStep.label}</p>
            </div>
          </div>
        )}

        {data.isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700">Booking Cancelled</p>
              <p className="text-sm text-red-500 mt-0.5">Please contact the studio for more information.</p>
            </div>
          </div>
        )}

        {/* Steps Timeline */}
        {!data.isCancelled && steps.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Progress Timeline</p>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.key} className="flex items-start gap-3">
                  {/* Left line + dot */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={cn("w-8 h-8 rounded-full border-2 flex items-center justify-center z-10",
                      step.done ? "border-transparent" : step.current ? "border-transparent" : "border-slate-200 bg-white")}>
                      {step.done ? (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      ) : step.current ? (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center animate-pulse" style={{ backgroundColor: accent + "30", border: `2px solid ${accent}` }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-200 bg-white" />
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="w-0.5 h-6 mt-0.5" style={{ backgroundColor: step.done ? accent : "#e2e8f0" }} />
                    )}
                  </div>
                  {/* Label */}
                  <div className="pb-4 pt-1 min-w-0">
                    <p className={cn("text-sm font-medium",
                      step.current ? "text-slate-900 font-bold" : step.done ? "text-slate-600" : "text-slate-300")}>
                      {step.label}
                    </p>
                    {step.current && (
                      <p className="text-xs mt-0.5" style={{ color: accent }}>← Currently here</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact studio */}
        {data.studio.phone && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Need help?</p>
              <p className="text-sm font-semibold text-slate-800">Contact {data.studio.name}</p>
            </div>
            <a href={`tel:${data.studio.phone}`}
              className="h-9 px-4 rounded-xl text-white text-sm font-medium flex items-center gap-2"
              style={{ backgroundColor: accent }}>
              Call Studio
            </a>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-300 pt-2">
          Powered by StuPanel — Studio Management System
        </p>
      </div>
    </div>
  );
}
