"use client";
/**
 * Super Admin → Music → listening: the playing song's tags, laid out like the Music Library filters.
 * One row per kind (Event, Video, Mood, Language). A tag the song has is filled; tap any tag to put it on or take
 * it off. The parts of a wedding (Holud parts, Sanatani rituals…) open under their wedding once it is on.
 * Each tap saves at once.
 */
import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; parent?: string | null; hidden?: boolean };
export type SongTagValues = { events: string[]; videos: string[]; moods: string[]; language: string | null };
type Lists = { EVENTS: Tag[]; VIDEOS: Tag[]; MOODS: Tag[]; LANGS: Tag[] };

const chip = (on: boolean) => cn(
  "h-10 lg:h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 border transition-colors disabled:opacity-60",
  on ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-white");
const subChip = (on: boolean) => cn(
  "h-9 lg:h-8 px-3 rounded-full text-[12.5px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 border transition-colors disabled:opacity-60",
  on ? "bg-white border-white text-slate-900" : "bg-transparent border-slate-600 text-slate-300 hover:border-indigo-400 hover:text-white");
const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name);

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[72px_1fr] gap-1.5 lg:gap-3 items-start">
      <p className="text-xs font-semibold text-slate-400 lg:pt-2.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

export function SongTags({ value, lists, onChange, busy }: {
  value: SongTagValues; lists: Lists; busy: boolean;
  /** Save a change (only the part that changed). */
  onChange: (patch: Partial<SongTagValues>) => void;
}) {
  const [q, setQ] = useState("");
  const k = q.trim().toLowerCase();
  const events = useMemo(() => lists.EVENTS.filter(t => !t.hidden), [lists.EVENTS]);
  const top = events.filter(t => !t.parent).sort(byName);
  const kids = (id: string) => events.filter(t => t.parent === id).sort(byName);
  const parentName = (id?: string | null) => events.find(t => t.id === id)?.name ?? "";
  const has = (key: "events" | "videos" | "moods", id: string) => value[key].includes(id);
  const toggle = (key: "events" | "videos" | "moods", id: string) => {
    const on = value[key];
    if (on.includes(id)) {
      // Taking a wedding off takes its parts off too.
      const drop = new Set([id, ...(key === "events" ? kids(id).map(c => c.id) : [])]);
      onChange({ [key]: on.filter(x => !drop.has(x)) });
    } else {
      const parent = key === "events" ? events.find(t => t.id === id)?.parent : null;
      onChange({ [key]: [...new Set([...on, ...(parent ? [parent] : []), id])] });
    }
  };

  // Searching: every matching tag in one row, with its wedding's name.
  const found = k ? [
    ...events.filter(t => `${t.name} ${parentName(t.parent)}`.toLowerCase().includes(k)).map(t => ({ key: "events" as const, t })),
    ...lists.VIDEOS.filter(t => !t.hidden && t.name.toLowerCase().includes(k)).map(t => ({ key: "videos" as const, t })),
    ...lists.MOODS.filter(t => !t.hidden && t.name.toLowerCase().includes(k)).map(t => ({ key: "moods" as const, t })),
  ] : [];

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white flex-1">Tags of this song <span className="text-xs font-normal text-slate-400">— tap to put on or take off</span></p>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-indigo-300" aria-label="Saving" />}
        <div className="relative w-40 lg:w-48">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a tag" aria-label="Find a tag"
            className="w-full h-9 rounded-full bg-slate-900 border border-slate-600 pl-8 pr-3 text-sm lg:text-xs text-white placeholder:text-slate-500" />
        </div>
      </div>

      {k ? (
        <Row title="Found">
          {found.length === 0 && <span className="text-xs text-slate-400 pt-2">No tag with that name.</span>}
          {found.map(({ key, t }) => {
            const on = has(key, t.id);
            return (
              <button key={`${key}:${t.id}`} type="button" disabled={busy} onClick={() => toggle(key, t.id)} aria-pressed={on} className={chip(on)}>
                {on && <Check className="w-3.5 h-3.5" />}{t.name}{t.parent && <span className={on ? "text-indigo-200" : "text-slate-500"}>· {parentName(t.parent)}</span>}
              </button>
            );
          })}
        </Row>
      ) : (
        <>
          <Row title="Event">
            {top.map(t => {
              const on = has("events", t.id);
              const n = kids(t.id).filter(c => has("events", c.id)).length;
              return (
                <button key={t.id} type="button" disabled={busy} onClick={() => toggle("events", t.id)} aria-pressed={on} className={chip(on)}>
                  {on && <Check className="w-3.5 h-3.5" />}{t.name}{n > 0 && <span className="text-[11px] bg-white/20 rounded-full px-1.5">{n}</span>}
                </button>
              );
            })}
          </Row>
          {/* The parts of each wedding the song is in, the way the Music Library shows them. */}
          {top.filter(t => has("events", t.id) && kids(t.id).length > 0).map(t => (
            <div key={t.id} className="lg:ml-[84px] rounded-2xl bg-indigo-500/10 border border-indigo-400/25 p-2.5">
              <p className="text-xs font-semibold text-indigo-200 mb-1.5">{t.name} — parts</p>
              <div className="flex flex-wrap gap-1.5">
                {kids(t.id).map(c => {
                  const on = has("events", c.id);
                  return (
                    <button key={c.id} type="button" disabled={busy} onClick={() => toggle("events", c.id)} aria-pressed={on} className={subChip(on)}>
                      {on && <Check className="w-3.5 h-3.5" />}{c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Row title="Video">
            {lists.VIDEOS.filter(t => !t.hidden).map(t => {
              const on = has("videos", t.id);
              return <button key={t.id} type="button" disabled={busy} onClick={() => toggle("videos", t.id)} aria-pressed={on} className={chip(on)}>{on && <Check className="w-3.5 h-3.5" />}{t.name}</button>;
            })}
          </Row>
          <Row title="Mood">
            {lists.MOODS.filter(t => !t.hidden).sort(byName).map(t => {
              const on = has("moods", t.id);
              return <button key={t.id} type="button" disabled={busy} onClick={() => toggle("moods", t.id)} aria-pressed={on} className={chip(on)}>{on && <Check className="w-3.5 h-3.5" />}{t.name}</button>;
            })}
          </Row>
          <Row title="Language">
            {lists.LANGS.filter(t => !t.hidden).sort(byName).map(t => {
              const on = value.language === t.id;
              return <button key={t.id} type="button" disabled={busy} onClick={() => onChange({ language: on ? null : t.id })} aria-pressed={on} className={chip(on)}>{on && <Check className="w-3.5 h-3.5" />}{t.name}</button>;
            })}
          </Row>
        </>
      )}
    </div>
  );
}
