"use client";

/**
 * Album editor. The page in the middle, the client's photos on the left (drag or click to place),
 * the design, words and checks on the right, all pages along the bottom. Saves by itself.
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpToLine, Check, ChevronLeft, ChevronRight, Contrast, Download, History, ImagePlus, Loader2, MessageCircle, Move, Plus, Redo2, Repeat, Share2, Shuffle, Trash2, Type, Undo2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { albumApi } from "@/lib/album/api";
import { checkAlbum, dpiOf } from "@/lib/album/checks";
import { focusFor, makeSpread, nextVariant, photosOn, relayout } from "@/lib/album/layout";
import { scanPhotos } from "@/lib/album/faces";
import { FONT_CHOICES, LOOKS, lookOf } from "@/lib/album/looks";
import { QUOTES, quoteAfter } from "@/lib/album/quotes";
import { photoUrl, ratioOf, sizeOf, STATUS, type AlbumDetail, type AlbumStatus, type APhoto, type ImgItem, type Item, type Spread, type TextItem } from "@/lib/album/types";
import { SpreadView } from "@/components/album/spread-view";
import { ExportDialog } from "@/components/album/export-dialog";
import { ShareDialog } from "@/components/album/share-dialog";
import { VersionsDialog } from "@/components/album/versions-dialog";
import { Stage } from "@/components/album/stage";
import { uid } from "@/lib/album/layout";
import { FONTS } from "@/lib/album/looks";

type Hist = { past: Spread[][]; future: Spread[][] };
type SaveS = "saved" | "saving" | "waiting" | "error" | "conflict";

export default function AlbumEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [hist, setHist] = useState<Hist>({ past: [], future: [] });
  const [save, setSave] = useState<SaveS>("saved");
  const [tray, setTray] = useState<"unused" | "all">("unused");
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [pan, setPan] = useState(false);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const rev = useRef(0);
  const pending = useRef<Spread[] | null>(null);
  const spreadsRef = useRef<Spread[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    albumApi.get(id).then(a => { const sp = Array.isArray(a.spreads) ? a.spreads : []; setAlbum(a); setSpreads(sp); spreadsRef.current = sp; rev.current = a.rev ?? 0; }).catch(e => setErr(e.message));
  }, [id]);

  const photos = useMemo(() => album?.source?.photos ?? [], [album]);
  const byId = useMemo(() => new Map(photos.map(p => [p.id, p])), [photos]);
  const ratio = album ? ratioOf(album.size) : 3;
  const spread = spreads[Math.min(cur, spreads.length - 1)];
  const used = useMemo(() => new Set(spreads.flatMap(photosOn)), [spreads]);
  const checks = useMemo(() => (album ? checkAlbum(spreads, byId, album.size, album.faces) : []), [spreads, byId, album]);
  const item = spread?.items.find(i => i.id === sel) ?? null;
  /** Photos on no page yet: picks first. They fill frames a new layout adds. */
  const spare = useMemo(() => photos.filter(p => !used.has(p.id)).sort((a, b) => Number(b.m === "selected" || b.m === "important") - Number(a.m === "selected" || a.m === "important")), [photos, used]);
  const ctxBase = useMemo(() => ({ ar: ratio, names: album?.names ?? {}, faces: album?.faces ?? undefined }), [ratio, album]);
  const [finding, setFinding] = useState<string | null>(null);
  /** Albums made before faces were found (or new photos): find them now, in this browser. */
  async function findFaces() {
    const list = photos.filter(p => used.has(p.id) && !album?.faces?.[p.id]);
    setFinding(`0 of ${list.length}`);
    const r = await scanPhotos(list, (d, t) => setFinding(`${d} of ${t}`));
    const faces = { ...(album?.faces ?? {}), ...r.faces };
    setAlbum(a => (a ? { ...a, faces } : a)); setFinding(null);
    try { await albumApi.save(id, { faces }); notify(`Faces found in ${Object.values(r.faces).filter(f => f.length).length} photos`); }
    catch (e) { notify((e as Error).message, { error: true }); }
  }

  // ── saving ──
  const flush = useCallback(async () => {
    if (!pending.current) return;
    const body = pending.current; pending.current = null;
    setSave("saving");
    try { const r = await albumApi.save(id, { spreads: body, base: rev.current }); rev.current = typeof r.rev === "number" ? r.rev : rev.current + 1; setSave(pending.current ? "waiting" : "saved"); }
    catch (e) {
      pending.current = pending.current ?? body;
      if ((e as { code?: string }).code === "ALBUM_CHANGED") { setSave("conflict"); return; }
      setSave("error"); notify((e as Error).message, { error: true });
    }
  }, [id]);
  /** Someone else saved first: take their pages, or save ours over them. */
  async function loadTheirs() {
    try {
      const a = await albumApi.get(id); const sp = Array.isArray(a.spreads) ? a.spreads : [];
      pending.current = null; if (timer.current) clearTimeout(timer.current);
      setAlbum(a); setSpreads(sp); spreadsRef.current = sp; rev.current = a.rev ?? 0; setHist({ past: [], future: [] }); setSave("saved"); setSel(null);
    } catch (e) { notify((e as Error).message, { error: true }); }
  }
  async function keepMine() {
    const body = pending.current ?? spreadsRef.current; pending.current = null; setSave("saving");
    try { const r = await albumApi.save(id, { spreads: body }); rev.current = r.rev; setSave("saved"); }
    catch (e) { pending.current = body; setSave("error"); notify((e as Error).message, { error: true }); }
  }
  useEffect(() => {
    const off = (e: BeforeUnloadEvent) => { if (pending.current) { e.preventDefault(); } };
    window.addEventListener("beforeunload", off);
    return () => window.removeEventListener("beforeunload", off);
  }, []);

  const commit = useCallback((next: Spread[]) => {
    spreadsRef.current = next; setSpreads(next);
    pending.current = next; setSave("waiting");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  }, [flush]);
  /** Every change goes through here: undo history + save a moment later. */
  const change = useCallback((fn: (s: Spread[]) => Spread[]) => {
    const prev = spreadsRef.current;
    const next = fn(prev);
    if (next === prev) return;
    setHist(h => ({ past: [...h.past.slice(-49), prev], future: [] }));
    commit(next);
  }, [commit]);
  const undo = () => {
    if (!hist.past.length) return;
    const prev = hist.past[hist.past.length - 1];
    setHist({ past: hist.past.slice(0, -1), future: [spreadsRef.current, ...hist.future] });
    commit(prev);
  };
  const redo = () => {
    if (!hist.future.length) return;
    const next = hist.future[0];
    setHist({ past: [...hist.past, spreadsRef.current], future: hist.future.slice(1) });
    commit(next);
  };

  const editItem = (itemId: string, patch: Partial<ImgItem> | Partial<TextItem> | Record<string, number>) =>
    change(all => all.map((s, i) => (i !== cur ? s : { ...s, items: s.items.map(it => (it.id === itemId ? ({ ...it, ...patch } as Item) : it)) })));
  const putPhoto = (itemId: string, photoId: string) => {
    const it = spread?.items.find(i => i.id === itemId); const p = byId.get(photoId);
    const pos = it?.k === "img" && p ? focusFor({ ...it, z: 1 }, p, album?.faces?.[photoId], ratio) : { fx: 50, fy: 40 };
    editItem(itemId, { p: photoId, ...pos, z: 1 }); setSel(itemId);
  };
  const setSpread = (fn: (s: Spread) => Spread) => change(all => all.map((s, i) => (i === cur ? fn(s) : s)));
  const pick = (itemId: string | null) => { setSel(itemId); if (itemId !== sel) setPan(false); };
  function deleteItem(itemId: string) { setSpread(s => ({ ...s, items: s.items.filter(i => i.id !== itemId) })); setSel(null); }
  function layer(itemId: string, toFront: boolean) {
    setSpread(s => { const it = s.items.find(i => i.id === itemId)!; const rest = s.items.filter(i => i.id !== itemId); const bgs = rest.filter(i => i.k === "img" && i.bg); const others = rest.filter(i => !(i.k === "img" && i.bg)); return { ...s, items: toFront ? [...rest, it] : [...bgs, it, ...others] }; });
  }
  function addText() {
    const t: TextItem = { k: "text", id: uid(), role: "label", t: "Your words", x: 60, y: 40, w: 30, size: 6, font: FONTS.corm, color: /^#(1|2|0)/.test(spread?.bg ?? "") ? "#ffffff" : "#17151F", italic: true };
    setSpread(s => ({ ...s, items: [...s.items, t] })); setSel(t.id);
  }
  function addFrame() {
    const f: ImgItem = { k: "img", id: uid(), slot: 99, p: null, want: "a", x: 56, y: 15, w: 18, h: 60, bd: { w: 1.6, c: "#ffffff" }, sh: true };
    setSpread(s => ({ ...s, items: [...s.items, f] })); setSel(f.id);
  }
  /** Swap the photos of two frames (the first chosen, then this one). */
  function swapWith(otherId: string) {
    const a = spread?.items.find(i => i.id === swapFrom), b = spread?.items.find(i => i.id === otherId);
    setSwapFrom(null);
    if (!a || !b || a.id === b.id || a.k !== "img" || b.k !== "img") return;
    const pa = a.p, pb = b.p;
    const posA = pb && byId.get(pb) ? focusFor({ ...a, z: 1 }, byId.get(pb)!, album?.faces?.[pb], ratio) : { fx: 50, fy: 40 };
    const posB = pa && byId.get(pa) ? focusFor({ ...b, z: 1 }, byId.get(pa)!, album?.faces?.[pa], ratio) : { fx: 50, fy: 40 };
    setSpread(s => ({ ...s, items: s.items.map(i => (i.id === a.id ? { ...i, p: pb, ...posA, z: 1 } as Item : i.id === b.id ? { ...i, p: pa, ...posB, z: 1 } as Item : i)) }));
    setSel(b.id);
  }

  async function setStatus(status: AlbumStatus) {
    if (!album) return;
    try { await albumApi.save(id, { status }); setAlbum({ ...album, status }); notify(`Marked "${STATUS[status].label}"`); }
    catch (e) { notify((e as Error).message, { error: true }); }
  }
  async function removeAlbum() {
    if (!confirm("Delete this album? The client's photos stay in their selection.")) return;
    try { await albumApi.remove(id); router.push("/album-studio"); } catch (e) { notify((e as Error).message, { error: true }); }
  }

  function addPage() {
    const look = lookOf(album?.look ?? "mono");
    const v = look.variants.find(x => !x.title && x.photos >= 3) ?? look.variants[0];
    const free = photos.filter(p => !used.has(p.id) && (p.m === "selected" || p.m === "important")).concat(photos.filter(p => !used.has(p.id) && !(p.m === "selected" || p.m === "important")));
    const s = makeSpread(look, v, free.slice(0, v.photos), { ...ctxBase, quote: QUOTES[(cur + 3) % QUOTES.length], title: null });
    change(all => [...all.slice(0, cur + 1), s, ...all.slice(cur + 1)]);
    setCur(cur + 1); setSel(null);
  }
  function removePage() {
    if (spreads.length <= 1 || !confirm(`Remove page ${cur + 1}? Its photos go back to the photo list.`)) return;
    change(all => all.filter((_, i) => i !== cur)); setCur(Math.max(0, cur - 1)); setSel(null);
  }
  function movePage(d: -1 | 1) {
    const j = cur + d; if (j < 0 || j >= spreads.length) return;
    change(all => { const a = [...all]; [a[cur], a[j]] = [a[j], a[cur]]; return a; }); setCur(j);
  }

  // Keyboard: arrows change page, Delete empties a frame, Ctrl/Cmd+Z undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      const it = sel ? spread?.items.find(i => i.id === sel) : null;
      if (it && /^Arrow/.test(e.key)) {
        e.preventDefault();
        const st = e.shiftKey ? 1 : 0.25;
        const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st * 3], ArrowDown: [0, st * 3] }[e.key] ?? [0, 0];
        editItem(it.id, { x: Math.round((it.x + d[0]) * 100) / 100, y: Math.round((it.y + d[1]) * 100) / 100 });
      } else if (it && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); deleteItem(it.id); }
      else if (e.key === "ArrowRight") setCur(c => Math.min(spreads.length - 1, c + 1));
      else if (e.key === "ArrowLeft") setCur(c => Math.max(0, c - 1));
      else if (e.key === "Escape") { setSel(null); setSwapFrom(null); setPan(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const clientNotes = (album?.notes ?? []).filter(n => n.by === "client");
  const openNotes = clientNotes.filter(n => !n.done).length;
  const pageNotes = clientNotes.filter(n => n.spread === spread?.id);
  const otherNotes = clientNotes.filter(n => !n.done && n.spread !== spread?.id).length;
  async function markNote(noteId: string, done: boolean) {
    try { const r = await albumApi.noteDone(id, noteId, done); setAlbum(a => (a ? { ...a, notes: r.notes } : a)); }
    catch (e) { notify((e as Error).message, { error: true }); }
  }

  if (err) return <div role="alert" className="rounded-[18px] bg-[#FDECEF] p-4 text-[14px] text-[#7A1F33]">{err} <Link href="/album-studio" className="font-semibold">Back to albums</Link></div>;
  if (!album) return <div className="flex items-center gap-2 text-[14px] text-[#6B6680] p-6"><Loader2 className="w-4 h-4 animate-spin" />Opening the album…</div>;

  const trayPhotos = tray === "unused" ? photos.filter(p => !used.has(p.id)) : photos;
  const curChecks = checks.filter(c => c.spread === cur);

  return (
    <div className="flex flex-col gap-3 -mx-2 sm:mx-0">
      {/* top bar */}
      <header className="flex flex-wrap items-center gap-2 rounded-[18px] bg-white px-3 py-2 shadow-[0_0_0_1px_rgba(40,28,96,.06)]">
        <Link href="/album-studio" aria-label="Back to albums" className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F2EFF8]"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="min-w-0 mr-auto leading-tight">
          <b className="block text-[15px] truncate">{album.title}</b>
          <span className="text-[12px] text-[#6B6680]">{sizeOf(album.size).label} · {spreads.length} pages · <SaveState s={save} onRetry={flush} />{album.approvedAt ? <b className="text-[#1F7A4F]"> · Client approved</b> : null}</span>
        </div>
        <button aria-label="Earlier versions" title="Earlier versions" onClick={() => { flush(); setVersionsOpen(true); }} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F2EFF8]"><History className="w-[18px] h-[18px]" /></button>
        <button aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!hist.past.length} onClick={undo} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F2EFF8] disabled:opacity-35"><Undo2 className="w-[18px] h-[18px]" /></button>
        <button aria-label="Redo" title="Redo" disabled={!hist.future.length} onClick={redo} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F2EFF8] disabled:opacity-35"><Redo2 className="w-[18px] h-[18px]" /></button>
        <label className="sr-only" htmlFor="st">Status</label>
        <select id="st" value={album.status} onChange={e => setStatus(e.target.value as AlbumStatus)}
          className="h-10 rounded-full border border-[#E4E0EC] bg-white px-3 text-[13px] font-semibold" style={{ color: STATUS[album.status].fg }}>
          {(Object.keys(STATUS) as AlbumStatus[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <button onClick={() => setSharing(true)} className="h-10 px-3.5 rounded-full border border-[#E4E0EC] bg-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Share2 className="w-4 h-4" /><span className="hidden sm:inline">Share with client</span><span className="sm:hidden">Share</span></button>
        <button onClick={() => { flush(); setExporting(true); }} className="h-10 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-bold inline-flex items-center gap-1.5 shadow-[0_10px_20px_-10px_rgba(109,74,230,.9)]"><Download className="w-4 h-4" />Export for print</button>
      </header>
      {save === "conflict" && (
        <div role="alert" className="rounded-[18px] bg-[#FFF4D6] border border-[#F2D58B] p-3.5 flex flex-wrap items-center gap-3 text-[14px] text-[#4A3300]">
          <AlertTriangle className="w-5 h-5 text-[#A15C00] flex-shrink-0" />
          <span className="flex-1 min-w-[220px]"><b>Someone else changed this album a moment ago.</b> Your latest changes are not saved yet.</span>
          <button onClick={loadTheirs} className="h-9 px-3.5 rounded-full bg-white text-[13px] font-semibold">Load their changes</button>
          <button onClick={keepMine} className="h-9 px-3.5 rounded-full bg-[#17151F] text-white text-[13px] font-semibold">Keep mine</button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[220px_minmax(0,1fr)_290px]">
        {/* photos */}
        <aside aria-label="Photos" className="rounded-[18px] bg-white p-3 flex flex-col gap-2.5 order-2 2xl:order-1 2xl:max-h-[calc(100dvh-170px)] lg:col-start-1 2xl:col-start-auto">
          <div className="flex gap-1 p-1 rounded-xl bg-[#F2EFF8] text-[12.5px] font-semibold">
            <button onClick={() => setTray("unused")} className={cn("flex-1 h-8 rounded-lg", tray === "unused" ? "bg-white shadow-sm" : "text-[#6B6680]")}>Not used · {photos.length - used.size}</button>
            <button onClick={() => setTray("all")} className={cn("flex-1 h-8 rounded-lg", tray === "all" ? "bg-white shadow-sm" : "text-[#6B6680]")}>All · {photos.length}</button>
          </div>
          <p className="text-[12px] text-[#6B6680]">{item?.k === "img" ? "Click a photo to put it in the chosen frame." : "Drag a photo onto a frame, or choose a frame and click a photo."}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] 2xl:grid-cols-2 gap-2 overflow-y-auto min-h-0 max-h-[260px] 2xl:max-h-none pr-0.5">
            {trayPhotos.map(p => (
              <button key={p.id} draggable onDragStart={e => e.dataTransfer.setData("text/photo", p.id)}
                onClick={() => { if (item?.k === "img") putPhoto(item.id, p.id); else notify("Choose a frame on the page first."); }}
                title={p.n} className={cn("relative aspect-square rounded-lg overflow-hidden bg-[#EEE] focus-visible:ring-2 focus-visible:ring-[#7D5CEF]", used.has(p.id) && "opacity-45")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.d && <img src={photoUrl(p.d, 200)} alt={p.n} loading="lazy" className="w-full h-full object-cover" draggable={false} />}
                {p.m === "important" && <span className="absolute left-1 top-1 text-[10px] px-1.5 rounded-full bg-white/90 text-[#C2304F] font-bold">♥</span>}
              </button>
            ))}
            {!trayPhotos.length && <p className="col-span-full text-[12.5px] text-[#6B6680] py-4 text-center">Every photo is on a page.</p>}
          </div>
        </aside>

        {/* page */}
        <main className="order-1 2xl:order-2 flex flex-col gap-3 min-w-0 lg:col-start-1 2xl:col-start-auto">
          <div className="rounded-[18px] bg-[#E9E4DC] p-3 sm:p-6 flex flex-col items-center gap-3" onPointerDown={() => { setSel(null); setPan(false); }}>
            <div className="flex items-center gap-2 text-[13px] text-[#4A4658] w-full">
              {spread?.chapter && <span className="px-2.5 h-6 rounded-full bg-white/70 inline-flex items-center font-semibold">{spread.chapter}</span>}
              <b className="text-[#17151F]">Page {cur + 1}</b><span>of {spreads.length}</span>
              <span className="ml-auto text-[12px] text-[#6B6680] hidden sm:inline">{lookOf(spread?.look ?? album.look).name}</span>
            </div>
            {swapFrom && <p className="w-full text-center text-[13px] font-semibold text-[#3F2A9E] bg-white/80 rounded-full py-1.5" role="status">Now click the frame to swap with · <button className="underline" onClick={() => setSwapFrom(null)}>Cancel</button></p>}
            {spread ? <div className="w-full" onPointerDown={e => e.stopPropagation()}><Stage spread={spread} ratio={ratio} byId={byId} sel={sel} setSel={pick} pan={pan} onChange={(itemId, patch) => editItem(itemId, patch)} onDropPhoto={putPhoto} marks={new Set(curChecks.map(c => c.item!).filter(Boolean))} onSwapPick={swapFrom ? swapWith : null} studio={album.studio} /></div> : <p className="text-[14px] text-[#6B6680] py-10">No pages. Add one below.</p>}
            <div className="flex flex-wrap items-center justify-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
              <Tool label="Previous page" onClick={() => setCur(Math.max(0, cur - 1))} disabled={cur === 0}><ChevronLeft className="w-4 h-4" /></Tool>
              <Tool label="Move page left" onClick={() => movePage(-1)} disabled={cur === 0}><ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Move</span></Tool>
              <Tool label="Add a page after this" onClick={addPage}><Plus className="w-4 h-4" /><span>Add page</span></Tool>
              <Tool label="Remove this page" onClick={removePage} disabled={spreads.length <= 1}><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Remove</span></Tool>
              <Tool label="Move page right" onClick={() => movePage(1)} disabled={cur >= spreads.length - 1}><span className="hidden sm:inline">Move</span><ArrowRight className="w-4 h-4" /></Tool>
              <Tool label="Next page" onClick={() => setCur(Math.min(spreads.length - 1, cur + 1))} disabled={cur >= spreads.length - 1}><ChevronRight className="w-4 h-4" /></Tool>
            </div>
          </div>
          <Strip studio={album.studio} spreads={spreads} cur={cur} setCur={i => { setCur(i); setSel(null); }} ratio={ratio} byId={byId} warn={new Set([...checks.filter(c => c.kind !== "twice").map(c => c.spread), ...clientNotes.filter(n => !n.done).map(n => spreads.findIndex(x => x.id === n.spread)).filter(i => i >= 0)])} />
        </main>

        {/* right panel */}
        <aside aria-label="Page settings" className="order-3 rounded-[18px] bg-white p-4 flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-2 2xl:col-start-auto 2xl:row-start-auto 2xl:row-span-1 lg:max-h-[calc(100dvh-170px)] lg:overflow-y-auto lg:sticky lg:top-3 self-start">
          {spread && (
            <section>
              <h2 className="text-[12px] font-bold text-[#6B6680] mb-2">Page design</h2>
              <select value={spread.look} onChange={e => { setSpread(s => relayout(s, e.target.value as Spread["look"], null, byId, ctxBase, spare)); setSel(null); }}
                className="w-full h-10 rounded-xl border border-[#E4E0EC] px-3 text-[14px] font-semibold bg-white" aria-label="Page design">
                {LOOKS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <button onClick={() => { setSpread(s => relayout(s, s.look, nextVariant(s), byId, ctxBase, spare)); setSel(null); }}
                className="mt-2 w-full h-10 rounded-xl bg-[#F2EFF8] text-[13px] font-semibold text-[#3F2A9E] inline-flex items-center justify-center gap-1.5"><Shuffle className="w-4 h-4" />Another layout</button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={addText} className="h-10 rounded-xl border border-[#E4E0EC] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><Type className="w-4 h-4" />Add text</button>
                <button onClick={addFrame} className="h-10 rounded-xl border border-[#E4E0EC] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><ImagePlus className="w-4 h-4" />Add frame</button>
              </div>
            </section>
          )}

          {item?.k === "img" && <ImgPanel it={item} p={item.p ? byId.get(item.p) : undefined} size={album.size} onChange={patch => editItem(item.id, patch)}
            pan={pan} setPan={setPan} onSwap={() => { setSwapFrom(item.id); setPan(false); }} onDelete={() => deleteItem(item.id)} onLayer={f => layer(item.id, f)} />}
          {item?.k === "text" && <TextPanel it={item} onChange={patch => editItem(item.id, patch)} onDelete={() => deleteItem(item.id)} onLayer={f => layer(item.id, f)} />}
          {item?.k === "logo" && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[12px] font-bold text-[#6B6680]">Studio logo</h2>
              <p className="text-[12.5px] text-[#6B6680]">{album.studio?.logoUrl ? "Your logo from Settings." : "No logo yet, so your studio’s name shows. Add a logo in Settings → Studio."} Drag to move, corners to resize.</p>
              <LayerRow onLayer={f => layer(item.id, f)} onDelete={() => deleteItem(item.id)} />
            </section>
          )}
          {item?.k === "box" && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[12px] font-bold text-[#6B6680]">Shape</h2>
              <p className="text-[12.5px] text-[#6B6680]">Drag to move, corners to resize.</p>
              <LayerRow onLayer={f => layer(item.id, f)} onDelete={() => deleteItem(item.id)} />
            </section>
          )}
          {!item && spread && (
            <section className="text-[13px] text-[#6B6680] rounded-xl bg-[#FAF9FC] p-3">Click a photo or a text to change it. Drag to move, drag a corner to resize (Shift keeps the shape). Arrow keys nudge, Delete removes.</section>
          )}

          {(album.notes ?? []).some(n => n.by === "client") && (
            <section>
              <h2 className="text-[12px] font-bold text-[#6B6680] mb-2">Client notes · {openNotes} open</h2>
              <div className="flex flex-col gap-2">
                {pageNotes.length === 0 && <p className="text-[12.5px] text-[#6B6680]">None on this page.{otherNotes ? ` ${otherNotes} on other pages (orange in the strip).` : ""}</p>}
                {pageNotes.map(n => (
                  <div key={n.id} className={cn("rounded-xl p-3 text-[13px] flex gap-2", n.done ? "bg-[#F4F3F7] text-[#6B6680]" : "bg-[#FFF4D6] text-[#4A3300]")}>
                    <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0"><p className={cn("whitespace-pre-wrap", n.done && "line-through")}>{n.text}</p><p className="text-[11.5px] opacity-70 mt-1">{fmtWhen(n.at)}</p></div>
                    <button onClick={() => markNote(n.id, !n.done)} className="self-start h-7 px-2 rounded-full bg-white text-[12px] font-semibold flex-shrink-0">{n.done ? "Undo" : "Done"}</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-[12px] font-bold text-[#6B6680] mb-2">Checks · {checks.length ? `${checks.length} to look at` : "all good"}</h2>
            <div className="flex flex-col gap-2">
              {checks.length === 0 && <p className="flex items-start gap-2 rounded-xl bg-[#F1F9F5] text-[#1C5A3C] p-3 text-[13px]"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" />No soft photos, no empty frames, no photo used twice{album.faces ? ", no face on the fold" : ""}.</p>}
              {!album.faces && (
                <button onClick={findFaces} disabled={!!finding} className="text-left rounded-xl bg-[#F2EFF8] p-3 text-[13px] text-[#3F2A9E] font-semibold flex items-center gap-2">
                  {finding ? <><Loader2 className="w-4 h-4 animate-spin" />Finding faces… {finding}</> : "Find faces, so none fall on the fold (free)"}
                </button>
              )}
              {checks.slice(0, 12).map((c, i) => (
                <button key={i} onClick={() => { setCur(c.spread); setSel(c.item ?? null); }} className="text-left flex items-start gap-2 rounded-xl bg-[#FFF7E6] text-[#5C3B00] p-3 text-[13px] hover:bg-[#FFF0D2]">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#A15C00]" /><span><b>Page {c.spread + 1}:</b> {c.text}</span>
                </button>
              ))}
            </div>
          </section>

          <button onClick={removeAlbum} className="mt-auto text-[13px] font-semibold text-[#B42318] self-start">Delete album</button>
        </aside>
      </div>

      {versionsOpen && <VersionsDialog albumId={id} onClose={() => setVersionsOpen(false)} onRestored={(sp, r) => { pending.current = null; setSpreads(sp); spreadsRef.current = sp; rev.current = r; setHist({ past: [], future: [] }); setSave("saved"); setSel(null); setCur(0); }} />}
      {sharing && <ShareDialog album={album} onClose={() => setSharing(false)} onChange={(url, status) => setAlbum(a => (a ? { ...a, proofUrl: url, status } : a))} />}
      {exporting && <ExportDialog album={album} spreads={spreads} byId={byId} checks={checks.length} onClose={() => setExporting(false)} onSaved={f => setAlbum(a => (a ? { ...a, printFolder: f } : a))} />}
    </div>
  );
}

function SaveState({ s, onRetry }: { s: SaveS; onRetry: () => void }) {
  if (s === "conflict") return <b className="text-[#A15C00]">Not saved</b>;
  if (s === "error") return <button onClick={onRetry} className="text-[#B42318] font-semibold">Not saved · Try again</button>;
  return <span aria-live="polite">{s === "saved" ? "Saved" : "Saving…"}</span>;
}

function Tool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} disabled={disabled} className="h-9 px-3 rounded-full bg-white/85 text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-white disabled:opacity-40">{children}</button>;
}

function Strip({ spreads, cur, setCur, ratio, byId, warn, studio }: { spreads: Spread[]; cur: number; setCur: (i: number) => void; ratio: number; byId: Map<string, APhoto>; warn: Set<number>; studio?: AlbumDetail["studio"] }) {
  const tw = 132;
  const curRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { curRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); }, [cur]);
  return (
    <div className="rounded-[18px] bg-white/70 px-3 py-2.5 flex gap-3 overflow-x-auto" role="list" aria-label="Pages">
      {spreads.map((s, i) => (
        <button key={s.id} ref={i === cur ? curRef : undefined} role="listitem" onClick={() => setCur(i)} aria-current={i === cur} className="flex-shrink-0 text-center">
          <div className={cn("rounded-[3px] overflow-hidden", i === cur ? "ring-2 ring-offset-2 ring-[#7D5CEF]" : warn.has(i) ? "ring-2 ring-[#E3A21A]" : "shadow-[0_2px_6px_rgba(40,20,10,.25)]")}>
            <SpreadView spread={s} width={tw} ratio={ratio} photos={byId} fold={false} studio={studio} />
          </div>
          <span className={cn("block text-[11px] mt-1", i === cur ? "font-extrabold text-[#17151F]" : "font-semibold text-[#6B6680]")}>{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

function LayerRow({ onLayer, onDelete, label = "Delete" }: { onLayer: (front: boolean) => void; onDelete: () => void; label?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button onClick={() => onLayer(true)} title="Bring to front" className="h-9 rounded-xl bg-[#F2EFF8] text-[12px] font-semibold inline-flex items-center justify-center gap-1"><ArrowUpToLine className="w-3.5 h-3.5" />Front</button>
      <button onClick={() => onLayer(false)} title="Send to back" className="h-9 rounded-xl bg-[#F2EFF8] text-[12px] font-semibold inline-flex items-center justify-center gap-1"><ArrowDownToLine className="w-3.5 h-3.5" />Back</button>
      <button onClick={onDelete} className="h-9 rounded-xl bg-[#FDECEF] text-[#B42318] text-[12px] font-semibold inline-flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" />{label}</button>
    </div>
  );
}

function ImgPanel({ it, p, size, onChange, pan, setPan, onSwap, onDelete, onLayer }: {
  it: ImgItem; p?: APhoto; size: AlbumDetail["size"]; onChange: (patch: Partial<ImgItem>) => void;
  pan: boolean; setPan: (v: boolean) => void; onSwap: () => void; onDelete: () => void; onLayer: (front: boolean) => void;
}) {
  const dpi = p ? dpiOf(it, p, size) : null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[12px] font-bold text-[#6B6680]">Photo</h2>
      {p ? <p className="text-[12.5px] text-[#4A4658] truncate" title={p.n}>{p.n}{dpi && !it.bg ? <span className={cn("ml-1", dpi < 150 ? "text-[#A15C00] font-semibold" : "text-[#6B6680]")}>· {dpi} DPI</span> : null}</p> : <p className="text-[12.5px] text-[#6B6680]">Empty frame. Click a photo on the left.</p>}
      <label className="text-[13px] font-semibold flex flex-col gap-1">
        <span className="flex justify-between">Zoom <span className="tabular-nums text-[#6B6680]">{Math.round((it.z ?? 1) * 100)}%</span></span>
        <input type="range" min={100} max={300} value={Math.round((it.z ?? 1) * 100)} onChange={e => onChange({ z: Number(e.target.value) / 100 })} className="accent-[#7D5CEF]" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onChange({ bw: !it.bw })} aria-pressed={!!it.bw} className={cn("h-10 rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5", it.bw ? "bg-[#17151F] text-white" : "bg-[#F2EFF8]")}><Contrast className="w-4 h-4" />Black & white</button>
        <button onClick={() => onChange({ p: null })} disabled={!it.p} className="h-10 rounded-xl bg-[#F2EFF8] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40"><X className="w-4 h-4" />Empty frame</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setPan(!pan)} aria-pressed={pan} disabled={!it.p} className={cn("h-10 rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40", pan ? "bg-[#7D5CEF] text-white" : "bg-[#F2EFF8]")}><Move className="w-4 h-4" />{pan ? "Moving photo" : "Move photo"}</button>
        <button onClick={onSwap} className="h-10 rounded-xl bg-[#F2EFF8] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><Repeat className="w-4 h-4" />Swap with…</button>
      </div>
      {pan && <p className="text-[12px] text-[#5B3FD0]">Drag inside the frame to slide the photo. Click outside when done.</p>}
      <button onClick={() => onChange({ fx: 50, fy: 40, z: 1 })} className="text-[12.5px] font-semibold text-[#5B3FD0] self-start">Reset position</button>
      {!it.bg && <LayerRow onLayer={onLayer} onDelete={onDelete} label="Frame" />}
    </section>
  );
}

function TextPanel({ it, onChange, onDelete, onLayer }: { it: TextItem; onChange: (patch: Partial<TextItem>) => void; onDelete: () => void; onLayer: (front: boolean) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[12px] font-bold text-[#6B6680]">{it.role === "quote" ? "Quote" : it.role === "name" ? "Name" : "Text"}</h2>
      <textarea value={it.t} onChange={e => onChange({ t: e.target.value })} rows={it.role === "quote" ? 3 : 2} maxLength={300}
        className="w-full rounded-xl border-[1.5px] border-[#7D5CEF] bg-[#FBFAFF] p-3 text-[16px] outline-none" style={{ fontFamily: it.font }} aria-label="Words" />
      {it.role === "quote" && <button onClick={() => onChange({ t: quoteAfter(it.t) })} className="h-9 rounded-full bg-[#F2EFF8] text-[12.5px] font-semibold text-[#3F2A9E] self-start px-3">↻ Another quote</button>}
      <label className="text-[13px] font-semibold flex flex-col gap-1">Font
        <select value={it.font} onChange={e => onChange({ font: e.target.value })} className="h-10 rounded-xl border border-[#E4E0EC] px-3 bg-white text-[14px]" style={{ fontFamily: it.font }}>
          {FONT_CHOICES.map(f => <option key={f.id} value={f.css} style={{ fontFamily: f.css }}>{f.label}</option>)}
        </select>
      </label>
      <label className="text-[13px] font-semibold flex flex-col gap-1">
        <span className="flex justify-between">Size <span className="tabular-nums text-[#6B6680]">{it.size.toFixed(1)}</span></span>
        <input type="range" min={2} max={40} step={0.5} value={it.size} onChange={e => onChange({ size: Number(e.target.value) })} className="accent-[#7D5CEF]" />
      </label>
      <div className="flex items-center gap-2">
        <label className="text-[13px] font-semibold flex items-center gap-2 mr-auto">Colour
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(it.color) ? it.color : "#ffffff"} onChange={e => onChange({ color: e.target.value })} className="w-10 h-8 rounded border border-[#E4E0EC]" />
        </label>
        {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => (
          <button key={a} aria-label={`Align ${a}`} aria-pressed={(it.align ?? "left") === a} onClick={() => onChange({ align: a })} className={cn("w-9 h-9 rounded-lg inline-flex items-center justify-center", (it.align ?? "left") === a ? "bg-[#17151F] text-white" : "bg-[#F2EFF8]")}><Icon className="w-4 h-4" /></button>
        ))}
      </div>
      <button onClick={() => onChange({ italic: !it.italic })} aria-pressed={!!it.italic} className={cn("h-9 rounded-xl text-[13px] font-semibold italic", it.italic ? "bg-[#17151F] text-white" : "bg-[#F2EFF8]")}>Italic</button>
      <LayerRow onLayer={onLayer} onDelete={onDelete} />
    </section>
  );
}

const fmtWhen = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
