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
  AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronDown, Coins, Copy, Download, ExternalLink, EyeOff, FolderOpen, FolderUp, HardDrive,
  ImagePlus, Images, Loader2, Mail, MessageCircle, MonitorUp, PackageCheck, QrCode, RefreshCw, ScanFace, Settings as SettingsIcon, Share2,
  Star, Trash2, Users, X,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, Group } from "@/components/ui/apple";
import { FormDrawer, PillPicker, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { useTab } from "@/components/ui/profile-page";
import { QrPoster } from "./qr-poster";
import { WatermarkEditor } from "./watermark-editor";
import { applyDuplicateChoice, checkDuplicates, uploadToDrive } from "@/lib/drive-uploader";
import { byFolder, canUpload, isRawName } from "@/lib/photos";
import {
  FACE_STATUS, FACE_UPLOAD_PATH, day, dayTime, errText, facePhotoUrl, num,
  type Credits, type FaceDetail, type FaceGuest, type FacePhoto, type FaceSettings,
} from "@/lib/face";

type Tab = "photos" | "guests" | "share" | "settings";
const TABS = ["photos", "guests", "share", "settings"] as const;
type Filter = "" | "ready" | "waiting" | "noface" | "failed" | "hidden" | "highlights";
const json = (body: unknown, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function FaceGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [g, setG] = useState<FaceDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useTab<Tab>(`/face-search/${id}`, TABS, typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab"));
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
          <button type="button" onClick={() => setTab("settings")} aria-label="Gallery settings" title="Gallery settings"
            className={cn("w-11 h-11 rounded-full bg-white text-[#17151F] inline-flex items-center justify-center", CARD_SHADOW, tab === "settings" && "ring-2 ring-[#7D5CEF]")}><SettingsIcon className="w-[18px] h-[18px]" /></button>
        </div>
      </div>

      {g.off && (
        <div role="status" className="mb-4 rounded-[18px] bg-[#FDECEF] p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#A82743] flex-shrink-0" />
          <p className="flex-1 text-[14px] text-[#7A1F33]">{g.off} You can&apos;t add photos and guests can&apos;t search until it is on again.</p>
        </div>
      )}
      {!g.ready && (
        <div className="mb-4 rounded-[18px] bg-[#FFF3E0] p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#8A5200] flex-shrink-0" />
          <p className="flex-1 text-[14px] text-[#6B4100]"><b>Face search is being set up.</b> Photos you add wait here and are read once setup is finished.</p>
        </div>
      )}

      <Sections value={tab} onChange={setTab} tabs={[
        { id: "photos", label: "Photos", icon: Images, count: c.photos }, { id: "guests", label: "Guests", icon: Users, count: c.guests },
        { id: "share", label: "Share", icon: Share2 }, { id: "settings", label: "Settings", icon: SettingsIcon },
      ]} />

      {(tab === "photos" || tab === "guests") && (
        <div className={cn("bg-white rounded-[20px] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-5 overflow-hidden", CARD_SHADOW)}>
          <Stat label="Photos ready" value={num(c.ready)} sub={c.waiting ? `${num(c.waiting)} being read` : c.failed ? `${num(c.failed)} could not be read` : `${num(c.faces)} faces found`} />
          <Stat label="No face found" value={num(c.noFace)} sub="Shown only as Highlights" />
          <Stat label="Guests" value={num(c.guests)} sub="Searched with a selfie" />
          <Stat label="Found their photos" value={num(c.found)} sub={c.guests ? `${foundPct}% of guests` : "No guests yet"} good={c.guests > 0} />
          <Stat label="Credits used here" value={num(g.creditsUsed)} sub={`${num(g.credits.total)} left`} />
        </div>
      )}

      {tab === "photos" && <Photos g={g} tick={tick} onChanged={load} onAdd={() => setAdding(true)} />}
      {tab === "guests" && <Guests id={g.id} title={g.title} />}
      {tab === "share" && <Share g={g} />}
      {tab === "settings" && <Settings g={g} onSaved={setG} onRemoved={() => router.replace("/face-search")} onAct={act} />}

      {adding && <AddPhotos g={g} onClose={() => setAdding(false)} onRefresh={() => { load(); setTick(n => n + 1); }}
        onAdded={() => { setAdding(false); setTab("photos"); load(); setTick(n => n + 1); }} />}
    </div>
  );
}

/** The four parts of a gallery. One bar, always fully visible: icon and name, so Settings is never out of sight. */
function Sections({ tabs, value, onChange }: { tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[]; value: Tab; onChange: (t: Tab) => void }) {
  return (
    <div role="tablist" aria-label="Gallery sections" className={cn("bg-white rounded-[20px] p-1.5 grid grid-cols-4 gap-1 mb-5", CARD_SHADOW)}>
      {tabs.map(t => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={cn("min-h-[56px] sm:min-h-[48px] min-w-0 rounded-[14px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 text-[12.5px] sm:text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
              on ? "bg-[#EEE8FD] text-[#4B32B8]" : "text-[#4A4658] hover:bg-[#F5F3FA] hover:text-[#17151F]")}>
            <t.icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="truncate max-w-full">{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className={cn("hidden sm:inline text-[12px] font-bold tabular-nums px-1.5 py-0.5 rounded-full", on ? "bg-white/80 text-[#4B32B8]" : "bg-[#F1EFF6] text-[#4A4658]")}>{num(t.count)}</span>}
          </button>
        );
      })}
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
    <EmptyState icon={ImagePlus} title="No photos yet" text="Upload your best photos from this phone or computer, or pick the program's folders on Google Drive. Each photo is read once and uses 1 credit."
      action={<button type="button" onClick={onAdd} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />Add photos</button>} />
  );

  const filters: { value: Filter; label: string; count?: number; dot?: string }[] = [
    { value: "", label: "All", count: c.photos }, { value: "ready", label: "Ready", count: c.ready, dot: "#1F8A5B" },
    ...(c.waiting ? [{ value: "waiting" as Filter, label: "Being read", count: c.waiting, dot: "#D98A00" }] : []),
    ...(c.noFace ? [{ value: "noface" as Filter, label: "No face found", count: c.noFace, dot: "#8A8599" }] : []),
    ...(c.failed ? [{ value: "failed" as Filter, label: "Could not be read", count: c.failed, dot: "#C2304F" }] : []),
    { value: "highlights", label: "Highlights", dot: "#7D5CEF" },
    ...(c.hidden ? [{ value: "hidden" as Filter, label: "Hidden", count: c.hidden, dot: "#17151F" }] : []),
  ];
  const folderAt = folder === null ? "all" : String(g.folders.findIndex(f => f.name === folder));

  return (
    <div className={picked.size ? "pb-24" : ""}>
      {/* One quiet bar: which folder, and which photos. It looks different from the section bar above on purpose. */}
      <div className={cn("bg-white rounded-[18px] p-2 mb-3 flex flex-col sm:flex-row sm:items-center gap-2", CARD_SHADOW)}>
        {g.folders.length > 1 && (
          <label className="relative inline-flex items-center flex-shrink-0 max-w-full">
            <span className="sr-only">Folder</span>
            <FolderOpen className="w-4 h-4 text-[#9A5B00] absolute left-3.5 pointer-events-none" />
            <select value={folderAt} onChange={e => { const v = e.target.value; setFolder(v === "all" ? null : g.folders[Number(v)]?.name ?? null); setPicked(new Set()); }}
              className="h-10 w-full sm:w-auto sm:max-w-[240px] pl-10 pr-9 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#17151F] appearance-none truncate focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40">
              <option value="all">All folders ({num(c.photos)})</option>
              {g.folders.map((f, i) => <option key={f.name} value={i}>{f.name || "Other photos"} ({num(f.photos)})</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-[#6B6680] absolute right-3.5 pointer-events-none" />
          </label>
        )}
        {g.folders.length > 1 && <span aria-hidden className="hidden sm:block w-px h-6 bg-[#EEEBF4]" />}
        <div role="group" aria-label="Show photos" className="flex gap-1 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none]">
          {filters.map(f => {
            const on = f.value === filter;
            return (
              <button key={f.value || "all"} type="button" aria-pressed={on} onClick={() => { setFilter(f.value); setPicked(new Set()); }}
                className={cn("h-10 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
                  on ? "bg-[#EEE8FD] text-[#4B32B8]" : "text-[#4A4658] hover:bg-[#F5F3FA]")}>
                {f.dot && <span className="w-2 h-2 rounded-full" style={{ background: f.dot }} />}
                {f.label}
                {f.count !== undefined && <span className={cn("text-[12px] tabular-nums", on ? "text-[#4B32B8]/80" : "text-[#6B6680]")}>{num(f.count)}</span>}
              </button>
            );
          })}
        </div>
      </div>
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
type Sources = { driveConnected: boolean; credits: Credits; raw: Folder[]; delivery: Folder[]; uploaded?: Folder[] };
type Way = "upload" | "raw" | "delivery";
const NO_SOURCES: Sources = { driveConnected: false, credits: { plan: 0, purchased: 0, total: 0, planResetAt: null }, raw: [], delivery: [], uploaded: [] };
const cleanFolder = (s: string) => s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);

/** Bring in the photos that reached the program's Drive upload folder but are not in the gallery yet. */
async function syncFaceUploads(id: string): Promise<{ added: number; short: number }> {
  const r = await apiFetch(`${API}/face-search/${id}/uploads/sync`, { method: "POST" }).catch(() => null);
  const d = r?.ok ? await r.json().catch(() => ({})) : {};
  return { added: Number(d.added) || 0, short: Number(d.short) || 0 };
}

/**
 * Three ways in, the cheapest first:
 *  - Upload: pick only the good photos on this phone or computer. They go to the program's Drive ("Face search / <folder>")
 *    and are added as they arrive. Each photo costs 1 credit, so this is what we suggest.
 *  - Raw files / Delivery files: whole folders of this program that are already on Drive.
 */
function AddPhotos({ g, onClose, onAdded, onRefresh }: { g: FaceDetail; onClose: () => void; onAdded: () => void; onRefresh: () => void }) {
  const id = g.id;
  const [src, setSrc] = useState<Sources | null>(null);
  const [way, setWay] = useState<Way>("upload");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch(`${API}/face-search/${id}/sources`).then(r => (r.ok ? r.json() : null)).then((d: Sources | null) => setSrc(d ?? NO_SOURCES)).catch(() => setSrc(NO_SOURCES));
  }, [id]);

  const have = src?.credits.total ?? 0;
  const folders = src && way !== "upload" ? src[way] : [];
  const good = files.filter(canUpload);
  const rawLeft = files.filter(f => isRawName(f.name)).length;
  const otherLeft = files.length - good.length - rawLeft;
  const groups = [...byFolder(good).entries()];
  const waiting = (src?.uploaded ?? []).reduce((n, f) => n + (f.photos - f.added), 0);
  const toAdd = way === "upload" ? good.length : folders.filter(f => picked.has(f.path)).reduce((n, f) => n + (f.photos - f.added), 0);
  const short = toAdd > have;

  async function addFromDrive() {
    if (!toAdd || saving || way === "upload") return;
    setSaving(true);
    const r = await apiFetch(`${API}/face-search/${id}/import`, json({ source: way, folders: [...picked] })).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setSaving(false);
    if (!r?.ok) return notify(errText(d, "Could not add the photos. Please try again."), { error: true });
    notify(d.added ? `${num(d.added)} photos added. They are being read now.` : "These photos are already in the gallery.");
    onAdded();
  }

  async function catchUp(quiet = false) {
    const d = await syncFaceUploads(id);
    if (d.added) onRefresh();
    if (d.short) notify(`${num(d.short)} uploaded photo${d.short === 1 ? " is" : "s are"} waiting: not enough credits.`, { error: true });
    else if (d.added && !quiet) notify(`${num(d.added)} photo${d.added === 1 ? "" : "s"} added. They are being read now.`);
    return d;
  }

  async function upload() {
    const programId = g.program?.id;
    if (!good.length || saving || !programId) return;
    setSaving(true);
    // Catch up a few seconds after files arrive (and at least every 20 s while they keep coming).
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = 0;
    const soon = () => {
      const now = Date.now();
      if (!first) first = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; first = 0; void catchUp(true); }, now - first > 20000 ? 0 : 3000);
    };
    let started = 0;
    for (const [name, list] of groups) {
      const folder = cleanFolder(name || folderName);
      const path = folder ? `${FACE_UPLOAD_PATH}/${folder}` : FACE_UPLOAD_PATH;
      // A photo that is already in the Drive folder is not sent again; the catch-up adds it.
      const check = await checkDuplicates({ files: list, bookingId: programId, folderFor: () => path, kind: "raw" }).catch(() => null);
      const plan = check ? applyDuplicateChoice(check, "skip") : { files: list, plans: undefined };
      started += plan.files.length;
      uploadToDrive({
        kind: "raw", files: plan.files, bookingId: programId, bookingName: g.program?.eventName || g.title,
        folderFor: () => path, plans: plan.plans, onDone: soon,
        // Kept with the unfinished list, so an upload continued after a closed tab still lands in this gallery.
        syncPath: `/face-search/${id}/uploads/sync`,
      });
    }
    setSaving(false);
    if (started) { notify(`Uploading ${num(started)} photo${started === 1 ? "" : "s"}. They join the gallery as they arrive.`); soon(); }
    else { const d = await catchUp(true); notify(d.added ? `${num(d.added)} photos were already on Drive and are added now.` : "These photos are already in the gallery."); }
    onAdded();
  }

  async function addWaiting() {
    if (saving) return;
    setSaving(true);
    const d = await catchUp();
    setSaving(false);
    if (d.added) onAdded();
  }

  const pick = (list: FileList | null) => { setFiles([...(list ?? [])]); };

  return (
    <FormDrawer open onClose={onClose} icon={ImagePlus} color="violet" title="Add photos" sub={`Only photos of ${g.program?.number ?? "this program"}. They stay in your Google Drive.`}
      footer={<>
        <button type="button" onClick={onClose} className="h-12 px-5 rounded-full bg-[#F5F3FA] text-[15px] font-semibold text-[#17151F]">Cancel</button>
        <button type="button" onClick={way === "upload" ? upload : addFromDrive} disabled={!toAdd || saving || short}
          className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {way === "upload" ? (toAdd ? `Upload ${num(toAdd)} photo${toAdd === 1 ? "" : "s"}` : "Choose photos first") : toAdd ? `Add ${num(toAdd)} photos` : "Choose folders"}
        </button>
      </>}>
      <div role="radiogroup" aria-label="Where are the photos?" className="grid grid-cols-3 gap-2 mb-4">
        {([
          { v: "upload", label: "Upload", hint: "Best: only good photos", icon: MonitorUp },
          { v: "raw", label: "Raw files", hint: src ? `${src.raw.length} folder${src.raw.length === 1 ? "" : "s"}` : "On Drive", icon: HardDrive },
          { v: "delivery", label: "Delivery files", hint: src ? `${src.delivery.length} folder${src.delivery.length === 1 ? "" : "s"}` : "On Drive", icon: PackageCheck },
        ] as { v: Way; label: string; hint: string; icon: React.ElementType }[]).map(o => {
          const on = way === o.v;
          return (
            <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => { setWay(o.v); setPicked(new Set()); }}
              className={cn("relative min-w-0 rounded-[16px] px-2 py-3 flex flex-col items-center gap-1 text-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
                on ? "bg-[#EEE8FD] ring-2 ring-[#7D5CEF]" : cn("bg-white", CARD_SHADOW))}>
              <o.icon className={cn("w-5 h-5", on ? "text-[#4B32B8]" : "text-[#4A4658]")} />
              <span className={cn("text-[13.5px] font-bold leading-tight", on ? "text-[#4B32B8]" : "text-[#17151F]")}>{o.label}</span>
              <span className="text-[11.5px] leading-tight text-[#6B6680]">{o.hint}</span>
            </button>
          );
        })}
      </div>

      {src === null ? <div className="py-12 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : !src.driveConnected ? <p className={cn("bg-white rounded-[20px] p-4 text-sm text-[#4A4658]", CARD_SHADOW)}>Google Drive is not connected. Connect it in <Link href="/settings?pane=drive" className="font-semibold text-[#5B3FD0]">Settings</Link> first.</p>
        : way === "upload" ? (
          <>
            <div className="mb-4 rounded-[16px] bg-[#EEE8FD] px-3.5 py-3 flex gap-3">
              <Coins className="w-5 h-5 text-[#4B32B8] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] leading-snug text-[#33268A]"><b>Each photo uses 1 credit.</b> Pick your good photos only. Leave out blurred, repeated and test shots, and you pay for less. Want your logo on them? Export with your watermark before you upload.</p>
            </div>

            {waiting > 0 && (
              <div className={cn("bg-white rounded-[20px] p-4 mb-4 flex items-center gap-3", CARD_SHADOW)}>
                <p className="flex-1 text-[13.5px] text-[#17151F]"><b>{num(waiting)} uploaded photo{waiting === 1 ? " is" : "s are"} not in the gallery yet.</b> <span className="text-[#6B6680]">Adding {waiting === 1 ? "it" : "them"} uses {num(Math.min(waiting, have))} credit{Math.min(waiting, have) === 1 ? "" : "s"}.</span></p>
                <button type="button" onClick={addWaiting} disabled={saving || !have} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold disabled:opacity-50 flex-shrink-0">Add now</button>
              </div>
            )}

            <div className={cn("bg-white rounded-[20px] p-5 text-center", CARD_SHADOW)}>
              <span className="mx-auto w-12 h-12 rounded-[16px] bg-[#EEE8FD] text-[#4B32B8] flex items-center justify-center mb-3"><MonitorUp className="w-6 h-6" /></span>
              <p className="text-[15px] font-bold text-[#17151F]">Upload from this phone or computer</p>
              <p className="text-[13px] text-[#6B6680] mt-1 mb-4">JPG, PNG, WebP or HEIC. They are saved in this program&apos;s Google Drive, in &quot;{FACE_UPLOAD_PATH}&quot;.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => fileInput.current?.click()} className="h-11 px-5 rounded-full bg-[#17151F] text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5"><ImagePlus className="w-4 h-4" />Choose photos</button>
                <button type="button" onClick={() => folderInput.current?.click()} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13.5px] font-semibold hidden [@media(pointer:fine)]:inline-flex items-center gap-1.5"><FolderUp className="w-4 h-4" />Choose a folder</button>
              </div>
              <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={e => { pick(e.target.files); e.target.value = ""; }} />
              <input ref={folderInput} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={e => { pick(e.target.files); e.target.value = ""; }} />
            </div>

            {files.length > 0 && (
              <div className={cn("bg-white rounded-[20px] p-4 mt-4", CARD_SHADOW)}>
                <p className="text-[14px] font-bold text-[#17151F] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />{num(good.length)} photo{good.length === 1 ? "" : "s"} ready to upload</p>
                {rawLeft > 0 && <p className="text-[12.5px] text-[#8A5200] mt-1">{num(rawLeft)} RAW file{rawLeft === 1 ? "" : "s"} left out. Export JPGs first.</p>}
                {otherLeft > 0 && <p className="text-[12.5px] text-[#A82743] mt-1">{num(otherLeft)} other file{otherLeft === 1 ? "" : "s"} left out (not a photo).</p>}
                {groups.some(([name]) => name) ? (
                  <ul className="mt-3 space-y-1.5">
                    {groups.map(([name, list]) => (
                      <li key={name} className="flex items-center gap-2 text-[13.5px] text-[#17151F]"><FolderOpen className="w-4 h-4 text-[#9A5B00] flex-shrink-0" /><span className="flex-1 min-w-0 truncate font-semibold">{name || "Other photos"}</span><span className="tabular-nums text-[#6B6680]">{num(list.length)}</span></li>
                    ))}
                  </ul>
                ) : good.length > 0 && (
                  <div className="mt-3">
                    <label htmlFor="fs-up-folder" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Folder name (optional)</label>
                    <input id="fs-up-folder" className={inputCls} value={folderName} maxLength={120} placeholder="Holud, Wedding, Reception" onChange={e => setFolderName(e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </>
        )
        : folders.length === 0 ? <p className={cn("bg-white rounded-[20px] p-4 text-sm text-[#4A4658]", CARD_SHADOW)}>No photos in this program&apos;s {way === "raw" ? "raw files" : "delivery files"} yet. Use Upload, or add them from the program page first.</p>
        : (
          <Group title={`${g.program?.number ? `${g.program.number}: ` : ""}${way === "raw" ? "raw files" : "delivery files"}`} note="RAW camera files (CR3, ARW, NEF) and videos are left out and cost nothing.">
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

      {src?.driveConnected && (
        <div className={cn("bg-white rounded-[20px] px-4 py-3.5 text-[13.5px] space-y-2 mt-4", CARD_SHADOW)}>
          <p className="flex justify-between"><span className="text-[#6B6680]">Photos to add</span><b className="tabular-nums">{num(toAdd)}</b></p>
          <p className="flex justify-between"><span className="text-[#6B6680]">Credits needed (1 per photo)</span><b className="tabular-nums">{num(toAdd)}</b></p>
          <p className="flex justify-between pt-2 border-t border-[#EEEBF4]"><span className="text-[#6B6680]">Your credits after this</span><b className={cn("tabular-nums", short && "text-[#A82743]")}>{short ? `${num(toAdd - have)} short` : num(have - toAdd)}</b></p>
          {short && <p className="text-[#A82743] text-[13px]">Not enough credits. You have {num(have)}. <Link href="/face-search/credits" className="font-semibold underline">See credits</Link></p>}
          <p className="text-xs text-[#6B6680]">{way === "upload" ? "The upload runs in the corner of the screen. You can keep working." : "Reading runs in the background. You can keep working."}</p>
        </div>
      )}
    </FormDrawer>
  );
}

// ─── Guests ───────────────────────────────────────────────────────────────────

function Guests({ id, title }: { id: string; title: string }) {
  const [list, setList] = useState<FaceGuest[] | null>(null);
  const [only, setOnly] = useState<"all" | "contact">("all");
  useEffect(() => { apiFetch(`${API}/face-search/${id}/guests`).then(r => (r.ok ? r.json() : { guests: [] })).then(d => setList(d.guests)).catch(() => setList([])); }, [id]);
  if (list === null) return <div className="py-16 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!list.length) return <EmptyState icon={ScanFace} title="No guests yet" text="Everyone who takes a selfie on the guest page shows up here, with how many photos they found." />;

  const withContact = list.filter(u => u.phone || u.email);
  const shown = only === "contact" ? withContact : list;
  const phones = [...new Set(withContact.map(u => u.phone).filter(Boolean))] as string[];

  async function copyNumbers() {
    try { await navigator.clipboard.writeText(phones.join("\n")); notify(`${num(phones.length)} number${phones.length === 1 ? "" : "s"} copied`); } catch { notify("Could not copy. Use Download list.", { error: true }); }
  }
  function download() {
    const esc = (v: string | number | null | undefined) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = [["Name", "WhatsApp", "Email", "Photos found", "Downloads", "Last search"], ...withContact.map(u => [u.name, u.phone, u.email, u.matchCount, u.downloads, dayTime(u.lastSearchAt ?? u.createdAt)])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(r => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "gallery"} guests.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      <div className={cn("bg-white rounded-[18px] p-2 mb-3 flex flex-col sm:flex-row sm:items-center gap-2", CARD_SHADOW)}>
        <div role="group" aria-label="Show guests" className="flex gap-1 flex-1 min-w-0">
          {([["all", "All guests", list.length], ["contact", "Gave name and number", withContact.length]] as const).map(([v, label, n]) => (
            <button key={v} type="button" aria-pressed={only === v} onClick={() => setOnly(v)}
              className={cn("h-10 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", only === v ? "bg-[#EEE8FD] text-[#4B32B8]" : "text-[#4A4658] hover:bg-[#F5F3FA]")}>
              {label}<span className={cn("text-[12px] tabular-nums", only === v ? "text-[#4B32B8]/80" : "text-[#6B6680]")}>{num(n)}</span>
            </button>
          ))}
        </div>
        {withContact.length > 0 && (
          <div className="flex gap-2">
            {phones.length > 0 && <button type="button" onClick={copyNumbers} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5"><Copy className="w-4 h-4" />Copy numbers</button>}
            <button type="button" onClick={download} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Download list</button>
          </div>
        )}
      </div>
      {shown.length === 0 ? <p className="text-center text-sm text-[#6B6680] py-12">No guest has given a name and number yet. Turn on &quot;Ask for name and WhatsApp number&quot; in Settings.</p> : (
        <Group>
          {shown.map(u => (
            <div key={u.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 min-h-[64px]">
              <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#4B32B8] flex items-center justify-center flex-shrink-0">
                {u.channel === "email" ? <Mail className="w-4 h-4" /> : u.channel === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : <ScanFace className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#17151F] truncate">{u.name || u.phone || u.email || "Guest (no details)"}</p>
                <p className="text-xs text-[#6B6680] truncate">{[u.name ? u.phone || u.email : "", `Searched ${dayTime(u.lastSearchAt ?? u.createdAt)}`, u.downloads ? `${num(u.downloads)} downloads` : ""].filter(Boolean).join(" · ")}</p>
              </div>
              {u.phone && <a href={`https://wa.me/${u.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label={`Message ${u.name || u.phone} on WhatsApp`} className="w-10 h-10 rounded-full bg-[#E2F4EA] text-[#176B47] flex items-center justify-center flex-shrink-0"><MessageCircle className="w-4 h-4" /></a>}
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap tabular-nums", u.matchCount ? "bg-[#E2F4EA] text-[#176B47]" : "bg-[#F1EFF6] text-[#4A4658]")}>{u.matchCount ? `${num(u.matchCount)} photos` : "No photos yet"}</span>
            </div>
          ))}
        </Group>
      )}
    </>
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
    <>
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
    <QrPoster link={g.link} title={g.title} pin={g.settings.pin} />
    </>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function Settings({ g, onSaved, onRemoved, onAct }: { g: FaceDetail; onSaved: (g: FaceDetail) => void; onRemoved: () => void; onAct: (a: "close" | "reopen") => void }) {
  const [s, setS] = useState<FaceSettings>(g.settings);
  const [title, setTitle] = useState(g.title);
  const [pin, setPin] = useState(g.settings.pin);
  const [welcome, setWelcome] = useState(g.settings.welcome);
  const [fb, setFb] = useState(g.settings.followFacebook ?? "");
  const [ig, setIg] = useState(g.settings.followInstagram ?? "");
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

  /** Turning the watermark on changes how every photo reaches the guest, so the studio is told first. */
  async function watermark(on: boolean) {
    if (!on) return save({ watermark: false });
    const ok = await askConfirm({
      title: "Turn on the watermark?",
      message: "What changes for guests:\n• Photos open a little slower, because each one passes through StuPanel to get the watermark.\n• They get a copy up to 2560 px wide, not your original file.\n• Your logo or text is put on every photo, where and how big you choose.\n\nOur advice: keep this off and export your photos with your own watermark from Lightroom or Photoshop. Guests then get them fast and in full quality.",
      confirmLabel: "Turn on anyway",
    });
    if (ok) await save({ watermark: true });
  }

  async function remove() {
    if (!(await askConfirm({ title: "Remove this gallery?", message: "Guests can't open the link any more and the face data is deleted. Your photos stay on Google Drive. Credits already used are not given back.", confirmLabel: "Remove gallery", danger: true }))) return;
    const r = await apiFetch(`${API}/face-search/${g.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return notify("Could not remove the gallery. Please try again.", { error: true });
    notify("Gallery removed"); onRemoved();
  }

  const strictText = { strict: "Fewest wrong photos. A guest may miss a few of their own.", balanced: "Best for most events.", loose: "Finds more photos. A similar face may slip in now and then." }[s.strictness];

  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,720px)] lg:gap-6 lg:items-start">
      <nav aria-label="Settings sections" className={cn("hidden lg:flex flex-col gap-0.5 bg-white rounded-[20px] p-2 sticky top-20", CARD_SHADOW)}>
        {[["fs-s-name", "Guest page"], ["fs-s-see", "Who sees what"], ["fs-s-match", "Face matching"], ["fs-s-before", "Before the photos"], ["fs-s-close", "Close or remove"]].map(([to, label]) => (
          <a key={to} href={`#${to}`} className="h-10 px-3 rounded-[12px] text-[13.5px] font-semibold text-[#4A4658] hover:bg-[#F5F3FA] hover:text-[#17151F] flex items-center">{label}</a>
        ))}
      </nav>
      <div className="min-w-0">
      <section id="fs-s-name" className="scroll-mt-24">
      <Group title="Guest page">
        <div className="px-4 py-3.5">
          <label htmlFor="fs-name" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Name guests see</label>
          <input id="fs-name" className={inputCls} value={title} maxLength={150} onChange={e => { const v = e.target.value; setTitle(v); if (v.trim()) later(() => save({}, { title: v.trim() })); }} />
        </div>
        <div className="px-4 py-3.5">
          <label htmlFor="fs-welcome" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Short note on the first screen (optional)</label>
          <input id="fs-welcome" className={inputCls} value={welcome} maxLength={300} placeholder="Thank you for celebrating with us" onChange={e => { const v = e.target.value; setWelcome(v); later(() => save({ welcome: v })); }} />
        </div>
      </Group>
      </section>

      <section id="fs-s-see" className="scroll-mt-24">
      <Group title="Who sees what">
        <div className="px-4 py-3.5">
          <p className="text-[15px] font-medium text-[#17151F]">Guests see</p>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">With &quot;Only their own&quot;, a guest sees the photos their face is in.</p>
          <PillPicker<"own" | "all"> label="Guests see" value={s.guestsSee} onChange={v => save({ guestsSee: v })} options={[{ value: "own", label: "Only their own" }, { value: "all", label: "All photos" }]} />
        </div>
        <SwitchRow label="Highlights for everyone" hint="Photos you mark as Highlights are shown to every guest." on={s.highlightsForAll} onChange={v => save({ highlightsForAll: v })} />
      </Group>
      </section>

      <section id="fs-s-match" className="scroll-mt-24">
      <Group title="Face matching">
        <div className="px-4 py-3.5">
          <p className="text-[15px] font-medium text-[#17151F]">How strict</p>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">{strictText}</p>
          <PillPicker<FaceSettings["strictness"]> label="How strict" value={s.strictness} onChange={v => save({ strictness: v })}
            options={[{ value: "strict", label: "Strict" }, { value: "balanced", label: "Balanced" }, { value: "loose", label: "Loose" }]} />
        </div>
      </Group>
      </section>

      <section id="fs-s-before" className="scroll-mt-24">
      <Group title="Before guests get their photos" note="Locking the gallery while the client has dues comes later.">
        <div className="px-4 py-3.5">
          <label htmlFor="fs-pin" className="block text-[15px] font-medium text-[#17151F]">Ask for a 4-digit code</label>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">Guests type it before the selfie. Leave empty for no code.</p>
          <input id="fs-pin" className={cn(inputCls, "max-w-[140px] tabular-nums tracking-[0.3em] text-center")} inputMode="numeric" maxLength={4} placeholder="None" value={pin}
            onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); if (v.length === 4 || v === "") later(() => save({ pin: v })); }} />
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[15px] font-medium text-[#17151F]">Ask for name and WhatsApp number</p>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">{{ off: "Guests see their photos right after the selfie.", optional: "Guests are asked after the selfie and can skip it.", required: "Guests see how many photos were found, and must give their name and number to open them." }[s.register ?? "off"]}</p>
          <PillPicker<"off" | "optional" | "required"> label="Ask for name and number" value={s.register ?? "off"} onChange={v => save({ register: v })}
            options={[{ value: "off", label: "Don't ask" }, { value: "optional", label: "Ask, can skip" }, { value: "required", label: "Must give" }]} />
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[15px] font-medium text-[#17151F]">Ask guests to follow your pages</p>
          <p className="text-xs text-[#6B6680] mt-0.5 mb-2.5">Guests open your page before their photos. Leave both empty to skip this step. We can&apos;t check that they pressed Follow.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="fs-fb" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Facebook page link</label>
              <input id="fs-fb" className={inputCls} inputMode="url" maxLength={200} placeholder="facebook.com/yourstudio" value={fb} onChange={e => { const v = e.target.value; setFb(v); later(() => save({ followFacebook: v })); }} />
            </div>
            <div>
              <label htmlFor="fs-ig" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Instagram link</label>
              <input id="fs-ig" className={inputCls} inputMode="url" maxLength={200} placeholder="instagram.com/yourstudio" value={ig} onChange={e => { const v = e.target.value; setIg(v); later(() => save({ followInstagram: v })); }} />
            </div>
          </div>
        </div>
        <SwitchRow label="Watermark on guest photos" hint="Off is best: export your photos with your own watermark, then guests get them fast and sharp." on={!!s.watermark} onChange={v => watermark(v)} />
        {s.watermark && <WatermarkEditor s={s} cover={g.cover} studio="" onSave={patch => save(patch)} />}
        <SwitchRow label="Guests can download" hint="Off = guests can only look at their photos." on={s.downloads} onChange={v => save({ downloads: v })} />
      </Group>
      </section>

      <section id="fs-s-close" className="scroll-mt-24">
      <Group title="Close or remove">
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
      </section>
      </div>
    </div>
  );
}
