"use client";

/**
 * The client's "choose your music" screen, inside the client portal.
 * One part at a time (Holud, Wedding, Teaser…): listen, add, put in order, add a note.
 * Every change saves by itself. Sending shows the whole list first and warns about empty parts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ExternalLink, Loader2, Lock, Music2, Play, Plus, Send, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { portalHeaders } from "@/lib/portal-session";
import { embedUrl, type ClientMusic, type MusicPick, type MusicSong } from "@/lib/music";

const T = {
    card: "Choose your music", cardSub: "Tell us the songs you want in your videos", open: "Choose songs", see: "See your songs", change: "Change songs",
    done: (a: number, b: number) => `${a} of ${b} parts done`, sent: "Sent to the studio", sentOn: (d: string) => `Sent on ${d}`,
    yours: "Your choices", upTo: (n: number) => `Up to ${n} songs. The first one is your first choice.`, none: "No song yet. Add one from below.",
    note: "Note for the editor (optional) — e.g. start from 1:20", own: "Add your own song", ownHint: "Open the song on YouTube → Share → Copy link → paste here",
    paste: "Paste a YouTube link", add: "Add", ideas: "Suggested by the studio", studioPick: "Studio pick", added: "Added", listen: "Listen",
    full: (n: number) => `You already chose ${n} songs for this part. Remove one to add another.`, dup: "This song is already in this part.",
    saving: "Saving…", saved: "Saved", notSaved: "Not saved — check your internet", next: "Next part", back: "Back", review: "Review & send",
    reviewTitle: "Check your songs", reviewSub: "This is what the studio will get.", empty: "No song chosen — the studio will pick one", warn: (l: string) => `You have not chosen a song for: ${l}. You can still send — the studio will choose for those.`,
    anyNote: "Anything else about the music? (optional)", send: "Send to the studio", sending: "Sending…", after: "After sending, the list is locked. You can ask the studio to open it again.",
    locked: "Your songs are with the studio", lockedSub: "Need a change? Ask the studio to open it again.", ask: "Ask to change", why: "What do you want to change? (optional)", askSend: "Send request", asked: "Request sent — the studio will open it for you.",
    first: "1st choice", order: (n: number) => `${n}${n === 2 ? "nd" : n === 3 ? "rd" : "th"} choice`, up: "Move up", down: "Move down", remove: "Remove", close: "Close", youtube: "Open on YouTube", songs: (n: number) => `${n} song${n === 1 ? "" : "s"}`,
} as const;

const fmt = (d: string | null) => d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d)) : "";

function Thumb({ song, onPlay, playing, label }: { song: MusicSong; onPlay: () => void; playing: boolean; label: string }) {
  return (
    <button type="button" onClick={onPlay} aria-label={`${label}: ${song.title}`}
      className="relative w-[72px] h-[46px] rounded-[10px] overflow-hidden flex-shrink-0 bg-[#EEEBF4]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={song.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
      <span className={cn("absolute inset-0 flex items-center justify-center", playing ? "bg-black/55" : "bg-black/25")}>
        <span className="w-6 h-6 rounded-full bg-white/95 flex items-center justify-center"><Play className="w-3 h-3 text-[#17151F] ml-0.5" fill="currentColor" /></span>
      </span>
    </button>
  );
}

export function PortalMusic({ token, music, brand, onChanged }: { token: string; music: ClientMusic; brand: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const t = T;
  const sent = music.status === "submitted";

  return (
    <>
      <div className="mx-4 sm:mx-5 mb-4 rounded-2xl p-3.5 flex items-center gap-3" style={{ backgroundColor: `${brand}12` }}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: brand }}>
          <Music2 className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#17151F]">{t.card}</p>
          <p className="text-xs text-[#4A4658]">
            {sent ? <span className="inline-flex items-center gap-1 text-[#1F8A5B] font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />{t.sent}</span>
              : music.counts.total ? t.done(music.counts.filled, music.counts.parts) : t.cardSub}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)}
          className="h-10 px-4 rounded-full text-white text-sm font-semibold flex-shrink-0 hover:opacity-90" style={{ backgroundColor: brand }}>
          {sent ? t.see : music.counts.total ? t.change : t.open}
        </button>
      </div>
      {open && <MusicSheet token={token} music={music} brand={brand}
        onClose={() => { setOpen(false); onChanged(); }} />}
    </>
  );
}

function MusicSheet({ token, music, brand, onClose }: {
  token: string; music: ClientMusic; brand: string; onClose: () => void;
}) {
  const t = T;
  const [picks, setPicks] = useState<Record<string, MusicPick[]>>(music.picks);
  const [status, setStatus] = useState(music.status);
  const [note, setNote] = useState(music.clientNote ?? "");
  const [step, setStep] = useState(0); // parts.length = review
  const [playing, setPlaying] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState("");
  const [asked, setAsked] = useState(!!music.reopenRequestedAt);
  const dirty = useRef(false);
  const latest = useRef({ picks, note });
  useEffect(() => { latest.current = { picks, note }; }, [picks, note]);

  const parts = music.parts;
  const locked = status !== "open";
  const part = parts[Math.min(step, parts.length - 1)];
  const list = picks[part.key] ?? [];
  const review = step >= parts.length;
  const total = useMemo(() => parts.reduce((n, p) => n + (picks[p.key]?.length ?? 0), 0), [parts, picks]);
  const emptyParts = parts.filter(p => !(picks[p.key]?.length));

  const push = useCallback(async () => {
    setSave("saving");
    try {
      const r = await fetch(`${API}/public/portal/${token}/music/${music.bookingId}`, {
        method: "PUT", headers: portalHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ picks: latest.current.picks, clientNote: latest.current.note }),
      });
      if (!r.ok) throw new Error();
      dirty.current = false; setSave("saved");
      return true;
    } catch { setSave("error"); return false; }
  }, [token, music.bookingId]);

  // Save by itself, a moment after the last change
  useEffect(() => {
    if (!dirty.current || locked) return;
    const id = setTimeout(push, 700);
    return () => clearTimeout(id);
  }, [picks, note, push, locked]);

  function change(next: MusicPick[]) {
    dirty.current = true; setMsg("");
    setPicks(p => ({ ...p, [part.key]: next }));
  }
  function addSong(s: MusicSong, from: "studio" | "client") {
    if (list.some(x => x.youtubeId === s.youtubeId)) { setMsg(t.dup); return false; }
    if (list.length >= music.perPart) { setMsg(t.full(music.perPart)); return false; }
    change([...list, { youtubeId: s.youtubeId, title: s.title, channel: s.channel, thumb: s.thumb, url: s.url, from }]);
    return true;
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; change(next);
  }

  async function addOwn() {
    const url = link.trim(); if (!url) return;
    if (list.length >= music.perPart) { setMsg(t.full(music.perPart)); return; }
    setAdding(true); setMsg("");
    try {
      const r = await fetch(`${API}/public/portal/${token}/music/lookup`, {
        method: "POST", headers: portalHeaders(token, { "Content-Type": "application/json" }), body: JSON.stringify({ url }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(Array.isArray(d.message) ? d.message[0] : d.message || "Could not add this link."); return; }
      const song: MusicSong = { youtubeId: d.youtubeId, title: d.title, channel: d.channel, thumb: `https://i.ytimg.com/vi/${d.youtubeId}/mqdefault.jpg`, url: `https://www.youtube.com/watch?v=${d.youtubeId}` };
      if (addSong(song, "client")) setLink("");
    } catch { setMsg(t.notSaved); } finally { setAdding(false); }
  }

  async function send() {
    setSending(true); setMsg("");
    try {
      if (dirty.current && !(await push())) { setMsg(t.notSaved); return; }
      const r = await fetch(`${API}/public/portal/${token}/music/${music.bookingId}/submit`, { method: "POST", headers: portalHeaders(token) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(Array.isArray(d.message) ? d.message[0] : d.message || t.notSaved); return; }
      setStatus("submitted"); setStep(0);
    } catch { setMsg(t.notSaved); } finally { setSending(false); }
  }

  async function askReopen() {
    setSending(true);
    try {
      const r = await fetch(`${API}/public/portal/${token}/music/${music.bookingId}/reopen`, {
        method: "POST", headers: portalHeaders(token, { "Content-Type": "application/json" }), body: JSON.stringify({ reason: why }),
      });
      if (r.ok) { setAsked(true); setAsking(false); }
    } finally { setSending(false); }
  }

  const ideas = (music.ideas[part.key] ?? []).filter(s => !list.some(x => x.youtubeId === s.youtubeId));

  // a plain function (not a component) so typing a note never loses focus
  const songRow = (s: MusicPick, i: number) => (
    <li key={s.youtubeId} className="rounded-2xl bg-white border border-[#F1EFF6] p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brand }}>{i + 1}</span>
        <Thumb song={s} label={t.listen} playing={playing === s.youtubeId} onPlay={() => setPlaying(p => (p === s.youtubeId ? null : s.youtubeId))} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[#17151F] leading-snug line-clamp-2">{s.title}</p>
          <p className="text-xs text-[#6B6680]">{i === 0 ? t.first : t.order(i + 1)}{s.from === "studio" ? ` · ${t.studioPick}` : ""}</p>
        </div>
        {!locked && (
          <div className="flex items-center flex-shrink-0">
            <button type="button" aria-label={t.up} disabled={i === 0} onClick={() => move(i, -1)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F1EFF6] disabled:opacity-25"><ArrowUp className="w-4 h-4" /></button>
            <button type="button" aria-label={t.down} disabled={i === list.length - 1} onClick={() => move(i, 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F1EFF6] disabled:opacity-25"><ArrowDown className="w-4 h-4" /></button>
            <button type="button" aria-label={t.remove} onClick={() => change(list.filter((_, j) => j !== i))} className="w-8 h-8 rounded-full flex items-center justify-center text-[#C2304F] hover:bg-[#FEF5F7]"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      {locked ? (s.note && <p className="mt-2 text-[13px] text-[#4A4658] pl-8">“{s.note}”</p>) : (
        <input value={s.note ?? ""} maxLength={200} placeholder={t.note} aria-label={t.note}
          onChange={e => change(list.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
          className="mt-2 w-full h-9 px-3 rounded-xl bg-[#F7F5FB] text-[13px] text-[#17151F] placeholder:text-[#8A8599] outline-none focus:ring-2 focus:ring-[#B5B0C4]" />
      )}
    </li>
  );

  return (
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={t.card} className="sp-drawer z-[70] sm:max-w-[560px] flex flex-col bg-[#F7F6FA]">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-5 pb-3 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: brand }}><Music2 className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-extrabold text-[#17151F] leading-tight truncate">{t.card}</h2>
            <p className="text-[13px] text-[#6B6680] truncate">{music.program}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#6B6680] flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* Parts */}
        {!review && (
          <div role="tablist" className="px-4 sm:px-5 pb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {parts.map((p, i) => {
              const n = picks[p.key]?.length ?? 0, on = i === step;
              return (
                <button key={p.key} role="tab" aria-selected={on} type="button" onClick={() => { setStep(i); setMsg(""); setPlaying(null); }}
                  className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0", on ? "text-white" : "bg-white text-[#4A4658]")}
                  style={on ? { backgroundColor: brand } : undefined}>
                  {n > 0 && <Check className="w-3.5 h-3.5" />}{p.label}<span className="opacity-70 tabular-nums">{n}/{music.perPart}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-5">
          {locked && (
            <div className="mb-3 rounded-2xl bg-[#F0FAF4] border border-[#E7F5EE] p-3.5">
              <p className="text-sm font-bold text-[#14613F] flex items-center gap-1.5"><Lock className="w-4 h-4" />{t.locked}</p>
              <p className="text-[13px] text-[#14613F]/80 mt-0.5">{music.submittedAt ? `${t.sentOn(fmt(music.submittedAt))}. ` : ""}{asked ? t.asked : t.lockedSub}</p>
              {!asked && !asking && <button type="button" onClick={() => setAsking(true)} className="mt-2.5 h-9 px-4 rounded-full bg-white text-[#14613F] text-[13px] font-semibold border border-[#CDEBDB]">{t.ask}</button>}
              {asking && (
                <div className="mt-2.5 space-y-2">
                  <textarea value={why} onChange={e => setWhy(e.target.value)} rows={2} maxLength={500} placeholder={t.why} aria-label={t.why} className="w-full rounded-xl bg-white p-2.5 text-[13px] outline-none border border-[#CDEBDB]" />
                  <button type="button" onClick={askReopen} disabled={sending} className="h-9 px-4 rounded-full bg-[#1F8A5B] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                    {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t.askSend}
                  </button>
                </div>
              )}
            </div>
          )}

          {playing && (
            <div className="mb-3 rounded-2xl overflow-hidden bg-black aspect-video relative">
              <iframe key={playing} src={embedUrl(playing)} title="YouTube" allow="autoplay; encrypted-media" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
              <button type="button" onClick={() => setPlaying(null)} aria-label={t.close} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
          )}

          {review ? (
            <>
              <h3 className="text-[17px] font-extrabold text-[#17151F]">{t.reviewTitle}</h3>
              <p className="text-[13px] text-[#6B6680] mb-3">{t.reviewSub}</p>
              {emptyParts.length > 0 && <p className="mb-3 rounded-2xl bg-[#FFF9EF] border border-[#FFF3E0] p-3 text-[13px] text-[#7A4A00]">{t.warn(emptyParts.map(p => p.label).join(", "))}</p>}
              <div className="space-y-3">
                {parts.map((p, i) => (
                  <div key={p.key} className="rounded-2xl bg-white border border-[#F1EFF6] p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#17151F]">{p.label}</p>
                      <button type="button" onClick={() => setStep(i)} className="text-[13px] font-semibold" style={{ color: brand }}>{t.change}</button>
                    </div>
                    {(picks[p.key] ?? []).length === 0 ? <p className="text-[13px] text-[#8A8599] mt-1">{t.empty}</p> : (
                      <ol className="mt-1.5 space-y-1.5">
                        {(picks[p.key] ?? []).map((s, j) => (
                          <li key={s.youtubeId} className="text-[13px] text-[#17151F] flex gap-2"><span className="font-bold tabular-nums" style={{ color: brand }}>{j + 1}.</span>
                            <span className="min-w-0"><span className="block line-clamp-2">{s.title}</span>{s.note && <span className="block text-[#6B6680]">“{s.note}”</span>}</span></li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
              <textarea value={note} onChange={e => { dirty.current = true; setNote(e.target.value); }} rows={2} maxLength={1000} placeholder={t.anyNote} aria-label={t.anyNote}
                className="mt-3 w-full rounded-2xl bg-white border border-[#F1EFF6] p-3 text-sm outline-none focus:ring-2 focus:ring-[#B5B0C4]" />
              <p className="mt-2 text-xs text-[#6B6680]">{t.after}</p>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-1.5 mt-1">
                <h3 className="text-sm font-bold text-[#17151F]">{t.yours} <span className="text-[#8A8599] tabular-nums">({list.length}/{music.perPart})</span></h3>
              </div>
              {!locked && <p className="text-xs text-[#6B6680] mb-2">{t.upTo(music.perPart)}</p>}
              {list.length === 0 ? <p className="rounded-2xl border border-dashed border-[#E4E0EC] bg-white/60 p-4 text-center text-[13px] text-[#6B6680]">{t.none}</p>
                : <ol className="space-y-2">{list.map((s, i) => songRow(s, i))}</ol>}

              {msg && <p role="alert" className="mt-2.5 rounded-xl bg-[#FEF5F7] border border-[#FDECEF] px-3 py-2 text-[13px] text-[#C2304F]">{msg}</p>}

              {!locked && (
                <>
                  <div className="mt-4 rounded-2xl bg-white border border-[#F1EFF6] p-3.5">
                    <p className="text-sm font-bold text-[#17151F]">{t.own}</p>
                    <p className="text-xs text-[#6B6680] mb-2">{t.ownHint}</p>
                    <div className="flex gap-2">
                      <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addOwn(); }} inputMode="url" placeholder={t.paste} aria-label={t.paste}
                        className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-[#F7F5FB] text-sm outline-none focus:ring-2 focus:ring-[#B5B0C4]" />
                      <button type="button" onClick={addOwn} disabled={adding || !link.trim()} className="h-11 px-4 rounded-xl text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0" style={{ backgroundColor: brand }}>
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{t.add}
                      </button>
                    </div>
                  </div>

                  {ideas.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-bold text-[#17151F] mb-2">{t.ideas}</h3>
                      <ul className="space-y-2">
                        {ideas.map(s => (
                          <li key={s.youtubeId} className="rounded-2xl bg-white border border-[#F1EFF6] p-2.5 flex items-center gap-2.5">
                            <Thumb song={s} label={t.listen} playing={playing === s.youtubeId} onPlay={() => setPlaying(p => (p === s.youtubeId ? null : s.youtubeId))} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-semibold text-[#17151F] leading-snug line-clamp-2">{s.title}</p>
                              <p className="text-xs text-[#6B6680] truncate">{s.pick ? t.studioPick : s.channel}</p>
                            </div>
                            <a href={s.url} target="_blank" rel="noreferrer" aria-label={t.youtube} className="w-9 h-9 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#F1EFF6] flex-shrink-0"><ExternalLink className="w-4 h-4" /></a>
                            <button type="button" onClick={() => addSong(s, "studio")} aria-label={`${t.add}: ${s.title}`} className="w-10 h-10 rounded-full text-white flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brand }}><Plus className="w-5 h-5" /></button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-white/85 backdrop-blur border-t border-[#F1EFF6] flex items-center gap-2">
          {locked ? (
            <>
              <span className="flex-1 text-[13px] text-[#6B6680]">{t.songs(total)}</span>
              {step < parts.length - 1 && <button type="button" onClick={() => setStep(s => s + 1)} className="h-11 px-5 rounded-full text-white text-sm font-semibold inline-flex items-center gap-1.5" style={{ backgroundColor: brand }}>{t.next}<ArrowRight className="w-4 h-4" /></button>}
            </>
          ) : review ? (
            <>
              <button type="button" onClick={() => setStep(parts.length - 1)} className="h-11 px-4 rounded-full bg-[#F1EFF6] text-[#33303F] text-sm font-semibold inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" />{t.back}</button>
              <button type="button" onClick={send} disabled={sending || total === 0} className="flex-1 h-11 rounded-full text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: brand }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{sending ? t.sending : t.send}
              </button>
            </>
          ) : (
            <>
              <span className={cn("flex-1 text-[13px] inline-flex items-center gap-1.5", save === "error" ? "text-[#C2304F]" : "text-[#6B6680]")} aria-live="polite">
                {save === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.saving}</>}
                {save === "saved" && <><Check className="w-3.5 h-3.5 text-[#1F8A5B]" />{t.saved}</>}
                {save === "error" && t.notSaved}
              </span>
              <button type="button" onClick={() => { setStep(s => s + 1); setMsg(""); setPlaying(null); }}
                className="h-11 px-5 rounded-full text-white text-sm font-semibold inline-flex items-center gap-1.5" style={{ backgroundColor: brand }}>
                {step < parts.length - 1 ? t.next : t.review}<ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
