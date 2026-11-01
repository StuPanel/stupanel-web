"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const fmtWhen = (d?: string | null) => d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(d)) : "—";

export function Page({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="p-6 md:p-8 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, sub, children, className }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-slate-800 border border-slate-700 rounded-xl", className)}>
      {title && (
        <div className="px-5 pt-4 pb-3 border-b border-slate-700/70">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export const inp = "w-full h-9 rounded-lg bg-slate-900 border border-slate-700 px-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60";

export function Btn({ loading, variant = "primary", className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button {...p} disabled={loading || p.disabled}
      className={cn("h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60",
        variant === "primary" && "bg-indigo-600 hover:bg-indigo-700 text-white",
        variant === "ghost" && "border border-slate-600 text-slate-200 hover:bg-slate-700",
        variant === "danger" && "border border-red-900 text-red-300 hover:bg-red-950/50",
        className)}>
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{children}
    </button>
  );
}

export function Msg({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p role="alert" className="text-xs text-red-400 bg-red-950/50 border border-red-900 px-3 py-2 rounded-lg">{error}</p>;
  if (ok) return <p role="status" className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-900 px-3 py-2 rounded-lg">{ok}</p>;
  return null;
}

/**
 * Asks for a fresh 6-digit code before a risky action.
 * Usage: const ask = useCodePrompt(); … ask("Remove Rahim?", code => api(code));
 */
export function useCodePrompt() {
  const [state, setState] = useState<{ title: string; run: (code: string) => Promise<void> } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ask = (title: string, run: (code: string) => Promise<void>) => { setState({ title, run }); setCode(""); setError(""); };
  const close = () => { if (!loading) setState(null); };
  const node = state && (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={close}>
      <form onClick={e => e.stopPropagation()} onSubmit={async e => {
        e.preventDefault(); setLoading(true); setError("");
        try { await state.run(code); setState(null); } catch (err) { setError((err as Error).message); } finally { setLoading(false); }
      }} className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center flex-shrink-0"><ShieldCheck className="w-4 h-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{state.title}</p>
            <p className="text-xs text-slate-400">Enter the 6-digit code from your authenticator app.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
        </div>
        <input autoFocus value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456"
          onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
          className={cn(inp, "h-11 text-center text-lg tracking-[0.3em] font-semibold")} />
        <Msg error={error} />
        <Btn loading={loading} disabled={code.length !== 6} className="w-full h-10">Confirm</Btn>
      </form>
    </div>
  );
  return { ask, node };
}

export function deviceName(ua?: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}
