"use client";

/**
 * Listen to songs one after another inside the admin page, to decide quickly which to keep.
 * The player sits at the bottom of the page; the next song starts by itself when one ends.
 * "Keep" marks a song as checked (remembered in this browser) and goes to the next one;
 * "Remove" takes it off the list at once (with Undo) and goes to the next one.
 */
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, ExternalLink, Loader2, SkipBack, SkipForward, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReviewSong = { youtubeId: string; title: string; channel?: string | null; url: string; tags: string[] };

const KEY = "sp_admin_music_checked";
/** Songs already listened to and kept, remembered in this browser only. */
export function loadChecked(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { return new Set(); }
}
export function saveChecked(s: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* private window: forget it */ }
}

export function ReviewPlayer({ songs, current, onPick, onClose, onKeep, onRemove, removeLabel, undo, onUndo, checked, side }: {
  songs: ReviewSong[]; current: string; onPick: (id: string) => void; onClose: () => void;
  onKeep: (id: string) => void; onRemove?: (id: string) => Promise<void>; removeLabel: string;
  undo: string | null; onUndo: () => void; checked: Set<string>;
  /** Shown beside the controls: the playing song's tags, to change them while listening. */
  side?: React.ReactNode;
}) {
  const i = Math.max(0, songs.findIndex(s => s.youtubeId === current));
  const song = songs[i] ?? null;
  const [auto, setAuto] = useState(true);
  const [small, setSmall] = useState(false);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const prev = songs[i - 1]?.youtubeId;
  const next = songs[i + 1]?.youtubeId;

  // YouTube tells the page when a song ends (enablejsapi); then the next one starts.
  const state = useRef({ auto, next, onPick });
  useEffect(() => { state.current = { auto, next, onPick }; });
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      let d: { event?: string; info?: number | { playerState?: number } } | null = null;
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      const ended = (d?.event === "onStateChange" && d.info === 0) || (d?.event === "infoDelivery" && typeof d.info === "object" && d.info?.playerState === 0);
      const s = state.current;
      if (ended && s.auto && s.next) s.onPick(s.next);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Keyboard: K keep, R remove, N next, P previous (not while typing in a box).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (!song || e.metaKey || e.ctrlKey || e.altKey || (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === "k") onKeep(song.youtubeId);
      else if (k === "r" && onRemove && !busy) void remove();
      else if (k === "n" && next) onPick(next);
      else if (k === "p" && prev) onPick(prev);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function remove() {
    if (!song || !onRemove) return;
    setBusy(true);
    try { await onRemove(song.youtubeId); } finally { setBusy(false); }
  }

  if (!song) return null;
  const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
  const btn = "h-9 px-3 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40";

  return (
    <div role="region" aria-label="Song player" className="sticky bottom-0 z-30 -mx-6 md:-mx-8 px-3 md:px-8 pb-3 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl shadow-black/50 p-3 flex flex-col lg:flex-row gap-3 lg:items-start">
        <div className="flex flex-col md:flex-row gap-3 md:items-center flex-1 min-w-0">
        <div className={cn("relative rounded-xl overflow-hidden bg-black flex-shrink-0 w-full md:w-[320px] aspect-video max-h-[30vh] md:max-h-none", small && "hidden md:hidden")}>
          <iframe ref={frame} key={song.youtubeId} onLoad={listen}
            src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}?autoplay=1&rel=0&enablejsapi=1`}
            title={song.title} allow="autoplay; encrypted-media" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-400 tabular-nums">Song {i + 1} of {songs.length}{checked.has(song.youtubeId) && <span className="ml-2 text-emerald-300">· kept before</span>}</p>
              <p className="text-[15px] font-semibold text-white truncate">{song.title}</p>
              <p className="text-xs text-slate-400 truncate">{[song.channel, ...song.tags].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" onClick={() => setSmall(v => !v)} aria-label={small ? "Show the video" : "Hide the video"} className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 inline-flex items-center justify-center flex-shrink-0">
              {small ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button type="button" onClick={onClose} aria-label="Close the player" className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 inline-flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => prev && onPick(prev)} disabled={!prev} title="Previous (P)" aria-label="Previous song" className={cn(btn, "w-9 px-0 bg-slate-700 hover:bg-slate-600 text-slate-200")}><SkipBack className="w-4 h-4" /></button>
            <button type="button" onClick={() => onKeep(song.youtubeId)} title="Keep it and play the next (K)" className={cn(btn, "bg-emerald-600 hover:bg-emerald-500 text-white")}><Check className="w-4 h-4" />Keep</button>
            {onRemove && <button type="button" onClick={() => void remove()} disabled={busy} title={`${removeLabel} and play the next (R)`} className={cn(btn, "bg-rose-600/90 hover:bg-rose-500 text-white")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}{removeLabel}</button>}
            <button type="button" onClick={() => next && onPick(next)} disabled={!next} title="Next without deciding (N)" aria-label="Next song" className={cn(btn, "w-9 px-0 bg-slate-700 hover:bg-slate-600 text-slate-200")}><SkipForward className="w-4 h-4" /></button>
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 ml-1 cursor-pointer select-none">
              <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="accent-indigo-500 w-4 h-4" />Next song by itself
            </label>
            <a href={song.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-slate-400 hover:text-white inline-flex items-center gap-1">YouTube<ExternalLink className="w-3 h-3" /></a>
          </div>
          {undo && (
            <p role="status" className="text-xs text-slate-300 flex items-center gap-2">
              <span className="truncate">{undo}</span>
              <button type="button" onClick={onUndo} className="text-indigo-300 hover:text-white font-semibold inline-flex items-center gap-1 flex-shrink-0"><Undo2 className="w-3.5 h-3.5" />Undo</button>
            </p>
          )}
          <p className="hidden md:block text-[11px] text-slate-500">Keys: K keep · R {removeLabel.toLowerCase()} · N next · P previous</p>
        </div>
        </div>
        {side && <div className="lg:w-[46%] xl:w-[44%] flex-shrink-0 lg:border-l border-t lg:border-t-0 border-slate-700 pt-3 lg:pt-0 lg:pl-3 max-h-[34vh] lg:max-h-[300px] overflow-y-auto">{side}</div>}
      </div>
    </div>
  );
}
