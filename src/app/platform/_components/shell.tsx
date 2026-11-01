"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Shell({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-900/40">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {sub && <p className="text-slate-400 text-sm mt-1">{sub}</p>}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">{children}</div>
        <div className="text-center text-xs text-slate-600 mt-4">{footer ?? "StuPanel Admin — team only"}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

export function CodeInput({ value, onChange, autoFocus, allowBackup }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; allowBackup?: boolean }) {
  return (
    <input value={value} autoFocus={autoFocus} autoComplete="one-time-code" inputMode={allowBackup ? "text" : "numeric"}
      maxLength={allowBackup ? 9 : 6} placeholder={allowBackup ? "123456 or XXXX-XXXX" : "123456"}
      onChange={e => onChange(allowBackup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))}
      className={cn(inputCls, "text-center text-lg tracking-[0.3em] font-semibold")} />
  );
}

export function Btn({ loading, children, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button {...p} disabled={loading || p.disabled}
      className={cn("w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60", className)}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}{children}
    </button>
  );
}

export function ErrorBox({ text }: { text: string }) {
  if (!text) return null;
  return <p role="alert" className="text-xs text-red-400 bg-red-950/50 border border-red-900 px-3 py-2 rounded-lg">{text}</p>;
}

export function OkBox({ text }: { text: string }) {
  if (!text) return null;
  return <p role="status" className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-900 px-3 py-2 rounded-lg">{text}</p>;
}

export function QrBox({ uri, secret }: { uri: string; secret: string }) {
  const [src, setSrc] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toDataURL(uri, { margin: 1, width: 200 }).then(setSrc).catch(() => setSrc("")); }, [uri]);
  return (
    <div className="space-y-3">
      <div className="mx-auto w-[200px] h-[200px] rounded-xl bg-white p-2 flex items-center justify-center">
        {src ? <img src={src} alt="QR code for your authenticator app" width={184} height={184} /> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
      </div>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-[11px] font-mono text-slate-300 break-all inline-flex items-center gap-2 hover:border-slate-600">
        <span className="flex-1 text-left">{secret.match(/.{1,4}/g)?.join(" ")}</span>
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function BackupCodes({ codes, onDone, doneLabel = "I saved them — continue" }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const text = `StuPanel Admin backup codes (each works once)\n\n${codes.join("\n")}\n`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Save these backup codes somewhere safe. If you lose your phone, each one lets you sign in once.</p>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-800/70 border border-slate-700 p-3 font-mono text-sm text-white text-center">
        {codes.map(c => <span key={c}>{c}</span>)}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(text)}
          className="flex-1 h-9 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center justify-center gap-1.5 hover:border-slate-600"><Copy className="w-3.5 h-3.5" />Copy</button>
        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="stupanel-admin-backup-codes.txt"
          className="flex-1 h-9 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center justify-center gap-1.5 hover:border-slate-600"><Download className="w-3.5 h-3.5" />Download</a>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="accent-indigo-500" />
        I saved my backup codes
      </label>
      <Btn type="button" disabled={!saved} onClick={onDone}>{doneLabel}</Btn>
    </div>
  );
}
