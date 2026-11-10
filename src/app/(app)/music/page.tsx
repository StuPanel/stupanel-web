"use client";

/**
 * Music library: the songs this studio likes to suggest to clients.
 * A song with tags (e.g. "Holud", "Teaser") is shown to clients for parts with that name;
 * a song without tags is shown for every part.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Flame, Loader2, Music2, Play, Plus, Trash2, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, PageHeader, SearchField } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";
import { embedUrl, type LibrarySong } from "@/lib/music";

const VIDEO_TAGS = ["Teaser", "Highlight", "Full video", "Reel"];
const err = async (r: Response) => { const d = await r.json().catch(() => ({})); return (Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong"; };

export default function MusicLibraryPage() {
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [dayTags, setDayTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await apiFetch(`${API}/music/songs`); if (r.ok) setSongs(await r.json()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      setEnabled(!!d.features?.musicSelection);
      const names = new Set<string>();
      for (const w of (d.workTypes ?? []) as { active?: boolean; events?: { name: string }[] }[]) if (w.active !== false) for (const e of w.events ?? []) names.add(e.name);
      setDayTags([...names]);
    }).catch(() => {});
  }, []);

  const allTags = useMemo(() => [...new Set([...dayTags, ...VIDEO_TAGS, ...songs.flatMap(s => s.tags)])], [dayTags, songs]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return songs.filter(s => (!k || s.title.toLowerCase().includes(k) || (s.channel ?? "").toLowerCase().includes(k)) && (!filter || s.tags.includes(filter)));
  }, [songs, q, filter]);

  async function add() {
    if (!url.trim()) return;
    setAdding(true);
    try {
      const r = await apiFetch(`${API}/music/songs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), tags }) });
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      const s: LibrarySong = await r.json();
      setSongs(p => [s, ...p]); setUrl(""); notify("Song added");
    } finally { setAdding(false); }
  }

  async function toggleTag(s: LibrarySong, tag: string) {
    const next = s.tags.includes(tag) ? s.tags.filter(t => t !== tag) : [...s.tags, tag];
    setSongs(p => p.map(x => (x.id === s.id ? { ...x, tags: next } : x)));
    const r = await apiFetch(`${API}/music/songs/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: next }) }).catch(() => null);
    if (!r?.ok) { notify("Couldn't save", { error: true }); load(); }
  }

  async function remove(s: LibrarySong) {
    if (!(await askConfirm({ title: "Remove this song?", message: s.title, confirmLabel: "Remove", danger: true }))) return;
    const r = await apiFetch(`${API}/music/songs/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't remove", { error: true }); return; }
    setSongs(p => p.filter(x => x.id !== s.id)); notify("Removed");
  }

  const tagChip = (on: boolean) => cn("h-8 px-3 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]");

  return (
    <div>
      <PageHeader icon={Music2} color="orchid" title="Music" sub={`${songs.length} song${songs.length === 1 ? "" : "s"} in your library — suggested to clients when they choose music`}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={q} onChange={setQ} placeholder="Search songs" />
      </PageHeader>

      {enabled === false && (
        <div className="mb-5 rounded-[18px] bg-[#FBF2FA] p-4 flex items-center gap-3">
          <p className="flex-1 text-[14px] text-[#58244E]"><b>Music selection is turned off.</b> Turn it on to let clients choose songs from their portal.</p>
          <Link href="/settings?pane=features" className="h-10 px-4 rounded-full bg-[#9E3A8C] text-white text-[13px] font-semibold inline-flex items-center flex-shrink-0">Open Settings</Link>
        </div>
      )}

      {/* Add */}
      <div className={cn("bg-white rounded-[20px] p-4 mb-5", CARD_SHADOW)}>
        <p className="text-[14px] font-bold text-[#17151F]">Add a song</p>
        <p className="text-[12.5px] text-[#6B6680] mb-3">Paste a YouTube link. We check it and fill in the name.</p>
        <div className="flex gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} inputMode="url" placeholder="https://youtube.com/watch?v=…" aria-label="YouTube link" className={inputCls} />
          <button type="button" onClick={add} disabled={adding || !url.trim()} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add
          </button>
        </div>
        <p className="text-[12.5px] font-semibold text-[#4A4658] mt-3 mb-1.5">Good for <span className="font-normal text-[#6B6680]">— leave empty to suggest it everywhere</span></p>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(t => <button key={t} type="button" aria-pressed={tags.includes(t)} onClick={() => setTags(p => (p.includes(t) ? p.filter(x => x !== t) : [...p, t]))} className={tagChip(tags.includes(t))}>{t}</button>)}
        </div>
      </div>

      {songs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-3 [scrollbar-width:none]">
          <button type="button" onClick={() => setFilter("")} className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap", !filter ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658]")}>All</button>
          {allTags.filter(t => songs.some(s => s.tags.includes(t))).map(t => (
            <button key={t} type="button" onClick={() => setFilter(filter === t ? "" : t)} className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap", filter === t ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658]")}>{t}</button>
          ))}
        </div>
      )}

      {playing && (
        <div className="mb-4 rounded-[20px] overflow-hidden bg-black aspect-video max-w-2xl relative">
          <iframe key={playing} src={embedUrl(playing)} title="YouTube" allow="autoplay; encrypted-media" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
          <button type="button" onClick={() => setPlaying(null)} aria-label="Close player" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}><div className="sp-skel h-4 w-48 rounded-full" /></div>
        : songs.length === 0 ? <EmptyState icon={Music2} title="No songs yet" text="Add the songs you often use for Holud, Wedding, teasers and reels. Clients will see them as your suggestions." />
        : shown.length === 0 ? <p className="text-center text-sm text-[#6B6680] py-10">No song matches.</p>
        : (
          <ul className={cn("bg-white rounded-[20px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
            {shown.map(s => (
              <li key={s.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button type="button" onClick={() => setPlaying(p => (p === s.youtubeId ? null : s.youtubeId))} aria-label={`Play ${s.title}`} className="relative w-[88px] h-[54px] rounded-[12px] overflow-hidden flex-shrink-0 bg-[#EEEBF4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute inset-0 bg-black/25 flex items-center justify-center"><span className="w-7 h-7 rounded-full bg-white/95 flex items-center justify-center"><Play className="w-3.5 h-3.5 text-[#17151F] ml-0.5" fill="currentColor" /></span></span>
                  </button>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#17151F] line-clamp-2 leading-snug">{s.title}</p>
                    <p className="text-[12.5px] text-[#6B6680] truncate">{s.channel}{s.usedCount > 0 && <span className="inline-flex items-center gap-0.5 ml-2 text-[#9E3A8C] font-semibold"><Flame className="w-3 h-3" />chosen {s.usedCount}×</span>}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:max-w-[46%]">
                  <div className="flex flex-wrap gap-1 flex-1 sm:justify-end">
                    {allTags.map(t => (s.tags.includes(t) || allTags.length <= 10) && (
                      <button key={t} type="button" aria-pressed={s.tags.includes(t)} onClick={() => toggleTag(s, t)}
                        className={cn("h-7 px-2.5 rounded-full text-[12px] font-semibold", s.tags.includes(t) ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-[#F5F3FA] text-[#A29DB3] hover:text-[#4A4658]")}>{t}</button>
                    ))}
                  </div>
                  <a href={s.url} target="_blank" rel="noreferrer" aria-label="Open on YouTube" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA] flex-shrink-0"><ExternalLink className="w-4 h-4" /></a>
                  <button type="button" onClick={() => remove(s)} aria-label={`Remove ${s.title}`} className="w-9 h-9 rounded-full flex items-center justify-center text-[#C2304F] hover:bg-[#FDECEF] flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
