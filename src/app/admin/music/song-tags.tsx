"use client";
/**
 * Super Admin → Music → listening: the playing song's tags at a glance. Its tags are filled chips (tap to take
 * one off); every other tag is below (tap to add). Each tap saves at once, so a song can be fixed while it plays.
 */
import { useMemo, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; parent?: string | null; hidden?: boolean };
export type SongTagValues = { events: string[]; videos: string[]; moods: string[]; language: string | null };
type Lists = { EVENTS: Tag[]; VIDEOS: Tag[]; MOODS: Tag[]; LANGS: Tag[] };

const SECTIONS = [
  { key: "events", title: "Events", list: "EVENTS" },
  { key: "videos", title: "Kind of video", list: "VIDEOS" },
  { key: "moods", title: "Mood", list: "MOODS" },
] as const;

export function SongTags({ value, lists, onChange, busy }: {
  value: SongTagValues; lists: Lists; busy: boolean;
  /** Save a change (only the part that changed). */
  onChange: (patch: Partial<SongTagValues>) => void;
}) {
  const [q, setQ] = useState("");
  const [more, setMore] = useState<Record<string, boolean>>({});
  const byId = useMemo(() => new Map(lists.EVENTS.map(t => [t.id, t])), [lists.EVENTS]);
  const label = (t: Tag) => (t.parent ? `${t.name} · ${byId.get(t.parent)?.name ?? t.parent}` : t.name);
  const k = q.trim().toLowerCase();
  const match = (t: Tag) => !k || label(t).toLowerCase().includes(k);
  const byName = (a: Tag, b: Tag) => label(a).localeCompare(label(b));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white flex-1">Tags of this song</p>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-indigo-300" aria-label="Saving" />}
        <div className="relative w-44">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a tag" aria-label="Find a tag"
            className="w-full h-8 rounded-lg bg-slate-900 border border-slate-600 pl-8 pr-2 text-xs text-white placeholder:text-slate-500" />
        </div>
      </div>

      {SECTIONS.map(s => {
        const all = (lists[s.list] as Tag[]).filter(t => !t.hidden);
        const on = value[s.key];
        const mine = on.map(id => all.find(t => t.id === id) ?? { id, name: id }).sort(byName);
        const rest = all.filter(t => !on.includes(t.id) && match(t)).sort(byName);
        const open = more[s.key] || !!k;
        const shown = open ? rest : rest.slice(0, s.key === "events" ? 10 : 8);
        return (
          <section key={s.key}>
            <p className="text-xs font-semibold text-slate-400 mb-1.5">{s.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {mine.length === 0 && <span className="text-xs text-amber-300">None yet — add one below</span>}
              {mine.map(t => (
                <button key={t.id} type="button" disabled={busy} onClick={() => onChange({ [s.key]: on.filter(x => x !== t.id) })}
                  title="Take this tag off" className="h-9 lg:h-7 pl-2.5 pr-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1 hover:bg-rose-600 disabled:opacity-60">
                  {label(t)}<X className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            {rest.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {shown.map(t => (
                  <button key={t.id} type="button" disabled={busy} onClick={() => onChange({ [s.key]: [...on, t.id] })}
                    title="Add this tag" className="h-9 lg:h-7 px-2.5 rounded-full border border-slate-600 text-slate-300 text-xs inline-flex items-center gap-1 hover:border-indigo-400 hover:text-white disabled:opacity-60">
                    <Plus className="w-3 h-3" />{label(t)}
                  </button>
                ))}
                {!open && rest.length > shown.length && (
                  <button type="button" onClick={() => setMore(m => ({ ...m, [s.key]: true }))} className="h-9 lg:h-7 px-2.5 rounded-full text-xs text-indigo-300 hover:text-white">
                    +{rest.length - shown.length} more
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      <section>
        <p className="text-xs font-semibold text-slate-400 mb-1.5">Language</p>
        <div className="flex flex-wrap gap-1.5">
          {lists.LANGS.filter(t => !t.hidden).sort(byName).map(t => {
            const sel = value.language === t.id;
            return (
              <button key={t.id} type="button" disabled={busy} onClick={() => onChange({ language: sel ? null : t.id })} aria-pressed={sel}
                className={cn("h-9 lg:h-7 px-3 lg:px-2.5 rounded-full text-sm lg:text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60", sel ? "bg-indigo-600 text-white" : "border border-slate-600 text-slate-300 hover:border-indigo-400 hover:text-white")}>
                {sel && <Check className="w-3 h-3" />}{t.name}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
