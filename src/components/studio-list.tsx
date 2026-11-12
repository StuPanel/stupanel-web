"use client";

/**
 * The studios a person works in, to pick one (after login, and in Switch studio),
 * plus invites from other studios waiting for an answer.
 */
import { Check, ChevronRight, Loader2, MailOpen, X } from "lucide-react";
import { StudioLogo } from "@/components/studio-logo";
import { cn } from "@/lib/utils";
import { roleLabel, type StudioCard, type StudioInvite } from "@/lib/studio-session";

export function StudioList({ studios, currentUserId, busyId, onPick }: {
  studios: StudioCard[]; currentUserId?: string | null; busyId?: string | null;
  onPick: (s: StudioCard) => void;
}) {
  return (
    <ul className="space-y-2" aria-label="Your studios">
      {studios.map(s => {
        const current = s.userId === currentUserId;
        const busy = busyId === s.userId;
        return (
          <li key={s.userId}>
            <button type="button" onClick={() => !current && onPick(s)} disabled={!!busyId || current} aria-current={current || undefined}
              className={cn("w-full flex items-center gap-3 p-3 rounded-[16px] text-left transition-all bg-white border",
                current ? "border-[#7D5CEF] ring-2 ring-[#7D5CEF]/15" : "border-[#E9E6F0] hover:border-[#CFC2F8] hover:shadow-[0_6px_20px_-10px_rgba(91,63,208,.35)]",
                !!busyId && !busy && !current && "opacity-60")}>
              <StudioLogo url={s.logoUrl} name={s.name} size={44} className="rounded-[12px]" />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold text-[#17151F] truncate">{s.name}</span>
                <span className="block text-[13px] text-[#6B6680]">{roleLabel(s)}{current ? " · open now" : ""}</span>
              </span>
              {busy ? <Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" />
                : current ? <span className="w-7 h-7 rounded-full bg-[#7D5CEF] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></span>
                : <ChevronRight className="w-5 h-5 text-[#A29DB3]" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function InviteList({ invites, busyId, onAnswer }: {
  invites: StudioInvite[]; busyId?: string | null;
  onAnswer: (inv: StudioInvite, accept: boolean) => void;
}) {
  if (!invites.length) return null;
  return (
    <section className="mt-5">
      <p className="text-[13px] font-bold text-[#4A4658] mb-2 flex items-center gap-1.5"><MailOpen className="w-4 h-4 text-[#7D5CEF]" />Invites waiting</p>
      <ul className="space-y-2">
        {invites.map(inv => (
          <li key={inv.userId} className="flex items-center gap-3 p-3 rounded-[16px] bg-[#F7F4FE] border border-[#E4DCFB]">
            <StudioLogo url={inv.logoUrl} name={inv.name} size={40} className="rounded-[12px]" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-bold text-[#17151F] truncate">{inv.name}</span>
              <span className="block text-[12.5px] text-[#6B6680]">wants you in their team</span>
            </span>
            <button type="button" aria-label={`Decline ${inv.name}`} onClick={() => onAnswer(inv, false)} disabled={!!busyId}
              className="w-9 h-9 rounded-full bg-white text-[#6B6680] hover:text-[#C2304F] flex items-center justify-center disabled:opacity-50"><X className="w-4 h-4" /></button>
            <button type="button" onClick={() => onAnswer(inv, true)} disabled={!!busyId}
              className="h-9 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
              {busyId === inv.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Accept
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
