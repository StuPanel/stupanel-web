"use client";
/**
 * Program notes written as points, with @mentions of people on the program.
 * Stored as plain text so old notes still work: one point per line ("- " in front),
 * a mention is `@[Name](userId)`. No one is notified — the person sees the point
 * marked "For you" on their program page.
 */
import { useMemo, useRef, useState } from "react";
import { AtSign, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NotePerson = { id: string; name: string; sub?: string };

const TOKEN = /@\[([^\]\n]{1,80})\]\(([\w-]{1,64})\)/g;

/** Text → points (one per line; "- ", "• " and "* " in front are dropped). */
export function parsePoints(text?: string | null): string[] {
  return (text ?? "").split(/\r?\n/).map(l => l.replace(/^\s*(?:[-•*]\s+)/, "").trim()).filter(Boolean);
}
/** Points → the text we store. */
export const joinPoints = (points: string[]) => points.map(p => p.trim()).filter(Boolean).map(p => `- ${p}`).join("\n");
/** Ids mentioned in one point. */
export const mentionsOf = (point: string) => [...point.matchAll(TOKEN)].map(m => m[2]);
/** A point with mentions shown as "@Name" (for editing and plain text). */
export const plainPoint = (point: string) => point.replace(TOKEN, (_, n) => `@${n}`);

/** One point, mentions as chips; `meId` turns "you" violet. */
export function PointText({ text, meId }: { text: string; meId?: string | null }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const me = !!meId && m[2] === meId;
    parts.push(
      <span key={i} className={cn("inline-flex items-center rounded-full px-1.5 mx-0.5 text-[0.92em] font-semibold align-baseline",
        me ? "bg-[#5B3FD0] text-white" : "bg-[#EEE8FD] text-[#5B3FD0]")}>@{m[1]}</span>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className="break-words">{parts}</span>;
}

/** The list as read-only points. Points that mention `meId` come first, marked "For you". */
export function PointList({ text, meId, empty }: { text?: string | null; meId?: string | null; empty?: string }) {
  const points = parsePoints(text);
  const sorted = meId ? [...points.filter(p => mentionsOf(p).includes(meId)), ...points.filter(p => !mentionsOf(p).includes(meId))] : points;
  if (!points.length) return empty ? <p className="px-4 py-3 text-[13px] text-[#6B6680]">{empty}</p> : null;
  return (
    <ul className="divide-y divide-[#F0EDF6]">
      {sorted.map((p, i) => {
        const mine = !!meId && mentionsOf(p).includes(meId);
        return (
          <li key={i} className={cn("px-4 py-2.5 flex gap-2.5 text-[14px] leading-relaxed text-[#33303F]", mine && "bg-[#F6F2FF]")}>
            <span className={cn("mt-[9px] w-1.5 h-1.5 rounded-full flex-shrink-0", mine ? "bg-[#5B3FD0]" : "bg-[#C9C2DA]")} />
            <span className="flex-1 min-w-0">
              {mine && <span className="mr-1.5 inline-flex h-5 px-2 rounded-full bg-[#5B3FD0] text-white text-[11px] font-bold items-center align-[1px]">For you</span>}
              <PointText text={p} meId={meId} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Edit the points: add (Enter), change, remove. Type "@" to mention someone from `people`.
 * `onChange` gets the whole stored text after every change.
 */
export function NotePoints({ value, onChange, people, placeholder, label, mentionHint }: {
  value: string; onChange: (text: string) => void; people: NotePerson[];
  placeholder?: string; label: string; mentionHint?: string;
}) {
  const points = useMemo(() => parsePoints(value), [value]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({}); // shown name → id
  const [query, setQuery] = useState<string | null>(null);
  const [hi, setHi] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);

  const matches = query === null ? [] : people.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  function typed(v: string) {
    setDraft(v);
    const caret = input.current?.selectionStart ?? v.length;
    const m = /(?:^|\s)@([^\s@]{0,30})$/.exec(v.slice(0, caret));
    setQuery(m ? m[1] : null); setHi(0);
  }
  function pick(p: NotePerson) {
    const el = input.current; const caret = el?.selectionStart ?? draft.length;
    const before = draft.slice(0, caret).replace(/@([^\s@]{0,30})$/, `@${p.name} `);
    const next = before + draft.slice(caret);
    setDraft(next); setPicked(x => ({ ...x, [p.name]: p.id })); setQuery(null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(before.length, before.length); });
  }
  /** "@Name" of picked people → stored tokens. Longest names first so "Md Bappy" wins over "Md". */
  function toStored(text: string) {
    let out = text.replace(/\s*\n\s*/g, " ").trim();
    const names = Object.keys(picked).sort((a, b) => b.length - a.length);
    for (const n of names) out = out.split(`@${n}`).join(`@[${n}](${picked[n]})`);
    return out;
  }
  function submit() {
    const p = toStored(draft);
    if (!p) return;
    const next = editing === null ? [...points, p] : points.map((x, i) => (i === editing ? p : x));
    onChange(joinPoints(next));
    setDraft(""); setEditing(null); setPicked({}); setQuery(null);
  }
  function edit(i: number) {
    const p = points[i];
    const map: Record<string, string> = {};
    for (const m of p.matchAll(TOKEN)) map[m[1]] = m[2];
    setPicked(map); setDraft(plainPoint(p)); setEditing(i);
    requestAnimationFrame(() => input.current?.focus());
  }
  function remove(i: number) {
    onChange(joinPoints(points.filter((_, j) => j !== i)));
    if (editing === i) { setEditing(null); setDraft(""); setPicked({}); }
  }

  return (
    <div>
      {points.length > 0 && (
        <ul className="mb-2 rounded-xl bg-white border border-[#EEEBF4] divide-y divide-[#F0EDF6]">
          {points.map((p, i) => (
            <li key={i} className={cn("pl-3 pr-1 py-1.5 flex items-start gap-2 text-[13.5px] leading-relaxed text-[#33303F]", editing === i && "bg-[#F6F2FF]")}>
              <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-[#C9C2DA] flex-shrink-0" />
              <span className="flex-1 min-w-0 py-0.5"><PointText text={p} /></span>
              <button type="button" onClick={() => edit(i)} aria-label={`Change point ${i + 1}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F0EDF6] flex-shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => remove(i)} aria-label={`Remove point ${i + 1}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9893A8] hover:text-[#C2304F] hover:bg-[#FDEDF1] flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <div className="flex items-end gap-2">
          <textarea ref={input} value={draft} rows={1} maxLength={500} aria-label={label}
            onChange={e => typed(e.target.value)}
            onKeyDown={e => {
              if (matches.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setHi(h => (h + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length); return; }
              if (e.key === "Escape") { if (query !== null) { setQuery(null); e.stopPropagation(); } else if (editing !== null) { setEditing(null); setDraft(""); } return; }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (matches.length) pick(matches[hi] ?? matches[0]); else submit(); }
            }}
            onBlur={() => setTimeout(() => setQuery(null), 150)}
            placeholder={placeholder ?? "Add a point — type @ to mention someone"}
            className="flex-1 min-h-11 max-h-32 rounded-[14px] bg-white border border-[#DCD6E8] hover:border-[#C9C2DA] px-3.5 py-2.5 text-[14px] text-[#17151F] placeholder:text-[#7A7590] resize-none focus:outline-none focus:border-[#7D5CEF] focus:ring-2 focus:ring-[#7D5CEF]/25 [field-sizing:content]" />
          {editing !== null && (
            <button type="button" onClick={() => { setEditing(null); setDraft(""); setPicked({}); }} aria-label="Stop changing"
              className="h-11 w-11 rounded-full bg-[#F5F3FA] text-[#6B6680] flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
          )}
          <button type="button" onClick={submit} disabled={!draft.trim()}
            className="h-11 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center gap-1 disabled:bg-[#EEE8FD] disabled:text-[#5B3FD0] flex-shrink-0">
            {editing === null ? <><Plus className="w-3.5 h-3.5" />Add</> : <><Check className="w-3.5 h-3.5" />Save</>}
          </button>
        </div>
        {query !== null && (
          <div role="listbox" aria-label="Mention someone" className="absolute left-0 right-0 bottom-full mb-1.5 z-20 rounded-2xl bg-white shadow-[0_8px_30px_rgba(22,18,40,.16)] border border-[#EEEBF4] py-1.5 max-h-60 overflow-auto">
            {matches.length ? matches.map((p, i) => (
              <button key={p.id} type="button" role="option" aria-selected={i === hi} onMouseDown={e => e.preventDefault()} onClick={() => pick(p)}
                className={cn("w-full text-left px-3.5 py-2 flex items-center gap-2.5", i === hi ? "bg-[#F6F2FF]" : "hover:bg-[#FAF9FC]")}>
                <span className="w-7 h-7 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-bold flex items-center justify-center flex-shrink-0">{p.name.charAt(0)}</span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-[#17151F] truncate">{p.name}</span>
                  {p.sub && <span className="block text-[11.5px] text-[#6B6680] truncate">{p.sub}</span>}
                </span>
              </button>
            )) : <p className="px-3.5 py-2 text-[12.5px] text-[#6B6680]">{people.length ? "No one by that name." : mentionHint ?? "No one to mention yet."}</p>}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[12px] text-[#6B6680] flex items-center gap-1"><AtSign className="w-3 h-3" />{mentionHint && !people.length ? mentionHint : "Type @ to mention someone — they see the point marked “For you”."}</p>
    </div>
  );
}
