"use client";
/**
 * The first time a studio opens StuPanel after its free trial (or paid plan) ended and the studio became view-only:
 * one calm full-page screen. It shows what the studio made (all of it is safe), the way back in (choose a plan),
 * the 7 free days once if still allowed, and a way to keep looking around. Shown once per ending, on each device.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, FileText, Gift, Images, Loader2, Lock, Users, Wallet, CalendarDays } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { fmtDate, money, type BillingStatus, type TrialState } from "@/lib/billing";

const seenKey = (end: string | null) => `sp-plan-ended-seen:${end ?? "x"}`;

export function TrialEnded({ status, onExtended }: { status: BillingStatus; onExtended: () => void }) {
  const a = status.access;
  const end = a.periodEndsAt;
  const [open, setOpen] = useState(false);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (a.mode !== "read_only" || status.pendingRequest) return;
    let seen = false;
    try { seen = !!localStorage.getItem(seenKey(end)); } catch { /* private window */ }
    if (seen) return;
    setOpen(true);
    apiFetch(`${API_URL}/billing/trial`).then(r => (r.ok ? r.json() : null)).then(setTrial).catch(() => null);
  }, [a.mode, end, status.pendingRequest]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  function close() {
    try { localStorage.setItem(seenKey(end), "1"); } catch { /* fine */ }
    setOpen(false);
  }

  async function extend() {
    setBusy(true); setErr("");
    const r = await apiFetch(`${API_URL}/billing/trial/extend`, { method: "POST" }).catch(() => null);
    const b = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setErr((Array.isArray(b.message) ? b.message[0] : b.message) || "Could not add the days. Please try again."); return; }
    setOpen(false);
    onExtended();
  }

  if (!open) return null;
  const wasTrial = status.status === "trialing" || !status.plan;
  const m = status.made;
  const tiles = m ? [
    { n: m.clients, label: m.clients === 1 ? "client" : "clients", icon: Users },
    { n: m.programs, label: m.programs === 1 ? "program" : "programs", icon: CalendarDays },
    { n: m.quotes, label: m.quotes === 1 ? "quote" : "quotes", icon: FileText },
    { n: m.galleries, label: m.galleries === 1 ? "photo gallery" : "photo galleries", icon: Images },
    ...(m.paid > 0 ? [{ n: money(m.paid), label: `recorded in ${m.payments} payment${m.payments === 1 ? "" : "s"}`, icon: Wallet }] : []),
  ].filter(t => t.n !== 0) : [];
  const offer = status.offer;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="pe-title">
      <div className="absolute inset-0 bg-[#17151F]/45 backdrop-blur-[6px] animate-in fade-in duration-300" onClick={close} />
      <div className="relative w-full sm:max-w-[560px] max-h-[94dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_30px_80px_-20px_rgba(40,28,96,.45)] animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Top: calm, not alarming */}
        <div className="relative px-6 sm:px-8 pt-8 pb-6 bg-[linear-gradient(160deg,#F6F2FF_0%,#FFFFFF_70%)]">
          <div className="w-14 h-14 rounded-2xl bg-[#17151F] text-white flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(23,21,31,.5)]">
            <Lock className="w-6 h-6" />
          </div>
          <h2 id="pe-title" className="mt-5 text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-[#17151F]">
            {wasTrial ? "Your free trial has ended" : `Your ${status.plan?.name ?? ""} plan has ended`}
          </h2>
          <p className="mt-2 text-[15px] text-[#4A4658] leading-relaxed">
            Everything you made is safe. You can still open and look at all of it — to add or change anything, choose a plan.
            {end && <span className="text-[#6B6680]"> It ended on {fmtDate(end)}.</span>}
          </p>
        </div>

        {tiles.length > 0 && (
          <div className="px-6 sm:px-8 pb-2">
            <p className="text-[13px] font-semibold text-[#4A4658] mb-2.5">What you made in StuPanel</p>
            <div className="grid grid-cols-2 gap-2">
              {tiles.map(t => (
                <div key={t.label} className="rounded-2xl bg-[#F7F5FB] px-3.5 py-3 flex items-center gap-3">
                  <t.icon className="w-5 h-5 text-[#7D5CEF] flex-shrink-0" />
                  <p className="min-w-0 leading-tight">
                    <span className="block text-[18px] font-extrabold tabular-nums text-[#17151F] truncate">{typeof t.n === "number" ? t.n.toLocaleString("en-US") : t.n}</span>
                    <span className="block text-[12.5px] text-[#6B6680]">{t.label}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 sm:px-8 pt-4 pb-7 space-y-3">
          {offer && (
            <p className="rounded-2xl bg-[#F1FAF5] border border-[#CDEBDB] px-4 py-3 text-[14px] text-[#1F6B47] flex items-center gap-2.5">
              <Gift className="w-5 h-5 flex-shrink-0" />
              <span><b>{offer.percent}% off your first month</b> if you choose a monthly plan before {fmtDate(offer.until)}.</span>
            </p>
          )}
          <Link href="/billing#plans" onClick={close}
            className="h-[52px] w-full rounded-full bg-[#7D5CEF] hover:bg-[#6B4BDD] text-white text-[16px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_12px_26px_-12px_rgba(125,92,239,.8)]">
            <Check className="w-5 h-5" strokeWidth={3} />Choose a plan
          </Link>
          {trial?.canExtend && (
            <button type="button" onClick={() => void extend()} disabled={busy}
              className="h-12 w-full rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}Not sure yet? Take {trial.extendDays} more days free
            </button>
          )}
          {err && <p role="alert" className="text-[13px] text-[#C2304F] text-center">{err}</p>}
          <button type="button" onClick={close} className="h-11 w-full rounded-full text-[14.5px] font-semibold text-[#4A4658] hover:bg-[#F5F3FA]">
            Keep looking around
          </button>
          <p className="text-[12px] text-[#8A8599] text-center">Nothing is deleted. You can choose a plan any time from Plan &amp; billing.</p>
        </div>
      </div>
    </div>
  );
}
