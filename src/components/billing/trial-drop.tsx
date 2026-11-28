"use client";
/**
 * The free-trial card (Faisal 28-NOV-2026). Not a fixed strip: after signing in it drops down from the top with a
 * soft spring, says how many days are left and offers a plan; × sends it back up. The closer the end, the warmer the
 * colour and the sooner it comes back after being closed:
 *
 *   more than 7 days  calm (violet)   back at the next sign-in
 *   4–7 days          soon (amber)    back after 6 hours
 *   1–3 days          urgent (coral)  back after 1 hour, "Take 7 more days" when the studio still can
 *   last day          today (red)     back after 20 minutes, with a countdown to the end
 *
 * Closing is kept on this device; signing out forgets it (see forgetTrialDrop), so the next sign-in shows it again.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, Loader2, Sparkles, X } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TrialState } from "@/lib/billing";

const KEY = "sp_trial_drop_v1";
const TRIAL_DAYS = 14;
type Stage = "calm" | "soon" | "urgent" | "today";
const stageOf = (d: number): Stage => (d <= 0 ? "today" : d <= 3 ? "urgent" : d <= 7 ? "soon" : "calm");
/** How long it stays away after ×; null = until the next sign-in. */
const AWAY: Record<Stage, number | null> = { calm: null, soon: 6 * 3600e3, urgent: 3600e3, today: 20 * 60e3 };

const LOOK: Record<Stage, { ring: string; track: string; glow: string; chip: string; btn: string }> = {
  calm: { ring: "#7D5CEF", track: "#E9E3FC", glow: "rgba(125,92,239,.22)", chip: "bg-[#EEE8FD] text-[#5B3FD0]", btn: "bg-[#17151F] hover:bg-[#2D2A38]" },
  soon: { ring: "#D98A12", track: "#FBEBCF", glow: "rgba(217,138,18,.22)", chip: "bg-[#FFF1D6] text-[#8A5A00]", btn: "bg-[#17151F] hover:bg-[#2D2A38]" },
  urgent: { ring: "#E0513A", track: "#FBDDD6", glow: "rgba(224,81,58,.24)", chip: "bg-[#FDE5DF] text-[#A33A27]", btn: "bg-[#E0513A] hover:bg-[#C8432E]" },
  today: { ring: "#C2304F", track: "#F8D7DE", glow: "rgba(194,48,79,.28)", chip: "bg-[#FDECEF] text-[#A82743]", btn: "bg-[#C2304F] hover:bg-[#A82743]" },
};

type Saved = { until: number | "login"; stage: Stage };
function readSaved(): Saved | null { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
/** Signing out: the next sign-in shows the card again. */
export function forgetTrialDrop() { try { localStorage.removeItem(KEY); } catch { /* nothing kept */ } }

function hiddenNow(stage: Stage) {
  const s = readSaved();
  if (!s) return false;
  // Closed while calmer: a warmer stage shows again at once.
  const order: Stage[] = ["calm", "soon", "urgent", "today"];
  if (order.indexOf(stage) > order.indexOf(s.stage)) return false;
  return s.until === "login" || Date.now() < s.until;
}

function Countdown({ to }: { to: string }) {
  const [left, setLeft] = useState<string>("");
  useEffect(() => {
    const end = new Date(to).getTime();
    const tick = () => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setLeft(`${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    };
    const first = setTimeout(tick, 0), id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [to]);
  return <span className="font-mono tabular-nums font-bold">{left}</span>;
}

export function TrialDrop({ daysLeft, endsAt }: { daysLeft: number; endsAt: string | null }) {
  const pathname = usePathname();
  const d = Math.max(0, daysLeft);
  const stage = stageOf(d);
  const look = LOOK[stage];
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [extending, setExtending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBilling = pathname.startsWith("/billing");

  // Drop in a moment after the page settles; when closed for a while, come back when that time is up.
  useEffect(() => {
    if (onBilling) return;
    const plan = () => {
      if (timer.current) clearTimeout(timer.current);
      const s = readSaved();
      if (!hiddenNow(stage)) { timer.current = setTimeout(() => setPhase("in"), 900); return; }
      if (s && s.until !== "login") timer.current = setTimeout(plan, Math.max(1000, s.until - Date.now() + 500));
    };
    plan();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [stage, onBilling]);

  useEffect(() => {
    if (phase !== "in" || stage === "calm" || trial) return;
    apiFetch(`${API_URL}/billing/trial`).then(r => (r.ok ? r.json() : null)).then(t => t && setTrial(t)).catch(() => undefined);
  }, [phase, stage, trial]);

  const close = () => {
    const away = AWAY[stage];
    try { localStorage.setItem(KEY, JSON.stringify({ until: away === null ? "login" : Date.now() + away, stage } satisfies Saved)); } catch { /* shows again next time */ }
    setPhase("out");
    if (away !== null) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPhase("in"), away); }
  };

  const extend = async () => {
    setExtending(true);
    const r = await apiFetch(`${API_URL}/billing/trial/extend`, { method: "POST" }).catch(() => null);
    setExtending(false);
    if (r?.ok) { setMsg("Done: 7 more days added. Reloading…"); setTimeout(() => window.location.reload(), 1200); }
    else setMsg("Couldn't add the days. Open Plan & billing.");
  };

  if (onBilling || phase === "hidden") return null;

  const title = stage === "today" ? "Your free trial ends today"
    : stage === "urgent" ? `Only ${d} day${d === 1 ? "" : "s"} left in your trial`
    : stage === "soon" ? `Your free trial ends in ${d} days`
    : `${d} days left in your free trial`;
  const line = stage === "calm"
    ? "Everything is open while you try StuPanel. Pick a plan whenever you are ready."
    : "Choose a plan to keep programs, clients and galleries running without a break. Nothing you made is lost.";
  const pct = Math.max(0.04, Math.min(1, d / Math.max(TRIAL_DAYS, d)));
  const R = 22, C = 2 * Math.PI * R;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-3 sm:pt-4" aria-live="polite">
      <div role="region" aria-label="Free trial"
        className={cn("trial-drop pointer-events-auto relative w-full max-w-[640px] rounded-[22px] border border-white/70 bg-white/85 backdrop-blur-xl backdrop-saturate-150 overflow-hidden",
          phase === "in" ? "trial-drop-in" : "trial-drop-out")}
        style={{ boxShadow: `0 18px 50px -12px ${look.glow}, 0 2px 8px rgba(23,21,31,.06)` }}
        onAnimationEnd={() => { if (phase === "out") setPhase("hidden"); }}>
        {/* soft colour wash on the left, the stage's colour */}
        <div aria-hidden="true" className="absolute -left-16 -top-20 w-56 h-56 rounded-full blur-3xl opacity-60" style={{ background: look.track }} />
        <div className="relative flex items-center gap-3.5 sm:gap-4 p-3.5 sm:p-4 pr-12">
          {/* days ring */}
          <div className={cn("relative w-[58px] h-[58px] flex-shrink-0", stage !== "calm" && "trial-pulse")}>
            <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90" aria-hidden="true">
              <circle cx="26" cy="26" r={R} fill="white" stroke={look.track} strokeWidth="5" />
              <circle cx="26" cy="26" r={R} fill="none" stroke={look.ring} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="trial-ring" style={{ ["--c" as string]: C } as React.CSSProperties} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <b className="text-[18px] font-extrabold text-[#17151F] tabular-nums">{d}</b>
              <span className="text-[9.5px] font-semibold text-[#6B6680] mt-0.5">{d === 1 ? "day" : "days"}</span>
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className={cn("h-[22px] px-2 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1", look.chip)}><Sparkles className="w-3 h-3" aria-hidden="true" />Free trial</span>
              {stage === "today" && endsAt && <span className="text-[12.5px] text-[#A82743]">ends in <Countdown to={endsAt} /></span>}
            </p>
            <p className="mt-1 text-[15.5px] sm:text-[16px] font-bold text-[#17151F] leading-snug">{title}</p>
            <p className="mt-0.5 text-[13px] text-[#5E5970] leading-snug">{msg ?? line}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Link href="/billing" onClick={() => setPhase("out")} className={cn("h-9 px-4 rounded-full text-white text-[13.5px] font-semibold inline-flex items-center transition-colors", look.btn)}>Choose a plan</Link>
              {trial?.canExtend && (stage === "urgent" || stage === "today") && (
                <button type="button" onClick={extend} disabled={extending} className="h-9 px-3.5 rounded-full bg-white border border-[#E4E0EC] hover:bg-[#FAF9FC] text-[13.5px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 disabled:opacity-60">
                  {extending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}Take {trial.extendDays} more days
                </button>
              )}
            </div>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Close" className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full text-[#8A8599] hover:text-[#17151F] hover:bg-black/5 flex items-center justify-center transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <style>{`
        .trial-drop-in { animation: trialIn .7s cubic-bezier(.2,1.3,.35,1) both; }
        .trial-drop-out { animation: trialOut .32s cubic-bezier(.5,0,.75,0) both; }
        @keyframes trialIn { 0% { transform: translateY(-140%) scale(.96); opacity: 0 } 60% { opacity: 1 } 100% { transform: none; opacity: 1 } }
        @keyframes trialOut { from { transform: none; opacity: 1 } to { transform: translateY(-140%) scale(.97); opacity: 0 } }
        .trial-ring { animation: trialRing 1.1s .35s cubic-bezier(.3,.7,.2,1) both; }
        @keyframes trialRing { from { stroke-dashoffset: var(--c) } }
        .trial-pulse::after { content: ""; position: absolute; inset: -4px; border-radius: 999px; border: 2px solid ${look.ring}; opacity: 0; animation: trialPulse 2.4s 1.2s ease-out infinite; }
        @keyframes trialPulse { 0% { transform: scale(.9); opacity: .55 } 100% { transform: scale(1.25); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) {
          .trial-drop-in { animation: trialFade .25s ease-out both } .trial-drop-out { animation: trialFade .2s ease-in reverse both }
          .trial-ring, .trial-pulse::after { animation: none }
          @keyframes trialFade { from { opacity: 0 } to { opacity: 1 } }
        }
      `}</style>
    </div>
  );
}
