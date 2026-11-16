"use client";

/**
 * One face gallery: its photos (read from the program's Google Drive), the guests who searched,
 * the link / QR to share and the settings.
 */
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  AlertCircle, ArrowLeft, Check, Copy, Download, ExternalLink, EyeOff, FolderOpen, HardDrive, ImagePlus, Images, Loader2,
  Mail, MessageCircle, PackageCheck, QrCode, RefreshCw, ScanFace, Star, Trash2, X,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, Chips, EmptyState, Group } from "@/components/ui/apple";
import { FormDrawer, PillPicker, SwitchRow, inputCls } from "@/components/ui/form-kit";
import {
  FACE_STATUS, day, dayTime, errText, facePhotoUrl, num,
  type Credits, type FaceDetail, type FaceGuest, type FacePhoto, type FaceSettings,
} from "@/lib/face";

type Tab = "photos" | "guests" | "share" | "settings";
type Filter = "" | "ready" | "waiting" | "noface" | "failed" | "hidden" | "highlights";
const json = (body: unknown, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function FaceGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [g, setG] = useState<FaceDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("photos");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/face-search/${id}`).catch(() => null);
    if (r?.status === 404) return setMissing(true);
    if (r?.ok) setG(await r.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // While photos are being read, look again every few seconds.
  const waiting = g?.counts.waiting ?? 0;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { load(); setTick(n => n + 1); }, 4000);
    return () => clearInterval(t);
  }, [waiting, load]);

  async function act(action: "publish" | "unpublish" | "close" | "reopen") {
    if (busy) return;
    setBusy(true);
    const r = await apiFetch(`${API}/face-search/${id}/action`, json({ action })).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return notify(errText(d, "Could not do that. Please try again."), { error: true });
    setG(d);
    notify(action === "publish" ? "Published. Guests can find their photos now." : action === "close" ? "Gallery closed." : "Guests can't open it now.");
  }

  if (missing) return <EmptyState icon={ScanFace} title="Gallery not found" text="It may have been removed." action={<Link href="/face-search" className="h-11 px-5 rounded-full bg-[#17151F] text-white text-sm font-semibold inline-flex items-center">Back to AI Face Search</Link>} />;
  if (!g) return <div className="py-24 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const st = FACE_STATUS[g.status];
  const c = g.counts;
  const foundPct = c.guests ? Math.round((c.found / c.guests) * 100) : 0;

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/face-search" aria-label="Back to AI Face Search" className={cn("w-11 h-11 rounded-full bg-white flex items-center justify-center text-[#17151F] flex-shrink-0", CARD_SHADOW)}><ArrowLeft className="w-4 h-4" /></Link>
          <div className="w-12 h-12 rounded-[14px] overflow-hidden bg-[#F1EFF6] flex-shrink-0 flex items-center justify-center text-[#A29DB3]">
            {g.cover
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={facePhotoUrl(g.cover, 160)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              : <Images className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] sm:text-[24px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{g.title}</h1>
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", st.badge)}>{st.label}</span>
            </div>
            <p className="text-xs text-[#6B6680] mt-0.5 truncate">{[g.program?.client, g.program?.number, day(g.program?.eventDate)].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={g.link} target="_blank" rel="noreferrer" className={cn("h-11 px-4 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5", CARD_SHADOW)}><ExternalLink className="w-4 h-4" />Guest page</a>
          {g.status === "published"
            ? <button type="button" disabled={busy} onClick={() => act("unpublish")} className={cn("h-11 px-4 rounded-full bg-white text-[13px] font-semibold text-[#17151F] disabled:opacity-50", CARD_SHADOW)}>Unpublish</button>
            : <button type="button" disabled={busy || !c.ready} onClick={() => act("publish")} title={c.ready ? "" : "Add photos first"} className="h-11 px-5 rounded-full bg-[#1F8A5B] text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Publish</button>}
          <button type="button" onClick={() => setAdding(true)} className="h-11 px-5 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />Add photos</button>
        </div>
      </div>

      {!g.ready && (
        <div className="mb-4 rounded-[18px] bg-[#FFF3E0] p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#8A5200] flex-shrink-0" />
          <p className="flex-1 text-[14px] text-[#6B4100]"><b>Face search is being set up.</b> Photos you add wait here and are read once setup is finished.</p>
        </div>
      )}

      <div className={cn("bg-white rounded-[20px] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-5 overflow-hidden", CARD_SHADOW)}>
        <Stat label="Photos ready" value={num(c.ready)} sub={c.waiting ? `${num(c.waiting)} being read` : c.failed ? `${num(c.failed)} could not be read` : `${num(c.faces)} faces found`} />
        <Stat label="No face found" value={num(c.noFace)} sub="Shown only as Highlights" />
        <Stat label="Guests" value={num(c.guests)} sub="Searched with a selfie" />
        <Stat label="Found their photos" value={num(c.found)} sub={c.guests ? `${foundPct}% of guests` : "No guests yet"} good={c.guests > 0} />
        <Stat label="Credits used here" value={num(g.creditsUsed)} sub={`${num(g.credits.total)} left`} />
      </div>

      <Chips<Tab> label="Sections" value={tab} onChange={setTab} options={[
        { value: "photos", label: "Photos", count: c.photos }, { value: "guests", label: "Guests", count: c.guests },
        { value: "share", label: "Share" }, { value: "settings", label: "Settings" },
      ]} />

      {tab === "photos" && <Photos g={g} tick={tick} onChanged={load} onAdd={() => setAdding(true)} />}
      {tab === "guests" && <Guests id={g.id} />}
      {tab === "share" && <Share g={g} />}
      {tab === "settings" && <Settings g={g} onSaved={setG} onRemoved={() => router.replace("/face-search")} onAct={act} />}

      {adding && <AddPhotos id={g.id} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); setTab("photos"); load(); setTick(n => n + 1); }} />}
    </div>
  );
}

function Stat({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="px-4 py-3.5 border-b sm:border-b-0 border-r border-[#EEEBF4] last:border-r-0 min-w-0">
      <p className="text-xs font-semibold text-[#6B6680] truncate">{label}</p>
      <p className="text-[24px] font-extrabold tracking-[-0.03em] text-[#17151F] tabular-nums leading-tight">{value}</p>
      <p className={cn("text-xs truncate", good ? "text-[#176B47] font-bold" : "text-[#6B6680]")}>{sub}</p>
    </div>
  );
}

// ─── Photos ───────────────────────────────────────────────────────────────────

function Photos({ g, tick, onChanged, onAdd }: { g: FaceDetail; tick: number; onChanged: () => void; onAdd: () => void }) {
  const [filter, setFilter] = useState<Filter>("");
  const [folder, setFolder] = useState<string | null>(null);
  const [list, setList] = useState<{ total: number; photos: FacePhoto[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);

  const query = useCallback((skip: number) => {
    const p = new URLSearchParams({ take: "200", skip: String(skip) });
    if (filter) p.set("filter", filter);
    if (folder !== null) p.set("folder", folder);
    return apiFetch(`${API}/face-search/${g.id}/photos?${p}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  }, [g.id, filter, folder]);

  useEffect(() => { let on = true; query(0).then(d => { if (on && d) setList(d); }); return () => { on = false; }; }, [query, tick]);

  async function loadMore() {
    if (!list || more) return;
    setMore(true);
    const d = await query(list.photos.length);
    setMore(false);
    if (d) setList({ total: d.total, photos: [...list.photos, ...d.photos] });
  }

  function toggle(id: string) { setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function change(body: Record<string, unknown>, done: string) {
    if (busy || !picked.size) return;
    setBusy(true);
    const r = await apiFetch(`${API}/face-search/${g.id}/photos`, json({ ids: [...picked], ...body }, "PATCH")).catch(() => null);
    setBusy(false);
    if (!r?.ok) return notify("Could not change these photos. Please try again.", { error: true });
    notify(done); setPicked(new Set()); const d = await query(0); if (d) setList(d); onChanged();
  }
  async function remove() {
    if (busy || !picked.size) return;
    const n = picked.size;
    if (!(await askConfirm({ title: `Remove ${n} photo${n === 1 ? "" : "s"}?`, message: "They leave this gallery and guests stop seeing them. The files stay on your Google Drive. Credits are not given back, but adding the same photos again is free.", confirmLabel: "Remove", danger: true }))) return;
    setBusy(true);
    const r = await apiFetch(`${API}/face-search/${g.id}/photos/remove`, json({ ids: [...picked] })).catch(() => null);
    setBusy(false);
    if (!r?.ok) return notify("Could not remove these photos. Please try again.", { error: true });
    notify(`${n} photo${n === 1 ? "" : "s"} removed`); setPicked(new Set()); const d = await query(0); if (d) setList(d); onChanged();
  }
  async function cover() {
    const [first] = [...picked];
    const r = await apiFetch(`${API}/face-search/${g.id}`, json({ coverPhotoId: first }, "PATCH")).catch(() => null);
    if (!r?.ok) return notify("Could not set the cover. Please try again.", { error: true });
    notify("Cover photo set"); setPicked(new Set()); onChanged();
  }
  async function retry() {
    const r = await apiFetch(`${API}/face-search/${g.id}/retry`, json({})).catch(() => null);
    if (r?.ok) { notify("Trying again"); onChanged(); }
  }

  const c = g.counts;
  if (!c.photos) return (
    <EmptyState icon={ImagePlus} title="No photos yet" text="Add the program's photos from Google Drive. Each photo is read once and uses 1 credit. RAW files and videos are left out and cost nothing."
      action={<button type="button" onClick={onAdd} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />Add photos</button>} />
  );

  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: "", label: "All", count: c.photos }, { value: "ready", label: "Ready", count: c.ready },
    ...(c.waiting ? [{ value: "waiting" as Filter, label: "Being read", count: c.waiting }] : []),
    ...(c.noFace ? [{ value: "noface" as Filter, label: "No face found", count: c.noFace }] : []),
    ...(c.failed ? [{ value: "failed" as Filter, label: "Could not be read", count: c.failed }] : []),
    { value: "highlights", label: "Highlights" },
    ...(c.hidden ? [{ value: "hidden" as Filter, label: "Hidden", count: c.hidden }] : []),
  ];

  return (
    <div className={picked.size ? "pb-24" : ""}>
      <Chips<Filter> label="Filter photos" value={filter} onChange={v => { setFilter(v); setPicked(new Set()); }} options={filters} />
      {g.folders.length > 1 && (
        <Chips<string> label="Folders" value={folder ?? "\u0000"} onChange={v => { setFolder(v === "\u0000" ? null : v); setPicked(new Set()); }}
          options={[{ value: "\u0000", label: "All folders" }, ...g.folders.map(f => ({ value: f.name, label: f.name || "Other photos", count: f.photos }))]} />
      )}
      {filter === "failed" && c.failed > 0 && (
        <button type="button" onClick={retry} className={cn("mb-4 h-10 px-4 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5", CARD_SHADOW)}><RefreshCw className="w-4 h-4" />Try these again</button>
      )}

      {list === null ? <div className="py-16 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : list.photos.length === 0 ? <p className="text-center text-sm text-[#6B6680] py-12">Nothing here.</p>
        : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-1.5 sm:gap-2">
              {list.photos.map(p => {
                const on = picked.has(p.id);
                const label = p.status === "failed" ? "Not read" : p.status !== "ready" ? "Reading…" : p.hidden ? "Hidden" : `${p.faceCount ?? 0} face${p.faceCount === 1 ? "" : "s"}`;
                return (
                  <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={on} title={p.error || p.fileName}
                    className={cn("relative aspect-[4/5] rounded-[12px] overflow-hidden bg-[#F1EFF6] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", on && "ring-[3px] ring-[#7D5CEF]")}>
                    {p.status === "ready" || p.status === "failed"
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={facePhotoUrl(p, 320)} alt={p.fileName} loading="lazy" referrerPolicy="no-referrer" className={cn("w-full h-full object-cover", p.hidden && "opacity-40")} />
                      : <span className="absolute inset-0 flex items-center justify-center text-[#A29DB3]"><Loader2 className="w-5 h-5 animate-spin" /></span>}
                    <span className={cn("absolute left-1.5 bottom-1.5 h-[22px] px-2 rounded-full text-[11.5px] font-bold inline-flex items-center",
                      p.status === "failed" ? "bg-[#FDECEF] text-[#A82743]" : p.hidden ? "bg-[#17151F]/80 text-white" : "bg-white/90 text-[#17151F]")}>{label}</span>
                    {p.highlight && <span className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-[#7D5CEF] text-white flex items-center justify-center"><Star className="w-3.5 h-3.5" fill="currentColor" /></span>}
                    <span className={cn("absolute right-1.5 top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2", on ? "bg-[#7D5CEF] border-[#7D5CEF] text-white" : "bg-white/70 border-white text-transparent")}><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>
                  </button>
                );
              })}
            </div>
            {list.photos.length < list.total && (
              <div className="flex justify-center mt-5">
                <button type="button" onClick={loadMore} disabled={more} className={cn("h-11 px-5 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-2", CARD_SHADOW)}>
                  {more && <Loader2 className="w-4 h-4 animate-spin" />}Show more ({num(list.total - list.photos.length)} left)
                </button>
              </div>
            )}
          </>
        )}

      {picked.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+84px)] lg:bottom-6 z-30 max-w-[calc(100vw-24px)]">
          <div className="bg-[#17151F] text-white rounded-full pl-4 pr-1.5 py-1.5 flex items-center gap-1 shadow-[0_18px_40px_-12px_rgba(23,21,31,.6)] overflow-x-auto [scrollbar-width:none]">
            <span className="text-[13px] font-bold tabular-nums whitespace-nowrap mr-1">{picked.size} chosen</span>
            <Act icon={Star} label="Highlight" onClick={() => change({ highlight: true }, "Marked as Highlights")} />
            <Act icon={X} label="No highlight" onClick={() => change({ highlight: false }, "Highlight removed")} />
            <Act icon={EyeOff} label="Hide" onClick={() => change({ hidden: true }, "Hidden from guests")} />
            <Act icon={Check} label="Show" onClick={() => change({ hidden: false }, "Shown to guests again")} />
            {picked.size === 1 && <Act icon={Images} label="Cover" onClick={cover} />}
            <Act icon={Trash2} label="Remove" onClick={remove} danger />
            <button type="button" onClick={() => setPicked(new Set())} aria-label="Clear" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Act({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-10 px-3 rounded-full text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 hover:bg-white/10", danger && "text-[#FF9DB0]")}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}

// ─── Add photos ───────────────────────────────────────────────────────────────

type Folder = { path: string; photos: number; added: number; raw: number; other: number };
type Sources = { driveConnected: boolean; credits: Credits; raw: Folder[]; delivery: Folder[] };

function AddPhotos({ id, onClose, onAdded }: { id: string; onClose: () => void; onAdded: () => void }) {
  const [src, setSrc] = useState<Sources | null>(null);
  const [tab, setTab] = useState<"raw" | "delivery">("raw");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`${API}/face-search/${id}/sources`).then(r => (r.ok ? r.json() : null)).then((d: Sources | null) => {
      setSrc(d ?? { driveConnected: false, credits: { plan: 0, purchased: 0, total: 0, planResetAt: null }, raw: [], delivery: [] });
      if (d && !d.raw.length && d.delivery.length) setTab("delivery");
    }).catch(() => setSrc({ driveConnected: false, credits: { plan: 0, purchased: 0, total: 0, planResetAt: null }, raw: [], delivery: [] }));
  }, [id]);

  const folders = src ? src[tab] : [];
  const toAdd = folders.filter(f => picked.has(f.path)).reduce((n, f) => n + (f.photos - f.added), 0);
  const have = src?.credits.total ?? 0;
  const short = toAdd > have;

  async function save() {
    if (!toAdd || saving) return;
    setSaving(true);
    const r = await apiFetch(`${API}/face-search/${id}/import`, json({ source: tab, folders: [...picked] })).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setSaving(false);
    if (!r?.ok) return notify(errText(d, "Could not add the photos. Please try again."), { error: true });
    notify(d.added ? `${num(d.added)} photos added. They are being read now.` : "These photos are already in the gallery.");
    onAdded();
  }

  return (
    <FormDrawer open onClose={onClose} icon={ImagePlus} color="violet" title="Add photos" sub="Photos stay in your Google Drive. Nothing is copied."
      footer={<>
        <button type="button" onClick={onClose} className="h-12 px-5 rounded-full bg-[#F5F3FA] text-[15px] font-semibold text-[#17151F]">Cancel</button>
        <button type="button" onClick={save} disabled={!toAdd || saving || short}
          className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{toAdd ? `Add ${num(toAdd)} photos` : "Choose folders"}
        </button>
      </>}>
      <div className="mb-4 rounded-[14px] bg-[#FFF3E0] px-3.5 py-3 text-[13px] leading-snug text-[#6B4100]">
        Face search works with <b>JPG and PNG</b> photos. RAW camera files (CR3, ARW, NEF) and videos are left out and cost nothing.
      </div>

      <PillPicker<"raw" | "delivery"> label="Where are the photos?" value={tab} onChange={v => { setTab(v); setPicked(new Set()); }}
        options={[{ value: "raw", label: "Raw files", icon: HardDrive }, { value: "delivery", label: "Delivery files", icon: PackageCheck }]} />

      <div className="mt-4">
        {src === null ? <div className="py-12 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>
          : !src.driveConnected ? <p className={cn("bg-white rounded-[20px] p-4 text-sm text-[#4A4658]", CARD_SHADOW)}>Google Drive is not connected. Connect it in <Link href="/settings?pane=drive" className="font-semibold text-[#5B3FD0]">Settings</Link> first.</p>
          : folders.length === 0 ? <p className={cn("bg-white rounded-[20px] p-4 text-sm text-[#4A4658]", CARD_SHADOW)}>No photos in this program&apos;s {tab === "raw" ? "raw files" : "delivery"} yet. Upload them from the program first.</p>
          : (
            <Group title={`Folders in ${tab === "raw" ? "Raw files" : "Delivery files"}`}>
              {folders.map(f => {
                const left = f.photos - f.added;
                const on = picked.has(f.path);
                const parts = [`${num(f.photos)} photo${f.photos === 1 ? "" : "s"}`, f.added ? `${num(f.added)} already added` : "", f.raw ? `${num(f.raw)} RAW left out` : "", f.other ? `${num(f.other)} other files left out` : ""].filter(Boolean);
                return (
                  <button key={f.path} type="button" disabled={!left} aria-pressed={on}
                    onClick={() => setPicked(s => { const n = new Set(s); if (n.has(f.path)) n.delete(f.path); else n.add(f.path); return n; })}
                    className={cn("w-full text-left px-4 py-3 flex items-center gap-3 min-h-[60px] disabled:opacity-55", on && "bg-[#F6F2FF]")}>
                    <span className={cn("w-6 h-6 rounded-[8px] border-2 flex items-center justify-center flex-shrink-0", on ? "bg-[#7D5CEF] border-[#7D5CEF] text-white" : "border-[#D6D2E0] text-transparent")}><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>
                    <FolderOpen className="w-5 h-5 text-[#9A5B00] flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-[#17151F] truncate">{f.path || "Main folder"}</span>
                      <span className={cn("block text-xs", !f.photos ? "text-[#A82743]" : "text-[#6B6680]")}>{!f.photos ? "Only RAW files here. Export JPGs first." : parts.join(" · ")}</span>
                    </span>
                    <span className="text-[15px] font-bold tabular-nums text-[#17151F]">{num(left)}</span>
                  </button>
                );
              })}
            </Group>
          )}
      </div>

      {src?.driveConnected && (
        <div className={cn("bg-white rounded-[20px] px-4 py-3.5 text-[13.5px] space-y-2", CARD_SHADOW)}>
          <p className="flex justify-between"><span className="text-[#6B6680]">Photos to add</span><b className="tabular-nums">{num(toAdd)}</b></p>
          <p className="flex justify-between"><span className="text-[#6B6680]">Credits needed (1 per photo)</span><b className="tabular-nums">{num(toAdd)}</b></p>
          <p className="flex justify-between pt-2 border-t border-[#EEEBF4]"><span className="text-[#6B6680]">Your credits after this</span><b className={cn("tabular-nums", short && "text-[#A82743]")}>{short ? `${num(toAdd - have)} short` : num(have - toAdd)}</b></p>
          {short && <p className="text-[#A82743] text-[13px]">Not enough credits. You have {num(have)}. <Link href="/face-search/credits" className="font-semibold underline">See credits</Link></p>}
          <p className="text-xs text-[#6B6680]">Reading runs in the background. You can keep working.</p>
        </div>
      )}
    </FormDrawer>
  );
}

// ─── Guests ───────────────────────────────────────────────────────────────────

function Guests({ id }: { id: string }) {
  const [list, setList] = useState<FaceGuest[] | null>(null);
  useEffect(() => { apiFetch(`${API}/face-search/${id}/guests`).then(r => (r.ok ? r.json() : { guests: [] })).then(d => setList(d.guests)).catch(() => setList([])); }, [id]);
  if (list === null) return <div className="py-16 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!list.length) return <EmptyState icon={ScanFace} title="No guests yet" text="Everyone who takes a selfie on the guest page shows up here, with how many photos they found." />;
  return (
    <Group>
      {list.map(u => (
        <div key={u.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 min-h-[64px]">
          <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#4B32B8] flex items-center justify-center flex-shrink-0">
            {u.channel === "email" ? <Mail className="w-4 h-4" /> : u.channel === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : <ScanFace className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#17151F] truncate">{u.name || u.phone || u.email || "Guest (no details)"}</p>
            <p className="text-xs text-[#6B6680] truncate">{[u.name ? u.phone || u.email : "", `Searched ${dayTime(u.lastSearchAt ?? u.createdAt)}`, u.downloads ? `${num(u.downloads)} downloads` : ""].filter(Boolean).join(" · ")}</p>
          </div>
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap tabular-nums", u.matchCount ? "bg-[#E2F4EA] text-[#176B47]" : "bg-[#F1EFF6] text-[#4A4658]")}>{u.matchCount ? `${num(u.matchCount)} photos` : "No photos yet"}</span>
        </div>
      ))}
    </Group>
  );
}

// ─── Share ────────────────────────────────────────────────────────────────────

function Share({ g }: { g: FaceDetail }) {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(g.link, { margin: 2, width: 960, errorCorrectionLevel: "M", color: { dark: "#17151F", light: "#FFFFFF" } }).then(setQr).catch(() => setQr("")); }, [g.link]);
  async function copy() {
    try { await navigator.clipboard.writeText(g.link); notify("Link copied"); } catch { notify("Could not copy. Press and hold the link to copy it.", { error: true }); }
  }
  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      <div>
        <Group title="Guest link" note="One link and one QR for every guest. Each guest takes a selfie and sees only the photos they are in.">
          <div className="px-4 py-3.5 flex items-center gap-3">
            <p className="flex-1 min-w-0 text-[14px] font-semibold text-[#17151F] break-all">{g.link}</p>
            <button type="button" onClick={copy} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0"><Copy className="w-4 h-4" />Copy</button>
          </div>
        </Group>
        {g.status !== "published" && (
          <div className="rounded-[18px] bg-[#FFF3E0] p-4 text-[14px] text-[#6B4100] mb-5"><b>Not published yet.</b> The link opens, but guests are told the photos are not ready. Press Publish when the photos are in.</div>
        )}
      </div>
      <Group title="QR code" note="Print it on table cards or a standee. It is the same link.">
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="w-[220px] h-[220px] rounded-[18px] bg-white ring-1 ring-[#EEEBF4] flex items-center justify-center overflow-hidden">
            {qr
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={qr} alt={`QR code for ${g.title}`} className="w-full h-full" />
              : <QrCode className="w-10 h-10 text-[#C9C2DA]" />}
          </div>
          <p className="text-[15px] font-bold text-[#17151F] text-center">Scan to get your photos</p>
          {qr && <a href={qr} download={`${g.title.replace(/[^\w\- ]+/g, "").trim() || "gallery"} QR.png`} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Download QR</a>}
        </div>
      </Group>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function Settings({ g, onSaved, onRemoved, onAct }: { g: FaceDetail; onSaved: (g: FaceDetail) => void; onRemoved: () => void; onAct: (a: "close" | "reopen") => void }) {
  const [s, setS] = useState<FaceSettings>(g.settings);
  const [title, setTitle] = useState(g.title);
  const [pin, setPin] = useState(g.settings.pin);
  const [welcome, setWelcome] = useState(g.settings.welcome);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(patch: Partial<FaceSettings>, extra: { title?: string } = {}) {
    const next = { ...s, ...patch };
    setS(next);
    const r = await apiFetch(`${API}/face-search/${g.id}`, json({ settings: next, ...extra }, "PATCH")).catch(() => null);
    if (!r?.ok) return notify("Could not save. Please try again.", { error: true });
    onSaved(await r.json());
    notify("Saved");
  }
  // Typed fields save a moment after the last key.
  function later(fn: () => void) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(fn, 700); }

  async function remove() {
    if (!(await askConfirm({ title: "Remove this gallery?", message: "Guests can't open the link any more and the face data is deleted. Your photos stay on Google Drive. Credits already used are not given back.", confirmLabel: "Remove gallery", danger: true }))) return;
    const r = await apiFetch(`${API}/face-search/${g.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return notify("Could not remove the gallery. Please try again.", { error: true });
    notify("Gallery removed"); onRemoved();
  }

  const strictText = { strict: "Fewest wrong photos. A guest may miss a few of their own.", balanced: "Best for most events.", loose: "Finds more photos. A similar face may slip in now and then." }[s.strictness];

  return (
    <div className="max-w-[720px]">
      <Group title="Name">
        <div className="px-4 py-3.5">
          <label htmlFor="fs-name" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Name guests see</label>
          <input id="fs-name" className={inputCls} value={title} maxLength={150} onChange={e => { const v = e.target.value; setTitle(v); if (v.trim()) later(() => save({}, { title: v.trim() })); }} />
        </div>
        <div className="px-4 py-3.5">
          <label htmlFor="fs-welcome" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Short note on the first screen (optional)</label>
          <input id="fs-welcome" className={inputCls} value={welcome} maxLength={300} placeholder="Thank you for celebrating with us" onChange={e => { const v = e.target.value; setWelcome(v); later(() => save({ welcome: v })); }} />
        </div>
      </Group>

      <Group title="Who sees what">
        <div className="px-4 py-3.5">
          <p className="text-[15px] font-medium text-[#17151F]">Guests see</p>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">With &quot;Only their own&quot;, a guest sees the photos their face is in.</p>
          <PillPicker<"own" | "all"> label="Guests see" value={s.guestsSee} onChange={v => save({ guestsSee: v })} options={[{ value: "own", label: "Only their own" }, { value: "all", label: "All photos" }]} />
        </div>
        <SwitchRow label="Highlights for everyone" hint="Photos you mark as Highlights are shown to every guest." on={s.highlightsForAll} onChange={v => save({ highlightsForAll: v })} />
      </Group>

      <Group title="Face matching">
        <div className="px-4 py-3.5">
          <p className="text-[15px] font-medium text-[#17151F]">How strict</p>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">{strictText}</p>
          <PillPicker<FaceSettings["strictness"]> label="How strict" value={s.strictness} onChange={v => save({ strictness: v })}
            options={[{ value: "strict", label: "Strict" }, { value: "balanced", label: "Balanced" }, { value: "loose", label: "Loose" }]} />
        </div>
      </Group>

      <Group title="Before guests get their photos" note="More choices (follow your pages first, watermark, lock while the client has dues) come in the next steps.">
        <div className="px-4 py-3.5">
          <label htmlFor="fs-pin" className="block text-[15px] font-medium text-[#17151F]">Ask for a 4-digit code</label>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">Guests type it before the selfie. Leave empty for no code.</p>
          <input id="fs-pin" className={cn(inputCls, "max-w-[140px] tabular-nums tracking-[0.3em] text-center")} inputMode="numeric" maxLength={4} placeholder="None" value={pin}
            onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); if (v.length === 4 || v === "") later(() => save({ pin: v })); }} />
        </div>
        <SwitchRow label="Guests can download" hint="Off = guests can only look at their photos." on={s.downloads} onChange={v => save({ downloads: v })} />
      </Group>

      <Group title="Closing">
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-[#17151F]">{g.status === "closed" ? "This gallery is closed" : "Close this gallery"}</p>
            <p className="text-xs text-[#6B6680] mt-0.5">Guests see &quot;This gallery is closed&quot;. You can open it again.</p>
          </div>
          <button type="button" onClick={() => onAct(g.status === "closed" ? "reopen" : "close")} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#17151F] flex-shrink-0">{g.status === "closed" ? "Open again" : "Close"}</button>
        </div>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-[#A82743]">Remove this gallery</p>
            <p className="text-xs text-[#6B6680] mt-0.5">The link stops working and the face data is deleted. Photos stay on Drive.</p>
          </div>
          <button type="button" onClick={remove} className="h-10 px-4 rounded-full bg-[#FDECEF] text-[13px] font-semibold text-[#A82743] flex-shrink-0 inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />Remove</button>
        </div>
      </Group>
    </div>
  );
}
