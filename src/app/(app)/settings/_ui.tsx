"use client";

/**
 * Building blocks for the Settings screen (macOS System Settings style):
 * a pane header, grouped white cards with hairline rows, and right-aligned
 * controls. Changes save on their own — toggles and pickers right away,
 * text when you leave the field.
 */
import { createContext, useContext, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/ui/apple";

// ─── Save context ─────────────────────────────────────────────────────────────
export type SaveState = "idle" | "saving" | "saved" | "error";
export type Patch = (payload: Record<string, unknown>) => Promise<boolean>;

// Company settings as the API returns them (many loosely-typed fields).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Company = Record<string, any>;
type Ctx = { data: Company; patch: Patch; state: SaveState };
export const SettingsCtx = createContext<Ctx>({ data: {}, patch: async () => false, state: "idle" });
export const useSettings = () => useContext(SettingsCtx);

// ─── Icon tile (shared, see components/ui/apple.tsx) ─────────────────────────
export { Tile } from "@/components/ui/apple";

// ─── Pane header ──────────────────────────────────────────────────────────────
export function PaneHeader({ icon, color, title, sub, onBack }: {
  icon: React.ElementType; color: string; title: string; sub: string; onBack?: () => void;
}) {
  const { state } = useSettings();
  return (
    <div className="mb-6">
      {onBack && (
        <button onClick={onBack}
          className="md:hidden -ml-2 mb-3 h-10 pl-1 pr-3 rounded-full inline-flex items-center gap-1 text-sm font-semibold text-[#5B3FD0] hover:bg-[#EEE8FD]">
          <ChevronLeft className="w-5 h-5" /> Settings
        </button>
      )}
      <div className="flex items-center gap-4">
        <Tile icon={icon} color={color} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{title}</h1>
          <p className="text-sm text-[#6B6680] mt-0.5">{sub}</p>
        </div>
        <SaveBadge state={state} />
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving") return (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6680]" role="status">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
    </span>
  );
  if (state === "saved") return (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F8A5B]" role="status">
      <Check className="w-3.5 h-3.5" /> Saved
    </span>
  );
  return null;
}

// ─── Group (white card of rows) ───────────────────────────────────────────────
export function Group({ title, note, children, className }: {
  title?: string; note?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("mb-7", className)}>
      {title && <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">{title}</h2>}
      <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] divide-y divide-[#EEEBF4] overflow-hidden">
        {children}
      </div>
      {note && <p className="px-1 mt-2 text-xs text-[#6B6680] leading-relaxed">{note}</p>}
    </section>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────
/** One setting. `id` is what search jumps to. `stack` puts the control under the label. */
export function Row({ id, label, hint, children, stack, disabled, badge }: {
  id?: string; label: React.ReactNode; hint?: React.ReactNode; children?: React.ReactNode;
  stack?: boolean; disabled?: boolean; badge?: string;
}) {
  return (
    <div id={id ? `set-${id}` : undefined}
      className={cn("sp-set-row px-4 sm:px-5 py-3.5 scroll-mt-28", disabled && "opacity-55",
        stack ? "space-y-2.5" : "flex items-center gap-4 min-h-[60px]")}>
      <div className={cn("min-w-0", !stack && "flex-1")}>
        <p className="text-sm font-semibold text-[#17151F] flex items-center gap-2">
          {label}
          {badge && <span className="text-[11px] font-bold uppercase tracking-wide text-[#5B3FD0] bg-[#EEE8FD] px-2 py-0.5 rounded-full">{badge}</span>}
        </p>
        {hint && <p className="text-xs text-[#6B6680] mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      {children !== undefined && (stack ? <div>{children}</div> : <div className="flex-shrink-0 max-w-[60%]">{children}</div>)}
    </div>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────
export function Switch({ on, onChange, label, disabled }: {
  on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex w-[46px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0] focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        on ? "bg-[#7D5CEF]" : "bg-[#E3DFEC]",
      )}>
      <span className={cn(
        "absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(22,18,40,.25)] transition-transform duration-200",
        on ? "translate-x-[21px]" : "translate-x-[3px]",
      )} />
    </button>
  );
}

// ─── Pickers & fields ────────────────────────────────────────────────────────
/** Local editing copy that follows the saved value when it changes from outside. */
export function useSynced<T>(value: T): [T, (v: T) => void] {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); setV(value); }
  return [v, setV];
}
const fieldBase =
  "h-10 rounded-full bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40 transition-shadow";

export function Select<T extends string | number>({ value, options, onChange, label, wide }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; wide?: boolean;
}) {
  return (
    <div className="relative">
      <select aria-label={label} value={String(value)}
        onChange={e => {
          const raw = e.target.value;
          const opt = options.find(o => String(o.value) === raw);
          if (opt) onChange(opt.value);
        }}
        className={cn(fieldBase, "appearance-none pl-4 pr-9 font-semibold cursor-pointer max-w-full truncate", wide ? "w-full" : "w-auto")}
        style={{ WebkitAppearance: "none" }}>
        {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680] pointer-events-none" />
    </div>
  );
}

/** Text that saves when you leave the field (or press Enter). */
export function TextField({ value, onCommit, label, placeholder, type = "text", wide, maxLength, mono, align = "left" }: {
  value: string; onCommit: (v: string) => void; label: string; placeholder?: string;
  type?: string; wide?: boolean; maxLength?: number; mono?: boolean; align?: "left" | "right";
}) {
  const [v, setV] = useSynced(value);
  function commit() {
    const next = v.trim();
    if (next !== value) onCommit(next);
  }
  return (
    <input aria-label={label} type={type} value={v} placeholder={placeholder} maxLength={maxLength}
      onChange={e => setV(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setV(value); }}
      className={cn(fieldBase, "px-4", wide ? "w-full" : "w-[220px] max-w-full", mono && "font-mono tracking-wide",
        align === "right" && "text-right")} />
  );
}

export function NumberField({ value, onCommit, label, min, max, step = 1, suffix }: {
  value: number; onCommit: (v: number) => void; label: string; min: number; max: number; step?: number; suffix?: string;
}) {
  const [v, setV] = useSynced(String(value));
  function commit() {
    let n = Number(v);
    if (!Number.isFinite(n) || v.trim() === "") n = value;
    n = Math.min(max, Math.max(min, n));
    setV(String(n));
    if (n !== value) onCommit(n);
  }
  return (
    <div className="relative inline-flex items-center">
      <input aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={v}
        onChange={e => setV(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={cn(fieldBase, "w-[110px] pl-4 text-right tabular-nums font-semibold", suffix ? "pr-12" : "pr-4")} />
      {suffix && <span className="absolute right-4 text-xs font-semibold text-[#6B6680] pointer-events-none">{suffix}</span>}
    </div>
  );
}

export function TextArea({ value, onCommit, label, placeholder, rows = 4, maxLength, mono }: {
  value: string; onCommit: (v: string) => void; label: string; placeholder?: string; rows?: number; maxLength?: number; mono?: boolean;
}) {
  const [v, setV] = useSynced(value);
  return (
    <div>
      <textarea aria-label={label} value={v} rows={rows} placeholder={placeholder} maxLength={maxLength}
        onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== value) onCommit(v); }}
        className={cn("w-full px-4 py-3 rounded-[16px] bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#9893A8] leading-relaxed",
          "focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40 resize-y", mono && "font-mono text-[13px]")} />
      {maxLength && <p className="text-xs text-[#6B6680] text-right mt-1 tabular-nums">{v.length}/{maxLength}</p>}
    </div>
  );
}

/** Segmented control (like macOS appearance pickers). */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-1 rounded-full bg-[#F5F3FA] gap-1 flex-wrap">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-8 px-3.5 rounded-full text-xs font-bold transition-colors",
            value === o.value ? "bg-white text-[#5B3FD0] shadow-[0_1px_3px_rgba(22,18,40,.12)]" : "text-[#4A4658] hover:text-[#17151F]")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small "coming soon" row. */
export function SoonRow({ id, label, hint }: { id?: string; label: string; hint: string }) {
  return <Row id={id} label={label} hint={hint} badge="Coming soon" disabled />;
}
