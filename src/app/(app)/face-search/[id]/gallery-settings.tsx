"use client";

/**
 * A face gallery's settings, one section at a time:
 *   Guest page · Access · Photos · Face matching · Watermark · Close or remove
 * The list on the left shows each section's state at a glance. Everything saves by itself.
 */
import { useEffect, useRef, useState } from "react";
import {
  Check, Images, ImageUp, KeyRound, Loader2, Minus, Plus, ScanFace, Stamp, Trash2, TriangleAlert, Type,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";
import { errText, facePhotoUrl, type Cover, type FaceDetail, type FaceSettings } from "@/lib/face";

type Sec = "page" | "access" | "photos" | "match" | "mark" | "end";
type Save = (patch: Partial<FaceSettings>, extra?: { title?: string }) => Promise<void>;

export function GallerySettings({ g, onSaved, onRemoved, onAct }: { g: FaceDetail; onSaved: (g: FaceDetail) => void; onRemoved: () => void; onAct: (a: "close" | "reopen") => void }) {
  const [s, setS] = useState<FaceSettings>(g.settings);
  const [sec, setSec] = useState<Sec>("page");
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const latest = useRef(g.settings);
  const calm = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save: Save = async (patch, extra = {}) => {
    const next = { ...latest.current, ...patch };
    latest.current = next; setS(next); setState("saving");
    const r = await apiFetch(`${API}/face-search/${g.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: next, ...extra }) }).catch(() => null);
    if (!r?.ok) { setState("error"); notify("Could not save. Please try again.", { error: true }); return; }
    onSaved(await r.json());
    setState("saved");
    if (calm.current) clearTimeout(calm.current);
    calm.current = setTimeout(() => setState(""), 2200);
  };

  const sections: { id: Sec; label: string; icon: React.ElementType; now: string; danger?: boolean }[] = [
    { id: "page", label: "Guest page", icon: Type, now: s.welcome ? "Name and note" : "Name" },
    { id: "access", label: "Access", icon: KeyRound, now: [s.pin ? "Code" : "", s.register && s.register !== "off" ? "Name and number" : "", s.followFacebook || s.followInstagram ? "Follow" : ""].filter(Boolean).join(", ") || "Open to anyone with the link" },
    { id: "photos", label: "Photos guests get", icon: Images, now: `${s.guestsSee === "all" ? "All photos" : "Only their own"}${s.downloads ? "" : ", no download"}` },
    { id: "match", label: "Face matching", icon: ScanFace, now: { strict: "Strict", balanced: "Balanced", loose: "Loose" }[s.strictness] },
    { id: "mark", label: "Watermark", icon: Stamp, now: s.watermark ? (s.watermarkKind === "logo" && s.watermarkLogo ? "Your logo" : "Text") : "Off" },
    { id: "end", label: "Close or remove", icon: TriangleAlert, now: g.status === "closed" ? "Closed" : "Open", danger: true },
  ];
  const cur = sections.find(x => x.id === sec)!;

  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 lg:items-start">
      {/* Sections: a list on wide screens, a row of pills on phones */}
      <nav aria-label="Settings sections" className={cn("flex lg:flex-col gap-1.5 lg:gap-1 overflow-x-auto lg:overflow-visible [scrollbar-width:none] mb-4 lg:mb-0 lg:bg-white lg:rounded-[22px] lg:p-2 lg:sticky lg:top-20", "lg:shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_-16px_rgba(22,18,40,.25)]")}>
        {sections.map(x => {
          const on = x.id === sec;
          return (
            <button key={x.id} type="button" aria-current={on ? "page" : undefined} onClick={() => setSec(x.id)}
              className={cn("flex items-center gap-3 flex-shrink-0 text-left rounded-full lg:rounded-[14px] h-11 lg:h-auto px-4 lg:px-2.5 lg:py-2.5 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40",
                on ? "bg-[#17151F] text-white lg:bg-[#EEE8FD] lg:text-[#17151F]" : "bg-white lg:bg-transparent text-[#4A4658] hover:bg-[#F5F3FA]")}>
              <span className={cn("hidden lg:flex w-9 h-9 rounded-[11px] items-center justify-center flex-shrink-0", on ? "bg-[#7D5CEF] text-white" : x.danger ? "bg-[#FDECEF] text-[#A82743]" : "bg-[#F1EFF6] text-[#4A4658]")}><x.icon className="w-[18px] h-[18px]" /></span>
              <span className="min-w-0">
                <span className={cn("block text-[13.5px] lg:text-[14px] font-semibold whitespace-nowrap", x.danger && !on && "lg:text-[#A82743]")}>{x.label}</span>
                <span className="hidden lg:block text-xs text-[#6B6680] truncate">{x.now}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <section aria-labelledby="fs-sec-title" className={cn("bg-white rounded-[22px] min-w-0", CARD_SHADOW)}>
        <header className="px-5 sm:px-6 pt-5 pb-4 flex items-start gap-3 border-b border-[#EEEBF4]">
          <span className={cn("w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0", cur.danger ? "bg-[#FDECEF] text-[#A82743]" : "bg-[#EEE8FD] text-[#4B32B8]")}><cur.icon className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="fs-sec-title" className="text-[19px] font-extrabold tracking-[-0.02em] text-[#17151F]">{cur.label}</h2>
            <p className="text-[13px] text-[#6B6680] mt-0.5">{{
              page: "What guests read when they open the link.",
              access: "What a guest must do before the photos open.",
              photos: "Which photos a guest sees, and whether they can save them.",
              match: "How sure the match must be before a photo is shown to a guest.",
              mark: "Your logo or name on every photo guests see or save.",
              end: "Stop this gallery for a while, or take it away.",
            }[sec]}</p>
          </div>
          <span role="status" aria-live="polite" className={cn("h-7 px-2.5 rounded-full text-xs font-bold items-center gap-1 flex-shrink-0 whitespace-nowrap", state ? "inline-flex" : "hidden",
            state === "saved" ? "bg-[#E2F4EA] text-[#176B47]" : state === "error" ? "bg-[#FDECEF] text-[#A82743]" : "bg-[#F1EFF6] text-[#4A4658]")}>
            {state === "saving" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving</> : state === "saved" ? <><Check className="w-3.5 h-3.5" strokeWidth={3} />Saved</> : "Not saved"}
          </span>
        </header>

        <div className="divide-y divide-[#EEEBF4]">
          {sec === "page" && <PageSec g={g} s={s} save={save} />}
          {sec === "access" && <AccessSec s={s} save={save} />}
          {sec === "photos" && <PhotosSec s={s} save={save} />}
          {sec === "match" && <MatchSec s={s} save={save} />}
          {sec === "mark" && <MarkSec g={g} s={s} save={save} />}
          {sec === "end" && <EndSec g={g} onAct={onAct} onRemoved={onRemoved} />}
        </div>
      </section>
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

/** One setting: what it is on the left, the control on the right (below it on phones). */
function Row({ label, hint, children, htmlFor, wide }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string; wide?: boolean }) {
  return (
    <div className={cn("px-5 sm:px-6 py-4 grid gap-x-8 gap-y-2.5 items-start", wide ? "" : "md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]")}>
      <div className="min-w-0">
        {htmlFor ? <label htmlFor={htmlFor} className="block text-[15px] font-semibold text-[#17151F]">{label}</label> : <p className="text-[15px] font-semibold text-[#17151F]">{label}</p>}
        {hint && <p className="text-[13px] leading-snug text-[#6B6680] mt-0.5">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn("relative w-[52px] h-8 rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", on ? "bg-[#7D5CEF]" : "bg-[#D6D2E0]")}>
      <span className={cn("absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}

/** A few choices as cards: a name and one line about what it does. */
function Choices<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; label: string; options: { value: T; title: string; text: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cn("text-left rounded-[16px] p-3.5 min-h-[76px] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", on ? "bg-[#EEE8FD] ring-2 ring-[#7D5CEF]" : "bg-[#F7F5FB] hover:bg-[#F1EFF6]")}>
            <span className="flex items-center gap-2 text-[14px] font-bold text-[#17151F]">
              <span className={cn("w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0", on ? "border-[#7D5CEF] bg-[#7D5CEF]" : "border-[#B5B0C4]")}>{on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}</span>
              {o.title}
            </span>
            <span className="block text-[12.5px] leading-snug text-[#6B6680] mt-1">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Saves a typed field a moment after the last key. */
function useLater() {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (fn: () => void, ms = 700) => { if (t.current) clearTimeout(t.current); t.current = setTimeout(fn, ms); };
}

// ─── Sections ────────────────────────────────────────────────────────────────

function PageSec({ g, s, save }: { g: FaceDetail; s: FaceSettings; save: Save }) {
  const [title, setTitle] = useState(g.title);
  const [welcome, setWelcome] = useState(s.welcome);
  const later = useLater();
  return (
    <>
      <Row label="Name guests see" hint="The big line on the first screen and on the QR poster." htmlFor="fs-name">
        <input id="fs-name" className={inputCls} value={title} maxLength={150} onChange={e => { const v = e.target.value; setTitle(v); if (v.trim()) later(() => save({}, { title: v.trim() })); }} />
      </Row>
      <Row label="Short note" hint="One line under the name. Leave it empty for none." htmlFor="fs-welcome">
        <input id="fs-welcome" className={inputCls} value={welcome} maxLength={300} placeholder="Thank you for celebrating with us" onChange={e => { const v = e.target.value; setWelcome(v); later(() => save({ welcome: v })); }} />
        <p className="text-xs text-[#6B6680] mt-1.5 tabular-nums">{welcome.length} / 300</p>
      </Row>
    </>
  );
}

function AccessSec({ s, save }: { s: FaceSettings; save: Save }) {
  const [pin, setPin] = useState(s.pin);
  const [fb, setFb] = useState(s.followFacebook ?? "");
  const [ig, setIg] = useState(s.followInstagram ?? "");
  const later = useLater();
  return (
    <>
      <Row label="4-digit code" hint="Guests type it before the selfie. Give the code to the couple, or print it on the poster." htmlFor="fs-pin">
        <div className="flex items-center gap-2.5 flex-wrap">
          <input id="fs-pin" className={cn(inputCls, "w-[150px] tabular-nums tracking-[0.4em] text-center text-[18px] font-bold")} inputMode="numeric" maxLength={4} placeholder="Off" value={pin}
            onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); if (v.length === 4 || v === "") later(() => save({ pin: v }), 400); }} />
          {pin.length === 4 && <button type="button" onClick={() => { setPin(""); void save({ pin: "" }); }} className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[13.5px] font-semibold text-[#17151F]">Turn off</button>}
          <button type="button" onClick={() => { const v = String(Math.floor(1000 + Math.random() * 9000)); setPin(v); void save({ pin: v }); }} className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[13.5px] font-semibold text-[#17151F]">Make one for me</button>
        </div>
        <p className={cn("text-xs mt-1.5", pin.length > 0 && pin.length < 4 ? "text-[#8A5200]" : "text-[#6B6680]")}>{pin.length === 4 ? "On. Guests need this code." : pin.length ? "Type all 4 digits." : "Off. Anyone with the link can take a selfie."}</p>
      </Row>
      <Row wide label="Ask for name and WhatsApp number" hint="You see the answers in Guests, and can copy the numbers or download the list.">
        <Choices<"off" | "optional" | "required"> label="Ask for name and number" value={s.register ?? "off"} onChange={v => save({ register: v })} options={[
          { value: "off", title: "Don't ask", text: "Photos open right after the selfie." },
          { value: "optional", title: "Ask, can skip", text: "Asked after the selfie. \"Not now\" still opens the photos." },
          { value: "required", title: "Must give", text: "Guests see how many photos were found, then must fill it in." },
        ]} />
      </Row>
      <Row wide label="Ask guests to open your pages" hint="Shown once before the photos. Leave both empty for no such step. We can't check that they pressed Follow.">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="fs-fb" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Facebook page</label>
            <input id="fs-fb" className={inputCls} inputMode="url" maxLength={200} placeholder="facebook.com/yourstudio" value={fb} onChange={e => { const v = e.target.value; setFb(v); later(() => save({ followFacebook: v })); }} />
          </div>
          <div>
            <label htmlFor="fs-ig" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Instagram</label>
            <input id="fs-ig" className={inputCls} inputMode="url" maxLength={200} placeholder="instagram.com/yourstudio" value={ig} onChange={e => { const v = e.target.value; setIg(v); later(() => save({ followInstagram: v })); }} />
          </div>
        </div>
      </Row>
    </>
  );
}

function PhotosSec({ s, save }: { s: FaceSettings; save: Save }) {
  return (
    <>
      <Row wide label="Guests see">
        <div className="sm:max-w-[560px]">
          <Choices<"own" | "all"> label="Guests see" value={s.guestsSee} onChange={v => save({ guestsSee: v })} options={[
            { value: "own", title: "Only their own", text: "The photos their face is in. Best for privacy." },
            { value: "all", title: "All photos", text: "Their own first, then every other photo of the event." },
          ]} />
        </div>
      </Row>
      <Row label="Highlights for everyone" hint="Photos you mark as Highlights (the couple, the stage, the venue) are shown to every guest.">
        <Toggle label="Highlights for everyone" on={s.highlightsForAll} onChange={v => save({ highlightsForAll: v })} />
      </Row>
      <Row label="Guests can download" hint="Off means guests can look at their photos but get no Download button.">
        <Toggle label="Guests can download" on={s.downloads} onChange={v => save({ downloads: v })} />
      </Row>
    </>
  );
}

function MatchSec({ s, save }: { s: FaceSettings; save: Save }) {
  return (
    <Row wide label="How strict" hint="You can change this any time. It works at once, also for photos already added, and costs nothing.">
      <Choices<FaceSettings["strictness"]> label="How strict" value={s.strictness} onChange={v => save({ strictness: v })} options={[
        { value: "strict", title: "Strict", text: "Fewest wrong photos. A guest may miss a few of their own." },
        { value: "balanced", title: "Balanced", text: "Best for most events." },
        { value: "loose", title: "Loose", text: "Finds more photos. A similar face may slip in now and then." },
      ]} />
    </Row>
  );
}

function EndSec({ g, onAct, onRemoved }: { g: FaceDetail; onAct: (a: "close" | "reopen") => void; onRemoved: () => void }) {
  async function remove() {
    if (!(await askConfirm({ title: "Remove this gallery?", message: "Guests can't open the link any more and the face data is deleted. Your photos stay on Google Drive. Credits already used are not given back.", confirmLabel: "Remove gallery", danger: true }))) return;
    const r = await apiFetch(`${API}/face-search/${g.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return notify("Could not remove the gallery. Please try again.", { error: true });
    notify("Gallery removed"); onRemoved();
  }
  return (
    <>
      <Row label={g.status === "closed" ? "This gallery is closed" : "Close this gallery"} hint={"Guests read \"This gallery is closed\". Nothing is deleted and you can open it again."}>
        <button type="button" onClick={() => onAct(g.status === "closed" ? "reopen" : "close")} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[14px] font-semibold text-[#17151F]">{g.status === "closed" ? "Open again" : "Close gallery"}</button>
      </Row>
      <Row label="Remove this gallery" hint="The link stops working and the face data is deleted. Photos stay on Drive. This can't be undone.">
        <button type="button" onClick={remove} className="h-11 px-5 rounded-full bg-[#FDECEF] text-[14px] font-semibold text-[#A82743] inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />Remove gallery</button>
      </Row>
    </>
  );
}

// ─── Watermark ───────────────────────────────────────────────────────────────

const SPOTS: { x: number; y: number; label: string }[] = [
  { x: 3, y: 3, label: "Top left" }, { x: 50, y: 3, label: "Top centre" }, { x: 97, y: 3, label: "Top right" },
  { x: 3, y: 50, label: "Middle left" }, { x: 50, y: 50, label: "Centre" }, { x: 97, y: 50, label: "Middle right" },
  { x: 3, y: 97, label: "Bottom left" }, { x: 50, y: 97, label: "Bottom centre" }, { x: 97, y: 97, label: "Bottom right" },
];
/** Where the old nine-place setting sits, as the two numbers used now. */
const fromPos = (p?: string) => ({ x: p?.[1] === "l" ? 3 : p?.[1] === "c" ? 50 : 97, y: p?.[0] === "t" ? 3 : p?.[0] === "c" ? 50 : 97 });

/**
 * The logo as guests will get it: the empty space around it cut off (the server does the same).
 * `ar` is width / height. If the picture can't be read here, the logo is shown as it is.
 */
function useTightLogo(url: string) {
  const [out, setOut] = useState<{ url: string; src: string; ar: number } | null>(null);
  useEffect(() => {
    if (!url) return;
    let on = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!on) return;
      let src = url, ar = img.naturalWidth / Math.max(1, img.naturalHeight);
      try {
        const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d", { willReadFrequently: true });
        if (x) {
          x.drawImage(img, 0, 0, w, h);
          const d = x.getImageData(0, 0, w, h).data;
          let l = w, t = h, r = -1, b = -1;
          for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 12) { if (xx < l) l = xx; if (xx > r) r = xx; if (yy < t) t = yy; if (yy > b) b = yy; }
          if (r >= l && b >= t && (r - l + 1 < w || b - t + 1 < h)) {
            const k = document.createElement("canvas"); k.width = r - l + 1; k.height = b - t + 1;
            k.getContext("2d")?.drawImage(c, l, t, k.width, k.height, 0, 0, k.width, k.height);
            src = k.toDataURL("image/png"); ar = k.width / k.height;
          }
        }
      } catch { /* the storage did not allow reading the pixels: show it as it is */ }
      setOut({ url, src, ar });
    };
    img.onerror = () => { if (on) setOut({ url, src: url, ar: 3 }); };
    img.src = url;
    return () => { on = false; };
  }, [url]);
  return out && out.url === url ? out : null;
}

/** A number with a slider, a box to type in, and − / + for one step at a time. */
function Dial({ id, label, value, min, max, unit = "%", onChange }: { id: string; label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v))));
  const btn = "w-11 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] flex items-center justify-center flex-shrink-0 disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40";
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#17151F] mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} aria-label={`${label}: less`} disabled={value <= min} onClick={() => set(value - 1)}><Minus className="w-4 h-4" /></button>
        <input id={id} type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} className="flex-1 min-w-0 h-11 accent-[#7D5CEF]" />
        <button type="button" className={btn} aria-label={`${label}: more`} disabled={value >= max} onClick={() => set(value + 1)}><Plus className="w-4 h-4" /></button>
        <span className="relative flex-shrink-0">
          <input type="number" aria-label={`${label} as a number`} min={min} max={max} value={value} onChange={e => { if (e.target.value !== "") set(Number(e.target.value)); }}
            className="w-[76px] h-11 rounded-[12px] bg-[#F5F3FA] pl-3 pr-7 text-[15px] font-bold tabular-nums text-[#17151F] outline-none focus-visible:ring-2 focus-visible:ring-[#7D5CEF] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#6B6680] pointer-events-none">{unit}</span>
        </span>
      </div>
    </div>
  );
}

function MarkSec({ g, s, save }: { g: FaceDetail; s: FaceSettings; save: Save }) {
  async function turn(on: boolean) {
    if (!on) return save({ watermark: false });
    const ok = await askConfirm({
      title: "Turn on the watermark?",
      message: "What changes for guests:\n• Photos open a little slower, because each one passes through StuPanel to get the watermark.\n• They get a copy up to 2560 px wide, not your original file.\n• Your logo or text is put on every photo, where and how big you choose.\n\nOur advice: keep this off and export your photos with your own watermark from Lightroom or Photoshop. Guests then get them fast and in full quality.",
      confirmLabel: "Turn on anyway",
    });
    if (ok) await save({ watermark: true });
  }
  return (
    <>
      <Row label="Watermark on guest photos" hint="Off is best: export your photos with your own watermark, and guests get them fast and sharp.">
        <Toggle label="Watermark on guest photos" on={!!s.watermark} onChange={turn} />
      </Row>
      {s.watermark && <MarkEditor s={s} cover={g.cover} save={save} />}
    </>
  );
}

function MarkEditor({ s, cover, save }: { s: FaceSettings; cover: Cover; save: Save }) {
  const start = s.watermarkX != null && s.watermarkY != null ? { x: s.watermarkX, y: s.watermarkY } : fromPos(s.watermarkPos);
  const [kind, setKind] = useState<"text" | "logo">(s.watermarkKind ?? "text");
  const [text, setText] = useState(s.watermarkText ?? "");
  const [logo, setLogo] = useState(s.watermarkLogo ?? "");
  const [at, setAt] = useState(start);
  const [size, setSize] = useState(s.watermarkSize ?? 18);
  const [opacity, setOpacity] = useState(s.watermarkOpacity ?? 100);
  const [back, setBack] = useState<"photo" | "dark" | "light">(cover ? "photo" : "dark");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLElement>(null);
  const later = useLater();

  const place = (x: number, y: number, now = false) => {
    const p = { x: Math.min(100, Math.max(0, Math.round(x))), y: Math.min(100, Math.max(0, Math.round(y))) };
    setAt(p);
    if (now) void save({ watermarkX: p.x, watermarkY: p.y }); else later(() => save({ watermarkX: p.x, watermarkY: p.y }), 500);
  };
  /** The pointer is where the middle of the mark should be. */
  function follow(e: React.PointerEvent) {
    const b = box.current?.getBoundingClientRect(), m = mark.current?.getBoundingClientRect();
    if (!b || !m) return;
    const free = { w: Math.max(1, b.width - m.width), h: Math.max(1, b.height - m.height) };
    place(((e.clientX - b.left - m.width / 2) / free.w) * 100, ((e.clientY - b.top - m.height / 2) / free.h) * 100);
  }

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
    void save({ watermarkLogo: d.url, watermarkKind: "logo" });
    if (d.hasAlpha === false) notify("This logo has a solid background. A PNG with a see-through background looks better.");
  }

  const tight = useTightLogo(logo);
  const useLogo = kind === "logo" && !!logo;
  // Same sums as the server: the width is a share of the photo's width, and the logo is never taller than 60% of the photo
  // (the preview is 3:2, so 60% of its height is 40% of its width).
  const logoW = tight ? Math.min(size, 40 * tight.ar) : size;
  const shown = text.trim() || "Your studio name";
  // left: X% with translate(-X%) puts the mark's left edge at X% of the free space, the same way the server places it.
  const pos: React.CSSProperties = { position: "absolute", left: `${at.x}%`, top: `${at.y}%`, transform: `translate(-${at.x}%, -${at.y}%)`, opacity: opacity / 100 };

  return (
    <div className="px-5 sm:px-6 py-5 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-6 items-start">
      {/* Preview: drag the mark, or use the arrow keys */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <p className="text-[13px] font-semibold text-[#17151F]">Preview <span className="font-normal text-[#6B6680]">· drag the watermark to move it</span></p>
          <div role="radiogroup" aria-label="Preview background" className="flex gap-1 p-1 rounded-full bg-[#F5F3FA]">
            {(["photo", "dark", "light"] as const).filter(v => v !== "photo" || cover).map(v => (
              <button key={v} type="button" role="radio" aria-checked={back === v} onClick={() => setBack(v)} className={cn("h-8 px-3 rounded-full text-xs font-semibold capitalize", back === v ? "bg-white text-[#17151F] shadow-sm" : "text-[#6B6680]")}>{v}</button>
            ))}
          </div>
        </div>
        <div ref={box} tabIndex={0} role="application" aria-label={`Watermark position: ${at.x}% across, ${at.y}% down. Use the arrow keys to move it.`}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); follow(e); }}
          onPointerMove={e => { if (drag) follow(e); }}
          onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
          onKeyDown={e => { const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (k) { e.preventDefault(); const n = e.shiftKey ? 10 : 1; place(at.x + k[0] * n, at.y + k[1] * n); } }}
          className={cn("relative w-full aspect-[3/2] rounded-[18px] overflow-hidden touch-none select-none focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/50", drag ? "cursor-grabbing" : "cursor-grab",
            back === "light" ? "bg-[#F1EFF6]" : "bg-gradient-to-br from-[#4a3f55] to-[#1f1a27]")} style={{ containerType: "inline-size" }}>
          {back === "photo" && cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={facePhotoUrl(cover, 1200)} alt="" referrerPolicy="no-referrer" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          )}
          {useLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img ref={mark as React.RefObject<HTMLImageElement>} src={tight?.src ?? logo} alt="" draggable={false} className="block pointer-events-none" style={{ ...pos, width: `${logoW}cqw`, height: tight ? `${logoW / tight.ar}cqw` : "auto", maxHeight: "40cqw", objectFit: "contain" }} />
            : <span ref={mark as React.RefObject<HTMLSpanElement>} className="font-bold text-white whitespace-nowrap leading-none pointer-events-none" style={{ ...pos, fontSize: `${(size * 0.1267).toFixed(2)}cqw`, textShadow: "0 0 .25cqw rgba(0,0,0,.7)" }}>{shown}</span>}
          {drag && <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "33.333% 33.333%" }} />}
        </div>
        <p className="text-xs text-[#6B6680] mt-2">Guests see this on every photo, also on the ones they save. On a tall photo the mark keeps the same share of the width.</p>
      </div>

      <div className="space-y-5 min-w-0">
        <div>
          <p className="text-[13px] font-semibold text-[#17151F] mb-1.5">Use</p>
          <div role="radiogroup" aria-label="Watermark kind" className="grid grid-cols-2 gap-2">
            {([["logo", "My logo", ImageUp], ["text", "Text", Type]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={kind === v} onClick={() => { setKind(v); void save({ watermarkKind: v }); }}
                className={cn("h-12 rounded-[14px] text-[14px] font-semibold inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", kind === v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#17151F]")}><Icon className="w-4 h-4" />{label}</button>
            ))}
          </div>
        </div>

        {kind === "logo" ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="w-[92px] h-[60px] rounded-[12px] flex items-center justify-center overflow-hidden flex-shrink-0 bg-[repeating-conic-gradient(#8A8599_0_25%,#A29DB3_0_50%)] bg-[length:14px_14px]">
                {logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={tight?.src ?? logo} alt="Your watermark logo" className="max-w-full max-h-full object-contain p-1.5" />
                  : <ImageUp className="w-5 h-5 text-white" />}
              </span>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => file.current?.click()} disabled={busy} className="h-11 px-4 rounded-full bg-[#7D5CEF] text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}{logo ? "Change" : "Upload logo"}
                </button>
                {logo && <button type="button" aria-label="Remove logo" onClick={() => { setLogo(""); setKind("text"); void save({ watermarkLogo: "", watermarkKind: "text" }); }} className="w-11 h-11 rounded-full bg-[#F5F3FA] text-[#A82743] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <input ref={file} type="file" accept="image/png,image/webp" className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <p className={cn("text-xs mt-2", logo ? "text-[#6B6680]" : "text-[#8A5200]")}>{logo ? "PNG or WebP with a see-through background, up to 2 MB." : "Upload a PNG or WebP with a see-through background (up to 2 MB). Until then the text is used."}</p>
          </div>
        ) : (
          <div>
            <label htmlFor="fs-wm" className="block text-[13px] font-semibold text-[#17151F] mb-1.5">Text</label>
            <input id="fs-wm" className={inputCls} maxLength={40} placeholder="Your studio name" value={text} onChange={e => { setText(e.target.value); later(() => save({ watermarkText: e.target.value })); }} />
            <p className="text-xs text-[#6B6680] mt-1.5">Leave it empty to use your studio name.</p>
          </div>
        )}

        {useLogo && tight && size > 40 * tight.ar && <p className="text-xs text-[#8A5200]">This logo is tall, so it stops growing at 60% of the photo&apos;s height.</p>}
        <Dial id="fs-wm-size" label="Size (share of the photo's width)" value={size} min={3} max={80} onChange={v => { setSize(v); later(() => save({ watermarkSize: v }), 500); }} />
        <Dial id="fs-wm-op" label="Strength (100 = solid)" value={opacity} min={5} max={100} onChange={v => { setOpacity(v); later(() => save({ watermarkOpacity: v }), 500); }} />

        <div>
          <p className="text-[13px] font-semibold text-[#17151F] mb-1.5">Place</p>
          <div className="flex gap-4 items-start">
            <div role="group" aria-label="Quick places" className="grid grid-cols-3 gap-1 w-[132px] p-1 rounded-[14px] bg-[#F5F3FA] flex-shrink-0">
              {SPOTS.map(p => {
                const on = at.x === p.x && at.y === p.y;
                return (
                  <button key={p.label} type="button" aria-pressed={on} aria-label={p.label} title={p.label} onClick={() => place(p.x, p.y, true)}
                    className={cn("h-10 rounded-[10px] flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", on ? "bg-[#7D5CEF]" : "bg-white hover:bg-[#EEE8FD]")}>
                    <span className={cn("w-2.5 h-2.5 rounded-full", on ? "bg-white" : "bg-[#C9C2DA]")} />
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {([["x", "Across"], ["y", "Down"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-xs font-semibold text-[#6B6680]">
                  <span className="w-12">{label}</span>
                  <input type="range" min={0} max={100} value={at[k]} aria-label={`${label} (0 to 100)`} onChange={e => place(k === "x" ? Number(e.target.value) : at.x, k === "y" ? Number(e.target.value) : at.y)} className="flex-1 min-w-0 h-9 accent-[#7D5CEF]" />
                  <span className="w-8 text-right tabular-nums text-[#17151F]">{at[k]}</span>
                </label>
              ))}
              <p className="text-xs text-[#6B6680]">0 touches one edge, 100 the other.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
