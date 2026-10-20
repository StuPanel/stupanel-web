"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Lock, X } from "lucide-react";
import { apiFetch, API_URL, READ_ONLY_EVENT } from "@/lib/api";

export type BillingMode = "full" | "trial" | "grace" | "read_only";

export interface BillingAccess {
  mode: BillingMode;
  periodEndsAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
}

/** Shared loader so the banner and sidebar card don't fetch twice. */
let cached: Promise<{ status: string; access: BillingAccess; pendingRequest: unknown } | null> | null = null;
export function loadBillingStatus(force = false) {
  if (!cached || force) {
    cached = apiFetch(`${API_URL}/billing/status`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return cached;
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function BillingBanner() {
  const pathname = usePathname();
  const [access, setAccess] = useState<BillingAccess | null>(null);
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(false);

  useEffect(() => {
    loadBillingStatus().then((d) => {
      if (d) { setAccess(d.access); setPending(!!d.pendingRequest); }
    });
  }, []);

  useEffect(() => {
    const onBlocked = () => {
      setBlockedNotice(true);
      setAccess((a) => (a ? { ...a, mode: "read_only" } : { mode: "read_only", periodEndsAt: null, graceEndsAt: null, daysLeft: null }));
    };
    window.addEventListener(READ_ONLY_EVENT, onBlocked);
    return () => window.removeEventListener(READ_ONLY_EVENT, onBlocked);
  }, []);

  const onBillingPage = pathname.startsWith("/billing");

  return (
    <>
      {access && !onBillingPage && <Strip access={access} pending={pending} dismissed={dismissed} onDismiss={() => setDismissed(true)} />}

      {blockedNotice && !onBillingPage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBlockedNotice(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="w-11 h-11 rounded-xl bg-[#EEE8FD] flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-[#7D5CEF]" />
            </div>
            <h3 className="text-base font-semibold text-[#17151F]">Your plan has ended</h3>
            <p className="mt-1.5 text-sm text-[#4A4658]">
              Your studio is in view-only mode. All your data is safe — renew your plan to add or change anything.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setBlockedNotice(false)}
                className="flex-1 rounded-lg border border-[#E3DFEC] py-2 text-sm font-medium text-[#4A4658] hover:bg-[#F5F3FA]">
                Not now
              </button>
              <Link href="/billing" onClick={() => setBlockedNotice(false)}
                className="flex-1 rounded-lg bg-[#7D5CEF] py-2 text-center text-sm font-semibold text-white hover:bg-[#6143CF]">
                Renew plan
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Strip({ access, pending, dismissed, onDismiss }: {
  access: BillingAccess; pending: boolean; dismissed: boolean; onDismiss: () => void;
}) {
  if (pending) {
    return (
      <div className="bg-[#EEE8FD] border-b border-[#CFC2F8] px-4 py-2.5 flex items-center gap-3">
        <Clock className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />
        <p className="text-sm text-[#5B3FD0] flex-1">We received your payment details and will confirm shortly.</p>
        <Link href="/billing" className="text-sm font-semibold text-[#5B3FD0] underline underline-offset-2">View</Link>
      </div>
    );
  }

  if (access.mode === "read_only") {
    return (
      <div className="bg-[#FDECEF] border-b border-[#F5C6D0] px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <Lock className="w-4 h-4 text-[#C2304F] flex-shrink-0" />
        <p className="text-sm text-[#8A1F37] flex-1">
          Your plan has ended. Your studio is <span className="font-semibold">view-only</span> — your data is safe. Renew to keep working.
        </p>
        <Link href="/billing" className="rounded-md bg-[#C2304F] px-3 py-1 text-sm font-semibold text-white hover:opacity-90">Renew now</Link>
      </div>
    );
  }

  if (dismissed) return null;

  if (access.mode === "grace") {
    return (
      <div className="bg-[#FDECEF] border-b border-[#F5C6D0] px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <Clock className="w-4 h-4 text-[#C2304F] flex-shrink-0" />
        <p className="text-sm text-[#8A1F37] flex-1">
          Your plan has ended. Pay before <span className="font-semibold">{fmtDate(access.graceEndsAt)}</span> or the studio becomes view-only.
        </p>
        <Link href="/billing" className="rounded-md bg-[#C2304F] px-3 py-1 text-sm font-semibold text-white hover:opacity-90">Pay now</Link>
        <button onClick={onDismiss} className="text-[#C2304F]/70 hover:text-[#C2304F]"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  const soon = access.daysLeft !== null && access.daysLeft <= 7;
  if (!soon) return null;
  const label = access.mode === "trial" ? "Free trial" : "Your plan";
  return (
    <div className="bg-[#EEE8FD] border-b border-[#CFC2F8] px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <Clock className="w-4 h-4 text-[#5B3FD0] flex-shrink-0" />
      <p className="text-sm text-[#5B3FD0] flex-1">
        {label} ends {access.daysLeft === 0 ? "today" : `in ${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"}`} ({fmtDate(access.periodEndsAt)}).
      </p>
      <Link href="/billing" className="rounded-md bg-[#7D5CEF] px-3 py-1 text-sm font-semibold text-white hover:bg-[#6143CF]">Choose a plan</Link>
      <button onClick={onDismiss} className="text-[#5B3FD0]/60 hover:text-[#5B3FD0]"><X className="w-4 h-4" /></button>
    </div>
  );
}
