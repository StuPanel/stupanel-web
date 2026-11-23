"use client";
/**
 * Choose the cover photo: the first picture a client or guest sees when they open the link, and the picture of the
 * link preview on WhatsApp / Facebook. Use one of the gallery's photos or upload one from this computer / phone,
 * then "Adjust" how it sits in the frame (drag to move, zoom).
 */
import { useRef, useState } from "react";
import { Check, ImageIcon, ImagePlus, Loader2, Move, RotateCcw, Sparkles, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormDrawer } from "@/components/ui/form-kit";
import { coverPos, coverZoom, type CoverFocus } from "@/lib/cover-focus";

export type CoverItem = { id: string; src: string; name: string };

const MID: CoverFocus = { x: 50, y: 50, z: 1 };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function CoverPicker({ items, current, onPick, onClose, auto, more, loading, who = "the client", cover, focus, uploaded, onUpload, onFocus }: {
  items: CoverItem[];
  current: string | null;
  onPick: (id: string | null) => Promise<boolean>;
  onClose: () => void;
  /** What is shown when no cover is chosen (e.g. "the first highlight"); offers "Choose for me". */
  auto?: string;
  /** More photos to load (big galleries): a "Show more" button. */
  more?: { left: number; load: () => void; busy: boolean };
  loading?: boolean;
  who?: string;
  /** The picture of the cover as it is now (uploaded, chosen or picked by StuPanel); "" = none yet. */
  cover?: string;
  focus?: CoverFocus | null;
  /** The cover is a photo uploaded from the studio's computer or phone. */
  uploaded?: boolean;
  onUpload?: (file: File) => Promise<boolean>;
  onFocus?: (f: CoverFocus | null) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [adjust, setAdjust] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(id: string | null) {
    if (saving) return;
    setSaving(id ?? "auto");
    const ok = await onPick(id);
    setSaving(null);
    // After choosing a photo, go straight to Adjust (when the page can save it).
    if (ok) { if (id && onFocus) setAdjust(true); else onClose(); }
  }
  async function upload(f: File | undefined) {
    if (!f || !onUpload || saving) return;
    setSaving("upload");
    const ok = await onUpload(f);
    setSaving(null);
    if (fileRef.current) fileRef.current.value = "";
    if (ok && onFocus) setAdjust(true);
  }

  if (adjust && onFocus && cover) return <AdjustCover src={cover} focus={focus ?? null} who={who} onSave={onFocus} onBack={() => setAdjust(false)} onDone={onClose} />;

  return (
    <FormDrawer open onClose={onClose} icon={ImageIcon} color="violet" title="Cover photo"
      sub={`What ${who} sees first when the link opens`}
      footer={<button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#F5F3FA] text-[15px] font-semibold text-[#17151F]">Close</button>}>
      {/* The cover now, with Adjust */}
      {cover && onFocus && (
        <div className="mb-4 rounded-[18px] bg-white p-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          <div className="relative w-[58px] h-[96px] rounded-[12px] overflow-hidden bg-[#2A2140] flex-shrink-0">
            <div className="absolute inset-0" style={coverZoom(focus)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full" style={coverPos(focus)} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-semibold text-[#17151F]">The cover now</p>
            <p className="text-[12.5px] text-[#6B6680]">{uploaded ? "Uploaded from your device" : current ? "A photo from this gallery" : "Chosen by StuPanel"}</p>
          </div>
          <button type="button" onClick={() => setAdjust(true)} className="h-10 px-4 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13.5px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
            <SlidersHorizontal className="w-4 h-4" />Adjust
          </button>
        </div>
      )}
      {auto && (
        <button type="button" onClick={() => pick(null)} disabled={!!saving}
          className={cn("w-full mb-4 rounded-[16px] px-4 py-3 flex items-center gap-3 text-left bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)]", !current && !uploaded && "ring-2 ring-[#7D5CEF] bg-[#F6F2FF]")}>
          <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#5B3FD0] flex items-center justify-center flex-shrink-0">{saving === "auto" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-semibold text-[#17151F]">Choose for me</span>
            <span className="block text-[12.5px] text-[#6B6680]">StuPanel shows {auto}</span>
          </span>
          {!current && !uploaded && <Check className="w-5 h-5 text-[#5B3FD0]" strokeWidth={3} />}
        </button>
      )}
      <p className="text-[13px] font-semibold text-[#4A4658] mb-2">{onUpload ? "Tap a photo, or upload one" : "Tap a photo to make it the cover"}</p>
      <p className="text-[12.5px] text-[#6B6680] -mt-1 mb-3">It is also the picture people see when the link is shared on WhatsApp or Facebook.</p>
      {onUpload && <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" tabIndex={-1} onChange={e => upload(e.target.files?.[0])} />}
      {loading ? <div className="py-12 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {onUpload && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={!!saving}
                className={cn("relative aspect-square rounded-[12px] border-2 border-dashed border-[#C9BDF5] bg-[#F6F2FF] text-[#5B3FD0] flex flex-col items-center justify-center gap-1.5 px-2 text-center focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
                  uploaded && "ring-[3px] ring-[#7D5CEF] ring-offset-2 border-solid")}>
                {saving === "upload" ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                <span className="text-[12px] font-semibold leading-tight">{saving === "upload" ? "Uploading…" : "Upload from this device"}</span>
              </button>
            )}
            {items.map(p => {
              const on = p.id === current && !uploaded;
              return (
                <button key={p.id} type="button" onClick={() => pick(p.id)} disabled={!!saving} aria-pressed={on} aria-label={`Make ${p.name} the cover`}
                  className={cn("relative aspect-square rounded-[12px] overflow-hidden bg-[#EEEBF4] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", on && "ring-[3px] ring-[#7D5CEF] ring-offset-2")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                  {on && <span className="absolute left-1.5 top-1.5 h-6 px-2 rounded-full bg-[#7D5CEF] text-white text-[11px] font-bold inline-flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} />Cover</span>}
                  {saving === p.id && <span className="absolute inset-0 bg-white/60 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#5B3FD0]" /></span>}
                </button>
              );
            })}
          </div>
        )}
      {!loading && !items.length && <p className="text-[14px] text-[#6B6680] py-6 text-center">No photo of this gallery is ready yet.{onUpload ? " You can upload one." : ""}</p>}
      {more && more.left > 0 && (
        <div className="flex justify-center mt-4">
          <button type="button" onClick={more.load} disabled={more.busy} className="h-11 px-5 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-2 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
            {more.busy && <Loader2 className="w-4 h-4 animate-spin" />}Show more ({more.left} left)
          </button>
        </div>
      )}
    </FormDrawer>
  );
}

/** Drag the photo to choose what stays in view; zoom in. Seen in a phone frame and a computer frame. */
function AdjustCover({ src, focus, who, onSave, onBack, onDone }: {
  src: string; focus: CoverFocus | null; who: string;
  onSave: (f: CoverFocus | null) => Promise<boolean>; onBack: () => void; onDone: () => void;
}) {
  const [f, setF] = useState<CoverFocus>(focus ?? MID);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; f: CoverFocus; w: number; h: number } | null>(null);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, f, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // Moving the photo right shows more of its left side: the focus goes left. Slower when zoomed in.
    const k = 100 / d.f.z;
    setF({ ...d.f, x: Math.round(clamp(d.f.x - ((e.clientX - d.x) / d.w) * k, 0, 100)), y: Math.round(clamp(d.f.y - ((e.clientY - d.y) / d.h) * k, 0, 100)) });
  };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 3;
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = m[e.key];
    if (!v) return;
    e.preventDefault();
    setF(c => ({ ...c, x: clamp(c.x + v[0], 0, 100), y: clamp(c.y + v[1], 0, 100) }));
  };

  async function save() {
    setBusy(true);
    const same = f.x === 50 && f.y === 50 && f.z === 1;
    const ok = await onSave(same ? null : f);
    setBusy(false);
    if (ok) onDone();
  }

  const frame = (cls: string, label: string, grab?: boolean) => (
    <figure className="flex flex-col items-center gap-1.5">
      <div className={cn("relative overflow-hidden bg-[#2A2140] select-none touch-none", cls, grab && "cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40")}
        {...(grab ? { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, tabIndex: 0, role: "application", "aria-label": "Cover position. Drag, or use the arrow keys, to move the photo.", onKeyDown: key } : {})}>
        <div className="absolute inset-0 pointer-events-none" style={coverZoom(f)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full" style={coverPos(f)} />
        </div>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/25 via-transparent to-black/60" />
        {grab && <span aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/35 backdrop-blur text-white flex items-center justify-center pointer-events-none"><Move className="w-5 h-5" /></span>}
      </div>
      <figcaption className="text-[12px] font-semibold text-[#6B6680]">{label}</figcaption>
    </figure>
  );

  return (
    <FormDrawer open onClose={onDone} icon={SlidersHorizontal} color="violet" title="Adjust the cover"
      sub={`Drag the photo so ${who} sees the best part`}
      footer={<>
        <button type="button" onClick={onBack} disabled={busy} className="flex-1 h-12 rounded-full bg-[#F5F3FA] text-[15px] font-semibold text-[#17151F]">Back</button>
        <button type="button" onClick={save} disabled={busy} className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save
        </button>
      </>}>
      <div className="rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(22,18,40,.06)]">
        <div className="flex items-end justify-center gap-4">
          {frame("w-[168px] h-[300px] rounded-[26px] ring-[5px] ring-[#17151F]", "On a phone", true)}
          {frame("w-[150px] h-[94px] rounded-[10px] ring-[3px] ring-[#17151F]", "On a computer")}
        </div>
        <label className="mt-5 flex items-center gap-3">
          <span className="text-[13px] font-semibold text-[#4A4658] w-12">Zoom</span>
          <input type="range" min={1} max={3} step={0.05} value={f.z} onChange={e => setF(c => ({ ...c, z: Number(e.target.value) }))}
            className="flex-1 accent-[#7D5CEF] h-11" aria-valuetext={`${Math.round(f.z * 100)}%`} />
          <span className="text-[13px] tabular-nums text-[#6B6680] w-11 text-right">{Math.round(f.z * 100)}%</span>
        </label>
        <button type="button" onClick={() => setF(MID)} className="mt-1 h-10 px-3 -ml-1 rounded-full text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5 hover:bg-[#F6F2FF]">
          <RotateCcw className="w-4 h-4" />Back to the middle
        </button>
      </div>
      <p className="text-[12.5px] text-[#6B6680] mt-3 px-1">The whole photo is still used for the WhatsApp and Facebook link picture.</p>
    </FormDrawer>
  );
}

/** Send a cover photo from this device (made smaller first). Returns the gallery, or an error message. */
export async function sendCover(endpoint: string, file: File, fetcher: (u: string, i?: RequestInit) => Promise<Response>): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  if (file.size > 40 * 1024 * 1024) return { ok: false, error: "This photo is too big. Use one under 25 MB." };
  const { shrink } = await import("@/lib/shrink-photo");
  const fd = new FormData();
  fd.append("file", await shrink(file, 2800), "cover.jpg");
  const r = await fetcher(endpoint, { method: "POST", body: fd }).catch(() => null);
  const d = r ? await r.json().catch(() => ({})) : {};
  if (!r?.ok) return { ok: false, error: (Array.isArray(d.message) ? d.message[0] : d.message) || "The photo could not be uploaded. Please try again." };
  return { ok: true, data: d };
}
