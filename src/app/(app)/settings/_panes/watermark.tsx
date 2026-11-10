"use client";

/**
 * Watermark — the studio's mark on the photos clients see while choosing.
 * Text (any of 6 fonts, colour, shadow) or a logo (original / white / black).
 * Full control: 9 positions or a repeated pattern, size, opacity, space from the edge,
 * pattern angle and spacing. The preview is drawn with the same maths the server uses.
 * Saving makes the mark picture here (PNG) and the server puts it on every preview again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImageUp, Loader2, Moon, RectangleHorizontal, RectangleVertical, RotateCcw, Sun, Type, ImageIcon, Grid3X3, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { placeMark, WM_FONTS, type Watermark, type WmPosition } from "@/lib/photos";
import { Group, Row, Segmented, Switch } from "../_ui";

const GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Great+Vibes&family=Montserrat:wght@700&family=Cormorant+Garamond:wght@600&family=Hind+Siliguri:wght@700&display=swap";
const WEIGHT: Record<string, number> = { "Great Vibes": 400, "Cormorant Garamond": 600 };
const COLOURS = ["#FFFFFF", "#17151F", "#F5F3FA", "#7D5CEF", "#C2304F", "#1F8A5B"];
const GRID: WmPosition[] = ["tl", "tc", "tr", "ml", "c", "mr", "bl", "bc", "br"];
const POS_LABEL: Record<WmPosition, string> = {
  tl: "Top left", tc: "Top", tr: "Top right", ml: "Left", c: "Centre", mr: "Right", bl: "Bottom left", bc: "Bottom", br: "Bottom right", tile: "Pattern",
};

type Mark = { canvas: HTMLCanvasElement; w: number; h: number };

/** Family name to draw with: the app's own font for Plus Jakarta Sans, else the Google font. */
function family(font: string) {
  if (font === "Plus Jakarta Sans" && typeof document !== "undefined") return getComputedStyle(document.body).fontFamily;
  return `"${font}"`;
}

async function loadFonts() {
  if (typeof document === "undefined") return;
  if (!document.querySelector(`link[data-wm-fonts]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = GOOGLE_FONTS; l.dataset.wmFonts = "1";
    document.head.appendChild(l);
  }
  await Promise.all(WM_FONTS.filter(f => f !== "Plus Jakarta Sans").map(f => document.fonts.load(`${WEIGHT[f] ?? 700} 60px "${f}"`).catch(() => null)));
}

/** Text → transparent picture, tight around the letters. */
function textMark(text: string, font: string, color: string, shadow: boolean): Mark | null {
  const t = text.trim();
  if (!t) return null;
  const px = 160, pad = shadow ? 28 : 8;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const f = `${WEIGHT[font] ?? 700} ${px}px ${family(font)}`;
  ctx.font = f;
  const m = ctx.measureText(t);
  const asc = Math.ceil(m.actualBoundingBoxAscent || px * 0.8);
  const desc = Math.ceil(m.actualBoundingBoxDescent || px * 0.25);
  c.width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight || m.width) + pad * 2;
  c.height = asc + desc + pad * 2;
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  if (shadow) { ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 3; }
  ctx.fillText(t, pad + (m.actualBoundingBoxLeft || 0), pad + asc);
  return { canvas: c, w: c.width, h: c.height };
}

/** Logo → picture (max 1000px), optionally all white or all black. */
function logoMark(img: HTMLImageElement, tint: Watermark["logoTint"]): Mark {
  const scale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (tint !== "original") {
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = tint === "white" ? "#FFFFFF" : "#000000";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return { canvas: c, w: c.width, h: c.height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** The sample photo: a soft dusk scene (dark) or a bright one, drawn so nothing needs downloading. */
function drawSample(ctx: CanvasRenderingContext2D, W: number, H: number, dark: boolean) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  if (dark) { g.addColorStop(0, "#2B2140"); g.addColorStop(0.55, "#7A3E66"); g.addColorStop(1, "#E3936E"); }
  else { g.addColorStop(0, "#F8EDE3"); g.addColorStop(0.6, "#F2D6CF"); g.addColorStop(1, "#E8C3B5"); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.7, H * 0.35, 0, W * 0.7, H * 0.35, Math.max(W, H) * 0.5);
  glow.addColorStop(0, dark ? "rgba(255,210,170,.55)" : "rgba(255,255,255,.8)"); glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // two figures
  ctx.fillStyle = dark ? "rgba(20,12,30,.75)" : "rgba(120,80,90,.35)";
  for (const [x, s] of [[0.42, 1], [0.56, 0.93]] as const) {
    const cx = W * x, base = H * 0.98, hh = H * 0.55 * s;
    ctx.beginPath(); ctx.arc(cx, base - hh, hh * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - hh * 0.2, base); ctx.quadraticCurveTo(cx, base - hh * 1.05, cx + hh * 0.2, base); ctx.fill();
  }
}

/** Draws the mark on a W×H photo exactly like the server (positions, pattern, opacity). */
function drawMark(ctx: CanvasRenderingContext2D, W: number, H: number, mark: Mark, wm: Watermark) {
  ctx.save();
  ctx.globalAlpha = wm.opacity / 100;
  if (wm.position === "tile") {
    const w = Math.max(8, Math.round((W * wm.size) / 100));
    const h = Math.max(1, Math.round((w * mark.h) / mark.w));
    const a = (wm.rotation * Math.PI) / 180;
    const rw = Math.ceil(Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)));
    const rh = Math.ceil(Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a)));
    const pad = Math.round((rw * wm.gap) / 100 / 2);
    const tile = document.createElement("canvas");
    tile.width = rw + pad * 2; tile.height = rh + pad * 2;
    const t = tile.getContext("2d")!;
    t.translate(tile.width / 2, tile.height / 2); t.rotate(a);
    t.drawImage(mark.canvas, -w / 2, -h / 2, w, h);
    const pat = ctx.createPattern(tile, "repeat");
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
  } else {
    const p = placeMark(W, H, wm, mark.w / mark.h);
    ctx.drawImage(mark.canvas, p.left, p.top, p.width, p.height);
  }
  ctx.restore();
}

export function WatermarkPane() {
  const [wm, setWm] = useState<Watermark | null>(null);
  const [saved, setSaved] = useState<Watermark | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [custom, setCustom] = useState<string | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoErr, setLogoErr] = useState("");
  const [fontsReady, setFontsReady] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const [dark, setDark] = useState(true);
  const [own, setOwn] = useState<HTMLImageElement | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch(`${API}/photo-selection/watermark`).then(r => (r.ok ? r.json() : null)).then((d: Watermark | null) => {
      if (!d) return;
      const v = { ...d, text: d.text || d.studioName || "" };
      setWm(v); setSaved(v);
    }).catch(() => {});
    apiFetch(`${API}/companies/me`).then(r => (r.ok ? r.json() : null)).then(d => setLogoUrl(d?.logoUrl ?? null)).catch(() => {});
    loadFonts().then(() => setFontsReady(n => n + 1));
  }, []);

  // Which logo picture to use: a new upload > the studio logo > the saved mark
  const logoSrc = wm?.kind !== "logo" ? null : custom ?? (wm.logoSource === "studio" ? logoUrl : wm.imageUrl ?? null);
  useEffect(() => {
    if (!logoSrc) { setLogoImg(null); return; }
    let live = true;
    loadImage(logoSrc).then(i => { if (live) { setLogoImg(i); setLogoErr(""); } })
      .catch(() => { if (live) { setLogoImg(null); setLogoErr("Could not load the logo. Upload it here instead."); } });
    return () => { live = false; };
  }, [logoSrc]);

  const mark = useMemo<Mark | null>(() => {
    if (!wm || typeof document === "undefined") return null;
    if (wm.kind === "text") return textMark(wm.text, wm.font, wm.color, wm.shadow);
    return logoImg ? logoMark(logoImg, wm.logoTint) : null;
    // fontsReady: redraw once the fonts have arrived
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wm?.kind, wm?.text, wm?.font, wm?.color, wm?.shadow, wm?.logoTint, logoImg, fontsReady]);

  // Live preview
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !wm) return;
    const W = portrait ? 800 : 1200, H = portrait ? 1200 : 800;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    if (own) {
      const s = Math.max(W / own.naturalWidth, H / own.naturalHeight);
      ctx.drawImage(own, (W - own.naturalWidth * s) / 2, (H - own.naturalHeight * s) / 2, own.naturalWidth * s, own.naturalHeight * s);
    } else drawSample(ctx, W, H, dark);
    if (mark && wm.enabled) drawMark(ctx, W, H, mark, wm);
  }, [wm, mark, portrait, dark, own]);

  const set = (p: Partial<Watermark>) => setWm(w => (w ? { ...w, ...p } : w));
  const dirty = useMemo(() => {
    if (!wm || !saved) return false;
    const keys: (keyof Watermark)[] = ["enabled", "kind", "text", "font", "color", "shadow", "logoSource", "logoTint", "position", "size", "opacity", "margin", "rotation", "gap"];
    return keys.some(k => wm[k] !== saved[k]) || !!custom;
  }, [wm, saved, custom]);

  const pickLogo = (f?: File) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) { notify("Use a PNG (best, with a clear background), JPG or SVG", { error: true }); return; }
    if (f.size > 5 * 1024 * 1024) { notify("That picture is too big (over 5 MB)", { error: true }); return; }
    const r = new FileReader();
    r.onload = () => { setCustom(String(r.result)); set({ logoSource: "custom", kind: "logo" }); };
    r.readAsDataURL(f);
  };

  const tryPhoto = (f?: File) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadImage(url).then(i => { setOwn(i); setPortrait(i.naturalHeight > i.naturalWidth); }).catch(() => notify("Could not open that photo", { error: true }));
  };

  const save = useCallback(async () => {
    if (!wm) return;
    setSaving(true);
    try {
      let imageKey = wm.imageKey, imageW = wm.imageW, imageH = wm.imageH;
      const needsPicture = !!mark && (custom || !saved || ["kind", "text", "font", "color", "shadow", "logoSource", "logoTint"].some(k => wm[k as keyof Watermark] !== saved[k as keyof Watermark]) || !wm.imageKey);
      if (wm.enabled && !mark) { notify(wm.kind === "text" ? "Write the text for the watermark" : "Choose a logo first", { error: true }); return; }
      if (needsPicture && mark) {
        const blob = await new Promise<Blob | null>(res => mark.canvas.toBlob(res, "image/png"));
        if (!blob) throw new Error("Could not make the picture");
        const u = await apiFetch(`${API}/photo-selection/watermark/upload-url`, { method: "POST" });
        if (!u.ok) throw new Error((await u.json().catch(() => ({}))).message || "Couldn't save");
        const { key, url } = await u.json();
        const put = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": "image/png" } });
        if (!put.ok) throw new Error("Upload failed — check your internet");
        imageKey = key; imageW = mark.w; imageH = mark.h;
      }
      const r = await apiFetch(`${API}/photo-selection/watermark`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wm, imageKey, imageW, imageH, imageUrl: undefined, studioName: undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save");
      const next = { ...d, text: d.text || d.studioName || "" } as Watermark & { remade?: number };
      setWm(next); setSaved(next); setCustom(null);
      notify(next.remade ? `Saved — ${next.remade} preview${next.remade === 1 ? "" : "s"} will be updated` : "Watermark saved");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't save", { error: true });
    } finally { setSaving(false); }
  }, [wm, mark, custom, saved]);

  if (!wm) return <div className="sp-card bg-white rounded-[20px] p-6"><div className="sp-skel h-[260px] rounded-[16px]" /></div>;

  const slider = (label: string, key: "size" | "opacity" | "margin" | "rotation" | "gap", min: number, max: number, unit: string, hint?: string) => (
    <Row label={<span className="flex-1 flex items-center justify-between gap-3 w-full">{label}<span className="text-[13px] font-bold text-[#5B3FD0] tabular-nums">{wm[key]}{unit}</span></span>} hint={hint} stack>
      <input type="range" min={min} max={max} value={wm[key]} aria-label={label} disabled={!wm.enabled}
        onChange={e => set({ [key]: Number(e.target.value) } as Partial<Watermark>)}
        className="w-full accent-[#7D5CEF] h-6 cursor-pointer disabled:cursor-not-allowed" />
    </Row>
  );

  return (
    <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 items-start">
      {/* Preview */}
      <section className="xl:sticky xl:top-24">
        <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Preview</h2>
        <div className="sp-card bg-white rounded-[22px] p-3 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
          <div className={cn("relative mx-auto rounded-[16px] overflow-hidden bg-[#EEEBF4] transition-[max-width] duration-300", portrait ? "max-w-[300px]" : "max-w-full")}>
            <canvas ref={canvasRef} className="block w-full h-auto" aria-label="Watermark preview" />
            {!wm.enabled && (
              <span className="absolute left-3 top-3 h-7 px-3 rounded-full bg-black/55 text-white text-[12px] font-semibold inline-flex items-center backdrop-blur">Watermark is off</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="inline-flex p-1 rounded-full bg-[#F5F3FA]" role="radiogroup" aria-label="Photo shape">
              {[{ v: false, i: RectangleHorizontal, l: "Landscape" }, { v: true, i: RectangleVertical, l: "Portrait" }].map(o => (
                <button key={o.l} type="button" role="radio" aria-checked={portrait === o.v} onClick={() => setPortrait(o.v)} title={o.l}
                  className={cn("h-8 w-9 rounded-full inline-flex items-center justify-center", portrait === o.v ? "bg-white text-[#5B3FD0] shadow-sm" : "text-[#6B6680]")}>
                  <o.i className="w-4 h-4" /><span className="sr-only">{o.l}</span>
                </button>
              ))}
            </div>
            {!own && (
              <div className="inline-flex p-1 rounded-full bg-[#F5F3FA]" role="radiogroup" aria-label="Sample photo">
                {[{ v: true, i: Moon, l: "Dark photo" }, { v: false, i: Sun, l: "Light photo" }].map(o => (
                  <button key={o.l} type="button" role="radio" aria-checked={dark === o.v} onClick={() => setDark(o.v)} title={o.l}
                    className={cn("h-8 w-9 rounded-full inline-flex items-center justify-center", dark === o.v ? "bg-white text-[#5B3FD0] shadow-sm" : "text-[#6B6680]")}>
                    <o.i className="w-4 h-4" /><span className="sr-only">{o.l}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => (own ? setOwn(null) : photoRef.current?.click())}
              className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#EEEBF4]">
              {own ? <><RotateCcw className="w-3.5 h-3.5" />Sample photo</> : <><ImageUp className="w-3.5 h-3.5" />Try on my photo</>}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => { tryPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <p className="text-[12px] text-[#6B6680] mt-2 px-1">Clients see this on the photos while they choose. Your original photos are never changed.</p>
        </div>
      </section>

      {/* Controls */}
      <div>
        <Group>
          <Row id="wm-on" label="Use a watermark" hint="On every photo-selection preview. You can turn it off for one selection.">
            <Switch label="Use a watermark" on={wm.enabled} onChange={v => set({ enabled: v })} />
          </Row>
        </Group>

        <Group title="Your mark">
          <Row label="Type">
            <Segmented label="Watermark type" value={wm.kind} onChange={k => set({ kind: k })}
              options={[{ value: "text", label: "Text" }, { value: "logo", label: "Logo" }]} />
          </Row>
          {wm.kind === "text" ? (
            <>
              <Row id="wm-text" label="Text" stack>
                <div className="relative">
                  <Type className="w-4 h-4 text-[#A29DB3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input value={wm.text} maxLength={60} onChange={e => set({ text: e.target.value })} placeholder="© Your studio"
                    className="w-full h-11 pl-10 pr-3.5 rounded-[12px] bg-[#F5F3FA] text-[15px] text-[#17151F] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/12" />
                </div>
              </Row>
              <Row label="Font" stack>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Font">
                  {WM_FONTS.map(f => (
                    <button key={f} type="button" role="radio" aria-checked={wm.font === f} onClick={() => set({ font: f })}
                      className={cn("h-12 px-3 rounded-[14px] text-[17px] truncate transition-all",
                        wm.font === f ? "bg-[#EEE8FD] text-[#3E2A9E] ring-2 ring-[#7D5CEF]" : "bg-[#F5F3FA] text-[#17151F] hover:bg-[#EEEBF4]")}
                      style={{ fontFamily: family(f), fontWeight: WEIGHT[f] ?? 700 }} title={f}>
                      {f === "Hind Siliguri" ? "স্টুডিও Aa" : (wm.text.trim() || "Studio").slice(0, 12)}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Colour">
                <div className="flex items-center gap-1.5">
                  {COLOURS.map(c => (
                    <button key={c} type="button" onClick={() => set({ color: c })} aria-label={`Colour ${c}`} aria-pressed={wm.color === c}
                      className={cn("w-8 h-8 rounded-full border border-black/10 flex items-center justify-center transition-transform", wm.color === c && "ring-2 ring-[#7D5CEF] ring-offset-2 scale-105")}
                      style={{ backgroundColor: c }}>
                      {wm.color === c && <Check className="w-3.5 h-3.5" style={{ color: c === "#FFFFFF" || c === "#F5F3FA" ? "#17151F" : "#fff" }} />}
                    </button>
                  ))}
                  <label className="relative w-8 h-8 rounded-full overflow-hidden border border-black/10 cursor-pointer" title="Any colour"
                    style={{ background: "conic-gradient(#C2304F,#7D5CEF,#1F5C99,#1F8A5B,#C2304F)" }}>
                    <input type="color" value={wm.color} onChange={e => set({ color: e.target.value.toUpperCase() })} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Any colour" />
                  </label>
                </div>
              </Row>
              <Row label="Soft shadow" hint="Keeps light text readable on bright photos">
                <Switch label="Soft shadow" on={wm.shadow} onChange={v => set({ shadow: v })} />
              </Row>
            </>
          ) : (
            <>
              <Row label="Logo" hint={wm.logoSource === "studio" && !custom ? (logoUrl ? "Your studio logo (Settings → Branding)" : "No studio logo yet — upload one here") : "Your uploaded picture"} stack>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-16 rounded-[12px] bg-[repeating-conic-gradient(#EEEBF4_0_25%,#fff_0_50%)] [background-size:14px_14px] flex items-center justify-center overflow-hidden">
                    {mark ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mark.canvas.toDataURL()} alt="Logo" className="max-w-[88%] max-h-[80%] object-contain" />
                    ) : <ImageIcon className="w-5 h-5 text-[#A29DB3]" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {logoUrl && (
                      <button type="button" onClick={() => { setCustom(null); set({ logoSource: "studio" }); }}
                        className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold", wm.logoSource === "studio" && !custom ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>Studio logo</button>
                    )}
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#EEEBF4]">
                      <Upload className="w-3.5 h-3.5" />Upload logo
                    </button>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
                  </div>
                </div>
                {logoErr && <p className="text-[12px] text-[#C2304F] mt-2">{logoErr}</p>}
              </Row>
              <Row label="Logo colour" hint="White or black works on most photos">
                <Segmented label="Logo colour" value={wm.logoTint} onChange={v => set({ logoTint: v })}
                  options={[{ value: "original", label: "Original" }, { value: "white", label: "White" }, { value: "black", label: "Black" }]} />
              </Row>
            </>
          )}
        </Group>

        <Group title="Where it goes">
          <div className={cn("px-4 sm:px-5 py-4 flex flex-col sm:flex-row gap-4 sm:items-center", !wm.enabled && "opacity-55 pointer-events-none")}>
            <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-[16px] bg-[#F5F3FA] w-[156px] flex-shrink-0" role="radiogroup" aria-label="Position">
              {GRID.map(p => (
                <button key={p} type="button" role="radio" aria-checked={wm.position === p} onClick={() => set({ position: p })} title={POS_LABEL[p]}
                  className={cn("h-12 rounded-[10px] flex items-center justify-center transition-all",
                    wm.position === p ? "bg-[#7D5CEF] shadow-[0_6px_14px_-6px_rgba(125,92,239,.7)]" : "bg-white hover:bg-[#EEE8FD]")}>
                  <span className={cn("w-2.5 h-2.5 rounded-full", wm.position === p ? "bg-white" : "bg-[#D9D3EA]")} />
                  <span className="sr-only">{POS_LABEL[p]}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-2">
              <button type="button" role="radio" aria-checked={wm.position === "tile"} onClick={() => set({ position: "tile" })}
                className={cn("w-full h-12 px-4 rounded-[14px] inline-flex items-center gap-2.5 text-[14px] font-semibold transition-all",
                  wm.position === "tile" ? "bg-[#7D5CEF] text-white" : "bg-[#F5F3FA] text-[#17151F] hover:bg-[#EEEBF4]")}>
                <Grid3X3 className="w-4 h-4" />Pattern — repeat across the photo
              </button>
              <p className="text-[12.5px] text-[#6B6680] leading-relaxed">
                {wm.position === "tile" ? "Hardest to remove. Good when clients take screenshots." : `${POS_LABEL[wm.position]} — one mark, out of the way of faces.`}
              </p>
            </div>
          </div>
        </Group>

        <Group title="Fine-tune">
          {slider("Size", "size", 5, 90, "%", "Width of the mark, compared with the photo")}
          {slider("Opacity", "opacity", 5, 100, "%", "Lower = more see-through")}
          {wm.position === "tile"
            ? <>{slider("Angle", "rotation", -60, 60, "°")}{slider("Space between", "gap", 0, 300, "%")}</>
            : slider("Space from the edge", "margin", 0, 20, "%")}
        </Group>

        <div className="sticky bottom-3 z-10 flex items-center gap-3 p-3 rounded-[20px] bg-white/85 backdrop-blur-xl border border-[#EEEBF4] shadow-[0_10px_30px_-12px_rgba(22,18,40,.25)]">
          <p className="flex-1 text-[13px] text-[#6B6680] px-1">
            {dirty ? "Changes not saved yet." : <>Used in <Link href="/photo-selection" className="font-semibold text-[#5B3FD0] hover:underline">Photo selection</Link>.</>}
          </p>
          {dirty && saved && (
            <button type="button" onClick={() => { setWm(saved); setCustom(null); }} className="h-10 px-4 rounded-full text-[13px] font-semibold text-[#4A4658] hover:bg-[#F5F3FA]">Undo</button>
          )}
          <button type="button" onClick={save} disabled={!dirty || saving}
            className="h-10 px-5 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save watermark
          </button>
        </div>
      </div>
    </div>
  );
}
