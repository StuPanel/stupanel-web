"use client";

/**
 * One photo selection — the studio's workspace.
 * Steps on top (add photos → albums → photos ready → send), then the albums (with their folders) and every photo
 * with the client's marks. Filters, a viewer, and ways to take the choice out (file names, CSV).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown, ClipboardCopy, Copy, Download, FolderOpen, Heart, ImagePlus, Images, Link2, Loader2,
  MessageSquareText, MoreHorizontal, RefreshCw, RotateCcw, Send, Settings2, Sparkles, Star, StickyNote, ThumbsUp, Trash2, TriangleAlert, X, XCircle,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW } from "@/components/ui/apple";
import { PortalAccessModal } from "@/components/portal-access-modal";
import { SelectLinkModal } from "@/components/select-link-modal";
import { PhotoViewer } from "@/components/photo-viewer";
import {
  albumProgress, foldersOf, isPicked, namesCsv, namesList, STATUS_LABEL, STATUS_STYLE, thumbOf, timeLeft, viewOf,
  type GalleryDetail, type GPhoto,
} from "@/lib/photos";
import { AddPhotos } from "../_components/add-photos";
import { GallerySettings } from "../_components/gallery-settings";
import { HandoffPanel } from "../_components/handoff";

type Filter = "all" | "picked" | "important" | "rejected" | "none" | "notes" | "highlight" | "problems";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" }, { id: "picked", label: "Chosen" }, { id: "important", label: "Most important" },
  { id: "rejected", label: "Not wanted" }, { id: "none", label: "Not chosen" }, { id: "notes", label: "With notes" },
  { id: "highlight", label: "Highlights" }, { id: "problems", label: "Problems" },
];
const SIZES = { s: "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10", m: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7", l: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function MarkBadge({ m }: { m: GPhoto["m"] }) {
  if (!m) return null;
  const s = m === "important" ? { c: "bg-[#C2304F]", I: Heart, l: "Most important" } : m === "selected" ? { c: "bg-[#1F8A5B]", I: ThumbsUp, l: "Chosen" } : { c: "bg-[#4A4658]", I: X, l: "Not wanted" };
  return <span className={cn("w-6 h-6 rounded-full text-white flex items-center justify-center shadow", s.c)} title={s.l}><s.I className="w-3.5 h-3.5" fill={m === "important" ? "currentColor" : "none"} /></span>;
}

export default function GalleryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [g, setG] = useState<GalleryDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [album, setAlbum] = useState<string>("all");
  /** Folder inside the album: null = all of them, "" = photos without a folder */
  const [folderPick, setFolder] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [size, setSize] = useState<keyof typeof SIZES>("m");
  const [view, setView] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState(false);
  const [portal, setPortal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [link, setLink] = useState<{ url: string } | null | undefined>(undefined);
  const [menu, setMenu] = useState<"copy" | "more" | null>(null);
  const [busy, setBusy] = useState(false);
  const lastReady = useRef(0);

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/photo-selection/${id}`).catch(() => null);
    if (r?.status === 404) { setMissing(true); return; }
    if (r?.ok) { const d: GalleryDetail = await r.json(); setG(d); lastReady.current = d.counts.ready; }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // While photos are being got ready: watch the numbers, refresh the photos now and then
  const working = (g?.counts.working ?? 0) > 0;
  useEffect(() => {
    if (!working) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const r = await apiFetch(`${API}/photo-selection/${id}/progress`).catch(() => null);
      if (!r?.ok) return;
      const p = await r.json();
      setG(x => (x ? { ...x, counts: { ...x.counts, total: p.total, ready: p.ready, failed: p.failed, working: p.working } } : x));
      // Ready photos show up every few seconds; a big gallery is reloaded less often
      const every = p.total > 1500 ? 4 : 2;
      if (p.working === 0 || (p.ready > lastReady.current && n % every === 0)) load();
    }, 3000);
    return () => clearInterval(t);
  }, [working, id, load]);

  const albumName = useMemo(() => new Map((g?.albums ?? []).map(a => [a.id, a.name])), [g?.albums]);
  const folders = useMemo(() => foldersOf(g?.photos ?? [], album === "all" ? undefined : album), [g?.photos, album]);
  const folder = folderPick !== null && folders.includes(folderPick) ? folderPick : null;
  const shown = useMemo(() => (g?.photos ?? []).filter(p =>
    (album === "all" || p.a === album) && (folder === null || (p.f ?? "") === folder) &&
    (filter === "all" ? true : filter === "picked" ? isPicked(p.m) : filter === "important" ? p.m === "important" : filter === "rejected" ? p.m === "rejected"
      : filter === "none" ? !p.m : filter === "notes" ? !!p.no : filter === "highlight" ? p.hl : p.st === "failed")), [g?.photos, album, folder, filter]);

  const act = async (action: "send" | "take" | "reopen" | "close", clear?: boolean) => {
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/photo-selection/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, clear }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't do that", { error: true }); return false; }
      setG(d);
      return true;
    } finally { setBusy(false); }
  };

  async function send() {
    if (!g) return;
    if (g.counts.working && !(await askConfirm({ title: "Some photos are still getting ready", message: `${g.counts.working} photos are not ready yet. The client sees them as soon as they are. Send now?`, confirmLabel: "Send now" }))) return;
    if (await act("send")) { notify("Sent — share it with the client"); openShare(); }
  }
  // The direct link (no code) for this selection lives with the handoff state.
  function openShare() {
    setSharing(true); setLink(undefined);
    apiFetch(`${API}/photo-selection/${id}/handoff`).then(r => (r.ok ? r.json() : null)).then(d => setLink(d?.link ?? null)).catch(() => setLink(null));
  }
  async function setShareLink(on: boolean, reset?: boolean) {
    const r = await apiFetch(`${API}/photo-selection/${id}/link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on, reset: !!reset }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't do that", { error: true }); return false; }
    setLink(d.link ?? null);
    return true;
  }
  async function take() {
    if (!g) return;
    const ok = await askConfirm({
      title: "Start the album?",
      message: g.status === "open" ? "The client has not sent their choice yet. Starting now locks it as it is." : "The client's choice is locked. If they need a change, they can ask you and you can open it again.",
      confirmLabel: "Start album",
    });
    if (ok && (await act("take"))) notify("Locked — the album can start");
  }
  async function reopen() {
    const keep = await askConfirm({ title: "Open it again for the client?", message: "Their choices stay — they can change them and send again.", confirmLabel: "Open again" });
    if (keep && (await act("reopen"))) notify("Open again for the client");
  }
  async function clearAll() {
    setMenu(null);
    if (!(await askConfirm({ title: "Clear every choice and start over?", message: "All marks and notes of the client are removed. This can't be undone.", confirmLabel: "Clear and open", danger: true }))) return;
    if (await act("reopen", true)) notify("Cleared — the client starts again");
  }
  async function closeIt() {
    setMenu(null);
    if (!(await askConfirm({ title: "Close this selection?", message: "The client won't see it any more. You can open it again later.", confirmLabel: "Close" }))) return;
    if (await act("close")) notify("Closed");
  }
  async function remove() {
    setMenu(null);
    if (!g || !(await askConfirm({ title: "Delete this photo selection?", message: `The ${g.counts.total} photos leave this selection and the client's choices are deleted. Your photos on Google Drive are not touched.`, confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/photo-selection/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { notify("Couldn't delete", { error: true }); return; }
    notify("Deleted"); router.push("/photo-selection");
  }

  async function patchPhotos(ids: string[], body: { highlight?: boolean; albumId?: string; folder?: string }) {
    const r = await apiFetch(`${API}/photo-selection/${id}/photos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ...body }) }).catch(() => null);
    if (!r?.ok) { notify("Couldn't save", { error: true }); return; }
    setG(x => x ? { ...x, photos: x.photos.map(p => (ids.includes(p.id) ? { ...p, ...(body.highlight !== undefined ? { hl: body.highlight } : {}), ...(body.albumId ? { a: body.albumId } : {}), ...(body.folder !== undefined ? { f: body.folder || null } : {}) } : p)) } : x);
    if (body.albumId) load();
  }
  async function removePhotos(ids: string[]) {
    if (!(await askConfirm({ title: `Remove ${ids.length} photo${ids.length > 1 ? "s" : ""}?`, message: "They leave this selection only — your photos on Google Drive are not touched.", confirmLabel: "Remove", danger: true }))) return;
    const r = await apiFetch(`${API}/photo-selection/${id}/photos/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => null);
    if (!r?.ok) { notify("Couldn't remove", { error: true }); return; }
    setSel(new Set()); setView(null); notify("Removed"); load();
  }
  async function retry() {
    await apiFetch(`${API}/photo-selection/${id}/retry`, { method: "POST" }).catch(() => null);
    notify("Trying again"); load();
  }

  async function copy(which: "picked" | "important") {
    setMenu(null);
    if (!g) return;
    const text = namesList(g.photos.filter(p => album === "all" || p.a === album), g.albums, which);
    if (!text) { notify(which === "important" ? "No photo is marked most important" : "The client has not chosen any photo yet", { error: true }); return; }
    try { await navigator.clipboard.writeText(text); notify("File names copied"); } catch { notify("Couldn't copy", { error: true }); }
  }
  function csv() {
    setMenu(null);
    if (!g) return;
    const blob = new Blob(["﻿" + namesCsv(g.photos, g.albums)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${g.title.replace(/[^\w\- ]+/g, "").trim() || "selection"}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  if (missing) return (
    <div className="max-w-md mx-auto text-center py-20">
      <p className="text-[17px] font-bold text-[#17151F]">This photo selection is not here</p>
      <Link href="/photo-selection" className="mt-4 inline-flex h-10 px-4 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold items-center">Back to photo selection</Link>
    </div>
  );
  if (!g) return (
    <div>
      <div className="sp-skel h-10 w-64 rounded-full mb-6" />
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">{Array.from({ length: 15 }).map((_, i) => <div key={i} className="sp-skel aspect-square rounded-[12px]" />)}</div>
    </div>
  );

  const left = g.status === "open" || g.status === "submitted" ? timeLeft(g.deadline) : null;
  const steps = [
    { label: "Add photos", done: g.counts.total > 0 },
    { label: "Albums & limits", done: g.albums.length > 0 && g.albums.some(a => a.maxPicks !== null || a.minPicks !== null) },
    { label: "Photos ready", done: g.counts.ready > 0 && g.counts.working === 0 },
    { label: "Send to client", done: g.status !== "preparing" },
  ];
  const vp = view !== null ? shown[view] : null;

  const primary = g.status === "preparing" || g.status === "closed"
    ? <button type="button" onClick={send} disabled={busy || !g.counts.ready} className="h-10 px-4 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send to client</button>
    : g.status === "taken"
      ? <button type="button" onClick={reopen} disabled={busy} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-sm font-semibold inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4" />Open again</button>
      : <button type="button" onClick={take} disabled={busy} className="h-10 px-4 rounded-full bg-[#1F8A5B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Start album</button>;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/photo-selection" aria-label="Back" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#4A4658] hover:bg-[#F5F3FA] flex-shrink-0 shadow-[0_1px_2px_rgba(22,18,40,.06)]"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[21px] sm:text-[24px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight truncate">{g.title}</h1>
              <span className={cn("h-7 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center", STATUS_STYLE[g.status])}>{STATUS_LABEL[g.status]}</span>
            </div>
            <p className="text-[13px] text-[#6B6680] truncate">
              <Link href={`/clients/${g.client.id}`} className="hover:text-[#5B3FD0]">{g.client.name}</Link> · <Link href={`/programs?view=${g.program.id}`} className="hover:text-[#5B3FD0]">{g.program.number} {g.program.name !== g.program.number ? `· ${g.program.name}` : ""}</Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setAdding(true)} className="h-10 px-4 rounded-full bg-white text-[#17151F] text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#F5F3FA] shadow-[0_1px_2px_rgba(22,18,40,.06)]"><ImagePlus className="w-4 h-4" />Add photos</button>
          <button type="button" onClick={openShare} className="h-10 px-4 rounded-full bg-white text-[#17151F] text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#F5F3FA] shadow-[0_1px_2px_rgba(22,18,40,.06)]"><Link2 className="w-4 h-4" />Share</button>
          <button type="button" onClick={() => setSettings(true)} aria-label="Settings" title="Settings" className="w-10 h-10 rounded-full bg-white text-[#4A4658] inline-flex items-center justify-center hover:bg-[#F5F3FA] shadow-[0_1px_2px_rgba(22,18,40,.06)]"><Settings2 className="w-4 h-4" /></button>
          <div className="relative">
            <button type="button" onClick={() => setMenu(m => (m === "more" ? null : "more"))} aria-label="More" aria-expanded={menu === "more"} className="w-10 h-10 rounded-full bg-white text-[#4A4658] inline-flex items-center justify-center hover:bg-[#F5F3FA] shadow-[0_1px_2px_rgba(22,18,40,.06)]"><MoreHorizontal className="w-4 h-4" /></button>
            {menu === "more" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-60 bg-white rounded-[16px] p-1.5 shadow-[0_12px_40px_rgba(22,18,40,.18)] border border-[#EEEBF4] sp-pop-in">
                  {g.status !== "preparing" && <button type="button" onClick={clearAll} className="w-full h-10 px-3 rounded-[10px] text-left text-[14px] text-[#17151F] hover:bg-[#F5F3FA] inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Clear choices & start over</button>}
                  {g.status !== "closed" && g.status !== "preparing" && <button type="button" onClick={closeIt} className="w-full h-10 px-3 rounded-[10px] text-left text-[14px] text-[#17151F] hover:bg-[#F5F3FA] inline-flex items-center gap-2"><XCircle className="w-4 h-4" />Close for the client</button>}
                  <button type="button" onClick={remove} className="w-full h-10 px-3 rounded-[10px] text-left text-[14px] text-[#C2304F] hover:bg-[#FDECEF] inline-flex items-center gap-2"><Trash2 className="w-4 h-4" />Delete selection</button>
                </div>
              </>
            )}
          </div>
          {primary}
        </div>
      </div>

      {/* Steps (until it is sent) */}
      {g.status === "preparing" && (
        <ol className={cn("bg-white rounded-[20px] p-2 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-1", CARD_SHADOW)}>
          {steps.map((s, i) => (
            <li key={s.label} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-[14px] transition-colors", s.done ? "bg-[#E2F4EA]/60" : i === steps.findIndex(x => !x.done) ? "bg-[#EEE8FD]" : "")}>
              <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 transition-colors", s.done ? "bg-[#1F8A5B] text-white" : "bg-white text-[#5B3FD0] ring-1 ring-[#E4DEF8]")}>
                {s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-[13px] font-semibold", s.done ? "text-[#1F8A5B]" : "text-[#17151F]")}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Client messages */}
      {g.reopenRequestedAt && (
        <div className="mb-4 rounded-[18px] bg-[#FDECEF] p-4 flex items-center gap-3 sp-fade-in">
          <Sparkles className="w-5 h-5 text-[#C2304F] flex-shrink-0" />
          <p className="flex-1 text-[14px] text-[#6E1C2D]"><b>{g.client.firstName} wants to change the photos.</b>{g.reopenReason ? ` “${g.reopenReason}”` : ""}</p>
          <button type="button" onClick={reopen} className="h-10 px-4 rounded-full bg-[#C2304F] text-white text-[13px] font-semibold flex-shrink-0">Open again</button>
        </div>
      )}
      {g.status === "submitted" && (
        <div className="mb-4 rounded-[18px] bg-[#E2F4EA] p-4 flex items-start gap-3 sp-fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#1F8A5B] flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-[14px] text-[#14532D]">
            <p><b>{g.client.firstName} sent {g.counts.picked} photos</b> on {fmt(g.submittedAt)}{g.counts.important ? ` · ${g.counts.important} most important` : ""}.{g.changedAfterSubmitAt ? " They changed something after sending." : ""}</p>
            {g.clientNote && <p className="mt-1 text-[#1F5132]">“{g.clientNote}”</p>}
          </div>
        </div>
      )}
      {g.status !== "submitted" && g.clientNote && (
        <div className="mb-4 rounded-[18px] bg-white p-4 flex items-start gap-3"><MessageSquareText className="w-5 h-5 text-[#5B3FD0] flex-shrink-0 mt-0.5" /><p className="text-[14px] text-[#17151F]">“{g.clientNote}”</p></div>
      )}

      {g.status !== "preparing" && <HandoffPanel g={g} />}

      {/* Getting photos ready */}
      {(working || g.counts.failed > 0) && (
        <div className={cn("bg-white rounded-[18px] p-4 mb-4", CARD_SHADOW)}>
          {g.counts.working > 0 && (
            <div>
              <div className="flex items-center justify-between text-[13px] mb-1.5">
                <span className="font-semibold text-[#17151F] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Getting photos ready {g.counts.ready} / {g.counts.total}</span>
                <span className="text-[#6B6680]">You can leave — it goes on by itself</span>
              </div>
              <div className="h-2 rounded-full bg-[#F5F3FA] overflow-hidden"><div className="h-full bg-[#1F8A5B] transition-[width] duration-700" style={{ width: `${g.counts.total ? (g.counts.ready / g.counts.total) * 100 : 0}%` }} /></div>
            </div>
          )}
          {g.counts.failed > 0 && (
            <div className="flex items-center gap-3 mt-3 text-[13px]">
              <TriangleAlert className="w-4 h-4 text-[#C2304F]" />
              <span className="flex-1 text-[#6E1C2D]">{g.counts.failed} photo{g.counts.failed > 1 ? "s" : ""} can&apos;t be shown.</span>
              <button type="button" onClick={() => { setFilter("problems"); setAlbum("all"); }} className="h-8 px-3 rounded-full bg-[#F5F3FA] text-[12.5px] font-semibold text-[#4A4658]">Show</button>
              <button type="button" onClick={retry} className="h-8 px-3 rounded-full bg-[#17151F] text-white text-[12.5px] font-semibold">Try again</button>
            </div>
          )}
        </div>
      )}

      {/* Albums */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-2 mb-2 [scrollbar-width:none]" role="tablist" aria-label="Albums">
        <button type="button" role="tab" aria-selected={album === "all"} onClick={() => setAlbum("all")}
          className={cn("flex-shrink-0 rounded-[16px] px-4 py-2.5 text-left transition-all", album === "all" ? "bg-[#17151F] text-white" : "bg-white text-[#17151F] hover:bg-[#F5F3FA]")}>
          <span className="block text-[13px] font-bold">All photos</span>
          <span className={cn("block text-[12px]", album === "all" ? "text-white/70" : "text-[#6B6680]")}>{g.counts.total} · {g.counts.picked} chosen</span>
        </button>
        {g.albums.map(a => {
          const p = albumProgress(a, a.picked);
          const on = album === a.id;
          return (
            <button key={a.id} type="button" role="tab" aria-selected={on} onClick={() => setAlbum(a.id)}
              className={cn("flex-shrink-0 min-w-[150px] rounded-[16px] px-4 py-2.5 text-left transition-all", on ? "bg-[#17151F] text-white" : "bg-white text-[#17151F] hover:bg-[#F5F3FA]")}>
              <span className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold truncate">{a.name}</span>
                <span className={cn("text-[12px] font-bold tabular-nums", p.over ? "text-[#E2566F]" : p.okRange ? (on ? "text-[#7BE0A8]" : "text-[#1F8A5B]") : on ? "text-white/70" : "text-[#6B6680]")}>{p.text}</span>
              </span>
              <span className={cn("block h-1 rounded-full mt-2 overflow-hidden", on ? "bg-white/15" : "bg-[#F5F3FA]")}>
                <span className={cn("block h-full rounded-full transition-[width] duration-700", p.over ? "bg-[#E2566F]" : p.okRange ? "bg-[#1F8A5B]" : "bg-[#7D5CEF]")} style={{ width: `${p.pct}%` }} />
              </span>
              <span className={cn("block text-[12px] mt-1", on ? "text-white/60" : "text-[#A29DB3]")}>{a.total ?? 0} photos</span>
            </button>
          );
        })}
      </div>

      {/* Folders inside the album */}
      {folders.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-1 [scrollbar-width:none]" role="tablist" aria-label="Folders">
          {[null, ...folders].map(f => {
            const n = g.photos.filter(p => (album === "all" || p.a === album) && (f === null || (p.f ?? "") === f));
            const on = folder === f;
            return (
              <button key={f ?? "*"} type="button" role="tab" aria-selected={on} onClick={() => setFolder(f)}
                className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors",
                  on ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]")}>
                {f !== null && <FolderOpen className="w-3.5 h-3.5" />}{f === null ? "All folders" : f || "Other photos"}
                <span className={cn("text-[12px] tabular-nums", on ? "text-white/70" : "text-[#A29DB3]")}>{n.filter(p => isPicked(p.m)).length}/{n.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] flex-1 min-w-0">
          {FILTERS.filter(f => f.id !== "problems" || g.counts.failed > 0).map(f => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors", filter === f.id ? "bg-[#7D5CEF] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]")}>{f.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex p-1 rounded-full bg-white" role="radiogroup" aria-label="Photo size">
            {(["s", "m", "l"] as const).map(s => (
              <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => setSize(s)}
                className={cn("w-8 h-7 rounded-full text-[12px] font-bold uppercase", size === s ? "bg-[#17151F] text-white" : "text-[#6B6680]")}>{s}</button>
            ))}
          </div>
          <button type="button" onClick={() => { setSelecting(v => !v); setSel(new Set()); }}
            className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold", selecting ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]")}>{selecting ? "Done" : "Select"}</button>
          <div className="relative">
            <button type="button" onClick={() => setMenu(m => (m === "copy" ? null : "copy"))} aria-expanded={menu === "copy"}
              className="h-9 px-3.5 rounded-full bg-white text-[#4A4658] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#F5F3FA]"><ClipboardCopy className="w-4 h-4" />Get list<ChevronDown className="w-3.5 h-3.5" /></button>
            {menu === "copy" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-72 bg-white rounded-[16px] p-1.5 shadow-[0_12px_40px_rgba(22,18,40,.18)] border border-[#EEEBF4] sp-pop-in">
                  <button type="button" onClick={() => copy("picked")} className="w-full px-3 py-2.5 rounded-[10px] text-left hover:bg-[#F5F3FA] flex gap-2.5"><Copy className="w-4 h-4 mt-0.5 text-[#5B3FD0]" /><span><span className="block text-[14px] font-semibold text-[#17151F]">Copy chosen file names</span><span className="block text-[12px] text-[#6B6680]">{album === "all" ? "By album" : albumName.get(album)} — paste in Lightroom or a note</span></span></button>
                  <button type="button" onClick={() => copy("important")} className="w-full px-3 py-2.5 rounded-[10px] text-left hover:bg-[#F5F3FA] flex gap-2.5"><Heart className="w-4 h-4 mt-0.5 text-[#C2304F]" /><span><span className="block text-[14px] font-semibold text-[#17151F]">Copy “most important” only</span></span></button>
                  <button type="button" onClick={csv} className="w-full px-3 py-2.5 rounded-[10px] text-left hover:bg-[#F5F3FA] flex gap-2.5"><Download className="w-4 h-4 mt-0.5 text-[#1F8A5B]" /><span><span className="block text-[14px] font-semibold text-[#17151F]">Download list (Excel)</span><span className="block text-[12px] text-[#6B6680]">Album, folder, file, mark and note</span></span></button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      {g.photos.length === 0 ? (
        <div className={cn("bg-white rounded-[22px] p-10 text-center", CARD_SHADOW)}>
          <span className="w-16 h-16 mx-auto rounded-[20px] bg-[#FDECEF] text-[#C2304F] flex items-center justify-center"><Images className="w-7 h-7" /></span>
          <p className="text-[17px] font-bold text-[#17151F] mt-4">Add the photos</p>
          <p className="text-[14px] text-[#6B6680] mt-1 max-w-md mx-auto">From the program&apos;s raw files or delivery on Google Drive, or from your phone or computer. Folders like Holud, Wedding and Reception all go into one album.</p>
          <button type="button" onClick={() => setAdding(true)} className="mt-5 h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />Add photos</button>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-center text-sm text-[#6B6680] py-12">No photo here.</p>
      ) : (
        <div className={cn("grid gap-1.5 sm:gap-2", SIZES[size])}>
          {shown.map((p, i) => {
            const on = sel.has(p.id);
            return (
              <button key={p.id} type="button"
                onClick={() => { if (selecting) setSel(s => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; }); else if (p.t) setView(i); }}
                className={cn("relative aspect-square rounded-[12px] overflow-hidden bg-[#EEEBF4] group [content-visibility:auto] [contain-intrinsic-size:160px]",
                  on && "ring-[3px] ring-[#7D5CEF] ring-offset-2", p.m === "rejected" && !selecting && "opacity-60")}
                aria-label={p.n}>
                {p.t ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbOf(p)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                ) : (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#A29DB3] p-2 text-center">
                    {p.st === "failed" ? <TriangleAlert className="w-5 h-5 text-[#C2304F]" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                    <span className="text-[11.5px] leading-tight line-clamp-2">{p.st === "failed" ? p.err || "Can't be shown" : p.n}</span>
                  </span>
                )}
                <span className="absolute left-1.5 top-1.5 flex gap-1"><MarkBadge m={p.m} />{p.no && <span className="w-6 h-6 rounded-full bg-white/95 text-[#5B3FD0] flex items-center justify-center shadow" title={p.no}><StickyNote className="w-3.5 h-3.5" /></span>}</span>
                {p.hl && <span className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full bg-white/95 text-[#9E3A8C] flex items-center justify-center shadow" title="Highlight"><Star className="w-3.5 h-3.5" fill="currentColor" /></span>}
                {selecting && <span className={cn("absolute right-1.5 bottom-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center", on ? "bg-[#7D5CEF] border-[#7D5CEF] text-white" : "bg-white/80 border-white")}>{on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}</span>}
                {size !== "s" && p.t && <span className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 bg-gradient-to-t from-black/55 to-transparent text-white text-[11.5px] truncate text-left opacity-0 group-hover:opacity-100 transition-opacity">{p.n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Selection bar */}
      {selecting && sel.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 z-40 flex items-center gap-2 p-2 pl-4 rounded-full bg-[#17151F] text-white shadow-[0_18px_40px_-12px_rgba(22,18,40,.6)] sp-pop-in">
          <span className="text-[13px] font-semibold mr-1">{sel.size} selected</span>
          <button type="button" onClick={() => patchPhotos([...sel], { highlight: true })} className="h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 text-[13px] font-semibold inline-flex items-center gap-1.5"><Star className="w-4 h-4" />Highlight</button>
          {g.albums.length > 1 && (
            <select defaultValue="" onChange={e => { if (e.target.value) patchPhotos([...sel], { albumId: e.target.value }); e.target.value = ""; }} aria-label="Move to album"
              className="h-9 px-3 rounded-full bg-white/10 text-[13px] font-semibold outline-none">
              <option value="" disabled>Album…</option>
              {g.albums.map(a => <option key={a.id} value={a.id} className="text-[#17151F]">{a.name}</option>)}
            </select>
          )}
          {folders.length > 0 && (
            <select defaultValue="" onChange={e => { if (e.target.value) patchPhotos([...sel], { folder: e.target.value === "-" ? "" : e.target.value }); e.target.value = ""; }} aria-label="Move to folder"
              className="h-9 px-3 rounded-full bg-white/10 text-[13px] font-semibold outline-none max-w-[130px]">
              <option value="" disabled>Folder…</option>
              {folders.filter(Boolean).map(f => <option key={f} value={f} className="text-[#17151F]">{f}</option>)}
              <option value="-" className="text-[#17151F]">No folder</option>
            </select>
          )}
          <button type="button" onClick={() => removePhotos([...sel])} className="h-9 px-3 rounded-full bg-[#C2304F] text-[13px] font-semibold inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />Remove</button>
        </div>
      )}

      {/* Viewer */}
      {vp && view !== null && (
        <PhotoViewer count={shown.length} index={view} onIndex={setView} onClose={() => setView(null)}
          src={viewOf(vp)}
          preload={[shown[view + 1], shown[view + 2], shown[view + 3], shown[view - 1]].filter(Boolean).filter(p => p!.t).map(p => viewOf(p!))}
          title={vp.n} sub={[albumName.get(vp.a), vp.f].filter(Boolean).join(" · ")}
          onKey={e => { if (e.key.toLowerCase() === "h") { patchPhotos([vp.id], { highlight: !vp.hl }); return true; } return false; }}
          footer={
            <div className="max-w-2xl mx-auto flex flex-col gap-2">
              {vp.no && <p className="text-[14px] bg-white/10 rounded-[14px] px-3.5 py-2.5"><StickyNote className="w-4 h-4 inline mr-1.5 -mt-0.5" />“{vp.no}”</p>}
              <div className="flex items-center gap-2">
                <span className="flex-1 inline-flex items-center gap-2 text-[13px] text-white/80">
                  <MarkBadge m={vp.m} />{vp.m === "important" ? "Most important" : vp.m === "selected" ? "Chosen by the client" : vp.m === "rejected" ? "Not wanted" : "Not chosen"}
                </span>
                <button type="button" onClick={() => patchPhotos([vp.id], { highlight: !vp.hl })} className={cn("h-10 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5", vp.hl ? "bg-white text-[#9E3A8C]" : "bg-white/10 hover:bg-white/20")}>
                  <Star className="w-4 h-4" fill={vp.hl ? "currentColor" : "none"} />Highlight
                </button>
                <button type="button" onClick={() => removePhotos([vp.id])} aria-label="Remove photo" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#C2304F] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          } />
      )}

      {adding && <AddPhotos galleryId={g.id} programId={g.program.id} programName={g.program.name} albums={g.albums} onClose={() => setAdding(false)} onAdded={load} />}
      {settings && <GallerySettings g={g} onClose={() => setSettings(false)} onSaved={load} />}
      {sharing && (
        <SelectLinkModal title="Share photo selection" what="this photo selection" client={g.client} link={link}
          onSet={setShareLink}
          message={url => `Hi ${g.client.firstName}, please choose the photos for your album here — no code needed:\n${url}${g.deadline ? `\nPlease choose by ${fmtDate(g.deadline)}.` : ""}`}
          onPortal={() => { setSharing(false); setPortal(true); }} onClose={() => setSharing(false)} />
      )}
      {portal && <PortalAccessModal client={{ id: g.client.id, firstName: g.client.firstName, lastName: g.client.lastName, phone: g.client.phone }} onClose={() => setPortal(false)} />}
      {left && (
        <div className={cn("fixed right-4 bottom-24 lg:bottom-6 z-30 h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 shadow-[0_10px_30px_-12px_rgba(22,18,40,.4)]",
          left.over ? "bg-[#C2304F] text-white" : "bg-white text-[#17151F]")}>{left.text}</div>
      )}
    </div>
  );
}
