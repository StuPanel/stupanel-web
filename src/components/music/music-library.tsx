"use client";

/**
 * Music Library: the songs this studio suggests to clients.
 * A song is tagged with what it fits — the event (Holud, Wedding…) and the kind of video (Trailer, Full video…) —
 * from one list every studio shares, so "Holud · Trailer" means the same everywhere. A song without tags fits any part.
 * A video is in the library once: adding it again adds the new tags to the song that is already there.
 * Tabs: My songs, StuPanel picks, Popular in studios (own country or worldwide; no studio is named) and From my clients —
 * each can be turned off in Settings → Music. A song from outside is added to My songs with one press.
 * Search finds a song by its name, artist, any tag or other name of a tag (haldi → Holud), or a pasted YouTube link.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Check, Copy, ExternalLink, EyeOff, Flame, Globe2, Heart, Grid2x2, LayoutGrid, Loader2, Mic2, Minus, Music2, Pencil, Piano, Play, Plus, Search, Settings2, SlidersHorizontal, Sparkles, Square, Trash2, Users, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, PageHeader } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import {
  EMPTY_CATALOG, embedUrl, markMatch, searchSongs, tagName, youtubeIdOf,
  type LibrarySong, type MusicTag, type OutsideMusic, type OutsideSong, type TagCatalog,
} from "@/lib/music";

const err = async (r: Response) => { const d = await r.json().catch(() => ({})); return (Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong"; };
const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** The studio's Music Library. `member`: a video editor in the member panel — same library, no studio settings links. */
export function MusicLibrary({ member = false }: { member?: boolean }) {
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [cat, setCat] = useState<TagCatalog>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [event, setEvent] = useState("");
  const [video, setVideo] = useState("");
  /** With singing, or music only (kept as the language "Instrumental"). */
  const [sound, setSound] = useState<"" | "song" | "instrumental">("");
  /** A ritual under the chosen event (only events that have them, like Sanatani wedding). */
  const [ritual, setRitual] = useState("");
  /** Phones: the filters wait behind one button, and open as a sheet. */
  const [sheet, setSheet] = useState(false);
  /** Phones: one song in a row (the usual) or two small ones; kept on this device. */
  const [mcols, setMcols] = useState<1 | 2>(() => { try { return localStorage.getItem("sp-music-cols-m") === "2" ? 2 : 1; } catch { return 1; } });
  const pickMcols = (n: 1 | 2) => { setMcols(n); try { if (n === 2) localStorage.setItem("sp-music-cols-m", "2"); else localStorage.removeItem("sp-music-cols-m"); } catch { /* private window */ } };
  /** Songs in one row on a wide screen: 0 = the usual three; the studio's choice is kept on this device. */
  const [cols, setCols] = useState(() => { try { const n = Number(localStorage.getItem("sp-music-cols")); return n >= 2 && n <= 6 ? n : 0; } catch { return 0; } });
  const pickCols = (n: number) => { setCols(n); try { if (n) localStorage.setItem("sp-music-cols", String(n)); else localStorage.removeItem("sp-music-cols"); } catch { /* private window */ } };
  const [playing, setPlaying] = useState<string | null>(null);
  /** The add / edit drawer: a song to edit, or a link to start a new one with. */
  const [form, setForm] = useState<{ song?: LibrarySong; url?: string; from?: OutsideSong } | null>(null);
  /** Songs from outside the studio's library (StuPanel picks, other studios, its clients). */
  const [out, setOut] = useState<OutsideMusic | null>(null);
  const [tab, setTab] = useState<"mine" | "favs" | "picks" | "community" | "clients">("mine");
  /** The studio's favourite songs (starred from any list), newest first. */
  const [favs, setFavs] = useState<{ youtubeId: string; title: string; channel: string | null; thumb: string; url: string }[]>([]);
  const [world, setWorld] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t, o, f] = await Promise.all([apiFetch(`${API}/music/songs`), apiFetch(`${API}/music/tags`), apiFetch(`${API}/music/outside`).catch(() => null), apiFetch(`${API}/music/favorites`).catch(() => null)]);
      if (f?.ok) setFavs((await f.json()).favorites ?? []);
      if (s.ok) setSongs(await s.json());
      if (t.ok) setCat({ ...EMPTY_CATALOG, ...(await t.json()) });
      if (o?.ok) setOut(await o.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => { if (d) setEnabled(!!d.features?.musicSelection); }).catch(() => {});
  }, []);

  // One search over all four lists; each tab shows how many it found.
  const lists = useMemo(() => {
    const mineIds = new Set(songs.map(s => s.youtubeId));
    const live = (l: OutsideSong[]) => l.map(s => ({ ...s, mine: mineIds.has(s.youtubeId) }));
    // Favourites: the richest copy of each starred song (own library first), else the saved name.
    const all = new Map<string, LibrarySong | OutsideSong>();
    for (const l of [live(out?.fromClients ?? []), live(out?.community.world ?? []), live(out?.community.country ?? []), live(out?.picks ?? []), songs as (LibrarySong | OutsideSong)[]]) for (const x of l) all.set(x.youtubeId, x);
    const favList = favs.map(f => all.get(f.youtubeId) ?? ({ youtubeId: f.youtubeId, title: f.title, channel: f.channel ?? undefined, thumb: f.thumb, url: f.url, events: [], videos: [], moods: [], language: null, mine: mineIds.has(f.youtubeId) } as OutsideSong));
    return {
      favs: favList as (LibrarySong | OutsideSong)[],
      mine: songs as (LibrarySong | OutsideSong)[],
      picks: live(out?.picks ?? []) as (LibrarySong | OutsideSong)[],
      community: live((world ? out?.community.world : out?.community.country) ?? []) as (LibrarySong | OutsideSong)[],
      clients: live(out?.fromClients ?? []).filter(s => !s.mine) as (LibrarySong | OutsideSong)[],
    };
  }, [songs, out, world, favs]);
  const foundIn = useMemo(() => ({
    mine: searchSongs(lists.mine, q, cat).map(h => h.song), favs: searchSongs(lists.favs, q, cat).map(h => h.song), picks: searchSongs(lists.picks, q, cat).map(h => h.song),
    community: searchSongs(lists.community, q, cat).map(h => h.song), clients: searchSongs(lists.clients, q, cat).map(h => h.song),
  }), [lists, q, cat]);
  const source = lists[tab];
  const found = foundIn[tab];
  const isInst = (s: { language?: string | null }) => s.language === "instrumental";
  /** What the Event and Video rows leave, before the Sound row: its chips count from this. */
  const beforeSound = useMemo(() => found.filter(s => (!event || s.events.includes(event)) && (!ritual || s.events.includes(ritual)) && (!video || s.videos.includes(video))), [found, event, ritual, video]);
  const shown = useMemo(() => beforeSound.filter(s => !sound || (sound === "instrumental") === isInst(s)), [beforeSound, sound]);
  // Events on the top row: the ones that stand on their own and have songs. An event with rituals under it is always there.
  const usedEvents = cat.events.filter(t => !t.parent && (source.some(s => s.events.includes(t.id)) || cat.events.some(c => c.parent === t.id)));
  // The events usual in the studio's country come first; the rest wait behind "More events" (the chosen one always shows).
  /** StuPanel can switch instrumental music off for everyone (admin → Music → Tags): then nothing here asks about it. */
  const hasInst = cat.languages.some(l => l.id === "instrumental");
  const rituals = event ? cat.events.filter(t => t.parent === event) : [];
  const eventName = cat.events.find(t => t.id === event)?.name ?? "";
  const filtering = !!(event || ritual || video || sound);
  const usedVideos = cat.videos.filter(t => source.some(s => s.videos.includes(t.id)));
  const pasted = youtubeIdOf(q);
  const tabs = [
    { id: "mine" as const, label: "My songs", icon: Music2, on: true },
    { id: "favs" as const, label: "Favourites", icon: Heart, on: true },
    { id: "picks" as const, label: "StuPanel picks", icon: Sparkles, on: !!out && out.settings.picks !== "off" },
    { id: "community" as const, label: "Popular in studios", icon: Building2, on: !!out && out.settings.community !== "off" },
    { id: "clients" as const, label: "From my clients", icon: Users, on: !!out && out.settings.fromClients !== "off" },
  ].filter(t => t.on);

  const favIds = useMemo(() => new Set(favs.map(f => f.youtubeId)), [favs]);
  /** Star / unstar a song (any list). */
  async function toggleFav(s: LibrarySong | OutsideSong) {
    const on = !favIds.has(s.youtubeId);
    const r = await apiFetch(`${API}/music/favorite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ youtubeId: s.youtubeId, title: s.title, channel: s.channel ?? null, on }) }).catch(() => null);
    if (!r?.ok) { notify("Couldn't save", { error: true }); return; }
    setFavs((await r.json()).favorites ?? []);
    notify(on ? "Added to Favourites" : "Taken out of Favourites");
  }
  /** The YouTube link on the clipboard in one tap. */
  async function copyLink(s: LibrarySong | OutsideSong) {
    try { await navigator.clipboard.writeText(s.url); notify("Link copied"); }
    catch { notify("Couldn't copy", { error: true }); }
  }

  /** Never show this outside song to this studio again. */
  async function hide(s: OutsideSong) {
    const r = await apiFetch(`${API}/music/hide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ youtubeId: s.youtubeId, hidden: true }) }).catch(() => null);
    if (!r?.ok) { notify("Couldn't hide", { error: true }); return; }
    const drop = (l: OutsideSong[]) => l.filter(x => x.youtubeId !== s.youtubeId);
    setOut(o => (o ? { ...o, picks: drop(o.picks), fromClients: drop(o.fromClients), community: { country: drop(o.community.country), world: drop(o.community.world) } } : o));
    notify(member ? "Hidden for the studio — the studio can bring it back in Settings → Music" : "Hidden — you can bring hidden songs back in Settings → Music");
  }

  async function remove(s: LibrarySong) {
    if (!(await askConfirm({ title: "Remove this song?", message: s.title, confirmLabel: "Remove", danger: true }))) return;
    const r = await apiFetch(`${API}/music/songs/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't remove", { error: true }); return; }
    setSongs(p => p.filter(x => x.id !== s.id)); notify("Removed");
  }

  // Filter chips: white with a clear edge and dark text, so they read on any backdrop; the chosen one is solid violet.
  const chip = (on: boolean) => cn("h-10 px-3.5 rounded-full text-[13.5px] font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-colors flex-shrink-0 border focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
    on ? "bg-[#7D5CEF] border-[#7D5CEF] text-white shadow-[0_8px_18px_-10px_rgba(125,92,239,.9)]" : "bg-white border-[#DDD8E8] text-[#17151F] hover:border-[#7D5CEF] hover:bg-[#F6F2FF]");
  const subChip = (on: boolean) => cn("h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors border focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
    on ? "bg-[#17151F] border-[#17151F] text-white" : "bg-white border-[#DDD8E8] text-[#17151F] hover:border-[#7D5CEF]");
  /** The small number in a chip. */
  const count = (n: number, on: boolean) => <span className={cn("min-w-[22px] h-[20px] px-1.5 rounded-full text-[11.5px] font-bold tabular-nums inline-flex items-center justify-center", on ? "bg-white/25 text-white" : n ? "bg-[#EEE8FD] text-[#4B32B8]" : "bg-[#F1EFF6] text-[#6B6680]")}>{n}</span>;
  /** How many filters are on (the number on the phone's Filters button). */
  const active = [event, ritual, video, sound].filter(Boolean).length;
  const hasRows = usedEvents.length > 0 || usedVideos.length > 0 || (hasInst && source.length > 0);
  const clearAll = () => { setEvent(""); setRitual(""); setVideo(""); setSound(""); };
  /** Event, Video and Sound. On a wide screen each stays on one line; in the phone's sheet each shows a few and the rest behind More. */
  const filterRows = (inSheet: boolean) => (
    <div className={inSheet ? "space-y-5" : "space-y-2.5"}>
      {usedEvents.length > 0 && (
        <div>
          <ChipRow label="Event" aria="Event" stacked={inSheet} limit={inSheet ? 7 : undefined} chipCls={chip} allOn={!event} onAll={() => { setEvent(""); setRitual(""); }}
            items={usedEvents.map(t => { const on = event === t.id; return { id: t.id, on, onPick: () => { setEvent(on ? "" : t.id); setRitual(""); }, node: <>{t.name}{count(found.filter(s => s.events.includes(t.id)).length, on)}</> }; })} />
          {/* The rituals of the chosen event (a Sanatani wedding): shown under it, a step in */}
          {rituals.length > 0 && (
            <div className={cn("rounded-[16px] bg-[#F3EEFF] border border-[#DDD3FA] p-2.5 mt-2", !inSheet && "sm:ml-[68px]")}>
              <p className="text-xs font-bold text-[#4B32B8] px-1 mb-1.5">{eventName}: which ritual?</p>
              <div className="flex gap-1.5 flex-wrap" role="group" aria-label={`Rituals of ${eventName}`}>
                <button type="button" aria-pressed={!ritual} onClick={() => setRitual("")} className={subChip(!ritual)}>All rituals</button>
                {rituals.map(t => { const n = found.filter(s => s.events.includes(t.id)).length; const on = ritual === t.id; return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => setRitual(on ? "" : t.id)} className={subChip(on)}>
                    {t.name}{count(n, on)}
                  </button>
                ); })}
              </div>
            </div>
          )}
        </div>
      )}
      {usedVideos.length > 0 && (
        <ChipRow label="Video" aria="Kind of video" stacked={inSheet} limit={inSheet ? 7 : undefined} chipCls={chip} allOn={!video} onAll={() => setVideo("")}
          items={usedVideos.map(t => { const on = video === t.id; return { id: t.id, on, onPick: () => setVideo(on ? "" : t.id), node: <>{t.name}{count(found.filter(s => s.videos.includes(t.id) && (!event || s.events.includes(event)) && (!ritual || s.events.includes(ritual))).length, on)}</> }; })} />
      )}
      {hasInst && source.length > 0 && (
        <ChipRow label="Sound" aria="With singing or music only" stacked={inSheet} limit={inSheet ? 7 : undefined} chipCls={chip} allOn={!sound} onAll={() => setSound("")}
          items={[
            { id: "song", on: sound === "song", onPick: () => setSound(sound === "song" ? "" : "song"), node: <><Mic2 className="w-4 h-4" aria-hidden />With singing{count(beforeSound.filter(s => !isInst(s)).length, sound === "song")}</> },
            { id: "instrumental", on: sound === "instrumental", onPick: () => setSound(sound === "instrumental" ? "" : "instrumental"), node: <><Piano className="w-4 h-4" aria-hidden />Instrumental{count(beforeSound.filter(isInst).length, sound === "instrumental")}</> },
          ]} />
      )}
    </div>
  );
  // The studio's own count of songs in a row applies on wide screens; phones and tablets keep one and two.
  const m2 = mcols === 2;
  const gridCls = cn("grid sm:grid-cols-2 gap-4", m2 ? "grid-cols-2 max-sm:gap-2.5" : "grid-cols-1", cols ? "lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" : "xl:grid-cols-3", cols >= 5 && "lg:gap-3");
  const gridStyle = cols ? ({ ["--cols" as string]: cols } as React.CSSProperties) : undefined;
  /** Many small cards: the tags are left out so the title and the buttons still fit. */
  const small = cols >= 5;

  return (
    <div>
      <PageHeader icon={Music2} color="orchid" title="Music Library" sub={`${songs.length} song${songs.length === 1 ? "" : "s"} — suggested to clients when they choose music`}>
        <button type="button" onClick={() => setForm({})} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 shadow-[0_10px_24px_-12px_rgba(125,92,239,.9)]">
          <Plus className="w-4 h-4" />Add song
        </button>
      </PageHeader>

      {enabled === false && !member && (
        <div className="mb-5 rounded-[18px] bg-[#FBF2FA] p-4 flex items-center gap-3">
          <p className="flex-1 text-[14px] text-[#58244E]"><b>Music selection is turned off.</b> Turn it on to let clients choose songs from their portal.</p>
          <Link href="/settings?pane=features" className="h-10 px-4 rounded-full bg-[#9E3A8C] text-white text-[13px] font-semibold inline-flex items-center flex-shrink-0">Open Settings</Link>
        </div>
      )}

      {/* Where the songs come from */}
      {tabs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-3 [scrollbar-width:none]" role="tablist" aria-label="Songs from">
          {tabs.map(t => { const on = tab === t.id; const n = (q ? foundIn : lists)[t.id].length; return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => { setTab(t.id); setEvent(""); setVideo(""); setSound(""); setPlaying(null); }}
              className={cn("h-11 pl-3.5 pr-4 rounded-full text-[13.5px] font-bold whitespace-nowrap inline-flex items-center gap-2 transition-all flex-shrink-0",
                on ? "bg-[#7D5CEF] text-white shadow-[0_10px_22px_-12px_rgba(125,92,239,.9)]" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]")}>
              <t.icon className="w-4 h-4" />{t.label}
              <span className={cn("h-5 min-w-5 px-1.5 rounded-full text-[11.5px] font-bold inline-flex items-center justify-center tabular-nums", on ? "bg-white/25" : q && n ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-[#F5F3FA] text-[#6B6680]")}>{n}</span>
            </button>
          ); })}
          {!member && <Link href="/settings?pane=music" aria-label="Music settings" title="Choose which lists you and your clients see"
            className="ml-auto h-11 w-11 rounded-full bg-white text-[#6B6680] hover:bg-[#F5F3FA] inline-flex items-center justify-center flex-shrink-0"><Settings2 className="w-4 h-4" /></Link>}
        </div>
      )}
      {tab !== "mine" && tab !== "favs" && (
        <div className="mb-3 rounded-[16px] bg-white/70 px-4 py-2.5 flex items-center gap-3 flex-wrap text-[13px] text-[#4A4658]">
          <p className="flex-1 min-w-[200px]">
            {tab === "picks" ? "Songs chosen by StuPanel. Add the ones you like to My songs."
              : tab === "community" ? "What other studios use, most used first. No studio is named, and nothing about clients is shared."
              : "Songs your clients brought themselves when they chose music. Add the good ones — the tags are already ticked."}
          </p>
          {tab === "community" && (
            <div className="inline-flex p-1 rounded-full bg-[#F5F3FA]" role="radiogroup" aria-label="Which studios">
              <button type="button" role="radio" aria-checked={!world} onClick={() => setWorld(false)} className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold", !world ? "bg-[#17151F] text-white" : "text-[#4A4658]")}>My country</button>
              <button type="button" role="radio" aria-checked={world} onClick={() => setWorld(true)} className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold inline-flex items-center gap-1", world ? "bg-[#17151F] text-white" : "text-[#4A4658]")}><Globe2 className="w-3.5 h-3.5" />Worldwide</button>
            </div>
          )}
        </div>
      )}

      {/* Find: search, then what the songs are for. One panel, so it reads as one tool. */}
      <section aria-label="Find songs" className="bg-white rounded-[22px] p-3 sm:p-4 mb-4 flex flex-col gap-3.5 border border-[#E6E1F0] shadow-[0_10px_28px_-18px_rgba(40,28,96,.35)]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6B6680] pointer-events-none" />
            <input value={q} onChange={e => setQ(e.target.value)} type="search" enterKeyHint="search" aria-label="Search songs"
              placeholder="Search a song, artist or tag, or paste a YouTube link"
              className="w-full h-12 pl-11 pr-11 rounded-full bg-white text-[15px] text-[#17151F] outline-none border border-[#DDD8E8] focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/15 placeholder:text-[#6B6680] [&::-webkit-search-cancel-button]:hidden" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-white text-[#6B6680] flex items-center justify-center"><X className="w-4 h-4" /></button>}
          </div>
          {/* How many songs sit in one row (wide screens). The usual is three. */}
          <div role="group" aria-label="Songs in a row" className="hidden lg:flex items-center gap-1 h-12 px-1.5 rounded-full bg-white border border-[#DDD8E8] flex-shrink-0">
            <button type="button" aria-label="Bigger cards" title="Bigger cards" disabled={(cols || 3) <= 2} onClick={() => pickCols((cols || 3) - 1)} className="w-9 h-9 rounded-full bg-[#F1EFF6] hover:bg-[#EEE8FD] text-[#17151F] flex items-center justify-center disabled:opacity-40"><Minus className="w-4 h-4" /></button>
            <span className="px-1.5 text-[13px] font-semibold text-[#17151F] tabular-nums whitespace-nowrap inline-flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-[#6B6680]" />{cols || 3} in a row</span>
            <button type="button" aria-label="Smaller cards" title="Smaller cards" disabled={(cols || 3) >= 6} onClick={() => pickCols((cols || 3) + 1)} className="w-9 h-9 rounded-full bg-[#F1EFF6] hover:bg-[#EEE8FD] text-[#17151F] flex items-center justify-center disabled:opacity-40"><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Phones: one button for the filters, and one or two songs in a row */}
        <div className="flex items-center gap-2 sm:hidden">
          <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" className={cn("flex-1 h-11 rounded-full border text-[14px] font-semibold inline-flex items-center justify-center gap-2", active ? "bg-[#F3EEFF] border-[#B9ADEB] text-[#4B32B8]" : "bg-white border-[#DDD8E8] text-[#17151F]")}>
            <SlidersHorizontal className="w-4 h-4" aria-hidden />Filters{active > 0 && <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#7D5CEF] text-white text-[12px] font-bold tabular-nums inline-flex items-center justify-center">{active}</span>}
          </button>
          <div role="group" aria-label="Songs in a row" className="flex items-center gap-0.5 h-11 px-1 rounded-full bg-white border border-[#DDD8E8] flex-shrink-0">
            <button type="button" aria-pressed={!m2} aria-label="One song in a row" onClick={() => pickMcols(1)} className={cn("w-9 h-9 rounded-full flex items-center justify-center", !m2 ? "bg-[#7D5CEF] text-white" : "text-[#4A4658]")}><Square className="w-4 h-4" /></button>
            <button type="button" aria-pressed={m2} aria-label="Two songs in a row" onClick={() => pickMcols(2)} className={cn("w-9 h-9 rounded-full flex items-center justify-center", m2 ? "bg-[#7D5CEF] text-white" : "text-[#4A4658]")}><Grid2x2 className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Wider screens: the filters sit here, each on one line */}
        {hasRows && <div className="hidden sm:block">{filterRows(false)}</div>}

        {(filtering || q) && !loading && (
          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#F1EFF6]">
            <p className="text-[13px] text-[#4A4658]" role="status"><b className="text-[#17151F] tabular-nums">{shown.length}</b> song{shown.length === 1 ? "" : "s"}{filtering ? ` for ${[eventName, cat.events.find(t => t.id === ritual)?.name, cat.videos.find(t => t.id === video)?.name, sound === "instrumental" ? "Instrumental" : sound === "song" ? "With singing" : ""].filter(Boolean).join(" · ")}` : ""}</p>
            {filtering && <button type="button" onClick={() => { setEvent(""); setRitual(""); setVideo(""); setSound(""); }} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 flex-shrink-0"><X className="w-3.5 h-3.5" />Clear filters</button>}
          </div>
        )}
      </section>

      {loading ? (
        <div className={gridCls} style={gridStyle}>{[0, 1, 2].map(i => <div key={i} className={cn("bg-white rounded-[22px] p-2.5", CARD_SHADOW)}><div className="sp-skel aspect-video rounded-[16px]" /><div className="sp-skel h-4 w-2/3 rounded-full mt-4 mx-1" /><div className="sp-skel h-3 w-1/3 rounded-full mt-2 mb-2 mx-1" /></div>)}</div>
      ) : tab === "favs" && source.length === 0 ? (
        <EmptyState icon={Heart} title="No favourites yet" text="Tap ♥ on any song — in My songs, StuPanel picks or the other lists — and it shows here." />
      ) : tab !== "mine" && source.length === 0 ? (
        <EmptyState icon={tab === "picks" ? Sparkles : tab === "community" ? Building2 : Users}
          title={tab === "picks" ? "No StuPanel picks yet" : tab === "community" ? (world ? "Nothing here yet" : "Nothing from your country yet") : "Nothing from your clients yet"}
          text={tab === "picks" ? "StuPanel will add songs here for every kind of video."
            : tab === "community" ? (world ? "A song shows here when two studios use it, or clients have chosen it a few times." : "A song shows here when two studios in your country use it. Try Worldwide.")
            : "When a client pastes their own YouTube link while choosing music, the song shows here."} />
      ) : songs.length === 0 && tab === "mine" ? (
        <EmptyState icon={Music2} title="No songs yet" text="Add the songs you like to use — for a Holud trailer, a wedding film, a reel. Clients see them as your suggestions when they choose music."
          action={<button type="button" onClick={() => setForm({})} className="mt-4 h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add your first song</button>} />
      ) : shown.length === 0 ? (
        <div className={cn("bg-white rounded-[22px] py-12 px-6 text-center", CARD_SHADOW)}>
          <span className="w-14 h-14 rounded-full bg-[#F5F3FA] flex items-center justify-center mx-auto"><Search className="w-6 h-6 text-[#A29DB3]" /></span>
          <p className="mt-4 text-base font-bold text-[#17151F]">{pasted ? (tab === "mine" ? "This song is not in your library" : "This song is not in this list") : "No song found"}</p>
          <p className="mt-1 text-[13.5px] text-[#6B6680]">{pasted ? "Add it with the tags it fits." : q ? `Nothing matches “${q.trim()}”${event || video ? " with these filters" : ""}.` : "No song has these tags yet."}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setForm(pasted ? { url: q.trim() } : {})} className="h-10 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />{pasted ? "Add this song" : "Add from YouTube"}</button>
            {(event || video || sound) && <button type="button" onClick={() => { setEvent(""); setVideo(""); setSound(""); }} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold">Clear filters</button>}
          </div>
        </div>
      ) : (
        <ul className={gridCls} style={gridStyle}>
          {shown.map((s, i) => {
            const lib = "id" in s ? (s as LibrarySong) : null;
            const o = lib ? null : (s as OutsideSong);
            const ownTags = lib?.tags ?? [];
            const key = lib?.id ?? s.youtubeId;
            const untagged = !s.events.length && !s.videos.length && !ownTags.length;
            return (
              <li key={key} className={cn("bg-white rounded-[22px] p-2.5 flex flex-col min-w-0 sp-pop-in", m2 && "max-sm:rounded-[18px] max-sm:p-2", CARD_SHADOW)} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                <div className="relative aspect-video rounded-[16px] overflow-hidden bg-[#17151F]">
                  {playing === key ? (
                    <>
                      <iframe src={embedUrl(s.youtubeId)} title={s.title} allow="autoplay; encrypted-media" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
                      <button type="button" onClick={() => setPlaying(null)} aria-label="Close player" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPlaying(key)} aria-label={`Play ${s.title}`} className="group absolute inset-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.thumb} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"><Play className="w-5 h-5 text-[#17151F] ml-0.5" fill="currentColor" /></span>
                      {lib && lib.usedCount > 0 && <span className="absolute left-2 bottom-2 h-6 px-2 rounded-full bg-white/95 text-[#9E3A8C] text-[11.5px] font-bold inline-flex items-center gap-1"><Flame className="w-3 h-3" />chosen {lib.usedCount}×</span>}
                      {o && (o.studios || o.times) && (
                        <span className="absolute left-2 bottom-2 h-6 px-2 rounded-full bg-white/95 text-[#17151F] text-[11.5px] font-bold inline-flex items-center gap-1">
                          {o.studios ? <><Building2 className="w-3 h-3 text-[#5B3FD0]" />{o.studios} studio{o.studios === 1 ? "" : "s"}{o.chosen ? <span className="text-[#9E3A8C] inline-flex items-center gap-0.5 ml-1"><Flame className="w-3 h-3" />{o.chosen}×</span> : null}</>
                            : <><Users className="w-3 h-3 text-[#5B3FD0]" />{o.times} client{o.times === 1 ? "" : "s"}</>}
                        </span>
                      )}
                      {lib && !lib.shared && <span className="absolute right-2 top-2 h-6 px-2 rounded-full bg-black/60 text-white text-[11px] font-semibold inline-flex items-center gap-1" title="Not shared with other studios"><EyeOff className="w-3 h-3" />Private</span>}
                    </button>
                  )}
                </div>
                <div className="px-1.5 pt-3 flex-1">
                  <p className={cn("text-[14.5px] font-bold text-[#17151F] line-clamp-2 leading-snug [overflow-wrap:anywhere]", m2 && "max-sm:text-[13px]")}>
                    {markMatch(s.title, q).map((m, k) => (m.hit ? <mark key={k} className="bg-[#EEE8FD] text-[#5B3FD0] rounded-[4px] px-0.5">{m.text}</mark> : <span key={k}>{m.text}</span>))}
                  </p>
                  {s.channel && <p className="text-[12.5px] text-[#6B6680] truncate mt-0.5">{s.channel}</p>}
                  <div className={cn("flex flex-wrap gap-1 mt-2.5", small && "lg:hidden", m2 && "max-sm:hidden")}>
                    {s.events.map(id => <span key={id} className="h-6 px-2 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.events, id)}</span>)}
                    {s.videos.map(id => <span key={id} className="h-6 px-2 rounded-full bg-[#E6EEF8] text-[#1F5C99] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.videos, id)}</span>)}
                    {ownTags.map(t => <span key={t} className="h-6 px-2 rounded-full bg-[#F5F3FA] text-[#4A4658] text-[11.5px] font-semibold inline-flex items-center">{t}</span>)}
                    {s.language === "instrumental"
                      ? <span className="h-6 px-2 rounded-full bg-[#DDF3EE] text-[#0F5A4C] text-[11.5px] font-semibold inline-flex items-center gap-1"><Piano className="w-3 h-3" aria-hidden />Instrumental</span>
                      : s.language && <span className="h-6 px-2 rounded-full border border-[#E3DFEC] text-[#6B6680] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.languages, s.language)}</span>}
                    {s.moods.map(id => <span key={id} className="h-6 px-2 rounded-full border border-[#E3DFEC] text-[#6B6680] text-[11.5px] font-semibold inline-flex items-center">{tagName(cat.moods, id)}</span>)}
                    {untagged && <span className="h-6 px-2 rounded-full bg-[#F5F3FA] text-[#6B6680] text-[11.5px] font-semibold inline-flex items-center">Fits any part</span>}
                  </div>
                </div>
                <div className={cn("flex items-center gap-1 px-0.5 pt-2.5 mt-2.5 border-t border-[#F1EFF6]", small && "lg:flex-wrap", m2 && "max-sm:gap-0 max-sm:pt-2 max-sm:mt-2")}>
                  {lib ? <button type="button" onClick={() => setForm({ song: lib })} aria-label={`Edit the tags of ${s.title}`} className={cn("h-9 px-3 rounded-full text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#F3EFFE] inline-flex items-center gap-1.5", m2 && "max-sm:px-2.5")}><Pencil className="w-3.5 h-3.5" /><span className={cn(m2 && "max-sm:hidden")}>Edit tags</span></button>
                    : o!.mine ? <span className="h-9 px-3 rounded-full text-[13px] font-semibold text-[#1F8A5B] bg-[#E2F4EA] inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={3} /><span className={cn(m2 && "max-sm:hidden")}>In my songs</span><span className={cn("hidden", m2 && "max-sm:inline")}>Added</span></span>
                    : <button type="button" onClick={() => setForm({ url: s.url, from: o! })} className="h-9 px-3.5 rounded-full text-[13px] font-semibold text-white bg-[#7D5CEF] hover:bg-[#6143CF] inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /><span className={cn(m2 && "max-sm:hidden")}>Add to my songs</span><span className={cn("hidden", m2 && "max-sm:inline")}>Add</span></button>}
                  <span className="flex-1" />
                  <button type="button" onClick={() => toggleFav(s)} aria-pressed={favIds.has(s.youtubeId)} aria-label={favIds.has(s.youtubeId) ? `Take ${s.title} out of Favourites` : `Add ${s.title} to Favourites`} title={favIds.has(s.youtubeId) ? "In Favourites" : "Add to Favourites"}
                    className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-colors", favIds.has(s.youtubeId) ? "text-[#C2304F] bg-[#FDECEF]" : "text-[#6B6680] hover:bg-[#F5F3FA]")}><Heart className="w-4 h-4" fill={favIds.has(s.youtubeId) ? "currentColor" : "none"} /></button>
                  <button type="button" onClick={() => copyLink(s)} aria-label={`Copy the link of ${s.title}`} title="Copy link" className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]", m2 && !lib && "max-sm:hidden")}><Copy className="w-4 h-4" /></button>
                  <a href={s.url} target="_blank" rel="noreferrer" aria-label="Open on YouTube" title="Open on YouTube" className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]", m2 && "max-sm:hidden")}><ExternalLink className="w-4 h-4" /></a>
                  {lib ? <button type="button" onClick={() => remove(lib)} aria-label={`Remove ${s.title}`} title="Remove" className="w-9 h-9 rounded-full flex items-center justify-center text-[#C2304F] hover:bg-[#FDECEF]"><Trash2 className="w-4 h-4" /></button>
                    : <button type="button" onClick={() => hide(o!)} aria-label={`Hide ${s.title}`} title="Don't show me this song" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]"><EyeOff className="w-4 h-4" /></button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Phones: the filters as a sheet from the bottom */}
      {sheet && (
        <div className="fixed inset-0 z-[1000] sm:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" onClick={() => setSheet(false)} className="absolute inset-0 bg-[#17151F]/45 sp-fade-in" />
          <div className="absolute inset-x-0 bottom-0 max-h-[86dvh] flex flex-col bg-white rounded-t-[26px] shadow-[0_-18px_50px_-20px_rgba(23,21,31,.55)] sp-fade-in">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F1EFF6]">
              <p className="text-[17px] font-bold text-[#17151F]">Filters</p>
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="w-10 h-10 rounded-full bg-[#F5F3FA] text-[#17151F] flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{hasRows ? filterRows(true) : <p className="text-[14px] text-[#6B6680]">There is nothing to filter in this list yet.</p>}</div>
            <div className="flex items-center gap-2 px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] border-t border-[#F1EFF6]">
              {filtering && <button type="button" onClick={clearAll} className="h-12 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[14px] font-semibold">Clear</button>}
              <button type="button" onClick={() => setSheet(false)} className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold">Show {shown.length} song{shown.length === 1 ? "" : "s"}</button>
            </div>
          </div>
        </div>
      )}

      {form && <SongDrawer cat={cat} songs={songs} song={form.song} url={form.url} from={form.from} onClose={() => setForm(null)}
        onSaved={(s, text) => { setSongs(p => (p.some(x => x.id === s.id) ? p.map(x => (x.id === s.id ? s : x)) : [s, ...p])); setCat(c => ({ ...c, own: [...new Set([...c.own, ...s.tags])].sort((a, b) => a.localeCompare(b)) })); notify(text); setForm(null); }} />}
    </div>
  );
}

/** Chips to pick tags from one list; tags that are not usual in the studio's country sit behind "More". */
function TagPicker({ list, value, onChange, single, label }: { list: MusicTag[]; value: string[]; onChange: (v: string[]) => void; single?: boolean; label: string }) {
  const [more, setMore] = useState(false);
  // Tags that sit under another one (the rituals of a Sanatani wedding) are shown under it, once it is chosen.
  const top = list.filter(t => !t.parent);
  const shown = top.filter(t => more || !t.more || value.includes(t.id));
  const hidden = top.length - shown.length;
  const kidsOf = (id: string) => list.filter(t => t.parent === id);
  const toggle = (id: string) => {
    if (!value.includes(id)) return onChange(single ? [id] : [...value, id]);
    // Taking an event off also takes its rituals off.
    const kids = new Set(kidsOf(id).map(t => t.id));
    onChange(value.filter(x => x !== id && !kids.has(x)));
  };
  const pill = (t: MusicTag, on: boolean, small?: boolean) => (
    <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)}
      className={cn("rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95", small ? "h-8 px-3" : "h-9 px-3.5",
        on ? "bg-[#7D5CEF] text-white shadow-[0_6px_14px_-8px_rgba(125,92,239,.9)]" : small ? "bg-white text-[#4A4658] hover:text-[#17151F]" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
      {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}{t.name}
    </button>
  );
  const open = top.filter(t => value.includes(t.id) && kidsOf(t.id).length > 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {shown.map(t => pill(t, value.includes(t.id)))}
        {hidden > 0 && <button type="button" onClick={() => setMore(true)} className="h-9 px-3.5 rounded-full text-[13px] font-semibold text-[#5B3FD0] border border-dashed border-[#CFC8DD] hover:bg-[#F3EFFE]">More ({hidden})</button>}
      </div>
      {open.map(p => (
        <div key={p.id} className="rounded-[14px] bg-[#F6F2FF] p-2.5" role="group" aria-label={`Rituals of ${p.name}`}>
          <p className="text-xs font-bold text-[#4B32B8] px-1 mb-1.5">{p.name}: which rituals? (none = the whole wedding)</p>
          <div className="flex flex-wrap gap-1.5">{kidsOf(p.id).map(t => pill(t, value.includes(t.id), true))}</div>
        </div>
      ))}
    </div>
  );
}

type ChipItem = { id: string; on: boolean; onPick: () => void; node: React.ReactNode };
/**
 * One line of filter chips. What does not fit on the line waits behind "More" at its end; pressing it shows all of them.
 * With `limit` (the phone's sheet) the first few show instead of measuring a line. The chosen chip is always in view.
 */
function ChipRow({ label, aria, items, allOn, onAll, chipCls, stacked, limit }: { label: string; aria: string; items: ChipItem[]; allOn: boolean; onAll: () => void; chipCls: (on: boolean) => string; stacked?: boolean; limit?: number }) {
  const [open, setOpen] = useState(false);
  const [fit, setFit] = useState(items.length);
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const measure = useCallback(() => {
    if (limit || !box.current || !ruler.current) return;
    const kids = Array.from(ruler.current.children) as HTMLElement[];
    const w = box.current.clientWidth, gap = 6, more = kids[kids.length - 1].offsetWidth;
    let all = kids[0].offsetWidth;
    for (let i = 1; i < kids.length - 1; i++) all += gap + kids[i].offsetWidth;
    if (all <= w) { setFit(kids.length - 2); return; }
    let used = kids[0].offsetWidth, k = 0;
    for (let i = 1; i < kids.length - 1; i++) { const next = used + gap + kids[i].offsetWidth; if (next + gap + more > w) break; used = next; k++; }
    setFit(k);
  }, [limit]);
  // After every draw (the numbers in the chips change their width) and whenever the line gets wider or narrower.
  useLayoutEffect(() => { measure(); });
  useEffect(() => { if (!box.current) return; const ro = new ResizeObserver(measure); ro.observe(box.current); return () => ro.disconnect(); }, [measure]);

  const room = Math.min(items.length, limit ?? fit);
  let shown = open ? items : items.slice(0, room);
  const chosen = items.findIndex(t => t.on);
  if (!open && chosen >= room) shown = room > 0 ? [...items.slice(0, room - 1), items[chosen]] : [items[chosen]];
  const rest = items.length - shown.length;
  const moreCls = "h-10 px-3.5 rounded-full text-[13.5px] font-semibold text-[#4B32B8] border border-dashed border-[#B9ADEB] hover:bg-[#F6F2FF] flex-shrink-0 whitespace-nowrap inline-flex items-center";
  return (
    <div className={cn(!stacked && "flex items-start gap-3")}>
      <p className={cn("text-[13px] font-bold text-[#17151F] flex-shrink-0", stacked ? "mb-2" : "w-14 pt-2.5")}>{label}</p>
      <div ref={box} className={cn("relative min-w-0 flex-1 flex gap-1.5", open || limit ? "flex-wrap" : "flex-nowrap overflow-hidden")} role="group" aria-label={aria}>
        <button type="button" aria-pressed={allOn} onClick={onAll} className={chipCls(allOn)}>All</button>
        {shown.map(t => <button key={t.id} type="button" aria-pressed={t.on} onClick={t.onPick} className={chipCls(t.on)}>{t.node}</button>)}
        {(rest > 0 || open) && items.length > 0 && <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className={moreCls}>{open ? "Fewer" : `More (${rest})`}</button>}
        {/* The same chips, unseen, to learn how wide each one is */}
        {!limit && (
          <div ref={ruler} aria-hidden className="absolute left-0 top-0 flex gap-1.5 invisible pointer-events-none h-0 overflow-hidden">
            <span className={chipCls(false)}>All</span>
            {items.map(t => <span key={t.id} className={chipCls(false)}>{t.node}</span>)}
            <span className={moreCls}>More (99)</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Ask StuPanel to add a tag for every studio. Until it is added the studio keeps it as its own tag. */
function SuggestTag({ onOwn }: { onOwn: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"event" | "video">("event");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    const n = name.trim().replace(/\s+/g, " ");
    if (n.length < 2 || busy) return;
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/music/tags/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, name: n }) });
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      const d = await r.json();
      if (d.exists && !d.tag.hidden) notify(`That is already in the list as “${d.tag.name}” — tick it above (it may be under More).`);
      else { onOwn(n); notify(d.exists ? "StuPanel is not offering that tag right now. It is saved as your own tag." : "Sent to StuPanel. Until it is added for everyone, it is saved as your own tag."); }
      setName(""); setOpen(false);
    } finally { setBusy(false); }
  }
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="self-start text-[13px] font-semibold text-[#5B3FD0] hover:underline">Missing an event or a kind of video? Suggest a tag for every studio</button>
  );
  return (
    <div className="rounded-2xl bg-[#F8F6FC] p-3 space-y-2.5">
      <p className="text-[13px] font-semibold text-[#17151F]">Suggest a tag for every studio</p>
      <div className="inline-flex p-1 rounded-full bg-white" role="group" aria-label="Kind of tag">
        {([["event", "Event"], ["video", "Kind of video"]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={cn("h-8 px-3.5 rounded-full text-[13px] font-semibold", kind === id ? "bg-[#17151F] text-white" : "text-[#4A4658]")}>{label}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void send(); } }} maxLength={40} autoFocus
          placeholder={kind === "event" ? "e.g. Cake cutting" : "e.g. Drone film"} aria-label="Name of the tag" className={inputCls} />
        <button type="button" onClick={() => void send()} disabled={busy || name.trim().length < 2} className="h-11 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 flex-shrink-0">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send</button>
      </div>
      <p className="text-[12px] text-[#6B6780]">StuPanel looks at it and adds it for all studios if it fits. Your studio&apos;s name is not shown to anyone.</p>
      <button type="button" onClick={() => setOpen(false)} className="text-[13px] font-semibold text-[#6B6780] hover:underline">Cancel</button>
    </div>
  );
}

function SongDrawer({ cat, songs, song, url: startUrl, from, onClose, onSaved }: {
  cat: TagCatalog; songs: LibrarySong[]; song?: LibrarySong; url?: string;
  /** A song from outside the library: its tags are ticked to start with. */
  from?: OutsideSong;
  onClose: () => void; onSaved: (s: LibrarySong, text: string) => void;
}) {
  const [url, setUrl] = useState(startUrl ?? "");
  const [info, setInfo] = useState<{ youtubeId: string; title: string; channel?: string } | null>(song ? { youtubeId: song.youtubeId, title: song.title, channel: song.channel } : null);
  /** What was ticked by itself after the link was pasted (so the person knows to check it). */
  const [filled, setFilled] = useState<{ from: "stupanel" | "studios" | "name"; what: string[] } | null>(null);
  /** Mood, language and own tags are folded away until asked for: fewer choices on the first look. */
  const [moreOpen, setMoreOpen] = useState(!!song);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState("");
  const [events, setEvents] = useState<string[]>(song?.events ?? from?.events ?? []);
  const [videos, setVideos] = useState<string[]>(song?.videos ?? from?.videos ?? []);
  const [moods, setMoods] = useState<string[]>(song?.moods ?? from?.moods ?? []);
  const [language, setLanguage] = useState<string[]>(song?.language ? [song.language] : from?.language ? [from.language] : []);
  const [own, setOwn] = useState<string[]>(song?.tags ?? []);
  const [newOwn, setNewOwn] = useState("");
  const [altNames, setAltNames] = useState(song?.altNames ?? from?.altNames ?? "");
  const [shared, setShared] = useState(song?.shared ?? true);
  const [saving, setSaving] = useState(false);

  /** Music only, no singing. */
  const inst = language[0] === "instrumental";
  const hasInst = cat.languages.some(l => l.id === "instrumental");
  // What is ticked right now, for the link check below (it must not undo the person's own ticks).
  const cur = useRef({ events, videos, moods, language, own });
  useEffect(() => { cur.current = { events, videos, moods, language, own }; });

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
      if (r?.ok) {
        const d = await r.json();
        setInfo(d);
        // Tick what we can work out, but never over something the person (or the list it came from) already ticked.
        const gs = d.guess as { from: "stupanel" | "studios" | "name"; events: string[]; videos: string[]; moods: string[]; language: string | null; tags: string[] } | null;
        if (gs && !from) {
          const now = cur.current, what: string[] = [];
          if (!now.events.length && gs.events.length) { setEvents(gs.events); what.push("event"); }
          if (!now.videos.length && gs.videos.length) { setVideos(gs.videos); what.push("kind of video"); }
          if (!now.moods.length && gs.moods.length) { setMoods(gs.moods); what.push("mood"); }
          if (!now.language.length && gs.language) { setLanguage([gs.language]); what.push(gs.language === "instrumental" ? "Instrumental (no singing)" : "language"); }
          if (!now.own.length && gs.tags.length) { setOwn(gs.tags); what.push("your own tags"); }
          setFilled(what.length ? { from: gs.from, what } : null);
        }
      } else { setInfo(null); setProblem(r ? await err(r) : "Could not check the link — is the internet on?"); }
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

      {filled && (
        <div role="status" className="mb-4 rounded-[16px] bg-[#E2F4EA] px-4 py-3 text-[13.5px] text-[#14532F] sp-fade-in">
          <b>We ticked the {filled.what.join(", ").replace(/, ([^,]*)$/, " and $1")} for you</b>
          {filled.from === "stupanel" ? " (StuPanel's tags for this song)." : filled.from === "studios" ? " (what most studios chose for this song)." : " (read from the song's name)."} Please check, and change anything that is wrong.
        </div>
      )}

      {(hasInst || inst) && <FormGroup title="Is there singing in it?" note="Instrumental is music only — good behind decoration shots, rituals and entries">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="With singing or music only">
          {([["song", "With singing", Mic2], ["instrumental", "Instrumental", Piano]] as const).map(([id, label, Icon]) => { const on = (id === "instrumental") === inst; return (
            <button key={id} type="button" aria-pressed={on} onClick={() => setLanguage(id === "instrumental" ? ["instrumental"] : inst ? [] : language)}
              className={cn("h-12 rounded-[14px] border text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
                on ? "bg-[#7D5CEF] border-[#7D5CEF] text-white" : "bg-white border-[#DDD8E8] text-[#17151F] hover:border-[#7D5CEF]")}>
              <Icon className="w-4 h-4" aria-hidden />{label}
            </button>
          ); })}
        </div>
      </FormGroup>}
      <FormGroup title="Which event?" note="Leave empty if it fits any event">
        <TagPicker list={cat.events} value={events} onChange={setEvents} label="Event" />
      </FormGroup>
      <FormGroup title="Which kind of video?" note="Leave empty if it fits any video">
        <TagPicker list={cat.videos} value={videos} onChange={setVideos} label="Kind of video" />
      </FormGroup>
      {/* Mood, language and own tags: filled in by themselves where possible, and folded away so the form is short */}
      {!moreOpen && (
        <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={false} className={cn("w-full text-left bg-white rounded-[20px] px-4 py-3.5 mb-4 flex items-center gap-3", CARD_SHADOW)}>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-bold text-[#17151F]">{inst ? "Mood and your own tags" : "Mood, language and your own tags"}</span>
            <span className="block text-[12.5px] text-[#6B6680] truncate">{[...language.filter(l => l !== "instrumental").map(l => tagName(cat.languages, l)), ...moods.map(m => tagName(cat.moods, m)), ...own].join(" · ") || "Optional. They help when searching."}</span>
          </span>
          <span className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[#4B32B8] text-[13px] font-semibold inline-flex items-center flex-shrink-0">{(language.length && !inst) || moods.length || own.length ? "Change" : "Add"}</span>
        </button>
      )}
      {moreOpen && <>
      <FormGroup title={inst ? "Mood" : "Mood and language"} note="Optional — they help when searching">
        <TagPicker list={cat.moods} value={moods} onChange={setMoods} label="Mood" />
        {!inst && <>
          <div className="h-px bg-[#F1EFF6] my-1" />
          <TagPicker list={cat.languages.filter(l => l.id !== "instrumental")} value={language} onChange={setLanguage} single label="Language" />
        </>}
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
        <SuggestTag onOwn={t => setOwn(o => (o.some(x => x.toLowerCase() === t.toLowerCase()) ? o : [...o, t]))} />
      </FormGroup>
      </>}
      <FormGroup title="More">
        <Field label="Other names (optional)" hint="Words people may search this song by — another spelling, the name in your language">
          {fid => <input id={fid} value={altNames} onChange={e => setAltNames(e.target.value)} maxLength={255} placeholder="e.g. কেশরিয়া, kesaria" className={inputCls} />}
        </Field>
        <SwitchRow label="Share with other studios" hint="Only the song and its tags are shared — never your studio's name or anything about your clients" on={shared} onChange={setShared} />
      </FormGroup>
    </FormDrawer>
  );
}
