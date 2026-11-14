"use client";

/**
 * Music Library: the songs this studio suggests to clients.
 * A song is tagged with what it fits — the event (Holud, Wedding…) and the kind of video (Trailer, Full video…) —
 * from one list every studio shares, so "Holud · Trailer" means the same everywhere. A song without tags fits any part.
 * A video is in the library once: adding it again adds the new tags to the song that is already there.
 * Search finds a song by its name, artist, any tag or other name of a tag (haldi → Holud), or a pasted YouTube link.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, EyeOff, Flame, Loader2, Music2, Pencil, Play, Plus, Search, Trash2, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, PageHeader } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import {
  EMPTY_CATALOG, embedUrl, markMatch, searchSongs, tagName, youtubeIdOf,
  type LibrarySong, type MusicTag, type TagCatalog,
} from "@/lib/music";

const err = async (r: Response) => { const d = await r.json().catch(() => ({})); return (Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong"; };
const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

export default function MusicLibraryPage() {
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [cat, setCat] = useState<TagCatalog>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [event, setEvent] = useState("");
  const [video, setVideo] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  /** The add / edit drawer: a song to edit, or a link to start a new one with. */
  const [form, setForm] = useState<{ song?: LibrarySong; url?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([apiFetch(`${API}/music/songs`), apiFetch(`${API}/music/tags`)]);
      if (s.ok) setSongs(await s.json());
      if (t.ok) setCat({ ...EMPTY_CATALOG, ...(await t.json()) });
    } finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => { if (d) setEnabled(!!d.features?.musicSelection); }).catch(() => {});
  }, []);

  const found = useMemo(() => searchSongs(songs, q, cat).map(h => h.song), [songs, q, cat]);
  const shown = useMemo(() => found.filter(s => (!event || s.events.includes(event)) && (!video || s.videos.includes(video))), [found, event, video]);
  const usedEvents = cat.events.filter(t => songs.some(s => s.events.includes(t.id)));
  const usedVideos = cat.videos.filter(t => songs.some(s => s.videos.includes(t.id)));
  const pasted = youtubeIdOf(q);

  async function remove(s: LibrarySong) {
    if (!(await askConfirm({ title: "Remove this song?", message: s.title, confirmLabel: "Remove", danger: true }))) return;
    const r = await apiFetch(`${API}/music/songs/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't remove", { error: true }); return; }
    setSongs(p => p.filter(x => x.id !== s.id)); notify("Removed");
  }

  const chip = (on: boolean) => cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors flex-shrink-0",
    on ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]");

  return (
    <div>
      <PageHeader icon={Music2} color="orchid" title="Music Library" sub={`${songs.length} song${songs.length === 1 ? "" : "s"} — suggested to clients when they choose music`}>
        <button type="button" onClick={() => setForm({})} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 shadow-[0_10px_24px_-12px_rgba(125,92,239,.9)]">
          <Plus className="w-4 h-4" />Add song
        </button>
      </PageHeader>

      {enabled === false && (
        <div className="mb-5 rounded-[18px] bg-[#FBF2FA] p-4 flex items-center gap-3">
          <p className="flex-1 text-[14px] text-[#58244E]"><b>Music selection is turned off.</b> Turn it on to let clients choose songs from their portal.</p>
          <Link href="/settings?pane=features" className="h-10 px-4 rounded-full bg-[#9E3A8C] text-white text-[13px] font-semibold inline-flex items-center flex-shrink-0">Open Settings</Link>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6B6680] pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)} type="search" enterKeyHint="search" aria-label="Search songs"
          placeholder="Search a song, artist or tag — or paste a YouTube link"
          className={cn("w-full h-12 pl-11 pr-11 rounded-full bg-white text-[15px] text-[#17151F] outline-none border border-transparent focus:border-[#7D5CEF] placeholder:text-[#A29DB3] [&::-webkit-search-cancel-button]:hidden", CARD_SHADOW)} />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-[#F5F3FA] text-[#6B6680] flex items-center justify-center"><X className="w-4 h-4" /></button>}
      </div>

      {/* Filters: only tags that have songs */}
      {(usedEvents.length > 0 || usedVideos.length > 0) && (
        <div className="space-y-2 mb-4">
          {usedEvents.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Event">
              <button type="button" role="tab" aria-selected={!event} onClick={() => setEvent("")} className={chip(!event)}>All events</button>
              {usedEvents.map(t => { const n = found.filter(s => s.events.includes(t.id)).length; return (
                <button key={t.id} type="button" role="tab" aria-selected={event === t.id} onClick={() => setEvent(event === t.id ? "" : t.id)} className={chip(event === t.id)}>
                  {t.name}<span className={cn("text-[12px] tabular-nums", event === t.id ? "text-white/70" : "text-[#A29DB3]")}>{n}</span>
                </button>
              ); })}
            </div>
          )}
          {usedVideos.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Kind of video">
              <button type="button" role="tab" aria-selected={!video} onClick={() => setVideo("")} className={chip(!video)}>All videos</button>
              {usedVideos.map(t => { const n = found.filter(s => s.videos.includes(t.id) && (!event || s.events.includes(event))).length; return (
                <button key={t.id} type="button" role="tab" aria-selected={video === t.id} onClick={() => setVideo(video === t.id ? "" : t.id)} className={chip(video === t.id)}>
                  {t.name}<span className={cn("text-[12px] tabular-nums", video === t.id ? "text-white/70" : "text-[#A29DB3]")}>{n}</span>
                </button>
              ); })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className={cn("bg-white rounded-[22px] p-2.5", CARD_SHADOW)}><div className="sp-skel aspect-video rounded-[16px]" /><div className="sp-skel h-4 w-2/3 rounded-full mt-4 mx-1" /><div className="sp-skel h-3 w-1/3 rounded-full mt-2 mb-2 mx-1" /></div>)}</div>
      ) : songs.length === 0 ? (
        <EmptyState icon={Music2} title="No songs yet" text="Add the songs you like to use — for a Holud trailer, a wedding film, a reel. Clients see them as your suggestions when they choose music."
          action={<button type="button" onClick={() => setForm({})} className="mt-4 h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add your first song</button>} />
      ) : shown.length === 0 ? (
        <div className={cn("bg-white rounded-[22px] py-12 px-6 text-center", CARD_SHADOW)}>
          <span className="w-14 h-14 rounded-full bg-[#F5F3FA] flex items-center justify-center mx-auto"><Search className="w-6 h-6 text-[#A29DB3]" /></span>
          <p className="mt-4 text-base font-bold text-[#17151F]">{pasted ? "This song is not in your library" : "No song found"}</p>
          <p className="mt-1 text-[13.5px] text-[#6B6680]">{pasted ? "Add it with the tags it fits." : q ? `Nothing matches “${q.trim()}”${event || video ? " with these filters" : ""}.` : "No song has these tags yet."}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setForm(pasted ? { url: q.trim() } : {})} className="h-10 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />{pasted ? "Add this song" : "Add from YouTube"}</button>
            {(event || video) && <button type="button" onClick={() => { setEvent(""); setVideo(""); }} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold">Clear filters</button>}
          </div>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((s, i) => {
            const untagged = !s.events.length && !s.videos.length && !s.tags.length;
            return (
              <li key={s.id} className={cn("bg-white rounded-[22px] p-2.5 flex flex-col sp-pop-in", CARD_SHADOW)} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                <div className="relative aspect-video rounded-[16px] overflow-hidden bg-[#17151F]">
                  {playing === s.id ? (
                    <>
                      <iframe src={embedUrl(s.youtubeId)} title={s.title} allow="autoplay; encrypted-media" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
                      <button type="button" onClick={() => setPlaying(null)} aria-label="Close player" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPlaying(s.id)} aria-label={`Play ${s.title}`} className="group absolute inset-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.thumb} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"><Play className="w-5 h-5 text-[#17151F] ml-0.5" fill="currentColor" /></span>
                      {s.usedCount > 0 && <span className="absolute left-2 bottom-2 h-6 px-2 rounded-full bg-white/95 text-[#9E3A8C] text-[11.5px] font-bold inline-flex items-center gap-1"><Flame className="w-3 h-3" />chosen {s.usedCount}×</span>}
                      {!s.shared && <span className="absolute right-2 top-2 h-6 px-2 rounded-full bg-black/60 text-white text-[11px] font-semibold inline-flex items-center gap-1" title="Not shared with other studios"><EyeOff className="w-3 h-3" />Private</span>}
                    </button>
                  )}
                </div>
                <div className="px-1.5 pt-3 flex-1">
                  <p className="text-[14.5px] font-bold text-[#17151F] line-clamp-2 leading-snug">
                    {markMatch(s.title, q).map((m, k) => (m.hit ? <mark key={k} className="bg-[#EEE8FD] text-[#5B3FD0] rounded-[4px] px-0.5">{m.text}</mark> : <span key={k}>{m.text}</span>))}
                  </p>
                  {s.channel && <p className="text-[12.5px] text-[#6B6680] truncate mt-0.5">{s.channel}</p>}
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {s.events.map(id => <span key={id} className="h-6 px-2 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.events, id)}</span>)}
                    {s.videos.map(id => <span key={id} className="h-6 px-2 rounded-full bg-[#E6EEF8] text-[#1F5C99] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.videos, id)}</span>)}
                    {s.tags.map(t => <span key={t} className="h-6 px-2 rounded-full bg-[#F5F3FA] text-[#4A4658] text-[11.5px] font-semibold inline-flex items-center">{t}</span>)}
                    {s.language && <span className="h-6 px-2 rounded-full border border-[#E3DFEC] text-[#6B6680] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.languages, s.language)}</span>}
                    {s.moods.map(id => <span key={id} className="h-6 px-2 rounded-full border border-[#E3DFEC] text-[#6B6680] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.moods, id)}</span>)}
                    {untagged && <span className="h-6 px-2 rounded-full bg-[#F5F3FA] text-[#6B6680] text-[11.5px] font-semibold inline-flex items-center">Fits any part</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 px-0.5 pt-2.5 mt-2.5 border-t border-[#F1EFF6]">
                  <button type="button" onClick={() => setForm({ song: s })} className="h-9 px-3 rounded-full text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#F3EFFE] inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" />Edit tags</button>
                  <span className="flex-1" />
                  <a href={s.url} target="_blank" rel="noreferrer" aria-label="Open on YouTube" title="Open on YouTube" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]"><ExternalLink className="w-4 h-4" /></a>
                  <button type="button" onClick={() => remove(s)} aria-label={`Remove ${s.title}`} title="Remove" className="w-9 h-9 rounded-full flex items-center justify-center text-[#C2304F] hover:bg-[#FDECEF]"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && <SongDrawer cat={cat} songs={songs} song={form.song} url={form.url} onClose={() => setForm(null)}
        onSaved={(s, text) => { setSongs(p => (p.some(x => x.id === s.id) ? p.map(x => (x.id === s.id ? s : x)) : [s, ...p])); setCat(c => ({ ...c, own: [...new Set([...c.own, ...s.tags])].sort((a, b) => a.localeCompare(b)) })); notify(text); setForm(null); }} />}
    </div>
  );
}

/** Chips to pick tags from one list; tags that are not usual in the studio's country sit behind "More". */
function TagPicker({ list, value, onChange, single, label }: { list: MusicTag[]; value: string[]; onChange: (v: string[]) => void; single?: boolean; label: string }) {
  const [more, setMore] = useState(false);
  const shown = list.filter(t => more || !t.more || value.includes(t.id));
  const hidden = list.length - shown.length;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : single ? [id] : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {shown.map(t => { const on = value.includes(t.id); return (
        <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)}
          className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95", on ? "bg-[#7D5CEF] text-white shadow-[0_6px_14px_-8px_rgba(125,92,239,.9)]" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
          {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}{t.name}
        </button>
      ); })}
      {hidden > 0 && <button type="button" onClick={() => setMore(true)} className="h-9 px-3.5 rounded-full text-[13px] font-semibold text-[#5B3FD0] border border-dashed border-[#CFC8DD] hover:bg-[#F3EFFE]">More ({hidden})</button>}
    </div>
  );
}

function SongDrawer({ cat, songs, song, url: startUrl, onClose, onSaved }: {
  cat: TagCatalog; songs: LibrarySong[]; song?: LibrarySong; url?: string;
  onClose: () => void; onSaved: (s: LibrarySong, text: string) => void;
}) {
  const [url, setUrl] = useState(startUrl ?? "");
  const [info, setInfo] = useState<{ youtubeId: string; title: string; channel?: string } | null>(song ? { youtubeId: song.youtubeId, title: song.title, channel: song.channel } : null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState("");
  const [events, setEvents] = useState<string[]>(song?.events ?? []);
  const [videos, setVideos] = useState<string[]>(song?.videos ?? []);
  const [moods, setMoods] = useState<string[]>(song?.moods ?? []);
  const [language, setLanguage] = useState<string[]>(song?.language ? [song.language] : []);
  const [own, setOwn] = useState<string[]>(song?.tags ?? []);
  const [newOwn, setNewOwn] = useState("");
  const [altNames, setAltNames] = useState(song?.altNames ?? "");
  const [shared, setShared] = useState(song?.shared ?? true);
  const [saving, setSaving] = useState(false);

  // A pasted link is checked with YouTube a moment after typing stops.
  const id = song ? song.youtubeId : youtubeIdOf(url);
  useEffect(() => {
    if (song) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProblem("");
    if (!url.trim()) { setInfo(null); return; }
    if (!id) { setInfo(null); setProblem("That is not a YouTube link. Open the song on YouTube, tap Share, and paste the link here."); return; }
    let off = false;
    setChecking(true);
    const t = setTimeout(async () => {
      const r = await apiFetch(`${API}/music/lookup?url=${encodeURIComponent(url.trim())}`).catch(() => null);
      if (off) return;
      if (r?.ok) setInfo(await r.json()); else { setInfo(null); setProblem(r ? await err(r) : "Could not check the link — is the internet on?"); }
      setChecking(false);
    }, 450);
    return () => { off = true; clearTimeout(t); setChecking(false); };
  }, [url, id, song]);

  /** The same video already in the library (when adding). */
  const have = !song && id ? songs.find(s => s.youtubeId === id) : undefined;
  const allOwn = [...new Set([...cat.own, ...own])];
  function addOwn() {
    const t = newOwn.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!t) return;
    if (!own.some(x => x.toLowerCase() === t.toLowerCase())) setOwn(o => [...o, t]);
    setNewOwn("");
  }

  async function save() {
    if (!info) return;
    setSaving(true);
    try {
      const typed = newOwn.trim().replace(/\s+/g, " ").slice(0, 60);
      const tags = typed && !own.some(x => x.toLowerCase() === typed.toLowerCase()) ? [...own, typed] : own;
      const body = { events, videos, moods, language: language[0] ?? null, tags, altNames: altNames.trim() || null, shared };
      const r = song
        ? await apiFetch(`${API}/music/songs/${song.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await apiFetch(`${API}/music/songs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), ...body }) });
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      const d = await r.json();
      onSaved(d, song ? "Saved" : d.already ? (d.tagsAdded ? "Already in your library — the new tags were added to it" : "This song is already in your library") : "Song added");
    } finally { setSaving(false); }
  }

  return (
    <FormDrawer open onClose={onClose} icon={Music2} color="orchid" title={song ? "Edit song" : "Add a song"} sub={song ? "What does this song fit?" : "Paste a YouTube link, then tick what it fits"}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={!info || saving || checking}
            className="flex-1 h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-45">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{song ? "Save" : have ? "Add these tags to it" : "Add to my library"}
          </button>
        </>
      }>
      {!song && (
        <FormGroup title="The song">
          <Field label="YouTube link" required>
            {fid => <input id={fid} value={url} onChange={e => setUrl(e.target.value)} inputMode="url" autoFocus placeholder="https://youtube.com/watch?v=…" className={inputCls} />}
          </Field>
          {problem && <p className="text-[13px] text-[#C2304F]">{problem}</p>}
          {checking && !info && <p className="text-[13px] text-[#6B6680] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Checking with YouTube…</p>}
        </FormGroup>
      )}

      {info && (
        <div className={cn("bg-white rounded-[20px] p-3 mb-4 flex items-center gap-3 sp-fade-in", CARD_SHADOW)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbOf(info.youtubeId)} alt="" className="w-[104px] h-[60px] rounded-[12px] object-cover flex-shrink-0 bg-[#EEEBF4]" />
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[#17151F] line-clamp-2 leading-snug">{info.title}</p>
            {info.channel && <p className="text-[12.5px] text-[#6B6680] truncate">{info.channel}</p>}
          </div>
        </div>
      )}
      {have && (
        <div className="mb-4 rounded-[16px] bg-[#EEE8FD] px-4 py-3 text-[13.5px] text-[#3B2A8C] sp-fade-in">
          <b>This song is already in your library.</b> It will not be added twice — the tags you tick here are added to it.
          {(have.events.length > 0 || have.videos.length > 0) && <span className="block mt-1 text-[12.5px] text-[#5B3FD0]">Now: {[...have.events.map(e => tagName(cat.events, e)), ...have.videos.map(v => tagName(cat.videos, v))].join(", ")}</span>}
        </div>
      )}

      <FormGroup title="Which event?" note="Leave empty if it fits any event">
        <TagPicker list={cat.events} value={events} onChange={setEvents} label="Event" />
      </FormGroup>
      <FormGroup title="Which kind of video?" note="Leave empty if it fits any video">
        <TagPicker list={cat.videos} value={videos} onChange={setVideos} label="Kind of video" />
      </FormGroup>
      <FormGroup title="Mood and language" note="Optional — they help when searching">
        <TagPicker list={cat.moods} value={moods} onChange={setMoods} label="Mood" />
        <div className="h-px bg-[#F1EFF6] my-1" />
        <TagPicker list={cat.languages} value={language} onChange={setLanguage} single label="Language" />
      </FormGroup>
      <FormGroup title="Your own tags" note="Only for your studio — e.g. Bride entry, Cake cutting">
        {allOwn.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allOwn.map(t => { const on = own.includes(t); return (
              <button key={t} type="button" aria-pressed={on} onClick={() => setOwn(o => (on ? o.filter(x => x !== t) : [...o, t]))}
                className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>{on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}{t}</button>
            ); })}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newOwn} onChange={e => setNewOwn(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOwn(); } }} maxLength={60} placeholder="New tag of your own" aria-label="New tag of your own" className={inputCls} />
          <button type="button" onClick={addOwn} disabled={!newOwn.trim()} className="h-11 px-4 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"><Plus className="w-4 h-4" />Add</button>
        </div>
      </FormGroup>
      <FormGroup title="More">
        <Field label="Other names (optional)" hint="Words people may search this song by — another spelling, the name in your language">
          {fid => <input id={fid} value={altNames} onChange={e => setAltNames(e.target.value)} maxLength={255} placeholder="e.g. কেশরিয়া, kesaria" className={inputCls} />}
        </Field>
        <SwitchRow label="Share with other studios" hint="Only the song and its tags are shared — never your studio's name or anything about your clients" on={shared} onChange={setShared} />
      </FormGroup>
    </FormDrawer>
  );
}
