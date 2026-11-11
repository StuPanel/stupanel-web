"use client";

/**
 * The client's "choose your photos" screen, inside the client portal.
 * One album at a time: tap ✓ on a photo to choose it, ♥ for the ones you love most, ✕ for "don't want".
 * Open a photo big, swipe through, write a note. Every tap saves by itself.
 * Before sending: the whole list per album, with a gentle warning if the number is off.
 * After sending you can still change until the studio starts the album.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CalendarClock, Check, CheckCircle2, Heart, Images, Loader2, Lock, MessageSquareText, Send, Sparkles, StickyNote, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { portalHeaders } from "@/lib/portal-session";
import { PhotoViewer } from "@/components/photo-viewer";
import { albumProgress, apiUrl, isPicked, photoUrl, timeLeft, type ClientGallery, type ClientGalleryCard, type GPhoto, type Mark } from "@/lib/photos";

const T = {
    card: "Choose your album photos", cardSub: (n: number) => `${n} photos are ready for you`, open: "Choose photos", continue: "Continue choosing", see: "See your photos",
    chosen: (n: number) => `${n} chosen`, sent: "Sent to the studio", started: "The studio has started your album",
    all: "All", unseen: "Not decided", picked: "Chosen", important: "Love most", rejected: "Don't want", highlights: "Highlights",
    choose: "Choose", love: "Love most", dont: "Don't want", note: "Note for the studio (optional)", notePh: "e.g. make it brighter, crop closer…",
    full: (a: string, n: number) => `${a} is full (${n}). Remove one to choose another.`, extra: (a: string, n: number) => `More than ${n} in ${a} — the studio may charge for extra photos.`,
    saving: "Saving…", saved: "Saved", notSaved: "Not saved — check your internet", review: "Review & send", reviewTitle: "Check before sending", reviewSub: "This is what the studio gets.",
    fewer: (n: number) => `${n} fewer than asked`, more: (n: number) => `${n} more than asked`, ok: "Good", noLimit: "No limit",
    anyNote: "Anything else for the studio? (optional)", send: "Send to the studio", sending: "Sending…", sendHint: "You can still change your choice until the studio starts the album.",
    thanks: "Sent! Thank you", thanksSub: "The studio will start your album. Until then you can still change your choice here.", backToPhotos: "Back to my photos", close: "Close",
    lockedTaken: "Your album has started — your choice is locked.", lockedOver: "The time to choose is over.", ask: "Ask to change", why: "What do you want to change? (optional)", askSend: "Send request", asked: "Request sent — the studio will open it for you.",
    left: (s: string) => s, tapHint: "Tap ✓ to choose. Open a photo to see it big.", none: "No photos here.", photos: (n: number) => `${n} photos`, of: "of",
} as const;

type Filter = "all" | "unseen" | "picked" | "important" | "rejected";

export function PortalPhotos({ token, galleries, brand, onChanged }: { token: string; galleries: ClientGalleryCard[]; brand: string; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const t = T;
  return (
    <>
      {galleries.map(g => {
        const done = g.status === "submitted" || g.status === "taken";
        const left = g.status === "open" || g.status === "submitted" ? timeLeft(g.deadline) : null;
        return (
          <div key={g.id} className="mx-4 sm:mx-5 mb-4 rounded-2xl overflow-hidden border border-[#EEEBF4]" style={{ backgroundColor: `${brand}0D` }}>
            {g.covers.length > 0 && (
              <div className="grid grid-cols-4 gap-0.5">
                {g.covers.slice(0, 4).map((c, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={apiUrl(c)} alt="" loading="lazy" className="block w-full h-20 object-cover" />
                ))}
              </div>
            )}
            <div className="p-3.5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: brand }}><Images className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#17151F] truncate">{t.card}</p>
                <p className="text-xs text-[#4A4658] truncate">
                  {g.status === "taken" ? <span className="inline-flex items-center gap-1 text-[#1F8A5B] font-semibold"><Lock className="w-3 h-3" />{t.started}</span>
                    : g.status === "submitted" ? <span className="inline-flex items-center gap-1 text-[#1F8A5B] font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />{t.sent} · {t.chosen(g.picked)}</span>
                    : g.picked ? t.chosen(g.picked) : t.cardSub(g.photos)}
                  {left && <span className={cn("ml-1.5 font-semibold", left.soon ? "text-[#C2304F]" : "text-[#6B6680]")}>· {left.text}</span>}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(g.id)} className="h-10 px-4 rounded-full text-white text-sm font-semibold flex-shrink-0 hover:opacity-90" style={{ backgroundColor: brand }}>
                {done ? t.see : g.picked ? t.continue : t.open}
              </button>
            </div>
          </div>
        );
      })}
      {open && (
        <Chooser token={token} galleryId={open} brand={brand}
          onClose={() => { setOpen(null); onChanged(); }} />
      )}
    </>
  );
}

function Chooser({ token, galleryId, brand, onClose }: {
  token: string; galleryId: string; brand: string; onClose: () => void;
}) {
  const t = T;
  const [g, setG] = useState<ClientGallery | null>(null);
  const [failed, setFailed] = useState(false);
  const [album, setAlbum] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<number | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [toast, setToast] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState("");
  const [asked, setAsked] = useState(false);
  const queue = useRef(new Map<string, { id: string; mark?: Mark | null; note?: string | null }>());
  const noteDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/public/portal/${token}/photos/${galleryId}`, { headers: portalHeaders(token) });
      if (!r.ok) throw new Error();
      const d: ClientGallery = await r.json();
      setG(d); setNote(d.clientNote ?? ""); setAsked(!!d.reopenRequestedAt);
      setAlbum(a => a || d.albums[0]?.id || "");
    } catch { setFailed(true); }
  }, [token, galleryId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    document.documentElement.classList.add("sp-locked");
    return () => document.documentElement.classList.remove("sp-locked");
  }, []);

  const say = (s: string) => {
    setToast(s);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };

  const flush = useCallback(async () => {
    if (!queue.current.size && !noteDirty.current) return true;
    const changes = [...queue.current.values()];
    queue.current.clear();
    const body: Record<string, unknown> = { changes };
    if (noteDirty.current) { body.clientNote = note; noteDirty.current = false; }
    setSave("saving");
    try {
      const r = await fetch(`${API}/public/portal/${token}/photos/${galleryId}/marks`, {
        method: "PUT", headers: portalHeaders(token, { "Content-Type": "application/json" }), body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "");
      if (d.refused?.length) {
        const ids = new Set(d.refused.map((x: { id: string }) => x.id));
        setG(x => (x ? { ...x, photos: x.photos.map(p => (ids.has(p.id) ? { ...p, m: null } : p)) } : x));
        say(t.full(d.refused[0].album, d.refused[0].max));
      }
      if (Array.isArray(d.albums)) setG(x => (x ? { ...x, albums: x.albums.map(a => ({ ...a, picked: d.albums.find((y: { id: string; picked: number }) => y.id === a.id)?.picked ?? a.picked })) } : x));
      setSave("saved");
      return true;
    } catch (e) {
      for (const c of changes) if (!queue.current.has(c.id)) queue.current.set(c.id, c);
      setSave("error");
      if (e instanceof Error && e.message) say(e.message);
      return false;
    }
  }, [token, galleryId, note, t]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 600);
  }, [flush]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const albums = useMemo(() => g?.albums ?? [], [g?.albums]);
  const current = albums.find(a => a.id === album) ?? albums[0];
  const pickedIn = useCallback((aid: string) => (g?.photos ?? []).filter(p => p.a === aid && isPicked(p.m)).length, [g?.photos]);
  const inAlbum = useMemo(() => (g?.photos ?? []).filter(p => !current || p.a === current.id), [g?.photos, current]);
  const shown = useMemo(() => inAlbum.filter(p =>
    filter === "all" ? true : filter === "unseen" ? !p.m : filter === "picked" ? isPicked(p.m) : p.m === filter), [inAlbum, filter]);
  const highlights = useMemo(() => inAlbum.filter(p => p.hl), [inAlbum]);
  const locked = !g?.canChange;

  function mark(p: GPhoto, m: Mark) {
    if (!g || locked) return;
    const next: Mark | null = p.m === m ? null : m;
    const a = albums.find(x => x.id === p.a);
    if (a && isPicked(next) && !isPicked(p.m) && a.maxPicks !== null) {
      const n = pickedIn(a.id);
      if (n >= a.maxPicks && !a.allowExtra) { say(t.full(a.name, a.maxPicks)); navigator.vibrate?.(40); return; }
      if (n >= a.maxPicks && a.allowExtra) say(t.extra(a.name, a.maxPicks));
    }
    setG(x => (x ? { ...x, photos: x.photos.map(y => (y.id === p.id ? { ...y, m: next } : y)) } : x));
    queue.current.set(p.id, { ...(queue.current.get(p.id) ?? { id: p.id }), mark: next });
    schedule();
  }
  function setPhotoNote(p: GPhoto, text: string) {
    setG(x => (x ? { ...x, photos: x.photos.map(y => (y.id === p.id ? { ...y, no: text || null } : y)) } : x));
    queue.current.set(p.id, { ...(queue.current.get(p.id) ?? { id: p.id }), note: text || null });
    schedule();
  }

  async function send() {
    if (!(await flush())) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/public/portal/${token}/photos/${galleryId}/submit`, { method: "POST", headers: portalHeaders(token) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { say(d.message || t.notSaved); return; }
      setReviewing(false); setThanks(true);
      setG(x => (x ? { ...x, status: "submitted", submittedAt: new Date().toISOString() } : x));
    } finally { setSending(false); }
  }
  async function askChange() {
    const r = await fetch(`${API}/public/portal/${token}/photos/${galleryId}/reopen`, {
      method: "POST", headers: portalHeaders(token, { "Content-Type": "application/json" }), body: JSON.stringify({ reason: why }),
    }).catch(() => null);
    if (r?.ok) { setAsked(true); setAsking(false); say(t.asked); }
  }
  async function close() { await flush(); onClose(); }

  const left = g && (g.status === "open" || g.status === "submitted") ? timeLeft(g.deadline) : null;
  const totalPicked = (g?.photos ?? []).filter(p => isPicked(p.m)).length;
  const vp = view !== null ? shown[view] : null;
  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: t.all, n: inAlbum.length },
    { id: "unseen", label: t.unseen, n: inAlbum.filter(p => !p.m).length },
    { id: "picked", label: t.picked, n: inAlbum.filter(p => isPicked(p.m)).length },
    { id: "important", label: t.important, n: inAlbum.filter(p => p.m === "important").length },
    { id: "rejected", label: t.rejected, n: inAlbum.filter(p => p.m === "rejected").length },
  ];

  const markButtons = (p: GPhoto, big = false) => (
    <div className={cn("flex items-center", big ? "gap-2" : "gap-1")}>
      {([
        { m: "selected" as Mark, I: Check, label: t.choose, on: "bg-[#1F8A5B] text-white" },
        { m: "important" as Mark, I: Heart, label: t.love, on: "bg-[#C2304F] text-white" },
        { m: "rejected" as Mark, I: X, label: t.dont, on: "bg-[#33303F] text-white" },
      ]).map(b => {
        const on = p.m === b.m || (b.m === "selected" && p.m === "important" && !big);
        return (
          <button key={b.m} type="button" disabled={locked} aria-pressed={p.m === b.m} aria-label={b.label}
            onClick={e => { e.stopPropagation(); mark(p, b.m); }}
            className={cn("rounded-full flex items-center justify-center gap-1.5 font-semibold transition-all active:scale-90 disabled:opacity-60",
              big ? "h-12 px-4 text-[14px] flex-1" : "w-8 h-8",
              p.m === b.m ? b.on : big ? "bg-white/10 text-white hover:bg-white/20" : on ? "bg-[#1F8A5B]/90 text-white" : "bg-white/85 text-[#33303F] backdrop-blur hover:bg-white")}>
            <b.I className={big ? "w-5 h-5" : "w-4 h-4"} fill={b.m === "important" && p.m === "important" ? "currentColor" : "none"} strokeWidth={2.4} />
            {big && <span>{b.label}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-[#F7F6FA] flex flex-col sp-fade-in" role="dialog" aria-modal="true" aria-label={t.card}>
      {/* Top bar */}
      <header className="flex-shrink-0 bg-white/85 backdrop-blur-xl border-b border-[#F1EFF6]">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 h-14 flex items-center gap-3">
          <button type="button" onClick={close} aria-label={t.close} className="w-10 h-10 rounded-full hover:bg-[#F1EFF6] flex items-center justify-center text-[#33303F]"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#17151F] truncate">{g?.title ?? "…"}</p>
            <p className="text-[12px] text-[#6B6680] truncate">
              {save === "saving" ? t.saving : save === "error" ? <span className="text-[#C2304F]">{t.notSaved}</span> : save === "saved" ? <span className="text-[#1F8A5B]">{t.saved}</span> : g?.studio}
            </p>
          </div>
          {left && <span className={cn("hidden sm:inline-flex h-8 px-3 rounded-full text-[12.5px] font-semibold items-center gap-1", left.soon ? "bg-[#FEF5F7] text-[#C2304F]" : "bg-[#F1EFF6] text-[#4A4658]")}><CalendarClock className="w-3.5 h-3.5" />{left.text}</span>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {!g ? (
          failed ? <p className="text-center text-[#6B6680] py-20">Could not open — please try again.</p>
            : <div className="max-w-6xl mx-auto p-4 grid grid-cols-3 sm:grid-cols-5 gap-1.5">{Array.from({ length: 15 }).map((_, i) => <div key={i} className="sp-skel aspect-square rounded-xl" />)}</div>
        ) : (
          <div className="max-w-6xl mx-auto px-3 sm:px-5 pt-4 pb-32">
            {/* Messages */}
            {g.welcome && <div className="mb-3 rounded-2xl bg-white p-4 text-[14px] text-[#33303F] shadow-sm flex gap-2.5"><MessageSquareText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: brand }} /><p className="whitespace-pre-line">{g.welcome}</p></div>}
            {locked && (
              <div className="mb-3 rounded-2xl bg-[#17151F] text-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="flex-1 text-[14px] flex items-center gap-2"><Lock className="w-4 h-4 flex-shrink-0" />{g.status === "taken" ? t.lockedTaken : g.lockedWhy || t.lockedOver}</p>
                {g.status === "taken" && (asked ? <span className="text-[13px] text-[#9AD5B6]">{t.asked}</span>
                  : <button type="button" onClick={() => setAsking(true)} className="h-10 px-4 rounded-full bg-white text-[#17151F] text-[13px] font-semibold flex-shrink-0">{t.ask}</button>)}
              </div>
            )}
            {!locked && g.status === "submitted" && (
              <div className="mb-3 rounded-2xl bg-[#F0FAF4] text-[#14613F] p-3.5 text-[13.5px] flex items-center gap-2"><CheckCircle2 className="w-4 h-4 flex-shrink-0" />{t.sent}. {t.sendHint}</div>
            )}

            {/* Albums */}
            {albums.length > 1 && (
              <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-2 [scrollbar-width:none]" role="tablist">
                {albums.map(a => {
                  const n = pickedIn(a.id);
                  const pr = albumProgress(a, n);
                  const on = current?.id === a.id;
                  return (
                    <button key={a.id} type="button" role="tab" aria-selected={on} onClick={() => { setAlbum(a.id); setFilter("all"); }}
                      className={cn("flex-shrink-0 min-w-[140px] rounded-2xl px-4 py-2.5 text-left transition-all", on ? "text-white shadow-md" : "bg-white text-[#17151F]")}
                      style={on ? { backgroundColor: brand } : undefined}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-[13.5px] font-bold truncate">{a.name}</span>
                        <span className="text-[12.5px] font-bold tabular-nums">{pr.text}</span>
                      </span>
                      <span className={cn("block h-1 rounded-full mt-2 overflow-hidden", on ? "bg-white/25" : "bg-[#F1EFF6]")}>
                        <span className={cn("block h-full rounded-full transition-[width] duration-500", pr.over ? "bg-rose-400" : on ? "bg-white" : pr.okRange ? "bg-[#1F8A5B]" : "")} style={{ width: `${pr.pct}%`, ...(!on && !pr.over && !pr.okRange ? { backgroundColor: brand } : {}) }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Highlights */}
            {highlights.length > 0 && filter === "all" && (
              <div className="mt-2 mb-3">
                <p className="text-[13px] font-bold text-[#33303F] mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4" style={{ color: brand }} />{t.highlights}</p>
                <div className="flex gap-2 overflow-x-auto -mx-3 px-3 [scrollbar-width:none]">
                  {highlights.slice(0, 12).map(p => (
                    <button key={p.id} type="button" onClick={() => setView(shown.indexOf(p))} className="relative flex-shrink-0 w-36 h-24 sm:w-48 sm:h-32 rounded-2xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(g.id, p.id, "t", g.img)} alt="" className="w-full h-full object-cover" onContextMenu={e => e.preventDefault()} />
                      {isPicked(p.m) && <span className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 py-2 sticky top-0 z-10 bg-[#F7F6FA]/90 backdrop-blur [scrollbar-width:none]">
              {filters.map(f => (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                  className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors", filter === f.id ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658]")}>
                  {f.label}<span className={cn("text-[12px]", filter === f.id ? "text-white/70" : "text-[#8A8599]")}>{f.n}</span>
                </button>
              ))}
            </div>
            {!locked && filter === "all" && !totalPicked && <p className="text-[12.5px] text-[#6B6680] mb-2">{t.tapHint}</p>}

            {/* Grid */}
            {shown.length === 0 ? <p className="text-center text-[#8A8599] py-16 text-sm">{t.none}</p> : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1 sm:gap-2">
                {shown.map((p, i) => (
                  <div key={p.id} className={cn("relative aspect-square rounded-xl overflow-hidden bg-[#E4E0EC] [content-visibility:auto] [contain-intrinsic-size:140px]",
                    isPicked(p.m) && "ring-[3px] ring-[#1F8A5B]", p.m === "important" && "ring-[#C2304F]", p.m === "rejected" && "opacity-45")}>
                    <button type="button" onClick={() => setView(i)} aria-label={p.n} className="absolute inset-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(g.id, p.id, "t", g.img)} alt="" loading="lazy" decoding="async" draggable={false} onContextMenu={e => e.preventDefault()} className="w-full h-full object-cover" />
                    </button>
                    {p.m === "important" && <span className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-[#C2304F] text-white flex items-center justify-center shadow"><Heart className="w-3.5 h-3.5" fill="currentColor" /></span>}
                    {p.no && <span className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow" style={{ color: brand }}><StickyNote className="w-3.5 h-3.5" /></span>}
                    {!locked && (
                      <button type="button" onClick={() => mark(p, isPicked(p.m) ? (p.m as Mark) : "selected")} aria-pressed={isPicked(p.m)} aria-label={t.choose}
                        className={cn("absolute right-1.5 bottom-1.5 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90",
                          isPicked(p.m) ? "bg-[#1F8A5B] text-white" : "bg-white/80 text-[#4A4658] backdrop-blur")}>
                        <Check className="w-5 h-5" strokeWidth={3} />
                      </button>
                    )}
                    {locked && isPicked(p.m) && <span className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center"><Check className="w-4 h-4" strokeWidth={3} /></span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom bar */}
      {g && !thanks && (
        <div className="flex-shrink-0 bg-white/90 backdrop-blur-xl border-t border-[#F1EFF6] pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {current && (() => {
                const pr = albumProgress(current, pickedIn(current.id));
                return (
                  <>
                    <p className="text-[13px] font-semibold text-[#17151F] truncate">{current.name}: <span className="tabular-nums">{pr.text}</span></p>
                    <div className="h-1.5 rounded-full bg-[#F1EFF6] mt-1.5 overflow-hidden"><div className={cn("h-full rounded-full transition-[width] duration-500", pr.over ? "bg-[#C2304F]" : pr.okRange ? "bg-[#1F8A5B]" : "")} style={{ width: `${pr.pct}%`, ...(!pr.over && !pr.okRange ? { backgroundColor: brand } : {}) }} /></div>
                  </>
                );
              })()}
            </div>
            {!locked && (
              <button type="button" onClick={() => { void flush(); setReviewing(true); }} disabled={!totalPicked}
                className="h-11 px-5 rounded-full text-white text-[14px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 flex-shrink-0 shadow-md" style={{ backgroundColor: brand }}>
                <Send className="w-4 h-4" />{t.review}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[90] max-w-[92vw] px-4 py-2.5 rounded-2xl bg-[#17151F] text-white text-[13.5px] shadow-xl sp-pop-in">{toast}</div>}

      {/* Viewer */}
      {g && vp && view !== null && (
        <PhotoViewer count={shown.length} index={view} onIndex={setView} onClose={() => setView(null)}
          src={photoUrl(g.id, vp.id, "v", g.img)}
          preload={[shown[view + 1], shown[view + 2], shown[view - 1]].filter(Boolean).map(p => photoUrl(g.id, p!.id, "v", g.img))}
          title={`${view + 1} ${t.of} ${shown.length}`} sub={albums.find(a => a.id === vp.a)?.name}
          onKey={e => {
            if (locked) return false;
            const k = e.key.toLowerCase();
            if (k === "1" || k === "s" || k === " ") { mark(vp, "selected"); return true; }
            if (k === "2" || k === "l") { mark(vp, "important"); return true; }
            if (k === "3" || k === "x") { mark(vp, "rejected"); return true; }
            return false;
          }}
          footer={
            <div className="max-w-xl mx-auto space-y-2.5">
              {!locked && markButtons(vp, true)}
              {locked && <p className="text-center text-[13px] text-white/70">{isPicked(vp.m) ? t.picked : vp.m === "rejected" ? t.rejected : ""}</p>}
              {g.allowNotes && !locked && (
                <input key={vp.id} defaultValue={vp.no ?? ""} maxLength={500} placeholder={t.notePh} aria-label={t.note}
                  onBlur={e => { if ((e.target.value || null) !== (vp.no || null)) setPhotoNote(vp, e.target.value.trim()); }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="w-full h-11 px-4 rounded-full bg-white/10 text-white placeholder:text-white/40 text-[14px] outline-none focus:bg-white/15" />
              )}
              {locked && vp.no && <p className="text-[13px] text-white/80 text-center">“{vp.no}”</p>}
            </div>
          } />
      )}

      {/* Review */}
      {g && reviewing && (
        <>
          <div className="sp-backdrop z-[70]" onClick={() => setReviewing(false)} />
          <div className="sp-drawer z-[75] sm:max-w-[520px] flex flex-col bg-[#F7F6FA]" role="dialog" aria-modal="true" aria-label={t.reviewTitle}>
            <div className="px-5 pt-5 pb-3 flex items-center gap-3">
              <div className="flex-1">
                <h2 className="text-[20px] font-extrabold text-[#17151F]">{t.reviewTitle}</h2>
                <p className="text-[13px] text-[#6B6680]">{t.reviewSub}</p>
              </div>
              <button type="button" onClick={() => setReviewing(false)} aria-label={t.close} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#6B6680]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-4 space-y-3">
              {albums.map(a => {
                const list = g.photos.filter(p => p.a === a.id && isPicked(p.m));
                const pr = albumProgress(a, list.length);
                const diff = pr.under ? (a.minPicks ?? 0) - list.length : pr.over ? list.length - (a.maxPicks ?? 0) : 0;
                return (
                  <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[15px] font-bold text-[#17151F]">{a.name}</p>
                      <span className={cn("h-7 px-2.5 rounded-full text-[12.5px] font-bold inline-flex items-center", pr.under || pr.over ? "bg-[#FEF5F7] text-[#C2304F]" : "bg-[#F0FAF4] text-[#1F8A5B]")}>
                        {pr.text}
                      </span>
                    </div>
                    <p className={cn("text-[12.5px] mt-1", pr.under || pr.over ? "text-[#C2304F]" : "text-[#6B6680]")}>
                      {pr.under ? t.fewer(diff) : pr.over ? t.more(diff) : a.limit ? t.ok : t.noLimit}
                      {list.some(p => p.m === "important") && ` · ♥ ${list.filter(p => p.m === "important").length}`}
                    </p>
                    {list.length > 0 && (
                      <div className="flex gap-1 mt-3 overflow-x-auto [scrollbar-width:none]">
                        {list.slice(0, 20).map(p => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={p.id} src={photoUrl(g.id, p.id, "t", g.img)} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        ))}
                        {list.length > 20 && <span className="w-14 h-14 rounded-lg bg-[#F1EFF6] text-[#6B6680] text-[12px] font-semibold flex items-center justify-center flex-shrink-0">+{list.length - 20}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <label htmlFor="ps-note" className="text-[13px] font-semibold text-[#33303F]">{t.anyNote}</label>
                <textarea id="ps-note" value={note} maxLength={2000} rows={3} onChange={e => { setNote(e.target.value); noteDirty.current = true; }}
                  className="mt-2 w-full px-3.5 py-2.5 rounded-xl bg-[#F7F5FB] text-[14px] outline-none border border-transparent focus:bg-white focus:border-[#B5B0C4] resize-none" />
              </div>
            </div>
            <div className="px-4 sm:px-5 py-4 bg-white/85 backdrop-blur border-t border-[#F1EFF6]">
              <p className="text-[12.5px] text-[#6B6680] mb-2">{t.sendHint}</p>
              <button type="button" onClick={send} disabled={sending} className="w-full h-12 rounded-full text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: brand }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{sending ? t.sending : t.send}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Thanks */}
      {thanks && (
        <div className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sp-fade-in">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-6 text-center sp-pop-in">
            <span className="w-16 h-16 mx-auto rounded-full bg-[#1F8A5B] text-white flex items-center justify-center"><Check className="w-8 h-8" strokeWidth={3} /></span>
            <p className="text-[20px] font-extrabold text-[#17151F] mt-4">{t.thanks}</p>
            <p className="text-[14px] text-[#6B6680] mt-1.5">{t.thanksSub}</p>
            <p className="text-[13px] font-semibold text-[#33303F] mt-3">{t.chosen(totalPicked)}</p>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setThanks(false)} className="flex-1 h-11 rounded-full bg-[#F1EFF6] text-[#33303F] text-[14px] font-semibold">{t.backToPhotos}</button>
              <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full text-white text-[14px] font-semibold" style={{ backgroundColor: brand }}>{t.close}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ask to change */}
      {asking && (
        <div className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sp-fade-in" onClick={() => setAsking(false)}>
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 sp-pop-in" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-bold text-[#17151F]">{t.ask}</p>
            <textarea value={why} maxLength={500} rows={3} onChange={e => setWhy(e.target.value)} placeholder={t.why}
              className="mt-3 w-full px-3.5 py-2.5 rounded-xl bg-[#F7F5FB] text-[14px] outline-none border border-transparent focus:bg-white focus:border-[#B5B0C4] resize-none" />
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setAsking(false)} className="flex-1 h-11 rounded-full bg-[#F1EFF6] text-[#33303F] text-[14px] font-semibold">{t.close}</button>
              <button type="button" onClick={askChange} className="flex-1 h-11 rounded-full text-white text-[14px] font-semibold" style={{ backgroundColor: brand }}>{t.askSend}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
