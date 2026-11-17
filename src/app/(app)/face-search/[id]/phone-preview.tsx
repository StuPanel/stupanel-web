"use client";

/**
 * The guest page in a phone frame, next to the gallery's Settings. It is the real page (/f/<token>?preview=1)
 * fed with these settings and sample answers, so what the studio sees is what guests get. Nothing is saved or sent.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FaceDetail, FacePhoto, FaceSettings } from "@/lib/face";

export type Screen = "land" | "register" | "wait" | "results";
const SCREENS: { id: Screen; label: string }[] = [
  { id: "land", label: "First screen" }, { id: "register", label: "Details" }, { id: "wait", label: "On the list" }, { id: "results", label: "Photos" },
];
const W = 390, H = 844;

type Pub = { studio: { name: string; logoUrl: string | null }; cover: unknown; eventDate: string | null };

function Frame({ g, s, screen, before, scale }: { g: FaceDetail; s: FaceSettings; screen: Screen; before: boolean; scale: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [pub, setPub] = useState<Pub | null>(null);
  const [photos, setPhotos] = useState<FacePhoto[]>([]);
  const token = useMemo(() => g.link.split("/f/")[1]?.split(/[?#]/)[0] ?? "", [g.link]);

  useEffect(() => {
    let on = true;
    fetch(`${API}/public/face/${encodeURIComponent(token)}`).then(r => (r.ok ? r.json() : null)).then(d => { if (on && d) setPub(d); }).catch(() => undefined);
    apiFetch(`${API}/face-search/${g.id}/photos?filter=ready&take=8`).then(r => (r.ok ? r.json() : null)).then(d => { if (on && d?.photos) setPhotos(d.photos); }).catch(() => undefined);
    return () => { on = false; };
  }, [g.id, token]);

  useEffect(() => {
    const on = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === "sp-face-preview-ready" && e.source === frame.current?.contentWindow) setReady(true); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  // Every change of a setting goes to the phone at once.
  useEffect(() => {
    if (!ready || !frame.current?.contentWindow) return;
    const asks = s.askName !== "hide" || s.askPhone !== "hide" || s.askEmail !== "hide";
    const open = {
      link: "guest", title: g.title, status: before ? "draft" : "published", ready: true,
      eventDate: pub?.eventDate ?? g.program?.eventDate ?? null,
      studio: pub?.studio ?? { name: "Your studio", logoUrl: null },
      cover: pub?.cover ?? g.cover ?? null, watermark: null,
      welcome: s.welcome ?? "", language: s.language ?? "en",
      register: asks ? s.register ?? "off" : "off",
      askName: s.askName ?? "required", askPhone: s.askPhone ?? "optional", askEmail: s.askEmail ?? "optional", contactOne: s.contactOne ?? true,
      needsPin: !!s.pin, hasFullCode: !!s.fullPin, downloads: s.downloads !== false, downloadAll: s.downloadAll !== false,
      follow: [s.followFacebook ? { site: "facebook", url: s.followFacebook } : null, s.followInstagram ? { site: "instagram", url: s.followInstagram } : null].filter(Boolean),
    };
    const sample = photos.map(p => ({ ...p, wm: undefined }));
    frame.current.contentWindow.postMessage({ type: "sp-face-preview", data: { open, screen, photos: sample } }, window.location.origin);
  }, [ready, s, screen, before, g, pub, photos]);

  return (
    <div className="relative mx-auto rounded-[34px] bg-[#17151F] p-[7px] shadow-[0_24px_50px_-24px_rgba(23,21,31,.55)]" style={{ width: W * scale + 14, height: H * scale + 14 }}>
      <div className="relative overflow-hidden rounded-[28px] bg-[#FAF4EB]" style={{ width: W * scale, height: H * scale }}>
        <iframe ref={frame} src={`/f/${encodeURIComponent(token)}?preview=1`} title="Guest page preview" tabIndex={-1}
          style={{ width: W, height: H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", display: "block" }} />
      </div>
    </div>
  );
}

function Controls({ screen, onScreen, before, onBefore, canEarly }: { screen: Screen; onScreen: (s: Screen) => void; before: boolean; onBefore: (b: boolean) => void; canEarly: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Which screen" className="grid grid-cols-2 gap-1.5">
        {SCREENS.map(x => {
          const off = x.id === "wait" && !canEarly;
          return (
            <button key={x.id} type="button" role="tab" aria-selected={screen === x.id} disabled={off} onClick={() => onScreen(x.id)}
              title={off ? "Only when guests are asked for details before you publish" : undefined}
              className={cn("h-9 rounded-full text-[12.5px] font-semibold transition-colors disabled:opacity-40", screen === x.id ? "bg-[#17151F] text-white" : "bg-white text-[#17151F] ring-1 ring-[#E9E5F2] hover:bg-[#F5F3FA]")}>{x.label}</button>
          );
        })}
      </div>
      <div role="radiogroup" aria-label="When" className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#EFECF5]">
        {[{ v: true, l: "Before publish" }, { v: false, l: "After publish" }].map(o => (
          <button key={o.l} type="button" role="radio" aria-checked={before === o.v} onClick={() => onBefore(o.v)}
            className={cn("h-8 rounded-full text-[12px] font-semibold", before === o.v ? "bg-white text-[#5B3FD0] shadow-sm" : "text-[#4A4658]")}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

/** The preview beside the settings (wide screens), or behind a button (smaller screens). */
export function PhonePreview({ g, s, screen, onScreen }: { g: FaceDetail; s: FaceSettings; screen: Screen; onScreen: (s: Screen) => void }) {
  const [before, setBefore] = useState(g.status === "draft");
  const [open, setOpen] = useState(false);
  const asks = (s.register ?? "off") !== "off" && (s.askName !== "hide" || s.askPhone !== "hide" || s.askEmail !== "hide");
  const canEarly = asks;
  // "On the list" only exists before publishing; Photos only after.
  const shown: Screen = screen === "wait" && !canEarly ? "register" : screen;
  const pick = (x: Screen) => { onScreen(x); if (x === "wait") setBefore(true); if (x === "results") setBefore(false); };
  const note = shown === "wait" ? "What a guest sees after giving their details before you publish." : shown === "register" ? (asks ? "Try it: type in the form to see the checks." : "Guest details are off.") : shown === "results" ? "Sample: a few photos of this gallery." : before ? "Before you publish: guests can sign up." : "After you publish.";

  const panel = (scale: number) => (
    <div className="flex flex-col gap-3">
      <Controls screen={shown} onScreen={pick} before={before} onBefore={setBefore} canEarly={canEarly} />
      <Frame g={g} s={s} screen={shown} before={shown === "wait" ? true : shown === "results" ? false : before} scale={scale} />
      <p className="text-[12px] leading-snug text-[#6B6680] text-center px-2">{note} Nothing here is saved or sent.</p>
    </div>
  );

  return (
    <>
      <aside aria-label="Phone preview" className="hidden xl:block sticky top-[68px]">
        <p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">What guests see</p>
        {panel(0.6)}
      </aside>
      <button type="button" onClick={() => setOpen(true)}
        className="xl:hidden fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-6 z-30 h-12 px-4 rounded-full bg-[#17151F] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 shadow-[0_12px_28px_-12px_rgba(23,21,31,.7)]">
        <Smartphone className="w-4 h-4" aria-hidden />Preview
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="What guests see" className="xl:hidden fixed inset-0 z-[60] bg-[#17151F]/55 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="relative w-full max-w-[360px] bg-[#F7F5FB] rounded-[24px] p-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-bold text-[#17151F]">What guests see</p>
              <button type="button" aria-label="Close preview" onClick={() => setOpen(false)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            {panel(0.72)}
          </div>
        </div>
      )}
    </>
  );
}
