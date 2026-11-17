"use client";

/**
 * A face gallery's settings, built like the studio's own Settings screen:
 * a list of sections with coloured tiles on the left, and on the right one section at a time as
 * grouped white cards of rows (label on the left, control on the right). Everything saves by itself.
 */
import { useEffect, useRef, useState } from "react";
import {
  CalendarClock, Check, ChevronRight, Megaphone, Download, Images, ImageUp, KeyRound, Loader2, Mail, MessageCircle, Minus, Plus, ScanFace, Send, Stamp, Trash2, TriangleAlert, Type,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { Tile } from "@/components/ui/apple";
import { Group, PaneHeader, Row, Segmented, SettingsCtx, Switch, TextArea, TextField, type SaveState } from "@/app/(app)/settings/_ui";
import { DEFAULT_GUEST_MESSAGE, errText, type FaceDetail, type FaceSettings } from "@/lib/face";
import { PhonePreview, type Screen } from "./phone-preview";

type Sec = "page" | "access" | "msgs" | "grow" | "photos" | "dl" | "match" | "mark" | "end";
type Save = (patch: Partial<FaceSettings>, extra?: { title?: string }) => Promise<void>;
type Pane = { id: Sec; title: string; sub: string; now: string; icon: React.ElementType; color: string };

const CARD = "bg-white rounded-[22px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]";
const pill = "h-10 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0]/50";

export function GallerySettings({ g, onSaved, onRemoved, onAct }: { g: FaceDetail; onSaved: (g: FaceDetail) => void; onRemoved: () => void; onAct: (a: "close" | "reopen") => void }) {
  const [s, setS] = useState<FaceSettings>(g.settings);
  const [sec, setSec] = useState<Sec>("page");
  /** The screen shown in the phone preview: follows the section, and the studio can pick another. */
  const [screen, setScreen] = useState<Screen>("land");
  /** Phones: the list of sections first, one section after a tap. */
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
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
    calm.current = setTimeout(() => setState("idle"), 2200);
  };

  const asks = !!s.register && s.register !== "off";
  const groups: { title: string; panes: Pane[] }[] = [
    { title: "Gallery", panes: [
      { id: "page", title: "General", sub: "The name guests see, a short note, and how long the gallery stays open.", now: s.expiresAt ? `Open until ${shortDay(s.expiresAt)}` : s.welcome ? "Name and note" : "Name", icon: Type, color: "violet" },
    ] },
    { title: "Guests", panes: [
      { id: "access", title: "Access and privacy", sub: "Who can open the photos, and what a guest must do first.", now: [s.pin ? "Code" : "", s.fullPin ? "All-photos code" : "", asks ? "Guest details" : ""].filter(Boolean).join(", ") || "Open to anyone with the link", icon: KeyRound, color: "teal" },
      { id: "msgs", title: "Messages to guests", sub: "How guests are told that their photos are ready, and what the message says.", now: !asks ? "Nobody to send to" : s.notifyEmail === false ? "WhatsApp by hand" : s.notifyWhen === "manual" ? "Email when I press" : "Email by itself", icon: Send, color: "blue" },
      { id: "grow", title: "Grow your studio", sub: "Ask guests to follow your pages, and let them share photos with your tag.", now: !(s.followFacebook || s.followInstagram) || (s.followWhen ?? "downloaded") === "off" ? (s.shareButton === false ? "Off" : "Share on") : FOLLOW_SHORT[s.followWhen ?? "downloaded"], icon: Megaphone, color: "orchid" },
    ] },
    { title: "Photos", panes: [
      { id: "photos", title: "Photos guests get", sub: "Which photos a guest sees.", now: s.guestsSee === "all" ? "All photos" : "Only their own", icon: Images, color: "green" },
      { id: "dl", title: "Downloads", sub: "Whether guests can save photos, one by one or many at once.", now: !s.downloads ? "Off" : s.downloadAll === false ? "One by one" : "One by one and all at once", icon: Download, color: "ink" },
      { id: "match", title: "Face matching", sub: "How sure the match must be before a photo is shown to a guest.", now: { strict: "Strict", balanced: "Balanced", loose: "Loose" }[s.strictness], icon: ScanFace, color: "deep" },
      { id: "mark", title: "Watermark", sub: "Your logo or name on every photo guests see or save.", now: s.watermark ? (s.watermarkKind === "logo" && s.watermarkLogo ? "Your logo" : "Text") : "Off", icon: Stamp, color: "orchid" },
    ] },
    { title: "Danger zone", panes: [
      { id: "end", title: "Close or remove", sub: "Stop this gallery for a while, or take it away.", now: g.status === "closed" ? "Closed" : "Open", icon: TriangleAlert, color: "red" },
    ] },
  ];
  const cur = groups.flatMap(x => x.panes).find(x => x.id === sec)!;
  const SCREEN_OF: Record<Sec, Screen> = { page: "land", access: "register", msgs: "wait", grow: "follow", photos: "results", dl: "results", match: "results", mark: "results", end: "land" };
  const go = (id: Sec) => { setSec(id); setOpen(true); setScreen(SCREEN_OF[id]); };

  return (
    <SettingsCtx.Provider value={{ data: {}, patch: async () => false, state, studio: null, patchStudio: async () => false }}>
      <div className="md:grid md:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[252px_minmax(0,1fr)_258px] md:gap-6 md:items-start">
        {/* Wide screens: the sections, always in view */}
        <aside className={cn("hidden md:block sticky top-[68px] sp-glass p-2 pb-3", CARD)}>
          <nav aria-label="Gallery settings sections">
            {groups.map(gr => (
              <div key={gr.title} className="mt-3 first:mt-1">
                <p className="px-2.5 mb-1 text-xs font-bold text-[#6B6680]">{gr.title}</p>
                {gr.panes.map(p => {
                  const on = p.id === sec;
                  return (
                    <button key={p.id} type="button" onClick={() => go(p.id)} aria-current={on ? "page" : undefined}
                      className={cn("w-full min-h-[48px] px-2.5 py-1.5 rounded-[12px] flex items-center gap-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0]/50", on ? "bg-[#EEE8FD]" : "hover:bg-[#F5F3FA]")}>
                      <Tile icon={p.icon} color={p.color} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm truncate", on ? "font-bold text-[#5B3FD0]" : "font-medium text-[#17151F]")}>{p.title}</span>
                        <span className="block text-[11.5px] text-[#6B6680] truncate">{p.now}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Phones: the list of sections */}
        <div className={cn("md:hidden", open && "hidden")}>
          {groups.map(gr => (
            <section key={gr.title} className="mb-6">
              <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">{gr.title}</h2>
              <div className={cn("overflow-hidden", CARD, "rounded-[20px]")}>
                {gr.panes.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => go(p.id)} className="w-full flex items-center gap-3 pl-4 pr-3 min-h-[60px] text-left active:bg-[#F5F3FA]">
                    <Tile icon={p.icon} color={p.color} size={30} />
                    <span className={cn("flex-1 min-w-0 py-3 flex items-center gap-2", i > 0 && "border-t border-[#EEEBF4]")}>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold text-[#17151F]">{p.title}</span>
                        <span className="block text-xs text-[#6B6680] truncate">{p.now}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* One section */}
        <div className={cn("min-w-0 w-full", !open && "hidden md:block")}>
          <div key={sec} className="sp-pane-in">
            <PaneHeader icon={cur.icon} color={cur.color} title={cur.title} sub={cur.sub} onBack={() => setOpen(false)} />
            {sec === "page" && <PageSec g={g} s={s} save={save} go={go} />}
            {sec === "access" && <AccessSec s={s} save={save} />}
            {sec === "grow" && <GrowSec s={s} save={save} />}
            {sec === "msgs" && <MsgSec g={g} s={s} save={save} toAccess={() => go("access")} />}
            {sec === "photos" && <PhotosSec s={s} save={save} />}
            {sec === "dl" && <DownloadsSec s={s} save={save} />}
            {sec === "match" && <MatchSec s={s} save={save} />}
            {sec === "mark" && <MarkSec s={s} save={save} />}
            {sec === "end" && <EndSec g={g} onAct={onAct} onRemoved={onRemoved} />}
          </div>
        </div>
        <PhonePreview g={g} s={s} screen={screen} onScreen={setScreen} />
      </div>
    </SettingsCtx.Provider>
  );
}

const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Saves a dragged or typed value a moment after the last change. */
type Ask = "hide" | "optional" | "required";
const ASK: { value: Ask; label: string }[] = [{ value: "hide", label: "Off" }, { value: "optional", label: "Optional" }, { value: "required", label: "Required" }];

function useLater() {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (fn: () => void, ms = 700) => { if (t.current) clearTimeout(t.current); t.current = setTimeout(fn, ms); };
}

// ─── Guest page ──────────────────────────────────────────────────────────────

/**
 * Before publishing: how to collect guests at the event and send them their photos later, as a checklist
 * that ticks itself from the settings.
 */
function EventGuide({ g, s, go }: { g: FaceDetail; s: FaceSettings; go: (id: Sec) => void }) {
  const asks = (s.register ?? "off") !== "off" && (s.askName !== "hide" || s.askPhone !== "hide" || s.askEmail !== "hide");
  const mail = s.askEmail !== "hide" && s.notifyEmail !== false && (s.notifyWhen ?? "auto") === "auto";
  const steps: { done?: boolean; title: string; text: string; act?: { label: string; go: Sec } }[] = [
    { done: asks, title: "Ask guests for their details", text: "So guests can sign up now. Access and privacy → Guest details: Must give, or Ask, can skip.", act: asks ? undefined : { label: "Set it", go: "access" } },
    { done: mail, title: "Let the emails go by themselves", text: "Guests who give an email get their link the moment their photos are ready. Others are listed in Guests for WhatsApp.", act: mail ? undefined : { label: "Set it", go: s.askEmail === "hide" ? "access" : "msgs" } },
    { title: "Print the Guests QR", text: "Share tab → Guests → QR code or poster. Put it on a banner or table cards at the event." },
    { done: g.status === "draft", title: "Keep the gallery unpublished", text: "At the event guests scan, take a selfie and give their details. They see \"You are on the list\" and no photos yet." },
    { title: "When the photos are ready", text: "Add the edited photos, wait until Photos shows they are all read, then press Publish. Every signed-up guest gets their own photos." },
  ];
  return (
    <section aria-label="Collect guests at the event" className="mb-7 rounded-[20px] bg-white overflow-hidden shadow-[0_1px_2px_rgba(23,21,31,.04),0_10px_30px_-18px_rgba(40,28,96,.18)]">
      <div className="px-4 sm:px-5 pt-4 pb-3 bg-[#F4F0FF]">
        <h2 className="text-[15px] font-bold text-[#17151F]">Taking photos now, sending them later?</h2>
        <p className="text-[13px] leading-snug text-[#4A4658] mt-0.5">Guests can sign up at the event and get their photos when you publish. Follow these steps. The phone preview shows what guests see.</p>
      </div>
      <ol className="divide-y divide-[#EEEBF4]">
        {steps.map((x, i) => (
          <li key={x.title} className="px-4 sm:px-5 py-3 flex items-start gap-3">
            <span aria-hidden className={cn("mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold", x.done ? "bg-[#1F8A5B] text-white" : "bg-[#EEE8FD] text-[#4B32B8]")}>
              {x.done ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#17151F]">{x.title}{x.done && <span className="sr-only"> (done)</span>}</p>
              <p className="text-[12.5px] leading-snug text-[#6B6680]">{x.text}</p>
            </div>
            {x.act && <button type="button" onClick={() => go(x.act!.go)} className="h-9 px-3.5 rounded-full bg-[#17151F] text-white text-[12.5px] font-semibold flex-shrink-0">{x.act.label}</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PageSec({ g, s, save, go }: { g: FaceDetail; s: FaceSettings; save: Save; go: (id: Sec) => void }) {
  return (
    <>
    {g.status === "draft" && <EventGuide g={g} s={s} go={go} />}
    <Group title="First screen" note="Guests see these when they scan the code or open the link.">
      <Row label="Name guests see" hint="The big line on the first screen and on the QR poster.">
        <TextField label="Name guests see" value={g.title} maxLength={150} onCommit={v => { if (v) void save({}, { title: v }); }} />
      </Row>
      <Row stack label="Short note" hint="One line under the name. Leave it empty for none.">
        <TextArea label="Short note" value={s.welcome} rows={2} maxLength={300} placeholder="Thank you for celebrating with us" onCommit={v => save({ welcome: v })} />
      </Row>
      <Row label="Language" hint="The guest page and the emails to guests. A guest can still switch on the first screen. Your own note and message stay as you wrote them.">
        <Segmented<"en" | "bn"> label="Guest page language" value={s.language ?? "en"} onChange={v => save({ language: v })} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
      </Row>
    </Group>
    <Group title="How long it stays open" note={"After the last day guests read \"This gallery is closed\". Nothing is deleted: you can open it again and pick a later day."}>
      <Row label={<span className="inline-flex items-center gap-2"><CalendarClock className="w-4 h-4 text-[#5B3FD0]" aria-hidden />Last open day</span>}
        hint={s.expiresAt ? `The gallery closes by itself after ${shortDay(s.expiresAt)}.` : "No end. The gallery stays open until you close it."}>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input type="date" aria-label="Last open day" value={s.expiresAt ?? ""} min={new Date().toISOString().slice(0, 10)} onChange={e => save({ expiresAt: e.target.value })}
            className="h-10 px-4 rounded-full bg-[#F5F3FA] text-sm font-semibold text-[#17151F] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
          {s.expiresAt && <button type="button" onClick={() => save({ expiresAt: "" })} className={cn(pill, "bg-[#F5F3FA] text-[#17151F]")}>No end</button>}
        </div>
      </Row>
    </Group>
    </>
  );
}

// ─── Access ──────────────────────────────────────────────────────────────────

function AccessSec({ s, save }: { s: FaceSettings; save: Save }) {
  const [pin, setPin] = useState(s.pin);
  const [full, setFull] = useState(s.fullPin ?? "");
  const later = useLater();
  const reg = s.register ?? "off";
  const phoneAsk: Ask = s.askPhone ?? "optional", mailAsk: Ask = s.askEmail ?? "optional", nameAsk: Ask = s.askName ?? "required";
  const oneOf = s.contactOne ?? true;
  // One plain sentence with the form as guests will get it.
  const summary = (() => {
    if (nameAsk === "hide" && phoneAsk === "hide" && mailAsk === "hide") return "Every field is off, so guests are not asked anything.";
    const part = (label: string, a: Ask) => (a === "hide" ? "" : a === "required" ? `${label} (required)` : `${label} (optional)`);
    const contact = phoneAsk === "optional" && mailAsk === "optional" && oneOf ? "WhatsApp or Email (one of the two, or both)" : [part("WhatsApp", phoneAsk), part("Email", mailAsk)].filter(Boolean).join(", ");
    const all = [part("Name", nameAsk), contact].filter(Boolean).join(", ");
    return `${all}. ${reg === "required" ? "Asked before the photos open." : "Asked after the selfie; guests can press Not now."}`;
  })();
  const same = full.length === 4 && full === pin;
  /** A new code that is not the other one. */
  const fresh = (other: string) => { let v = ""; do { v = String(Math.floor(1000 + Math.random() * 9000)); } while (v === other); return v; };
  return (
    <>
      <Group title="Codes" note="The guests' code can be printed on the poster (Share). Keep the all-photos code for the couple and family only.">
        <Row label="Guests' code" hint={pin.length === 4 ? "On. Guests type it before the selfie." : pin.length ? "Type all 4 digits." : "Off. Anyone with the link can take a selfie."}>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input aria-label="4-digit code" inputMode="numeric" maxLength={4} placeholder="Off" value={pin}
              onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); if (v.length === 4 || v === "") later(() => save({ pin: v }), 400); }}
              className="h-10 w-[112px] rounded-full bg-[#F5F3FA] text-center text-[16px] font-bold tabular-nums tracking-[0.35em] text-[#17151F] placeholder:tracking-normal placeholder:font-semibold placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
            <button type="button" onClick={() => { const v = fresh(full); setPin(v); void save({ pin: v }); }} className={cn(pill, "bg-[#F5F3FA] text-[#17151F]")}>Make one</button>
            {pin.length === 4 && <button type="button" onClick={() => { setPin(""); void save({ pin: "" }); }} className={cn(pill, "bg-[#F5F3FA] text-[#A82743]")}>Turn off</button>}
          </div>
        </Row>
        <Row label="All-photos code" hint={same ? "This must be different from the guests' code." : full.length === 4 ? "On. Whoever types this code sees every photo, not only their own." : full.length ? "Type all 4 digits." : "Off. For the couple and family: one code that opens every photo."}>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input aria-label="All-photos code" inputMode="numeric" maxLength={4} placeholder="Off" value={full} aria-invalid={same}
              onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setFull(v); if ((v.length === 4 && v !== pin) || v === "") later(() => save({ fullPin: v }), 400); }}
              className={cn("h-10 w-[112px] rounded-full bg-[#F5F3FA] text-center text-[16px] font-bold tabular-nums tracking-[0.35em] text-[#17151F] placeholder:tracking-normal placeholder:font-semibold placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40", same && "ring-2 ring-[#C2304F]/60")} />
            <button type="button" onClick={() => { const v = fresh(pin); setFull(v); void save({ fullPin: v }); }} className={cn(pill, "bg-[#F5F3FA] text-[#17151F]")}>Make one</button>
            {full.length === 4 && <button type="button" onClick={() => { setFull(""); void save({ fullPin: "" }); }} className={cn(pill, "bg-[#F5F3FA] text-[#A82743]")}>Turn off</button>}
          </div>
        </Row>
      </Group>

      <Group title="Guest details" note="You see the answers in Guests, and can send every guest their photos from there.">
        <Row stack label="Ask guests for their details"
          hint={{
            off: "Nothing is asked. Photos open right after the selfie. Guests can't sign up before you publish, and nobody can be told about new photos.",
            optional: "After the selfie guests see the form, and can press \"Not now\". Before you publish, the form is a must: that is how they sign up.",
            required: "Guests fill in the form before any photo opens. Before you publish, guests sign up with a selfie and their details, and get their link when you publish.",
          }[reg]}>
          <Segmented<"off" | "optional" | "required"> label="Ask guests for their details" value={reg} onChange={v => save({ register: v })}
            options={[{ value: "off", label: "Don't ask" }, { value: "optional", label: "Ask, can skip" }, { value: "required", label: "Must give" }]} />
        </Row>
        {reg !== "off" && <>
          <Row label="Name" hint={nameAsk === "hide" ? "Not asked." : nameAsk === "optional" ? "Guests can leave it empty." : "Guests must type it."}>
            <Segmented<Ask> label="Name" value={nameAsk} onChange={v => save({ askName: v })} options={ASK} />
          </Row>
          <Row label="WhatsApp number" hint={phoneAsk === "hide" ? "Not asked." : phoneAsk === "optional" ? "Guests can leave it empty." : "Guests must give it."}>
            <Segmented<Ask> label="WhatsApp number" value={phoneAsk} onChange={v => save({ askPhone: v })} options={ASK} />
          </Row>
          <Row label="Email" hint={mailAsk === "hide" ? "Not asked." : mailAsk === "optional" ? "Guests can leave it empty. Guests with an email get their photos by themselves." : "Guests must give it. They get their photos by email by themselves."}>
            <Segmented<Ask> label="Email" value={mailAsk} onChange={v => save({ askEmail: v })} options={ASK} />
          </Row>
          {phoneAsk === "optional" && mailAsk === "optional" && (
            <Row label="One of WhatsApp or Email is needed" hint={oneOf ? "On. Guests give one of the two, or both." : "Off. Guests can leave both empty."}>
              <Switch label="One of WhatsApp or Email is needed" on={oneOf} onChange={v => save({ contactOne: v })} />
            </Row>
          )}
          <div className="px-4 py-3.5 bg-[#F7F5FB]" role="status">
            <p className="text-[12px] font-bold text-[#4A4658] mb-1">What guests see</p>
            <p className="text-[13.5px] leading-snug text-[#17151F]">{summary}</p>
          </div>
        </>}
      </Group>

    </>
  );
}

// ─── Photos guests get ───────────────────────────────────────────────────────

function PhotosSec({ s, save }: { s: FaceSettings; save: Save }) {
  return (
    <Group title="What a guest gets">
      <Row label="Guests see" hint={s.guestsSee === "all" ? "Their own photos first, then every other photo of the event." : "Only the photos their face is in. Best for privacy."}>
        <Segmented<"own" | "all"> label="Guests see" value={s.guestsSee} onChange={v => save({ guestsSee: v })} options={[{ value: "own", label: "Only their own" }, { value: "all", label: "All photos" }]} />
      </Row>
      <Row label="Highlights for everyone" hint="Photos you mark as Highlights (the couple, the stage, the venue) are shown to every guest.">
        <Switch label="Highlights for everyone" on={s.highlightsForAll} onChange={v => save({ highlightsForAll: v })} />
      </Row>
    </Group>
  );
}

// ─── Downloads ───────────────────────────────────────────────────────────────

function DownloadsSec({ s, save }: { s: FaceSettings; save: Save }) {
  return (
    <Group title="Saving photos" note={s.watermark ? "With the watermark on, guests save a copy with your mark on it (up to 2560 px wide)." : "Guests save your original files from Google Drive."}>
      <Row label="Guests can download" hint="Off means guests can look at their photos but get no Download button.">
        <Switch label="Guests can download" on={s.downloads} onChange={v => save({ downloads: v })} />
      </Row>
      <Row label="Many at once" hint={"\"Download all\" and \"Choose\" on the guest's photos. Off means one photo at a time, from the opened photo."} disabled={!s.downloads}>
        <Switch label="Many at once" on={s.downloads && s.downloadAll !== false} disabled={!s.downloads} onChange={v => save({ downloadAll: v })} />
      </Row>
    </Group>
  );
}

// ─── Face matching ───────────────────────────────────────────────────────────

function MatchSec({ s, save }: { s: FaceSettings; save: Save }) {
  return (
    <Group title="How strict" note="You can change this any time. It works at once, also for photos already added, and costs nothing.">
      <Row label={{ strict: "Strict", balanced: "Balanced", loose: "Loose" }[s.strictness]}
        hint={{ strict: "Fewest wrong photos. A guest may miss a few of their own.", balanced: "Best for most events.", loose: "Finds more photos. A similar face may slip in now and then." }[s.strictness]}>
        <Segmented<FaceSettings["strictness"]> label="How strict" value={s.strictness} onChange={v => save({ strictness: v })}
          options={[{ value: "strict", label: "Strict" }, { value: "balanced", label: "Balanced" }, { value: "loose", label: "Loose" }]} />
      </Row>
    </Group>
  );
}

// ─── Messages to guests ──────────────────────────────────────────────────────

/** Fills the blanks of a message with sample values, to show what a guest will read. */
function sampleMessage(t: string, event: string, studio: string) {
  const body = (t.trim() || DEFAULT_GUEST_MESSAGE).replace(/\{name\}/gi, "Guest").replace(/\{event\}/gi, event).replace(/\{studio\}/gi, studio).replace(/\{count\}/gi, "12 photos");
  const link = "app.stupanel.com/f/…";
  return /\{link\}/i.test(t.trim() || DEFAULT_GUEST_MESSAGE) ? body.replace(/\{link\}/gi, link) : `${body}\n${link}`;
}

type FollowWhen = NonNullable<FaceSettings["followWhen"]>;
const FOLLOW_SHORT: Record<FollowWhen, string> = { off: "Follow off", before: "Follow before photos", results: "Follow when photos appear", open: "Follow on opening a photo", download: "Follow on Download", downloaded: "Follow after a download" };
const MOMENTS: { v: FollowWhen; title: string; text: string; tag?: string }[] = [
  { v: "downloaded", title: "After a download", text: "The guest has their photo, then a card asks to follow. The happiest moment, so the most follows and no annoyance.", tag: "Best" },
  { v: "results", title: "When the photos appear", text: "A moment after the guest sees their photos, the card slides up over them." },
  { v: "open", title: "When a photo is opened", text: "The card comes up over the first photo the guest opens." },
  { v: "download", title: "When Download is pressed", text: "The card comes first; the photo saves from the card's button." },
  { v: "before", title: "Before the photos", text: "A whole screen before the photos open. Guests see it first, but some find it annoying." },
  { v: "off", title: "Don't ask", text: "No follow card. The Share button still works if it is on." },
];

/** Marketing: when guests are asked to follow the studio, the words, and sharing with the studio's tag. */
function GrowSec({ s, save }: { s: FaceSettings; save: Save }) {
  const when: FollowWhen = s.followWhen ?? "downloaded";
  const pages = !!(s.followFacebook || s.followInstagram);
  const holds = when === "before" || when === "download";
  const handle = (() => { try { return s.followInstagram ? new URL(s.followInstagram).pathname.split("/").filter(Boolean)[0] ?? "" : ""; } catch { return ""; } })();
  return (
    <>
      <Group title="Your pages" note="Instagram is shown first. On a phone the link opens the Instagram or Facebook app. We can't see whether a guest really followed: the card thanks them when they come back.">
        <Row label="Instagram">
          <TextField label="Instagram" value={s.followInstagram ?? ""} maxLength={200} placeholder="instagram.com/yourstudio" onCommit={v => save({ followInstagram: v })} />
        </Row>
        <Row label="Facebook page">
          <TextField label="Facebook page" value={s.followFacebook ?? ""} maxLength={200} placeholder="facebook.com/yourstudio" onCommit={v => save({ followFacebook: v })} />
        </Row>
      </Group>

      <Group title="When to ask guests to follow" note={pages ? "Each guest is asked once. After they open your page they are never asked again on that phone." : "Add a page above first."}>
        <div role="radiogroup" aria-label="When to ask guests to follow" className="p-2 grid gap-1.5">
          {MOMENTS.map(m => {
            const on = when === m.v;
            return (
              <button key={m.v} type="button" role="radio" aria-checked={on} disabled={!pages && m.v !== "off"} onClick={() => save({ followWhen: m.v })}
                className={cn("w-full text-left rounded-[16px] px-3.5 py-3 flex items-start gap-3 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0]/50", on ? "bg-[#EEE8FD] ring-2 ring-[#7D5CEF]" : "hover:bg-[#F7F5FB]")}>
                <span aria-hidden className={cn("mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors", on ? "bg-[#7D5CEF] border-[#7D5CEF] text-white" : "border-[#CFC9DC]")}>{on && <Check className="w-3 h-3" strokeWidth={3.5} />}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("text-[14px] font-semibold flex items-center gap-2", on ? "text-[#4B32B8]" : "text-[#17151F]")}>{m.title}{m.tag && <span className="text-[10.5px] font-bold text-[#0B7A47] bg-[#E6F6EE] rounded-full px-2 py-0.5">{m.tag}</span>}</span>
                  <span className="block text-[12.5px] leading-snug text-[#6B6680] mt-0.5">{m.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {pages && when !== "off" && (
        <Group title="Rules">
          <Row label="Guests can skip" hint={holds
            ? (s.followSkip === false ? (when === "before" ? "Off. The photos open only after a page was opened." : "Off. The download goes on only after a page was opened.") : "On. The card has \"Not now\" (or \"Skip and download\").")
            : "This moment never holds anything back, so guests can always close the card."}>
            <Switch label="Guests can skip" on={s.followSkip !== false || !holds} disabled={!holds} onChange={v => save({ followSkip: v })} />
          </Row>
          <Row label="Ask again on a later visit" hint={s.followAgain === false ? "Off. A guest who pressed Not now is not asked again on that phone." : "On. A guest who pressed Not now is asked once more when they come back."}>
            <Switch label="Ask again on a later visit" on={s.followAgain !== false} onChange={v => save({ followAgain: v })} />
          </Row>
        </Group>
      )}

      {pages && when !== "off" && (
        <Group title="The words on the card" note="Leave empty for the usual words. The guest page language decides the usual words; yours stay as you write them.">
          <Row stack label="Title">
            <TextField label="Card title" value={s.followTitle ?? ""} maxLength={80} placeholder="Enjoying your photos?" onCommit={v => save({ followTitle: v })} />
          </Row>
          <Row stack label="Text">
            <TextArea label="Card text" value={s.followText ?? ""} rows={2} maxLength={200} placeholder="Follow us to see more of our work." onCommit={v => save({ followText: v })} />
          </Row>
        </Group>
      )}

      <Group title="Share with your tag" note="Instagram does not let apps add text to a post, so the caption is copied and the guest pastes it. With the watermark on, your name is on every shared photo too.">
        <Row label="Share button" hint={s.shareButton === false ? "Off." : "On. In the opened photo, next to Download (phones and tablets)."}>
          <Switch label="Share button" on={s.shareButton !== false} onChange={v => save({ shareButton: v })} />
        </Row>
        {s.shareButton !== false && (
          <Row stack label="Caption" hint={<>Leave empty for &quot;📸 Photo by {handle ? `@${handle}` : "your studio name"}&quot;. You can use {"{handle}"}, {"{studio}"} and {"{event}"}.</>}>
            <TextField label="Share caption" value={s.shareCaption ?? ""} maxLength={200} placeholder={`📸 Photo by ${handle ? `@${handle}` : "{studio}"}`} onCommit={v => save({ shareCaption: v })} />
          </Row>
        )}
      </Group>
    </>
  );
}

function MsgSec({ g, s, save, toAccess }: { g: FaceDetail; s: FaceSettings; save: Save; toAccess: () => void }) {
  const [msg, setMsg] = useState(s.message ?? "");
  const box = useRef<HTMLTextAreaElement>(null);
  const later = useLater();
  const asks = !!s.register && s.register !== "off";
  const set = (v: string) => { setMsg(v); later(() => save({ message: v })); };
  /** Put a blank where the cursor is. */
  const add = (word: string) => {
    const el = box.current; const base = msg || DEFAULT_GUEST_MESSAGE;
    const pos = msg && el ? el.selectionStart : base.length; const next = `${base.slice(0, pos)}${word}${base.slice(pos)}`.slice(0, 400);
    set(next); requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + word.length, pos + word.length); });
  };
  return (
    <>
      {!asks && (
        <div className="mb-7 rounded-[20px] bg-[#FFF3E0] px-4 sm:px-5 py-4 text-[14px] text-[#6B4100] flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1"><b>There is nobody to send to yet.</b> Guests are not asked for a number or an email. Ask for it, and every guest can be told when their photos are ready.</p>
          <button type="button" onClick={toAccess} className={cn(pill, "bg-[#17151F] text-white")}>Open Access</button>
        </div>
      )}

      <Group title="Email" note="StuPanel sends it. The email has a button that opens the guest's own photos, with no selfie and no code.">
        <Row label={<span className="inline-flex items-center gap-2"><Mail className="w-4 h-4 text-[#1F5C99]" aria-hidden />Email guests their photos</span>} hint="For guests who gave an email. Off means no guest is emailed.">
          <Switch label="Email guests their photos" on={s.notifyEmail !== false} onChange={v => save({ notifyEmail: v })} />
        </Row>
        {s.notifyEmail !== false && (
          <Row label="When the emails go" hint={s.notifyWhen === "manual" ? "Only when you press \"Check for new photos\" in Guests." : "When you publish, and again when new photos of a guest are added."}>
            <Segmented<"auto" | "manual"> label="When the emails go" value={s.notifyWhen ?? "auto"} onChange={v => save({ notifyWhen: v })} options={[{ value: "auto", label: "By themselves" }, { value: "manual", label: "When I press" }]} />
          </Row>
        )}
      </Group>

      <Group title="WhatsApp, from your own number" note="WhatsApp messages that go by themselves will come later as a paid extra.">
        <Row label={<span className="inline-flex items-center gap-2"><MessageCircle className="w-4 h-4 text-[#176B47]" aria-hidden />You send it from Guests</span>}
          hint="Press Send for each guest: your WhatsApp opens with the message below and the guest's own link already written." />
        <Row stack label="The message" hint="The blanks are filled in for each guest. The link is always added, even if you take it out.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] items-start">
            <div>
              <textarea ref={box} aria-label="Message" rows={4} maxLength={400} placeholder={DEFAULT_GUEST_MESSAGE} value={msg} onChange={e => set(e.target.value)}
                className="w-full px-4 py-3 rounded-[16px] bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#9893A8] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40 resize-y min-h-[112px]" />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-xs font-semibold text-[#6B6680] mr-1">Add a blank:</span>
                {[["{name}", "Guest's name"], ["{event}", "Event"], ["{count}", "Number of photos"], ["{studio}", "Your studio"], ["{link}", "Their link"]].map(([w, label]) => (
                  <button key={w} type="button" onClick={() => add(w)} className="h-8 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEE8FD] text-xs font-bold text-[#17151F]">{label}</button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-[#6B6680] tabular-nums">{msg.length}/400</p>
                {msg && <button type="button" onClick={() => { setMsg(""); void save({ message: "" }); }} className="text-xs font-bold text-[#5B3FD0] hover:underline">Use the usual message</button>}
              </div>
            </div>
            <div aria-label="What the guest reads" className="rounded-[18px] bg-[#EDE8E1] p-3">
              <p className="text-[11.5px] font-semibold text-[#6B6680] text-center mb-2">What the guest reads</p>
              <p className="rounded-[14px] rounded-tr-[5px] bg-[#DCF7C5] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#17151F] whitespace-pre-wrap [overflow-wrap:anywhere] shadow-[0_1px_1px_rgba(0,0,0,.08)]">{sampleMessage(msg, g.title, "your studio")}</p>
            </div>
          </div>
        </Row>
      </Group>
    </>
  );
}

// ─── Close or remove ─────────────────────────────────────────────────────────

function EndSec({ g, onAct, onRemoved }: { g: FaceDetail; onAct: (a: "close" | "reopen") => void; onRemoved: () => void }) {
  async function remove() {
    if (!(await askConfirm({ title: "Remove this gallery?", message: "Guests can't open the link any more and the face data is deleted. Your photos stay on Google Drive. Credits already used are not given back.", confirmLabel: "Remove gallery", danger: true }))) return;
    const r = await apiFetch(`${API}/face-search/${g.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return notify("Could not remove the gallery. Please try again.", { error: true });
    notify("Gallery removed"); onRemoved();
  }
  return (
    <>
      <Group title="Pause">
        <Row label={g.status === "closed" ? "This gallery is closed" : "Close this gallery"} hint={"Guests read \"This gallery is closed\". Nothing is deleted and you can open it again."}>
          <button type="button" onClick={() => onAct(g.status === "closed" ? "reopen" : "close")} className={cn(pill, "bg-[#F5F3FA] text-[#17151F]")}>{g.status === "closed" ? "Open again" : "Close gallery"}</button>
        </Row>
      </Group>
      <Group title="Remove" note="This can't be undone.">
        <Row label="Remove this gallery" hint="The link stops working and the face data is deleted. Photos stay on Drive.">
          <button type="button" onClick={remove} className={cn(pill, "bg-[#FDECEF] text-[#A82743]")}><Trash2 className="w-4 h-4" />Remove gallery</button>
        </Row>
      </Group>
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

/** A number with a slider, − / + for one step, and a box to type in. */
function Dial({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v))));
  const btn = "w-10 h-10 rounded-full bg-[#F5F3FA] text-[#17151F] flex items-center justify-center flex-shrink-0 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0]/50";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} aria-label={`${label}: less`} disabled={value <= min} onClick={() => set(value - 1)}><Minus className="w-4 h-4" /></button>
      <input type="range" aria-label={label} min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} className="flex-1 min-w-0 h-10 accent-[#7D5CEF]" />
      <button type="button" className={btn} aria-label={`${label}: more`} disabled={value >= max} onClick={() => set(value + 1)}><Plus className="w-4 h-4" /></button>
      <span className="relative flex-shrink-0">
        <input type="number" aria-label={`${label} as a number`} min={min} max={max} value={value} onChange={e => { if (e.target.value !== "") set(Number(e.target.value)); }}
          className="w-[78px] h-10 rounded-full bg-[#F5F3FA] pl-3 pr-8 text-right text-sm font-bold tabular-nums text-[#17151F] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#6B6680] pointer-events-none">%</span>
      </span>
    </div>
  );
}

type Backdrop = "mixed" | "dark" | "light";
/**
 * A sample picture for the preview: no people, no real photo. "Mixed" runs from dark to bright with soft shapes,
 * so a white logo, a black logo and a coloured one can all be judged on it.
 */
function Sample({ kind }: { kind: Backdrop }) {
  if (kind === "dark") return <span aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#3B3350_0%,#17151F_100%)]" />;
  if (kind === "light") return <span aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#FFFFFF_0%,#E9E5F1_100%)]" />;
  return (
    <svg aria-hidden viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
      <defs>
        <linearGradient id="fs-sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F6E7D4" /><stop offset=".45" stopColor="#C9B6DC" /><stop offset="1" stopColor="#2B2540" /></linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#fs-sky)" />
      <circle cx="78" cy="84" r="34" fill="#FFF6E6" opacity=".9" />
      <path d="M0 210 Q60 150 130 196 T300 170 V300 H0Z" fill="#6C5A8E" opacity=".75" />
      <path d="M0 250 Q90 200 170 240 T300 222 V300 H0Z" fill="#241F36" />
    </svg>
  );
}

function MarkSec({ s, save }: { s: FaceSettings; save: Save }) {
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
      <Group note="Off is best: export your photos with your own watermark, and guests get them fast and sharp.">
        <Row label="Watermark on guest photos" hint="Your logo or name is put on every photo a guest sees or saves.">
          <Switch label="Watermark on guest photos" on={!!s.watermark} onChange={turn} />
        </Row>
      </Group>
      {s.watermark && <MarkEditor s={s} save={save} />}
    </>
  );
}

function MarkEditor({ s, save }: { s: FaceSettings; save: Save }) {
  const start = s.watermarkX != null && s.watermarkY != null ? { x: s.watermarkX, y: s.watermarkY } : fromPos(s.watermarkPos);
  const [kind, setKind] = useState<"text" | "logo">(s.watermarkKind ?? "text");
  const [logo, setLogo] = useState(s.watermarkLogo ?? "");
  const [at, setAt] = useState(start);
  const [size, setSize] = useState(s.watermarkSize ?? 18);
  const [opacity, setOpacity] = useState(s.watermarkOpacity ?? 100);
  const [back, setBack] = useState<Backdrop>("mixed");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const later = useLater();

  const place = (x: number, y: number, now = false) => {
    const p = { x: Math.min(100, Math.max(0, Math.round(x))), y: Math.min(100, Math.max(0, Math.round(y))) };
    setAt(p);
    if (now) void save({ watermarkX: p.x, watermarkY: p.y }); else later(() => save({ watermarkX: p.x, watermarkY: p.y }), 500);
  };

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
  const text = (s.watermarkText ?? "").trim() || "Your studio name";
  const frame = { at, size, opacity, back, useLogo, logo: tight?.src ?? logo, ar: tight?.ar ?? null, text, place };

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-6 xl:items-start">
      {/* The preview: one wide photo and one tall photo, so the mark is judged on both */}
      <section aria-label="Preview" className="mb-7 xl:order-2 xl:sticky xl:top-[68px]">
        <div className="px-1 mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold text-[#4A4658]">Preview</h2>
          <Segmented<Backdrop> label="Preview background" value={back} onChange={setBack} options={[{ value: "mixed", label: "Mixed" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
        </div>
        <div className={cn("p-3 flex xl:flex-col items-end xl:items-center justify-center gap-3", CARD, "rounded-[20px]")}>
          <Frame {...frame} ratio={3 / 2} label="Wide photo" className="w-[58%] xl:w-full max-w-[300px]" />
          <Frame {...frame} ratio={2 / 3} label="Tall photo" className="w-[26%] xl:w-[150px] max-w-[150px]" />
        </div>
        <p className="px-1 mt-2 text-xs text-[#6B6680] leading-relaxed">Sample pictures, not your photos. Drag the mark on either one to move it; both show the same place.</p>
      </section>

      <div className="min-w-0 xl:order-1">
        <Group title="The mark">
          <Row label="Use">
            <Segmented<"logo" | "text"> label="Watermark kind" value={kind} onChange={v => { setKind(v); void save({ watermarkKind: v }); }} options={[{ value: "logo", label: "My logo" }, { value: "text", label: "Text" }]} />
          </Row>
          {kind === "logo" ? (
            <Row stack label="Logo" hint={logo ? "PNG or WebP with a see-through background, up to 2 MB." : "Upload a PNG or WebP with a see-through background (up to 2 MB). Until then the text is used."}>
              <div className="flex items-center gap-2">
                <span className="w-[72px] h-10 rounded-[12px] flex items-center justify-center overflow-hidden flex-shrink-0 bg-[repeating-conic-gradient(#8A8599_0_25%,#A29DB3_0_50%)] bg-[length:12px_12px]">
                  {logo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={tight?.src ?? logo} alt="Your watermark logo" className="max-w-full max-h-full object-contain p-1" />
                    : <ImageUp className="w-4 h-4 text-white" />}
                </span>
                <button type="button" onClick={() => file.current?.click()} disabled={busy} className={cn(pill, "bg-[#7D5CEF] text-white disabled:opacity-60")}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}{logo ? "Change" : "Upload"}
                </button>
                {logo && <button type="button" aria-label="Remove logo" onClick={() => { setLogo(""); setKind("text"); void save({ watermarkLogo: "", watermarkKind: "text" }); }} className="w-10 h-10 rounded-full bg-[#F5F3FA] text-[#A82743] flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
                <input ref={file} type="file" accept="image/png,image/webp" className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            </Row>
          ) : (
            <Row label="Text" hint="Leave it empty to use your studio name.">
              <TextField label="Watermark text" value={s.watermarkText ?? ""} maxLength={40} placeholder="Your studio name" onCommit={v => save({ watermarkText: v })} />
            </Row>
          )}
        </Group>

        <Group title="Size and strength" note={useLogo && tight && size > 40 * tight.ar ? "This logo is tall, so on a wide photo it stops growing at 60% of the photo's height." : undefined}>
          <Row stack label="Size" hint="The mark's width as a share of the photo's width.">
            <Dial label="Size" value={size} min={3} max={80} onChange={v => { setSize(v); later(() => save({ watermarkSize: v }), 500); }} />
          </Row>
          <Row stack label="Strength" hint="100 is solid. Lower lets the photo show through.">
            <Dial label="Strength" value={opacity} min={5} max={100} onChange={v => { setOpacity(v); later(() => save({ watermarkOpacity: v }), 500); }} />
          </Row>
        </Group>

        <Group title="Place" note="Pick a corner, fine-tune with the two sliders, or drag the mark on the preview.">
          <Row stack label="Where it sits">
            <div className="flex gap-4 items-center flex-wrap">
              <div role="group" aria-label="Quick places" className="grid grid-cols-3 gap-1 w-[120px] p-1 rounded-[14px] bg-[#F5F3FA] flex-shrink-0">
                {SPOTS.map(p => {
                  const on = at.x === p.x && at.y === p.y;
                  return (
                    <button key={p.label} type="button" aria-pressed={on} aria-label={p.label} title={p.label} onClick={() => place(p.x, p.y, true)}
                      className={cn("h-9 rounded-[10px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0]/50", on ? "bg-[#7D5CEF]" : "bg-white hover:bg-[#EEE8FD]")}>
                      <span className={cn("w-2 h-2 rounded-full", on ? "bg-white" : "bg-[#C9C2DA]")} />
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                {([["x", "Across"], ["y", "Down"]] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-xs font-semibold text-[#6B6680]">
                    <span className="w-12">{label}</span>
                    <input type="range" min={0} max={100} value={at[k]} aria-label={`${label} (0 to 100)`} onChange={e => place(k === "x" ? Number(e.target.value) : at.x, k === "y" ? Number(e.target.value) : at.y)} className="flex-1 min-w-0 h-9 accent-[#7D5CEF]" />
                    <span className="w-8 text-right tabular-nums text-[#17151F]">{at[k]}</span>
                  </label>
                ))}
              </div>
            </div>
          </Row>
        </Group>
      </div>
    </div>
  );
}

/** One sample photo with the mark on it. The mark can be dragged, or moved with the arrow keys. */
function Frame({ ratio, label, className, at, size, opacity, back, useLogo, logo, ar, text, place }: {
  ratio: number; label: string; className?: string; at: { x: number; y: number }; size: number; opacity: number; back: Backdrop;
  useLogo: boolean; logo: string; ar: number | null; text: string; place: (x: number, y: number, now?: boolean) => void;
}) {
  const [drag, setDrag] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLElement>(null);
  /** The pointer is where the middle of the mark should be. */
  function follow(e: React.PointerEvent) {
    const b = box.current?.getBoundingClientRect(), m = mark.current?.getBoundingClientRect();
    if (!b || !m) return;
    const free = { w: Math.max(1, b.width - m.width), h: Math.max(1, b.height - m.height) };
    place(((e.clientX - b.left - m.width / 2) / free.w) * 100, ((e.clientY - b.top - m.height / 2) / free.h) * 100);
  }
  // Same sums as the server: the width is a share of the photo's width, and a logo is never taller than 60% of the photo.
  const maxH = 60 / ratio; // in % of the frame's width
  const logoW = ar ? Math.min(size, maxH * ar) : size;
  // left: X% with translate(-X%) puts the mark's left edge at X% of the free space, the same way the server places it.
  const pos: React.CSSProperties = { position: "absolute", left: `${at.x}%`, top: `${at.y}%`, transform: `translate(-${at.x}%, -${at.y}%)`, opacity: opacity / 100 };
  return (
    <figure className={cn("min-w-0", className)}>
      <div ref={box} tabIndex={0} role="application" aria-label={`${label}. Watermark position: ${at.x}% across, ${at.y}% down. Use the arrow keys to move it.`}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); follow(e); }}
        onPointerMove={e => { if (drag) follow(e); }}
        onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
        onKeyDown={e => { const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (k) { e.preventDefault(); const n = e.shiftKey ? 10 : 1; place(at.x + k[0] * n, at.y + k[1] * n); } }}
        className={cn("relative w-full rounded-[12px] overflow-hidden touch-none select-none ring-1 ring-black/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/50", drag ? "cursor-grabbing" : "cursor-grab")}
        style={{ aspectRatio: String(ratio), containerType: "inline-size" }}>
        <Sample kind={back} />
        {useLogo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img ref={mark as React.RefObject<HTMLImageElement>} src={logo} alt="" draggable={false} className="block pointer-events-none" style={{ ...pos, width: `${logoW}cqw`, height: ar ? `${logoW / ar}cqw` : "auto", maxHeight: `${maxH}cqw`, objectFit: "contain" }} />
          : <span ref={mark as React.RefObject<HTMLSpanElement>} className="font-bold text-white whitespace-nowrap leading-none pointer-events-none" style={{ ...pos, fontSize: `${(size * 0.1267).toFixed(2)}cqw`, textShadow: "0 0 .25cqw rgba(0,0,0,.7)" }}>{text}</span>}
        {drag && <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "33.333% 33.333%" }} />}
      </div>
      <figcaption className="mt-1.5 text-[11.5px] font-semibold text-[#6B6680] text-center">{label}</figcaption>
    </figure>
  );
}
