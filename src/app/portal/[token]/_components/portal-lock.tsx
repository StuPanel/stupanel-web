"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, MessageCircle, LinkIcon, ShieldCheck } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { StudioLogo } from "@/components/studio-logo";
import { setPortalSession, waLink } from "@/lib/portal-session";

export type PortalMeta = {
  active: boolean;
  studio: { name: string; logoUrl?: string | null; whatsapp?: string | null };
};

/**
 * Shown before the client portal when this device has not entered the access
 * code yet ("locked"), or when the link was retired ("retired").
 * Client-facing, so English only.
 */
export function PortalLock({ token, kind, meta, onUnlocked }: {
  token: string;
  kind: "locked" | "retired";
  meta: PortalMeta | null;
  onUnlocked: () => void;
}) {
  const studio = meta?.studio.name ?? "your studio";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!retryAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [retryAt]);

  const lockedFor = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 60000)) : 0;
  const isLocked = !!retryAt && retryAt > now;

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const forgotLink = waLink(meta?.studio.whatsapp,
    kind === "retired"
      ? `Hi ${studio}, my client portal link is no longer active. Could you send me a new link? (${pageUrl})`
      : `Hi ${studio}, I can't open my client portal — could you send me my access code? (${pageUrl})`);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy || isLocked) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API}/public/portal/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.session) {
        setPortalSession(token, d.session);
        onUnlocked();
        return;
      }
      if (r.status === 429 && d.retryAt) {
        setRetryAt(new Date(d.retryAt).getTime());
        setError("");
      } else if (r.status === 401) {
        const left = typeof d.attemptsLeft === "number" ? d.attemptsLeft : null;
        setError(left ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "That code isn't right.");
        setCode("");
        inputRef.current?.focus();
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("No internet connection. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F3FA] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] p-6 sm:p-8 text-center">
          <StudioLogo url={meta?.studio.logoUrl} name={meta?.studio.name} size={64} className="mx-auto rounded-2xl" />
          <p className="mt-3 text-sm font-semibold text-[#4A4658]">{meta?.studio.name ?? "Client Portal"}</p>

          {kind === "retired" ? (
            <>
              <div className="w-12 h-12 rounded-full bg-[#FDECEF] flex items-center justify-center mx-auto mt-6">
                <LinkIcon className="w-6 h-6 text-[#C2304F]" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-[#17151F]">This link is no longer active</h1>
              <p className="mt-2 text-sm text-[#6B6680]">Please ask {studio} for a new client portal link.</p>
              {forgotLink && (
                <a href={forgotLink} target="_blank" rel="noopener noreferrer"
                  className="mt-6 h-12 w-full rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                  <MessageCircle className="w-4 h-4" /> Message {studio} on WhatsApp
                </a>
              )}
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="mt-6 text-xl font-bold text-[#17151F]">Your client portal</h1>
              <p className="mt-2 text-sm text-[#6B6680]">Enter the access code {studio} sent you.</p>

              <label htmlFor="portal-code" className="sr-only">Access code</label>
              <input
                id="portal-code" ref={inputRef} value={code}
                onChange={e => { setCode(e.target.value.replace(/\s/g, "")); setError(""); }}
                autoComplete="one-time-code" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                inputMode="text" maxLength={20} placeholder="••••••" disabled={isLocked}
                aria-invalid={!!error}
                className={`mt-6 w-full h-14 rounded-2xl border bg-white text-center text-2xl font-semibold tracking-[0.35em] text-[#17151F] placeholder:text-[#CFC2F8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/30 transition-colors disabled:bg-[#F5F3FA] ${error ? "border-[#C2304F]" : "border-[#E3DFEC] focus:border-[#5B3FD0]"}`}
              />

              {error && <p role="alert" className="mt-2 text-sm text-[#C2304F]">{error}</p>}
              {isLocked && (
                <p role="alert" className="mt-2 text-sm text-[#C2304F]">
                  Too many wrong tries. Please wait {lockedFor} {lockedFor === 1 ? "minute" : "minutes"}.
                </p>
              )}

              <button type="submit" disabled={busy || !code.trim() || isLocked}
                className="mt-5 h-12 w-full rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Open portal
              </button>

              <p className="mt-4 text-xs text-[#6B6680] flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1F8A5B]" />
                You only need to enter this once on this device.
              </p>

              {forgotLink && (
                <a href={forgotLink} target="_blank" rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5B3FD0] hover:underline">
                  <MessageCircle className="w-4 h-4" /> Forgot your code? Ask {studio}
                </a>
              )}
            </form>
          )}
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-[#6B6680]">Powered by <span className="font-semibold text-[#17151F]">StuPanel</span></footer>
    </div>
  );
}
