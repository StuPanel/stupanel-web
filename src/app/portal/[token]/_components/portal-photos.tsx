"use client";

/**
 * The client's "choose your photos" screen, inside the client portal.
 * One album at a time: tap ✓ on a photo to choose it, ♥ for the ones you love most, ✕ for "don't want".
 * Open a photo big, swipe through, write a note. Every tap saves by itself.
 * Before sending: the whole list per album, with a gentle warning if the number is off.
 * After sending you can still change until the studio starts the album.
 */
import { coverPos, coverZoom } from "@/lib/cover-focus";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Columns2, Eye, FolderOpen, Heart, Images, Loader2, Lock, MessageSquareText, Search, Send, Sparkles, StickyNote, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { portalPhotoApi, type SelectApi } from "@/lib/select-api";
import { PhotoViewer } from "@/components/photo-viewer";
import { useSeen } from "./use-seen";
import { albumProgress, drivePhoto, findPhotos, foldersOf, photoNumbers, isPicked, thumbOf, timeLeft, viewOf, zoomOf, type ClientGallery, type ClientGalleryCard, type GPhoto, type Mark } from "@/lib/photos";

const T = {
    card: "Choose your album photos", cardSub: (n: number) => `${n} photos are ready for you`, open: "Choose photos", continue: "Continue choosing", see: "See your photos",
    chosen: (n: number) => `${n} chosen`, sent: "Sent to the studio", started: "The studio has started your album",
    all: "All", fresh: "New", freshNote: (n: number) => `The studio added ${n} new photo${n > 1 ? "s" : ""} — they are marked “New”.`, unseen: "Not decided", picked: "Chosen", important: "Love most", rejected: "Don't want", highlights: "Highlights",
    choose: "Choose", love: "Love most", dont: "Don't want", note: "Note for the studio (optional)", notePh: "e.g. make it brighter, crop closer…",
    full: (a: string, n: number) => `${a} is full (${n}). Remove one to choose another.`, extra: (a: string, n: number) => `More than ${n} in ${a} — the studio may charge for extra photos.`,
    saving: "Saving…", saved: "Saved", notSaved: "Not saved — check your internet", review: "Review & send", reviewTitle: "Check before sending", reviewSub: "This is what the studio gets.",
    fewer: (n: number) => `${n} fewer than asked`, more: (n: number) => `${n} more than asked`, ok: "Good", noLimit: "No limit",
    anyNote: "Anything else for the studio? (optional)", send: "Send to the studio", sending: "Sending…", sendHint: "After sending, your choice is locked. If you need a change later, tap “Ask to change”.",
    thanks: "Sent! Thank you", thanksSub: "The studio will start your album. Your choice is locked now — if you need a change, tap “Ask to change”.", backToPhotos: "Back to my photos", close: "Close",
    lockedTaken: "Your album has started — your choice is locked.", lockedSent: "You sent your choice — it is locked.", lockedOver: "The time to choose is over.", ask: "Ask to change", why: "What do you want to change? (optional)", askSend: "Send request", asked: "Request sent — the studio will open it for you.",
    seen: (n: number, of: number) => `Seen ${n} of ${of} photos`, seenAll: (n: number) => `You've seen all ${n} photos`,
    resume: "Continue where you left off", resumeSub: (i: number, n: number, a: string) => `Photo ${i} of ${n}${a ? ` · ${a}` : ""}`, resumeGo: "Continue", dismiss: "Dismiss",
    folders: "Folders", allFolders: "All", otherPhotos: "Other photos",
    hi: (n: string) => (n ? `Hi ${n},` : "Hello,"), coverLabel: "Choose your album photos", start: "Start choosing", goOn: "Continue choosing", look: "See your photos",
    coverPhotos: (n: number) => `${n} photos`, coverPick: (l: string) => `Choose ${l}`, coverSoFar: (n: number, of: number) => `${n} chosen so far · ${of} photos`,
    coverSaved: "Your choices save by themselves. Stop any time and come back later — on this phone or another.",
    chosenOf: (of: number) => `of ${of} chosen`,
    fullTitle: (n: number) => `You have already chosen ${n} photos`, fullText: (n: number) => `Your album has room for ${n}, so this photo was not added. To choose it, first take out one of your ${n}. Or send your choice to the studio now.`,
    fullDoneTitle: (n: number) => `All ${n} photos chosen`, fullDoneText: "Your album is complete. Have a last look and send it to the studio — you can still change it until they start the album.",
    fullShort: "complete", fullChange: "Change my chosen photos", fullSee: (n: number) => `See my ${n} photos`, fullKeep: "Keep looking", coverDefault: "your photos are ready. Pick the ones you want in your album.",
    find: "Find a photo", findPh: "Photo number or file name", findIn: (a: string) => `in ${a}`, noMatch: (q: string) => `No photo matches “${q}”. Try the number on the photo, e.g. 45.`, clearFind: "Clear",
    compare: "Compare", cmpHint: "Tap 2 to 4 photos to see them side by side", cmpCount: (n: number) => `${n} of 4 picked`, cmpGo: "Compare", cmpCancel: "Cancel", cmpDone: "Done", cmpMax: "You can compare up to 4 photos at a time.",
    cmpTitle: (n: number) => `Comparing ${n} photos`, cmpTake: "Remove from compare", cmpTip: "Choose the one you like — or more than one.", photoNo: (n: number | undefined) => (n ? `#${n}` : ""),
    side: "Your choice", sideTotal: (n: number) => `${n} photo${n === 1 ? "" : "s"} chosen`, sideLoved: (n: number) => `${n} loved most`, sideRecent: "Chosen so far", sideAll: "See all chosen", sideNone: "Nothing chosen yet. Tap ✓ on a photo to choose it.",
    left: (s: string) => s, tapHint: "Double-tap a photo (or tap ✓) to choose it. Tap once to see it big.", viewHint: "Double-tap to choose · swipe for the next photo", none: "No photos here.", photos: (n: number) => `${n} photos`, of: "of",
} as const;

type Filter = "all" | "new" | "unseen" | "picked" | "important" | "rejected";

export function PortalPhotos({ token, galleries, brand, onChanged, autoOpen }: {
  token: string; galleries: ClientGalleryCard[]; brand: string; onChanged: () => void;
  /** Open this gallery's chooser right away (from the to-do list). */
  autoOpen?: string;
}) {
  const [open, setOpen] = useState<string | null>(autoOpen && galleries.some(g => g.id === autoOpen) ? autoOpen : null);
  const chooserApi = useMemo(() => (open ? portalPhotoApi(token, open) : null), [token, open]);
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
                  <img key={i} src={drivePhoto(c)} alt="" loading="lazy" referrerPolicy="no-referrer" className="block w-full h-20 object-cover" />
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
      {/* On the page itself — inside the program card a transform would trap the full-screen chooser. */}
      {chooserApi && createPortal(
        <Chooser api={chooserApi} brand={brand}
          onClose={() => { setOpen(null); onChanged(); }} />, document.body)}
    </>
  );
}

/** The full-screen chooser. Without onClose (a direct link) there is nothing to go back to, so no close button. */
export function Chooser({ api, brand, onClose, onLoaded, onFailed, failText, after }: {
  api: SelectApi; brand: string; onClose?: () => void; onLoaded?: (g: ClientGallery) => void;
  /** It could not open (e.g. a link that was turned off) — the page shows its own message. */
  onFailed?: () => void;
  /** Shown when it can't open (e.g. a link that was turned off). */
  failText?: string;
  /** Extra line under the "Sent!" buttons (e.g. a link to the client portal). */
  after?: React.ReactNode;
}) {
  const t = T;
  const [g, setG] = useState<ClientGallery | null>(null);
  const [failed, setFailed] = useState(false);
  const [album, setAlbum] = useState<string>("");
  /** Folder inside the album (Holud, Wedding…): null = all of them, "" = photos without a folder */
  const [folderPick, setFolder] = useState<string | null>(null);
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
  const mainRef = useRef<HTMLElement>(null);
  /** Only remember a spot once the client has moved (opening the page alone is not "stopping" there). */
  const moved = useRef(false);
  const [flash, setFlash] = useState<string | null>(null);
  /** Grid: one tap opens the photo, two quick taps choose it. */
  const tap = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [gridBurst, setGridBurst] = useState<{ id: string; n: number } | null>(null);
  /** The viewer's tip shows the first time only. */
  const [hintSeen, setHintSeen] = useState(false);
  /** The welcome screen: shown when the page opens, gone after "Start". */
  const [intro, setIntro] = useState<"show" | "leaving" | "gone">("show");
  /** The album is full: "blocked" = they tried one more, "done" = they just chose the last one that fits. */
  const [full, setFull] = useState<{ album: string; max: number; why: "blocked" | "done" } | null>(null);
  const toldFull = useRef(new Set<string>());
  /** Find a photo by its number or file name (shown on each photo, the studio uses the same number). */
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState("");
  /** Compare: "pick" = tapping photos adds them; the overlay opens with 2–4 photos. */
  const [cmpPick, setCmpPick] = useState(false);
  const [cmpSel, setCmpSel] = useState<string[]>([]);
  const [cmpOpen, setCmpOpen] = useState(false);
  const cmpPushed = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await (api.fetch ?? fetch)(api.url(""), { headers: api.headers() });
      if (!r.ok) throw new Error();
      const d: ClientGallery = await r.json();
      setG(d); onLoaded?.(d); setNote(d.clientNote ?? ""); setAsked(!!d.reopenRequestedAt);
      setAlbum(a => a || d.albums[0]?.id || "");
    } catch { setFailed(true); onFailed?.(); }
  }, [api, onLoaded, onFailed]);
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
    // The studio's preview: the marks stay on this screen only.
    if (api.preview) { queue.current.clear(); noteDirty.current = false; setSave("saved"); return true; }
    const changes = [...queue.current.values()];
    queue.current.clear();
    const body: Record<string, unknown> = { changes };
    if (noteDirty.current) { body.clientNote = note; noteDirty.current = false; }
    setSave("saving");
    try {
      const r = await fetch(api.url("/marks"), {
        method: "PUT", headers: api.headers({ "Content-Type": "application/json" }), body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "");
      if (d.refused?.length) {
        const ids = new Set(d.refused.map((x: { id: string }) => x.id));
        setG(x => (x ? { ...x, photos: x.photos.map(p => (ids.has(p.id) ? { ...p, m: null } : p)) } : x));
        setFull({ album: d.refused[0].album, max: d.refused[0].max, why: "blocked" });
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
  }, [api, note, t]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 600);
  }, [flush]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const albums = useMemo(() => g?.albums ?? [], [g?.albums]);
  const current = albums.find(a => a.id === album) ?? albums[0];
  const pickedIn = useCallback((aid: string) => (g?.photos ?? []).filter(p => p.a === aid && isPicked(p.m)).length, [g?.photos]);
  const inAlbum = useMemo(() => (g?.photos ?? []).filter(p => !current || p.a === current.id), [g?.photos, current]);
  const folders = useMemo(() => foldersOf(inAlbum), [inAlbum]);
  // A folder that is not in this album (any more) counts as "all".
  const folder = folderPick !== null && folders.includes(folderPick) ? folderPick : null;
  const inFolder = useMemo(() => (folder === null ? inAlbum : inAlbum.filter(p => (p.f ?? "") === folder)), [inAlbum, folder]);
  const nums = useMemo(() => photoNumbers(g?.photos ?? []), [g?.photos]);
  const query = finding ? q.trim() : "";
  const shown = useMemo(() => query ? findPhotos(inAlbum, nums, query) : inFolder.filter(p =>
    filter === "all" ? true : filter === "new" ? !!p.nw : filter === "unseen" ? !p.m : filter === "picked" ? isPicked(p.m) : p.m === filter), [inFolder, filter, inAlbum, nums, query]);
  const highlights = useMemo(() => inFolder.filter(p => p.hl), [inFolder]);
  const locked = !g?.canChange;
  const { isSeen, version, resume, clearResume, markSeen, setLast } = useSeen(g?.id);
  const seenIn = useMemo(() => inAlbum.filter(p => p.m || isSeen(p.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inAlbum, isSeen, version]);
  const resumeAt = useMemo(() => {
    if (!g || !resume || locked) return null;
    const list = g.photos.filter(p => p.a === resume.a);
    const i = list.findIndex(p => p.id === resume.p);
    // Near the top there is nothing to continue from.
    return i >= 12 ? { photo: list[i], i, n: list.length, album: albums.find(a => a.id === resume.a)?.name ?? "" } : null;
  }, [g, resume, locked, albums]);

  // Photos that come into view count as seen; the top one on screen is where they are.
  useEffect(() => {
    const root = mainRef.current;
    if (!root || !g || !current) return;
    const visible = new Set<string>();
    let t: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.pid!;
        if (e.isIntersecting) visible.add(id); else visible.delete(id);
      }
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        if (!visible.size) return;
        markSeen([...visible]);
        if (moved.current && filter === "all") {
          const top = shown.find(p => visible.has(p.id));
          if (top) setLast({ a: current.id, p: top.id });
        }
      }, 350);
    }, { root, threshold: 0.6 });
    root.querySelectorAll<HTMLElement>("[data-pid]").forEach(el => io.observe(el));
    return () => { io.disconnect(); if (t) clearTimeout(t); };
  }, [g, current, shown, filter, markSeen, setLast]);

  function goResume() {
    if (!resumeAt) return;
    moved.current = true;
    setAlbum(resumeAt.photo.a); setFolder(null); setFilter("all"); clearResume();
    setTimeout(() => {
      document.getElementById(`ph-${resumeAt.photo.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      setFlash(resumeAt.photo.id);
      setTimeout(() => setFlash(null), 2200);
    }, 60);
  }

  /** Returns false when the photo could not be chosen (the album is full). */
  /** `next`: in the big view, slide to the next photo after marking. */
  function mark(p: GPhoto, m: Mark, next = false): boolean {
    if (!g || locked) return false;
    const nextMark: Mark | null = p.m === m ? null : m;
    const a = albums.find(x => x.id === p.a);
    if (a && isPicked(nextMark) && !isPicked(p.m) && a.maxPicks !== null) {
      const n = pickedIn(a.id);
      // Full: say it in the middle of the screen — a small line at the bottom is easy to miss.
      if (n >= a.maxPicks && !a.allowExtra) { setFull({ album: a.name, max: a.maxPicks, why: "blocked" }); navigator.vibrate?.([30, 60, 30]); return false; }
      if (n >= a.maxPicks && a.allowExtra) say(t.extra(a.name, a.maxPicks));
      // The last one that fits: tell them the album is complete and offer to send it.
      if (n + 1 === a.maxPicks && !a.allowExtra && !toldFull.current.has(a.id)) { toldFull.current.add(a.id); setTimeout(() => setFull({ album: a.name, max: a.maxPicks!, why: "done" }), 650); }
    }
    setG(x => (x ? { ...x, photos: x.photos.map(y => (y.id === p.id ? { ...y, m: nextMark } : y)) } : x));
    queue.current.set(p.id, { ...(queue.current.get(p.id) ?? { id: p.id }), mark: nextMark });
    schedule();
    if (next) slideOn(nextMark);
    return true;
  }
  /** Double-tap: choose it (never un-chooses — that's what the ✓ button is for). False = it was not chosen. */
  function quickChoose(p: GPhoto, next = false): boolean {
    if (!g || locked) return false;
    if (isPicked(p.m)) { if (next) slideOn(p.m); return true; }
    return mark(p, "selected", next);
  }
  function onCellTap(p: GPhoto, i: number) {
    if (tap.current?.id === p.id) {
      clearTimeout(tap.current.timer); tap.current = null;
      if (locked) { setView(i); return; }
      if (!quickChoose(p)) return;
      setGridBurst(b => ({ id: p.id, n: (b?.n ?? 0) + 1 }));
      navigator.vibrate?.(15);
      return;
    }
    if (tap.current) clearTimeout(tap.current.timer);
    tap.current = { id: p.id, timer: setTimeout(() => { tap.current = null; setView(i); }, locked ? 0 : 260) };
  }
  useEffect(() => () => { if (tap.current) clearTimeout(tap.current.timer); }, []);

  function toggleCmp(p: GPhoto) {
    setCmpSel(list => {
      if (list.includes(p.id)) return list.filter(x => x !== p.id);
      if (list.length >= 4) { say(t.cmpMax); return list; }
      navigator.vibrate?.(10);
      return [...list, p.id];
    });
  }
  function startCmp() { setCmpPick(true); setCmpSel([]); setFinding(false); setQ(""); }
  function stopCmp() { setCmpPick(false); setCmpSel([]); }
  // The phone's Back closes the compare view (not the whole page).
  function openCmp() {
    if (cmpSel.length < 2) return;
    setCmpOpen(true);
    try { history.pushState({ spCompare: 1 }, ""); cmpPushed.current = true; } catch { /* no history */ }
  }
  function closeCmp() {
    setCmpOpen(false);
    if (cmpPushed.current) { cmpPushed.current = false; try { history.back(); } catch { /* ignore */ } }
  }
  useEffect(() => {
    if (!cmpOpen) return;
    const onPop = () => { cmpPushed.current = false; setCmpOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !full) closeCmp(); };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey); };
  }, [cmpOpen, full]);
  const cmpPhotos = useMemo(() => cmpSel.map(id => g?.photos.find(p => p.id === id)).filter((p): p is GPhoto => !!p), [cmpSel, g?.photos]);

  function setPhotoNote(p: GPhoto, text: string) {
    setG(x => (x ? { ...x, photos: x.photos.map(y => (y.id === p.id ? { ...y, no: text || null } : y)) } : x));
    queue.current.set(p.id, { ...(queue.current.get(p.id) ?? { id: p.id }), note: text || null });
    schedule();
  }

  async function send() {
    if (!(await flush())) return;
    if (api.preview) { setReviewing(false); setThanks(true); return; }
    setSending(true);
    try {
      const r = await fetch(api.url("/submit"), { method: "POST", headers: api.headers() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { say(d.message || t.notSaved); return; }
      setReviewing(false); setThanks(true);
      setG(x => (x ? { ...x, status: "submitted", submittedAt: new Date().toISOString() } : x));
    } finally { setSending(false); }
  }
  async function askChange() {
    if (api.preview) { setAsked(true); setAsking(false); say(t.asked); return; }
    const r = await fetch(api.url("/reopen"), {
      method: "POST", headers: api.headers({ "Content-Type": "application/json" }), body: JSON.stringify({ reason: why }),
    }).catch(() => null);
    if (r?.ok) { setAsked(true); setAsking(false); say(t.asked); }
  }
  async function close() { await flush(); onClose?.(); }

  const left = g && (g.status === "open" || g.status === "submitted") ? timeLeft(g.deadline) : null;
  const totalPicked = (g?.photos ?? []).filter(p => isPicked(p.m)).length;
  const loved = (g?.photos ?? []).filter(p => p.m === "important").length;
  /** The side card on wide screens: the last 8 chosen photos of the album in view. */
  const recent = (g?.photos ?? []).filter(p => isPicked(p.m) && (!current || p.a === current.id)).slice(-8);
  const vp = view !== null ? shown[view] : null;
  // Big view, top right: "20 / 20–30" for the album of the photo shown (just the number when it has no limit).
  const viewAlbum = view !== null && g ? albums.find(a => a.id === vp?.a) : undefined;
  const viewCount = viewAlbum ? albumProgress(viewAlbum, pickedIn(viewAlbum.id)).text : String(totalPicked);
  // After a mark in the big view, the next photo slides in — unless the marked one leaves this list
  // (e.g. "Not decided"), then the next one is already in its place.
  const [nextSig, setNextSig] = useState(0);
  function slideOn(next: Mark | null) {
    const stays = filter === "all" || filter === "new" ? true : filter === "unseen" ? !next : filter === "picked" ? isPicked(next) : next === filter;
    if (stays) setNextSig(n => n + 1);
  }
  useEffect(() => {
    if (!vp) return;
    markSeen([vp.id]);
    moved.current = true;
    setLast({ a: vp.a, p: vp.id });
  }, [vp, markSeen, setLast]);
  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: t.all, n: inFolder.length },
    ...(inFolder.some(p => p.nw) ? [{ id: "new" as Filter, label: t.fresh, n: inFolder.filter(p => p.nw).length }] : []),
    { id: "unseen", label: t.unseen, n: inFolder.filter(p => !p.m).length },
    { id: "picked", label: t.picked, n: inFolder.filter(p => isPicked(p.m)).length },
    ...(g?.allowLove !== false ? [{ id: "important" as Filter, label: t.important, n: inFolder.filter(p => p.m === "important").length }] : []),
    { id: "rejected", label: t.rejected, n: inFolder.filter(p => p.m === "rejected").length },
  ];

  const markButtons = (p: GPhoto, big = false) => (
    <div className={cn("flex items-center", big ? "gap-2" : "gap-1")}>
      {([
        { m: "selected" as Mark, I: Check, label: t.choose, on: "bg-[#1F8A5B] text-white" },
        { m: "important" as Mark, I: Heart, label: t.love, on: "bg-[#C2304F] text-white" },
        { m: "rejected" as Mark, I: X, label: t.dont, on: "bg-[#33303F] text-white" },
      ]).filter(b => b.m !== "important" || g?.allowLove !== false).map(b => {
        const on = p.m === b.m || (b.m === "selected" && p.m === "important" && !big);
        return (
          <button key={b.m} type="button" disabled={locked} aria-pressed={p.m === b.m} aria-label={b.label}
            onClick={big ? e => { e.stopPropagation(); mark(p, b.m, true); } : e => { e.stopPropagation(); mark(p, b.m); }}
            className={cn("rounded-full flex items-center justify-center gap-1.5 font-semibold transition-all active:scale-90 disabled:opacity-60",
              big ? "h-12 px-2.5 text-[13.5px] flex-1 whitespace-nowrap" : "w-8 h-8",
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
          {onClose && <button type="button" onClick={close} aria-label={t.close} className="w-10 h-10 rounded-full hover:bg-[#F1EFF6] flex items-center justify-center text-[#33303F]"><ArrowLeft className="w-5 h-5" /></button>}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#17151F] truncate">{g?.title ?? "…"}</p>
            <p className="text-[12px] text-[#6B6680] truncate">
              {save === "saving" ? t.saving : save === "error" ? <span className="text-[#C2304F]">{t.notSaved}</span> : save === "saved" ? <span className="text-[#1F8A5B]">{t.saved}</span> : g?.studio}
            </p>
          </div>
          {left && <span className={cn("hidden sm:inline-flex h-8 px-3 rounded-full text-[12.5px] font-semibold items-center gap-1", left.soon ? "bg-[#FEF5F7] text-[#C2304F]" : "bg-[#F1EFF6] text-[#4A4658]")}><CalendarClock className="w-3.5 h-3.5" />{left.text}</span>}
          {/* How many are chosen, always in view */}
          {g && (
            <span className="flex-shrink-0 h-10 pl-2 pr-3.5 rounded-full bg-[#F0FAF4] inline-flex items-center gap-2" role="status" aria-label={`${totalPicked} ${t.chosenOf(g.photos.length)}`}>
              <span className="w-6 h-6 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>
              <span className="leading-none">
                <span key={totalPicked} className="sp-count text-[17px] font-extrabold text-[#14613F] tabular-nums">{totalPicked}</span>
                <span className="block text-[10.5px] font-semibold text-[#3E8062] mt-0.5 whitespace-nowrap">{t.chosenOf(g.photos.length)}</span>
              </span>
            </span>
          )}
        </div>
      </header>

      <main ref={mainRef} onScroll={() => { moved.current = true; }} className="flex-1 overflow-y-auto">
        {!g ? (
          failed ? <p className="text-center text-[#6B6680] py-20 px-6">{failText ?? "Could not open — please try again."}</p>
            : <div className="max-w-6xl mx-auto p-4 grid grid-cols-3 sm:grid-cols-5 gap-1.5">{Array.from({ length: 15 }).map((_, i) => <div key={i} className="sp-skel aspect-square rounded-xl" />)}</div>
        ) : (
          <div className="max-w-6xl xl:max-w-[1360px] mx-auto px-3 sm:px-5 pt-4 pb-32 xl:flex xl:items-start xl:gap-6">
          <div className="flex-1 min-w-0">
            {/* Messages */}
            {g.welcome && <div className="mb-3 rounded-2xl bg-white p-4 text-[14px] text-[#33303F] shadow-sm flex gap-2.5"><MessageSquareText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: brand }} /><p className="whitespace-pre-line">{g.welcome}</p></div>}
            {locked && (
              <div className="mb-3 rounded-2xl bg-[#17151F] text-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="flex-1 text-[14px] flex items-center gap-2"><Lock className="w-4 h-4 flex-shrink-0" />{g.status === "taken" ? t.lockedTaken : g.status === "submitted" ? t.lockedSent : g.lockedWhy || t.lockedOver}</p>
                {(g.status === "taken" || g.status === "submitted") && (asked ? <span className="text-[13px] text-[#9AD5B6]">{t.asked}</span>
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
                    <button key={a.id} type="button" role="tab" aria-selected={on} onClick={() => { setAlbum(a.id); setFolder(null); setFilter("all"); }}
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

            {/* Folders inside the album (Holud, Wedding…): one album, one count for all of them */}
            {folders.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-2 mt-1 [scrollbar-width:none]" role="tablist" aria-label={t.folders}>
                {[null, ...folders].map(f => {
                  const list = f === null ? inAlbum : inAlbum.filter(p => (p.f ?? "") === f);
                  const on = folder === f;
                  return (
                    <button key={f ?? "*"} type="button" role="tab" aria-selected={on} onClick={() => { setFolder(f); setView(null); mainRef.current?.scrollTo({ top: 0 }); }}
                      className={cn("flex-shrink-0 h-11 pl-3.5 pr-4 rounded-2xl text-left inline-flex items-center gap-2 transition-all", on ? "text-white shadow-md" : "bg-white text-[#17151F]")}
                      style={on ? { backgroundColor: brand } : undefined}>
                      {f === null ? <Images className="w-4 h-4 flex-shrink-0" /> : <FolderOpen className="w-4 h-4 flex-shrink-0" />}
                      <span className="text-[13.5px] font-bold whitespace-nowrap">{f === null ? t.allFolders : f || t.otherPhotos}</span>
                      <span className={cn("text-[12px] font-semibold tabular-nums", on ? "text-white/80" : "text-[#8A8599]")}>{list.filter(p => isPicked(p.m)).length}/{list.length}</span>
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
                      <img src={thumbOf(p)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onContextMenu={e => e.preventDefault()} />
                      {isPicked(p.m) && <span className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Continue where you left off */}
            {resumeAt && (
              <div className="mt-1 mb-3 rounded-2xl bg-white p-2.5 pr-3 shadow-sm flex items-center gap-3 sp-pop-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbOf(resumeAt.photo)} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" onContextMenu={e => e.preventDefault()} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#17151F] truncate">{t.resume}</p>
                  <p className="text-[12.5px] text-[#6B6680] truncate">{t.resumeSub(resumeAt.i + 1, resumeAt.n, albums.length > 1 ? resumeAt.album : "")}</p>
                </div>
                <button type="button" onClick={goResume} className="h-10 px-4 rounded-full text-white text-[13.5px] font-semibold flex-shrink-0 hover:opacity-90" style={{ backgroundColor: brand }}>{t.resumeGo}</button>
                <button type="button" onClick={clearResume} aria-label={t.dismiss} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-[#8A8599] hover:bg-[#F1EFF6] flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* How many photos they have looked at */}
            {!locked && inAlbum.length > 0 && (
              <div className="mt-1 mb-1 flex items-center gap-3">
                <p className={cn("text-[12.5px] font-semibold flex items-center gap-1.5 flex-shrink-0", seenIn >= inAlbum.length ? "text-[#1F8A5B]" : "text-[#4A4658]")}>
                  {seenIn >= inAlbum.length ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span className="tabular-nums">{seenIn >= inAlbum.length ? t.seenAll(inAlbum.length) : t.seen(seenIn, inAlbum.length)}</span>
                </p>
                <span className="flex-1 h-1 rounded-full bg-[#E9E6F0] overflow-hidden" aria-hidden>
                  <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round((seenIn / inAlbum.length) * 100)}%`, backgroundColor: seenIn >= inAlbum.length ? "#1F8A5B" : brand }} />
                </span>
              </div>
            )}

            {/* Filters — with Find (by number or file name) and Compare in front */}
            <div className="flex items-center gap-1.5 -mx-3 px-3 py-2 sticky top-0 z-10 bg-[#F7F6FA]/90 backdrop-blur">
              {cmpPick ? (
                <div className="flex-1 min-w-0 h-11 pl-3.5 pr-1.5 rounded-full text-white flex items-center gap-2 sp-pop-in" style={{ backgroundColor: brand }}>
                  <Columns2 className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">{t.cmpHint}</span>
                  <button type="button" onClick={stopCmp} className="h-8 px-3 rounded-full bg-white/20 hover:bg-white/30 text-[12.5px] font-semibold flex-shrink-0">{t.cmpCancel}</button>
                </div>
              ) : finding ? (
                <form className="flex-1 min-w-0 flex items-center gap-1.5 sp-pop-in" role="search" onSubmit={e => { e.preventDefault(); if (shown.length) { (document.activeElement as HTMLElement | null)?.blur(); setView(0); } }}>
                  <label className="flex-1 min-w-0 h-11 pl-3.5 pr-1.5 rounded-full bg-white shadow-sm flex items-center gap-2 focus-within:ring-2" style={{ ["--tw-ring-color" as string]: brand }}>
                    <Search className="w-4 h-4 text-[#8A8599] flex-shrink-0" />
                    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t.findPh} aria-label={t.find} enterKeyHint="go" inputMode="search"
                      className="flex-1 min-w-0 bg-transparent outline-none text-[16px] sm:text-[14px] text-[#17151F] placeholder:text-[#A29DB3]" />
                    {query && <span className="text-[12px] font-semibold text-[#8A8599] tabular-nums flex-shrink-0">{shown.length}</span>}
                  </label>
                  <button type="button" onClick={() => { setFinding(false); setQ(""); }} aria-label={t.clearFind} className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-[#4A4658] flex-shrink-0"><X className="w-4 h-4" /></button>
                </form>
              ) : (
                <>
                  <button type="button" onClick={() => setFinding(true)} aria-label={t.find} title={t.find} className="w-9 h-9 rounded-full bg-white text-[#4A4658] flex items-center justify-center flex-shrink-0 hover:bg-[#EFEDF4]"><Search className="w-4 h-4" /></button>
                  {inAlbum.length > 1 && <button type="button" onClick={startCmp} className="h-9 pl-2.5 pr-3 rounded-full bg-white text-[#4A4658] text-[13px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0 hover:bg-[#EFEDF4]"><Columns2 className="w-4 h-4" />{t.compare}</button>}
                  <span className="w-px h-5 bg-[#E4E0EC] flex-shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mr-3 pr-3">
                    {filters.map(f => (
                      <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                        className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors flex-shrink-0", filter === f.id ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658]")}>
                        {f.label}<span className={cn("text-[12px]", filter === f.id ? "text-white/70" : "text-[#8A8599]")}>{f.n}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {query && albums.length > 1 && current && <p className="text-[12.5px] text-[#6B6680] mb-2">{t.findIn(current.name)}</p>}
            {!locked && !query && !cmpPick && filter === "all" && !totalPicked && <p className="text-[12.5px] text-[#6B6680] mb-2">{t.tapHint}</p>}
            {!locked && !query && !cmpPick && filter === "all" && inFolder.some(p => p.nw) && (
              <button type="button" onClick={() => setFilter("new")} className="mb-2 w-full text-left rounded-2xl bg-white px-3.5 py-2.5 text-[13px] text-[#33303F] shadow-sm flex items-center gap-2">
                <span className="h-5 px-2 rounded-full text-white text-[11px] font-bold inline-flex items-center flex-shrink-0" style={{ backgroundColor: brand }}>{t.fresh}</span>
                <span className="flex-1">{t.freshNote(inFolder.filter(p => p.nw).length)}</span><ArrowRight className="w-4 h-4 text-[#8A8599]" />
              </button>
            )}

            {/* Grid */}
            {shown.length === 0 ? <p className="text-center text-[#8A8599] py-16 px-6 text-sm">{query ? t.noMatch(query) : t.none}</p> : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1 sm:gap-2">
                {shown.map((p, i) => { const ci = cmpSel.indexOf(p.id); const no = nums.get(p.id); return (
                  <div key={p.id} id={`ph-${p.id}`} data-pid={p.id} style={flash === p.id ? { outline: `3px solid ${brand}`, outlineOffset: 2 } : cmpPick && ci >= 0 ? { outline: `3px solid ${brand}`, outlineOffset: 2 } : undefined}
                    className={cn("relative aspect-square rounded-xl overflow-hidden bg-[#E4E0EC] [content-visibility:auto] [contain-intrinsic-size:140px]",
                    !cmpPick && isPicked(p.m) && "ring-[3px] ring-[#1F8A5B]", !cmpPick && p.m === "important" && "ring-[#C2304F]", p.m === "rejected" && "opacity-45")}>
                    <button type="button" onClick={() => (cmpPick ? toggleCmp(p) : onCellTap(p, i))} aria-label={`${t.photoNo(no)} ${p.n}`} aria-pressed={cmpPick ? ci >= 0 : undefined}
                      className={cn("absolute inset-0 [touch-action:manipulation] transition-transform duration-200 ease-out", isPicked(p.m) && "scale-[.9] rounded-lg overflow-hidden")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbOf(p)} alt="" loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" onContextMenu={e => e.preventDefault()} className="w-full h-full object-cover" />
                    </button>
                    {gridBurst?.id === p.id && (
                      <span key={gridBurst.n} className="sp-burst absolute left-1/2 top-1/2 -ml-8 -mt-8 w-16 h-16 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center shadow-xl" aria-hidden>
                        <Check className="w-9 h-9" strokeWidth={3} />
                      </span>
                    )}
                    {p.nw && <span className="absolute left-1.5 bottom-1.5 h-5 px-1.5 rounded-full text-white text-[10.5px] font-bold inline-flex items-center shadow pointer-events-none" style={{ backgroundColor: brand }}>{t.fresh}</span>}
                    {/* The photo's number (the studio sees the same one) — with ♥ when they love it most */}
                    {no && (
                      <span className={cn("absolute left-1.5 top-1.5 h-6 px-1.5 rounded-full text-white text-[11px] font-bold tabular-nums inline-flex items-center gap-0.5 shadow pointer-events-none",
                        p.m === "important" ? "bg-[#C2304F]" : "bg-black/45 backdrop-blur-sm", query && nums.get(p.id) === Number(query.replace(/^#\s*/, "")) && "ring-2 ring-white")}>
                        {p.m === "important" && <Heart className="w-3 h-3" fill="currentColor" />}{no}
                      </span>
                    )}
                    {!no && p.m === "important" && <span className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-[#C2304F] text-white flex items-center justify-center shadow"><Heart className="w-3.5 h-3.5" fill="currentColor" /></span>}
                    {p.no && <span className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow" style={{ color: brand }}><StickyNote className="w-3.5 h-3.5" /></span>}
                    {cmpPick && (
                      <span className={cn("absolute right-1.5 bottom-1.5 w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-extrabold shadow-md transition-all pointer-events-none",
                        ci >= 0 ? "text-white scale-100" : "bg-white/80 backdrop-blur border-2 border-white scale-90")} style={ci >= 0 ? { backgroundColor: brand } : undefined}>
                        {ci >= 0 ? ci + 1 : ""}
                      </span>
                    )}
                    {!locked && !cmpPick && (
                      <button type="button" onClick={() => mark(p, isPicked(p.m) ? (p.m as Mark) : "selected")} aria-pressed={isPicked(p.m)} aria-label={t.choose}
                        className={cn("absolute right-1.5 bottom-1.5 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90",
                          isPicked(p.m) ? "bg-[#1F8A5B] text-white" : "bg-white/80 text-[#4A4658] backdrop-blur")}>
                        <Check className="w-5 h-5" strokeWidth={3} />
                      </button>
                    )}
                    {locked && !cmpPick && isPicked(p.m) && <span className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center"><Check className="w-4 h-4" strokeWidth={3} /></span>}
                  </div>
                ); })}
              </div>
            )}
          </div>

          {/* Desktop: the choice so far, always in sight */}
          <aside aria-label={t.side} className="hidden xl:block w-[300px] flex-shrink-0 sticky top-4 rounded-[24px] bg-white shadow-sm p-5">
            <p className="text-[12.5px] font-semibold text-[#6B6680]">{t.side}</p>
            <p className="mt-0.5 text-[26px] leading-tight font-bold text-[#17151F] tabular-nums">{t.sideTotal(totalPicked)}</p>
            {loved > 0 && <p className="mt-1 text-[13px] font-semibold text-[#C2304F] inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" fill="currentColor" />{t.sideLoved(loved)}</p>}
            <div className="mt-4 space-y-3">
              {albums.map(a => {
                const pr = albumProgress(a, pickedIn(a.id));
                const on = current?.id === a.id;
                return (
                  <button key={a.id} type="button" onClick={() => { setAlbum(a.id); setFolder(null); setFilter("all"); mainRef.current?.scrollTo({ top: 0 }); }} aria-current={on ? "true" : undefined}
                    className={cn("block w-full text-left rounded-2xl px-3 py-2.5 transition-colors", on ? "bg-[#F5F3FA]" : "hover:bg-[#F7F6FA]")}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] font-bold text-[#17151F] truncate">{a.name}</span>
                      <span className={cn("text-[12.5px] font-bold tabular-nums", pr.over ? "text-[#C2304F]" : pr.okRange ? "text-[#1F8A5B]" : "text-[#4A4658]")}>{pr.text}</span>
                    </span>
                    <span className="block h-1.5 rounded-full mt-2 bg-[#ECE9F2] overflow-hidden">
                      <span className={cn("block h-full rounded-full transition-[width] duration-500", pr.over ? "bg-[#C2304F]" : pr.okRange ? "bg-[#1F8A5B]" : "")} style={{ width: `${pr.pct}%`, ...(!pr.over && !pr.okRange ? { backgroundColor: brand } : {}) }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-[#F1EFF6]">
              {recent.length ? (
                <>
                  <p className="text-[12.5px] font-semibold text-[#6B6680] mb-2">{t.sideRecent}</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {recent.map(p => { const i = shown.indexOf(p); const no = nums.get(p.id); return (
                      <button key={p.id} type="button" disabled={i < 0} onClick={() => setView(i)} aria-label={`${t.photoNo(no)} ${p.n}`}
                        className="relative aspect-square rounded-lg overflow-hidden bg-[#E4E0EC] disabled:cursor-default">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbOf(p)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onContextMenu={e => e.preventDefault()} />
                        {p.m === "important" && <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-[#C2304F] text-white flex items-center justify-center"><Heart className="w-2.5 h-2.5" fill="currentColor" /></span>}
                      </button>
                    ); })}
                  </div>
                  <button type="button" onClick={() => { setFolder(null); setFilter("picked"); mainRef.current?.scrollTo({ top: 0 }); }}
                    className="mt-2.5 text-[13px] font-semibold hover:underline" style={{ color: brand }}>{t.sideAll}</button>
                </>
              ) : <p className="text-[13px] text-[#6B6680]">{t.sideNone}</p>}
            </div>
            {!locked && (
              <button type="button" onClick={() => { void flush(); setReviewing(true); }} disabled={!totalPicked}
                className="mt-5 w-full h-11 rounded-full text-white text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-md" style={{ backgroundColor: brand }}>
                <Send className="w-4 h-4" />{t.review}
              </button>
            )}
          </aside>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      {g && !thanks && cmpPick && (
        <div className="flex-shrink-0 bg-white/90 backdrop-blur-xl border-t border-[#F1EFF6] pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex -space-x-2">
                {cmpPhotos.map(p => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={thumbOf(p)} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover ring-2 ring-white sp-pop-in" onContextMenu={e => e.preventDefault()} />
                ))}
              </div>
              <p className="text-[13px] font-semibold text-[#17151F] tabular-nums truncate">{t.cmpCount(cmpSel.length)}</p>
            </div>
            <button type="button" onClick={openCmp} disabled={cmpSel.length < 2}
              className="h-11 px-5 rounded-full text-white text-[14px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 flex-shrink-0 shadow-md transition-opacity" style={{ backgroundColor: brand }}>
              <Columns2 className="w-4 h-4" />{t.cmpGo}
            </button>
          </div>
        </div>
      )}
      {g && !thanks && !cmpPick && (
        <div className="flex-shrink-0 bg-white/90 backdrop-blur-xl border-t border-[#F1EFF6] pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {current && (() => {
                const pr = albumProgress(current, pickedIn(current.id));
                return (
                  <>
                    <p className="text-[13px] font-semibold text-[#17151F] truncate">{current.name}: <span className="tabular-nums">{pr.text}</span>{pr.full && !pr.over && <span className="ml-1.5 text-[#1F8A5B]">· {t.fullShort}</span>}</p>
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

      {/* Welcome screen */}
      {g && intro !== "gone" && !thanks && (() => {
        const cover = g.cover ? { d: g.cover } : g.photos.find(p => p.hl) ?? g.photos[0];
        const one = albums.length === 1 ? albums[0] : null;
        const date = g.program?.date ? new Date(g.program.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
        const go = () => { setIntro("leaving"); setTimeout(() => setIntro("gone"), 380); };
        return (
          <div className={cn("absolute inset-0 z-[70] bg-[#0E0C14] text-white overflow-hidden transition-opacity duration-300", intro === "leaving" && "opacity-0 pointer-events-none")}>
            {(g.coverUrl || cover) && (
              <div className="absolute inset-0" style={coverZoom(g.coverFocus)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.coverUrl || viewOf(cover!)} alt="" referrerPolicy="no-referrer" draggable={false} onContextMenu={e => e.preventDefault()} className="sp-cover absolute inset-0 w-full h-full object-cover" style={coverPos(g.coverFocus)} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/85" />
            <div className="relative h-full max-w-xl mx-auto px-6 flex flex-col pt-[max(20px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2.5 sp-rise">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {g.studioLogo ? <img src={g.studioLogo} alt="" className="w-10 h-10 rounded-full object-cover bg-white" />
                  : <span className="w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-[15px] font-bold">{g.studio.slice(0, 1)}</span>}
                <span className="text-[14px] font-semibold tracking-wide">{g.studio}</span>
                {onClose && <button type="button" onClick={close} aria-label={t.close} className="ml-auto w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center"><X className="w-5 h-5" /></button>}
              </div>
              <div className="mt-auto">
                <p className="sp-rise text-[11.5px] font-bold uppercase tracking-[0.22em] text-white/75" style={{ animationDelay: "80ms" }}>{t.coverLabel}</p>
                <h1 className="sp-rise mt-2 text-[34px] sm:text-[44px] leading-[1.05] font-extrabold tracking-[-0.02em]" style={{ animationDelay: "140ms" }}>{g.program?.name || g.title}</h1>
                {date && <p className="sp-rise mt-2 text-[14px] text-white/75" style={{ animationDelay: "180ms" }}>{date}</p>}
                <div className="sp-rise mt-5 flex flex-wrap gap-2" style={{ animationDelay: "240ms" }}>
                  <span className="h-8 px-3 rounded-full bg-white/15 backdrop-blur text-[13px] font-semibold inline-flex items-center gap-1.5"><Images className="w-3.5 h-3.5" />{t.coverPhotos(g.photos.length)}</span>
                  {one?.limit && <span className="h-8 px-3 rounded-full bg-white/15 backdrop-blur text-[13px] font-semibold inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={3} />{t.coverPick(one.limit)}</span>}
                  {left && <span className={cn("h-8 px-3 rounded-full backdrop-blur text-[13px] font-semibold inline-flex items-center gap-1.5", left.soon ? "bg-[#C2304F]/85" : "bg-white/15")}><CalendarClock className="w-3.5 h-3.5" />{left.text}</span>}
                </div>
                <p className="sp-rise mt-5 text-[15px] leading-relaxed text-white/90" style={{ animationDelay: "300ms" }}>
                  <span className="font-bold">{t.hi(g.clientName ?? "")}</span> {g.welcome || t.coverDefault}
                </p>
                {totalPicked > 0 && (
                  <div className="sp-rise mt-4" style={{ animationDelay: "340ms" }}>
                    <p className="text-[13px] font-semibold text-[#9AE6BD] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{t.coverSoFar(totalPicked, g.photos.length)}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-[#4ADE80]" style={{ width: `${Math.min(100, one?.maxPicks ? (totalPicked / one.maxPicks) * 100 : (totalPicked / Math.max(1, g.photos.length)) * 100)}%` }} /></div>
                  </div>
                )}
                <button type="button" onClick={go}
                  className="sp-rise mt-6 w-full h-14 rounded-full bg-white text-[#17151F] text-[16px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,.6)] active:scale-[.98] transition-transform" style={{ animationDelay: "400ms" }}>
                  {locked ? t.look : totalPicked ? t.goOn : t.start}<ArrowRight className="w-5 h-5" />
                </button>
                {!locked && <p className="sp-rise mt-3 text-center text-[12.5px] leading-snug text-white/70" style={{ animationDelay: "460ms" }}>{t.coverSaved}</p>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* The album is full — in the middle of the screen, above the open photo too */}
      {full && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-sm sp-fade-in" role="alertdialog" aria-modal="true" aria-labelledby="sp-full-title" onClick={() => setFull(null)}>
          <div className="w-full max-w-sm bg-white rounded-[28px] p-6 text-center shadow-2xl sp-pop-in mb-[env(safe-area-inset-bottom)]" onClick={e => e.stopPropagation()}>
            <span className={cn("w-16 h-16 mx-auto rounded-full flex items-center justify-center", full.why === "done" ? "bg-[#E2F4EA] text-[#1F8A5B]" : "bg-[#FDECEF] text-[#C2304F]")}>
              {full.why === "done" ? <CheckCircle2 className="w-9 h-9" /> : <Lock className="w-8 h-8" />}
            </span>
            <h2 id="sp-full-title" className="mt-4 text-[21px] leading-tight font-extrabold tracking-[-0.01em] text-[#17151F]">{full.why === "done" ? t.fullDoneTitle(full.max) : t.fullTitle(full.max)}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#4A4658]">{full.why === "done" ? t.fullDoneText : t.fullText(full.max)}</p>
            <button type="button" onClick={() => { const big = view !== null || cmpOpen; setFull(null); setView(null); if (cmpOpen) { closeCmp(); stopCmp(); } void flush(); /* the closing photo steps Back once — open the sheet after it */ setTimeout(() => setReviewing(true), big ? 400 : 0); }}
              className="mt-5 w-full py-3.5 rounded-full text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 shadow-md" style={{ backgroundColor: brand }}>
              <Send className="w-4 h-4" />{t.review}
            </button>
            <button type="button" onClick={() => { setFull(null); setView(null); if (cmpOpen) { closeCmp(); stopCmp(); } setFinding(false); setQ(""); setFolder(null); setFilter("picked"); mainRef.current?.scrollTo({ top: 0 }); }}
              className="mt-2 w-full py-3 rounded-full bg-[#F5F3FA] text-[#17151F] text-[14.5px] font-semibold">{full.why === "done" ? t.fullSee(full.max) : t.fullChange}</button>
            <button type="button" onClick={() => setFull(null)} className="mt-1 w-full py-2.5 text-[13.5px] font-semibold text-[#6B6680]">{t.fullKeep}</button>
          </div>
        </div>
      )}

      {/* Compare: 2–4 photos side by side (stacked on a phone held upright), each with its own buttons */}
      {g && cmpOpen && cmpPhotos.length >= 2 && (
        <div className="fixed inset-0 z-[80] bg-[#0E0C14] text-white flex flex-col sp-fade-in" role="dialog" aria-modal="true" aria-label={t.cmpTitle(cmpPhotos.length)}>
          <div className="flex-shrink-0 h-14 px-3 sm:px-5 flex items-center gap-3 pt-[env(safe-area-inset-top)] box-content">
            <button type="button" onClick={closeCmp} aria-label={t.close} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold truncate">{t.cmpTitle(cmpPhotos.length)}</p>
              <p className="text-[12px] text-white/60 truncate">{locked ? "" : t.cmpTip}</p>
            </div>
            <span className="h-8 pl-1.5 pr-3 rounded-full bg-white/10 inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums"><span className="w-5 h-5 rounded-full bg-[#1F8A5B] flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span><span key={totalPicked} className="sp-count">{totalPicked}</span></span>
          </div>
          <div className={cn("flex-1 min-h-0 grid gap-2 p-2 sm:gap-3 sm:p-3",
            cmpPhotos.length === 2 ? "grid-rows-2 grid-cols-1 landscape:grid-rows-1 landscape:grid-cols-2 sm:grid-rows-1 sm:grid-cols-2"
              : cmpPhotos.length === 3 ? "grid-cols-2 grid-rows-2 lg:grid-cols-3 lg:grid-rows-1" : "grid-cols-2 grid-rows-2")}>
            {cmpPhotos.map((p, i) => {
              const no = nums.get(p.id);
              return (
                <div key={p.id} className={cn("relative min-h-0 min-w-0 rounded-2xl bg-white/[.04] overflow-hidden flex flex-col sp-pop-in", cmpPhotos.length === 3 && i === 2 && "col-span-2 lg:col-span-1",
                  isPicked(p.m) && "ring-2 ring-[#1F8A5B]", p.m === "important" && "ring-[#C2304F]")} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="relative flex-1 min-h-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={viewOf(p)} alt={p.n} referrerPolicy="no-referrer" draggable={false} onContextMenu={e => e.preventDefault()} className={cn("absolute inset-0 w-full h-full object-contain transition-opacity", p.m === "rejected" && "opacity-40")} />
                    <span className="absolute left-2 top-2 h-7 px-2.5 rounded-full bg-black/55 backdrop-blur text-[12.5px] font-bold tabular-nums inline-flex items-center gap-1">
                      {p.m === "important" && <Heart className="w-3.5 h-3.5 text-[#FF8FA6]" fill="currentColor" />}{no ? `#${no}` : p.n}
                    </span>
                    {cmpPhotos.length > 2 && (
                      <button type="button" onClick={() => setCmpSel(l => l.filter(x => x !== p.id))} aria-label={t.cmpTake} title={t.cmpTake}
                        className="absolute right-2 top-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur flex items-center justify-center hover:bg-black/75"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                  {!locked ? (
                    <div className="flex-shrink-0 p-1.5 sm:p-2 flex gap-1.5">
                      {([
                        { m: "selected" as Mark, I: Check, label: t.choose, on: "bg-[#1F8A5B] text-white" },
                        { m: "important" as Mark, I: Heart, label: t.love, on: "bg-[#C2304F] text-white" },
                        { m: "rejected" as Mark, I: X, label: t.dont, on: "bg-white text-[#17151F]" },
                      ]).filter(b => b.m !== "important" || g.allowLove !== false).map(b => (
                        <button key={b.m} type="button" aria-pressed={p.m === b.m} aria-label={`${b.label} ${t.photoNo(no)}`} onClick={() => { if (mark(p, b.m)) navigator.vibrate?.(12); }}
                          className={cn("flex-1 min-w-0 h-11 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all active:scale-95",
                            p.m === b.m ? b.on : "bg-white/10 hover:bg-white/20 text-white")}>
                          <b.I className="w-4 h-4 flex-shrink-0" strokeWidth={2.4} fill={b.m === "important" && p.m === "important" ? "currentColor" : "none"} />
                          <span className={cn("truncate", cmpPhotos.length > 2 ? "hidden sm:inline" : "")}>{b.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : isPicked(p.m) ? <p className="flex-shrink-0 py-2 text-center text-[12.5px] font-semibold text-[#9AE6BD]">{t.picked}</p> : null}
                </div>
              );
            })}
          </div>
          <div className="flex-shrink-0 pb-[max(10px,env(safe-area-inset-bottom))] px-3 flex justify-center">
            <button type="button" onClick={() => { closeCmp(); stopCmp(); }} className="h-10 px-5 rounded-full bg-white/10 hover:bg-white/20 text-[13.5px] font-semibold">{t.cmpDone}</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[90] max-w-[92vw] px-4 py-2.5 rounded-2xl bg-[#17151F] text-white text-[13.5px] shadow-xl sp-pop-in">{toast}</div>}

      {/* Viewer */}
      {g && vp && view !== null && (
        <PhotoViewer count={shown.length} index={view} onIndex={setView} onClose={() => { setView(null); setHintSeen(true); }}
          src={viewOf(vp)}
          srcAt={i => (shown[i] ? viewOf(shown[i]) : "")} thumbAt={i => (shown[i] ? thumbOf(shown[i]) : "")} zoomAt={i => (shown[i] ? zoomOf(shown[i]) : "")}
          preload={[shown[view + 1], shown[view + 2], shown[view + 3], shown[view - 1]].filter(Boolean).map(p => viewOf(p!))}
          title={`${view + 1} ${t.of} ${shown.length}`} sub={[nums.get(vp.id) ? `Photo #${nums.get(vp.id)}` : "", albums.length > 1 ? albums.find(a => a.id === vp.a)?.name : "", vp.f].filter(Boolean).join(" · ") || undefined}
          top={<span className="h-8 pl-1.5 pr-3 rounded-full bg-white/10 inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums"><span className="w-5 h-5 rounded-full bg-[#1F8A5B] flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span><span key={totalPicked} className="sp-count">{viewCount}</span></span>}
          onDoubleTap={locked ? undefined : () => quickChoose(vp, true)}
          nextSignal={nextSig}
          hint={!locked && !hintSeen ? t.viewHint : undefined}
          onKey={e => {
            if (locked) return false;
            const k = e.key.toLowerCase();
            if (k === "1" || k === "s" || k === " ") { mark(vp, "selected", true); return true; }
            if ((k === "2" || k === "l") && g.allowLove !== false) { mark(vp, "important", true); return true; }
            if (k === "3" || k === "x") { mark(vp, "rejected", true); return true; }
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
                          <img key={p.id} src={thumbOf(p)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
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
              {onClose && <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full text-white text-[14px] font-semibold" style={{ backgroundColor: brand }}>{t.close}</button>}
            </div>
            {after}
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
