"use client";

/** Where a client's program stands — a simple step list from booking to delivery. No login. */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Check, MapPin, Phone, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { CARD_SHADOW, DateBox } from "@/components/ui/apple";
import { PublicLoading, PublicMessage, PublicShell } from "@/components/public/public-shell";

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

  if (loading) return <PublicLoading />;
  if (error || !data) return <PublicMessage icon={XCircle} tone="red" title="Program not found" text="This tracking link isn't working. Please ask the studio for a new one." />;

  const steps = data.steps ?? [];
  const doneCount = steps.filter(s => s.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const current = steps.find(s => s.current);
  const date = data.eventDate && !isNaN(new Date(data.eventDate).getTime()) ? data.eventDate : null;

  return (
    <PublicShell studio={data.studio} sub="Program tracker" width="max-w-[640px]"
      right={data.studio.phone && (
        <a href={`tel:${data.studio.phone}`} className="h-10 px-3.5 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5">
          <Phone className="w-4 h-4" />Call
        </a>
      )}>
      <p className="px-1 mb-2 text-[14px] text-[#6B6680]">Hello, {data.clientFirstName}</p>

      <section className={cn("bg-white rounded-[22px] p-5 mb-4", CARD_SHADOW)}>
        <div className="flex items-start gap-3.5">
          {date && <DateBox date={date} />}
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{data.eventName || "Your program"}</h1>
            <p className="mt-1 text-[12.5px] text-[#6B6680] tabular-nums">{[data.bookingNumber, data.eventDate].filter(Boolean).join(" · ")}</p>
            {data.eventLocation && <p className="mt-0.5 text-[12.5px] text-[#6B6680] inline-flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{data.eventLocation}</p>}
          </div>
        </div>

        {data.isCancelled ? (
          <div className="mt-4 rounded-[14px] bg-[#FDECEF] px-4 py-3 flex items-start gap-3 text-[#9C2340]">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div><p className="font-bold">This program was cancelled</p><p className="text-[13px] mt-0.5">Please contact the studio for details.</p></div>
          </div>
        ) : steps.length > 0 && (
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-[13px] mb-2">
              <span className="text-[#6B6680]">Now: <span className="font-bold text-[#17151F]">{current?.label ?? data.statusLabel}</span></span>
              <span className="text-[#6B6680] tabular-nums">{doneCount} of {steps.length}</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1EFF6] overflow-hidden" role="progressbar" aria-label="Progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-[#8E72F2] to-[#5B3FD0] transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </section>

      {!data.isCancelled && steps.length > 0 && (
        <section className={cn("bg-white rounded-[22px] p-5", CARD_SHADOW)}>
          <h2 className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#8A8599] mb-4">Steps</h2>
          <ol>
            {steps.map((step, i) => (
              <li key={step.key} className="flex gap-3.5">
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className={cn("w-8 h-8 rounded-full flex items-center justify-center",
                    step.done ? "bg-[#7D5CEF] text-white" : step.current ? "bg-[#EEE8FD] ring-2 ring-[#7D5CEF]" : "bg-[#F1EFF6]")}>
                    {step.done ? <Check className="w-4 h-4" strokeWidth={3} /> : step.current ? <span className="w-2.5 h-2.5 rounded-full bg-[#7D5CEF] animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-[#CFC8DD]" />}
                  </span>
                  {i < steps.length - 1 && <span className={cn("w-0.5 flex-1 min-h-[18px] my-1 rounded-full", step.done ? "bg-[#7D5CEF]" : "bg-[#EEEBF4]")} />}
                </div>
                <div className="pt-1.5 pb-4 min-w-0">
                  <p className={cn("text-[14.5px]", step.current ? "font-bold text-[#17151F]" : step.done ? "font-medium text-[#4A4658]" : "text-[#A29DB3]")}>{step.label}</p>
                  {step.current && <p className="text-[12.5px] text-[#5B3FD0] font-semibold mt-0.5">You are here</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </PublicShell>
  );
}
