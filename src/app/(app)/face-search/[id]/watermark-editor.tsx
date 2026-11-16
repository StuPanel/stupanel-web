"use client";

/**
 * The watermark a studio puts on guest photos: its own logo (PNG) or a line of text,
 * in any of nine places, at the size and strength it likes. A preview shows the result on the gallery's cover.
 */
import { useRef, useState } from "react";
import { ImageUp, Loader2, Trash2, Type } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { PillPicker, inputCls } from "@/components/ui/form-kit";
import { errText, facePhotoUrl, type Cover, type FaceSettings } from "@/lib/face";

type Pos = NonNullable<FaceSettings["watermarkPos"]>;
const GRID: { pos: Pos; label: string }[] = [
  { pos: "tl", label: "Top left" }, { pos: "tc", label: "Top centre" }, { pos: "tr", label: "Top right" },
  { pos: "cl", label: "Middle left" }, { pos: "cc", label: "Centre" }, { pos: "cr", label: "Middle right" },
  { pos: "bl", label: "Bottom left" }, { pos: "bc", label: "Bottom centre" }, { pos: "br", label: "Bottom right" },
];

export function WatermarkEditor({ s, cover, studio, onSave }: { s: FaceSettings; cover: Cover; studio: string; onSave: (patch: Partial<FaceSettings>) => void }) {
  const [kind, setKind] = useState<"text" | "logo">(s.watermarkKind ?? "text");
  const [text, setText] = useState(s.watermarkText ?? "");
  const [logo, setLogo] = useState(s.watermarkLogo ?? "");
  const [pos, setPos] = useState<Pos>(s.watermarkPos ?? "br");
  const [size, setSize] = useState(s.watermarkSize ?? 18);
  const [opacity, setOpacity] = useState(s.watermarkOpacity ?? 80);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sliders and typing save a moment after the last change.
  const later = (patch: Partial<FaceSettings>) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => onSave(patch), 600); };

  async function upload(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|webp)$/.test(f.type)) return notify("Use a PNG or WebP logo with a see-through background.", { error: true });
    if (f.size > 2 * 1024 * 1024) return notify("This file is larger than 2 MB. Please use a smaller logo.", { error: true });
    setBusy(true);
    const form = new FormData(); form.append("file", f);
    const r = await apiFetch(`${API}/face-search/watermark-logo`, { method: "POST", body: form }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok || !d.url) return notify(errText(d, "Could not upload the logo. Please try again."), { error: true });
    setLogo(d.url); setKind("logo");
    onSave({ watermarkLogo: d.url, watermarkKind: "logo" });
    if (d.hasAlpha === false) notify("This logo has a solid background. A PNG with a see-through background looks better.");
  }

  const y = pos[0] === "t" ? "start" : pos[0] === "b" ? "end" : "center";
  const x = pos[1] === "l" ? "start" : pos[1] === "r" ? "end" : "center";
  const shownText = text.trim() || studio || "Your studio";

  return (
    <div className="px-4 py-4 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <PillPicker<"logo" | "text"> label="Watermark" value={kind} onChange={v => { setKind(v); onSave({ watermarkKind: v }); }}
          options={[{ value: "logo", label: "My logo", icon: ImageUp }, { value: "text", label: "Text", icon: Type }]} />

        {kind === "logo" ? (
          <div>
            <p className="text-xs font-semibold text-[#6B6680] mb-1.5">Logo (PNG or WebP, see-through background, up to 2 MB)</p>
            <div className="flex items-center gap-3 flex-wrap">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Your watermark logo" className="h-14 max-w-[160px] object-contain rounded-[12px] bg-[repeating-conic-gradient(#8A8599_0_25%,#A29DB3_0_50%)] bg-[length:14px_14px] p-1.5" />
              )}
              <button type="button" onClick={() => file.current?.click()} disabled={busy} className="h-11 px-4 rounded-full bg-[#17151F] text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}{logo ? "Change logo" : "Upload logo"}
              </button>
              {logo && <button type="button" onClick={() => { setLogo(""); setKind("text"); onSave({ watermarkLogo: "", watermarkKind: "text" }); }} className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13.5px] font-semibold inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />Remove</button>}
              <input ref={file} type="file" accept="image/png,image/webp" className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {!logo && <p className="text-xs text-[#8A5200] mt-2">Until you upload a logo, the text is used.</p>}
          </div>
        ) : (
          <div>
            <label htmlFor="fs-wm" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Text</label>
            <input id="fs-wm" className={cn(inputCls, "max-w-[320px]")} maxLength={40} placeholder={studio || "Your studio name"} value={text} onChange={e => { setText(e.target.value); later({ watermarkText: e.target.value }); }} />
            <p className="text-xs text-[#6B6680] mt-1.5">Leave empty to use your studio name.</p>
          </div>
        )}

        <div className="flex gap-5 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-[#6B6680] mb-1.5">Position</p>
            <div role="radiogroup" aria-label="Watermark position" className="grid grid-cols-3 gap-1 w-[132px] p-1 rounded-[14px] bg-[#F5F3FA]">
              {GRID.map(g => (
                <button key={g.pos} type="button" role="radio" aria-checked={pos === g.pos} aria-label={g.label} title={g.label} onClick={() => { setPos(g.pos); onSave({ watermarkPos: g.pos }); }}
                  className={cn("h-10 rounded-[10px] flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", pos === g.pos ? "bg-[#7D5CEF]" : "bg-white hover:bg-[#EEE8FD]")}>
                  <span className={cn("w-2.5 h-2.5 rounded-full", pos === g.pos ? "bg-white" : "bg-[#C9C2DA]")} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[200px] space-y-4">
            <div>
              <label htmlFor="fs-wm-size" className="flex justify-between text-xs font-semibold text-[#6B6680] mb-1.5"><span>Size</span><span className="tabular-nums text-[#17151F]">{size}%</span></label>
              <input id="fs-wm-size" type="range" min={5} max={60} value={size} onChange={e => { const v = Number(e.target.value); setSize(v); later({ watermarkSize: v }); }} className="w-full h-11 accent-[#7D5CEF]" />
            </div>
            <div>
              <label htmlFor="fs-wm-op" className="flex justify-between text-xs font-semibold text-[#6B6680] mb-1.5"><span>Strength</span><span className="tabular-nums text-[#17151F]">{opacity}%</span></label>
              <input id="fs-wm-op" type="range" min={20} max={100} step={5} value={opacity} onChange={e => { const v = Number(e.target.value); setOpacity(v); later({ watermarkOpacity: v }); }} className="w-full h-11 accent-[#7D5CEF]" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[#6B6680] mb-1.5">Preview</p>
        {/* The box is its own measuring stick (cqw), so the mark keeps the same share of the photo as on the real one. */}
        <div className="relative w-full aspect-[4/3] rounded-[16px] overflow-hidden bg-gradient-to-br from-[#8a6f55] to-[#3f3340] grid p-[2.25cqw]" style={{ containerType: "inline-size", placeItems: `${y} ${x}` }}>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={facePhotoUrl(cover, 640)} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {kind === "logo" && logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt="" className="relative block object-contain" style={{ width: `${size}cqw`, maxHeight: "45cqw", opacity: opacity / 100 }} />
            : <span className="relative font-bold text-white whitespace-nowrap leading-none" style={{ fontSize: `${(size * 0.1425).toFixed(2)}cqw`, opacity: opacity / 100, textShadow: "0 0 2px rgba(0,0,0,.6)" }}>{shownText}</span>}
        </div>
        <p className="text-xs text-[#6B6680] mt-1.5">Guests see this on every photo, also on the ones they download.</p>
      </div>
    </div>
  );
}
