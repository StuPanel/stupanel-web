"use client";
/**
 * Website "Autofill" (Faisal 25-NOV-2026): each press puts the next ready text in a box.
 * The words come from StuPanel (Super Admin → Studio sites → Text templates), see stupanel-api text-templates.ts.
 * Fill-ins: {studio} {city} {events} {package}, and for a team member {name} {role}; a [part] is dropped when a
 * fill-in inside it is empty.
 */
import { useEffect, useState } from "react";
import { Wand2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { cn } from "@/lib/utils";

export type TextItem = string | { a: string; b: string };
type Field = { key: string; kind: "text" | "pair"; max: number; max2?: number };
type Data = { fields: Field[]; texts: Record<string, TextItem[]>; studio: { name: string; city: string; country: string } };
export type FillCtx = { events?: string[]; packageName?: string; /** A team member's first name */ name?: string; /** What they do, "cinematographer and video editor" */ role?: string };

let cache: Promise<Data | null> | null = null;
function load(): Promise<Data | null> {
  if (!cache) {
    cache = apiFetch(`${API}/site/text-templates`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    cache.then(d => { if (!d) cache = null; }); // try again next time
  }
  return cache;
}

/** "Holud, Wedding and Reception" from the moving words (first three). */
function eventsLine(list?: string[]) {
  const e = (list ?? []).map(s => s.trim()).filter(Boolean).slice(0, 3);
  if (!e.length) return "Holud, wedding and reception";
  return e.length === 1 ? e[0] : `${e.slice(0, -1).join(", ")} and ${e[e.length - 1]}`;
}

export function fillText(tpl: string, d: Data, ctx: FillCtx, max: number): string {
  const vals: Record<string, string> = {
    studio: d.studio.name || "our studio",
    city: d.studio.city || d.studio.country,
    events: eventsLine(ctx.events),
    package: ctx.packageName?.trim() || "this package",
    name: ctx.name?.trim() || "our team member",
    role: ctx.role?.trim() ?? "",
  };
  const put = (s: string) => s.replace(/\{(studio|city|events|package|name|role)\}/g, (_, k: string) => vals[k] ?? "");
  // [optional parts]: kept only when every fill-in inside has a value
  const out = tpl.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    const keys = [...inner.matchAll(/\{(studio|city|events|package|name|role)\}/g)].map(m => m[1]);
    return keys.every(k => vals[k]) ? put(inner) : "";
  });
  return put(out).replace(/ {2,}/g, " ").slice(0, max);
}

/** The ready texts for one box, already filled in for this studio. */
export function useAutofill(key: string, ctx: FillCtx = {}) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { let on = true; load().then(x => { if (on) setD(x); }); return () => { on = false; }; }, []);
  const field = d?.fields.find(f => f.key === key);
  const items = d && field ? (d.texts[key] ?? []) : [];
  const texts = d && field ? items.filter((x): x is string => typeof x === "string").map(t => fillText(t, d, ctx, field.max)) : [];
  const pairs = d && field ? items.filter((x): x is { a: string; b: string } => typeof x === "object").map(p => ({ a: fillText(p.a, d, ctx, field.max), b: fillText(p.b, d, ctx, field.max2 ?? field.max) })) : [];
  return { ready: !!field && items.length > 0, texts, pairs };
}

/** The next one after `current` (a random start when the box has the studio's own words). */
export function nextOf<T>(list: T[], isCurrent: (x: T) => boolean): T | null {
  if (!list.length) return null;
  const i = list.findIndex(isCurrent);
  if (i >= 0) return list[(i + 1) % list.length];
  return list[Math.floor(Math.random() * list.length)];
}

export function AutofillButton({ onClick, disabled, label = "Autofill", className }: { onClick: () => void; disabled?: boolean; label?: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      title="Put ready words in this box. Press again for different words."
      className={cn("h-8 px-2.5 rounded-full bg-[#EEE8FD] hover:bg-[#E4DBFB] text-[#5B3FD0] text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 flex-shrink-0", className)}>
      <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />{label}
    </button>
  );
}

/** Autofill for a one-text box. `also`: a second list after the first (a member's role list, then the general one). */
export function AutofillText({ field, also, value, onFill, ctx }: { field: string; also?: string; value: string; onFill: (v: string) => void; ctx?: FillCtx }) {
  const one = useAutofill(field, ctx);
  const two = useAutofill(also ?? field, ctx);
  const texts = also && also !== field ? [...one.texts, ...two.texts] : one.texts;
  if (!texts.length) return null;
  return <AutofillButton onClick={() => { const v = nextOf(texts, t => t.trim() === (value ?? "").trim()); if (v != null) onFill(v); }} />;
}

/** Autofill for a two-box pair (SEO title + description): fills both. */
export function AutofillPair({ field, value, onFill, ctx }: { field: string; value: { a: string; b: string }; onFill: (v: { a: string; b: string }) => void; ctx?: FillCtx }) {
  const { ready, pairs } = useAutofill(field, ctx);
  if (!ready) return null;
  return <AutofillButton onClick={() => { const v = nextOf(pairs, p => p.a === value.a.trim()); if (v) onFill(v); }} />;
}

/** "Add a ready question": the next question the list doesn't have yet. */
export function AutofillAdd({ field, have, onAdd, ctx, max }: { field: string; have: string[]; onAdd: (v: { a: string; b: string }) => void; ctx?: FillCtx; max: number }) {
  const { ready, pairs } = useAutofill(field, ctx);
  if (!ready) return null;
  const taken = new Set(have.map(q => q.trim().toLowerCase()));
  return (
    <AutofillButton label="Add a ready question" disabled={have.length >= max}
      onClick={() => {
        const v = pairs.find(p => !taken.has(p.a.trim().toLowerCase()));
        if (v) onAdd(v); else notify("All the ready questions are already in your list.");
      }} />
  );
}
