"use client";
/**
 * Website → Look → Make it yours: fonts, colour, background, corners, buttons, headings and logo on top of the
 * chosen look, so two studios with the same look still look different. Every box has "As the look".
 */
import { AlertTriangle, RotateCcw, Shuffle } from "lucide-react";
import { FormGroup } from "@/components/ui/form-kit";
import { cn } from "@/lib/utils";
import { ACCENTS, BACKGROUNDS, BUTTONS, CORNERS, FONT_PAIRS, HEADINGS, LOGOS, LOGO_SIZES, accentHex, contrast, randomStyle, textOn, type SiteStyle } from "@/lib/site-style";

/** All the font pairs at once, only for this panel's samples. */
const SAMPLE_FONTS = `https://fonts.googleapis.com/css2?${[...new Set(FONT_PAIRS.flatMap(p => p.q.split("&")))].join("&")}&display=swap`;

const chip = (on: boolean) => cn("rounded-[12px] border-2 px-3 py-2 text-left transition-colors min-h-[44px]", on ? "border-[#7D5CEF] bg-[#F5F3FA]" : "border-[#ECE9F2] hover:bg-[#F7F5FB]");

function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-[14px] font-semibold text-[#17151F]">{label}</p>
      {hint && <p className="text-[12px] text-[#6B6680] mt-0.5">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export function StylePanel({ value, allowed, onChange }: { value: SiteStyle | undefined; allowed: boolean; onChange: (s: SiteStyle) => void }) {
  const s: SiteStyle = value ?? {};
  const set = (k: keyof SiteStyle, v: string | undefined) => {
    const next = { ...s, [k]: v };
    if (!v) delete next[k];
    onChange(next);
  };
  const any = Object.keys(s).length > 0;
  const ac = accentHex(s);
  const bg = BACKGROUNDS.find(b => b.id === s.bg);
  const weak = ac && bg && contrast(ac, bg.vars["--bg"]) < 2.2;
  const asLook = (k: keyof SiteStyle) => (
    <button type="button" onClick={() => set(k, undefined)} aria-pressed={!s[k]} className={chip(!s[k])}>
      <span className="text-[13px] font-semibold text-[#4A4658]">As the look</span>
    </button>
  );

  return (
    <FormGroup title="Make it yours" note="Small changes on top of the look, so your website doesn't look like another studio's. Shown in the phone preview at once; visitors see it after you publish.">
      <link rel="stylesheet" href={SAMPLE_FONTS} />
      {!allowed && <p className="px-4 py-3 text-[13px] text-[#7A5410] bg-[#FFF8EA]">Your own fonts and colours are not part of your plan.</p>}
      <fieldset disabled={!allowed} className="contents">
        <div className="px-4 py-3.5 flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange(randomStyle(s))} className="h-11 px-4 rounded-[12px] bg-[#17151F] text-white text-sm font-semibold inline-flex items-center gap-2"><Shuffle className="w-4 h-4" />Make one for me</button>
          {any && <button type="button" onClick={() => onChange({})} className="h-11 px-4 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" />Back to the look</button>}
          <p className="basis-full text-[12px] text-[#6B6680]">&ldquo;Make one for me&rdquo; mixes the choices below. Press again for another.</p>
        </div>

        <Row label="Fonts" hint="Headings and text are chosen together so they always match.">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <button type="button" onClick={() => set("font", undefined)} aria-pressed={!s.font} className={chip(!s.font)}>
              <span className="block text-[18px] leading-tight text-[#17151F]">As the look</span>
              <span className="block text-[11px] text-[#6B6680] mt-1">The look&apos;s own fonts</span>
            </button>
            {FONT_PAIRS.map(p => (
              <button key={p.id} type="button" onClick={() => set("font", p.id)} aria-pressed={s.font === p.id} className={chip(s.font === p.id)}>
                <span className="block text-[21px] leading-tight text-[#17151F] truncate" style={{ fontFamily: p.fd, fontWeight: p.fdw, textTransform: p.tt, letterSpacing: p.ls }}>Our story</span>
                <span className="block text-[12px] text-[#4A4658] mt-1 truncate" style={{ fontFamily: p.fb }}>{p.name} · {p.like}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label="Main colour" hint="Buttons, lines and small titles.">
          <div className="flex flex-wrap gap-2 items-center">
            {asLook("accent")}
            {ACCENTS.map(a => (
              <button key={a.id} type="button" onClick={() => set("accent", a.id)} aria-pressed={s.accent === a.id} title={a.name} aria-label={a.name}
                className={cn("w-11 h-11 rounded-full border-2 flex items-center justify-center", s.accent === a.id ? "border-[#7D5CEF]" : "border-white shadow-[0_0_0_1px_#E4E0EC]")}>
                <span className="w-8 h-8 rounded-full" style={{ background: a.hex }} />
              </button>
            ))}
            <label className={cn("h-11 px-3 rounded-[12px] border-2 inline-flex items-center gap-2 cursor-pointer text-[13px] font-semibold text-[#4A4658]", s.accent?.startsWith("#") ? "border-[#7D5CEF] bg-[#F5F3FA]" : "border-[#ECE9F2]")}>
              <input type="color" value={s.accent?.startsWith("#") ? s.accent : "#7D5CEF"} onChange={e => set("accent", e.target.value.toUpperCase())} className="w-7 h-7 p-0 border-0 bg-transparent cursor-pointer" aria-label="Your own colour" />
              Your own
            </label>
          </div>
          {ac && <p className="mt-2 text-[12px] text-[#6B6680] inline-flex items-center gap-2">Button: <span className="px-3 py-1.5 text-[11px] font-semibold tracking-[.2em]" style={{ background: ac, color: textOn(ac) }}>BOOK US</span></p>}
          {weak && <p className="mt-2 text-[12px] text-[#B45309] inline-flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />This colour is hard to see on the {bg!.name.toLowerCase()} background. Pick a darker or lighter one.</p>}
        </Row>

        <Row label="Background">
          <div className="flex flex-wrap gap-2">
            {asLook("bg")}
            {BACKGROUNDS.map(b => (
              <button key={b.id} type="button" onClick={() => set("bg", b.id)} aria-pressed={s.bg === b.id} className={cn(chip(s.bg === b.id), "inline-flex items-center gap-2")}>
                <span className="w-6 h-6 rounded-full border border-[#E4E0EC]" style={{ background: b.swatch }} />
                <span className="text-[13px] font-semibold text-[#4A4658]">{b.name}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label="Corners" hint="Of photos, boxes and buttons.">
          <div className="flex flex-wrap gap-2">
            {asLook("corners")}
            {CORNERS.map(([id, name]) => (
              <button key={id} type="button" onClick={() => set("corners", id)} aria-pressed={s.corners === id} className={cn(chip(s.corners === id), "inline-flex items-center gap-2")}>
                <span className="w-7 h-5 bg-[#CFC8DE]" style={{ borderRadius: id === "soft" ? 5 : 0 }} />
                <span className="text-[13px] font-semibold text-[#4A4658]">{name}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label="Main buttons">
          <div className="flex flex-wrap gap-2">
            {asLook("button")}
            {BUTTONS.map(([id, name]) => (
              <button key={id} type="button" onClick={() => set("button", id)} aria-pressed={s.button === id} className={cn(chip(s.button === id), "inline-flex items-center gap-2.5")}>
                <span className="text-[10px] font-semibold tracking-[.2em] px-2.5 py-1.5" style={id === "solid" ? { background: ac ?? "#17151F", color: textOn(ac ?? "#17151F") } : id === "outline" ? { boxShadow: `inset 0 0 0 1px ${ac ?? "#17151F"}`, color: "#17151F" } : { boxShadow: `inset 0 -1px 0 ${ac ?? "#17151F"}`, color: "#17151F", paddingLeft: 2, paddingRight: 2 }}>BOOK</span>
                <span className="text-[13px] font-semibold text-[#4A4658]">{name}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label="Headings">
          <div className="flex flex-wrap gap-2">
            {asLook("heading")}
            {HEADINGS.map(([id, name]) => (
              <button key={id} type="button" onClick={() => set("heading", id)} aria-pressed={s.heading === id} className={chip(s.heading === id)}>
                <span className="text-[13px] font-semibold text-[#4A4658]">{name}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label="Logo and menu" hint="On computers. Phones always show the logo with a menu button.">
          <div className="flex flex-wrap gap-2">
            {asLook("logo")}
            {LOGOS.map(([id, name]) => (
              <button key={id} type="button" onClick={() => set("logo", id)} aria-pressed={s.logo === id} className={cn(chip(s.logo === id), "inline-flex items-center gap-2.5")}>
                <span className="w-16 h-5 rounded-[4px] border border-[#DCD7E6] flex items-center gap-[3px] px-1" aria-hidden="true">
                  {id === "left"
                    ? <><span className="w-3 h-2.5 rounded-sm bg-[#7D5CEF]" /><span className="ml-auto w-2 h-[2px] bg-[#B8B1C8]" /><span className="w-2 h-[2px] bg-[#B8B1C8]" /><span className="w-2 h-[2px] bg-[#B8B1C8]" /></>
                    : <><span className="w-2 h-[2px] bg-[#B8B1C8]" /><span className="w-2 h-[2px] bg-[#B8B1C8]" /><span className="mx-auto w-3 h-2.5 rounded-sm bg-[#7D5CEF]" /><span className="w-2 h-[2px] bg-[#B8B1C8]" /><span className="w-2 h-[2px] bg-[#B8B1C8]" /></>}
                </span>
                <span className="text-[13px] font-semibold text-[#4A4658]">{name}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="text-[12px] text-[#6B6680] mr-1">Logo picture size:</span>
            {LOGO_SIZES.map(([id, name]) => (
              <button key={id} type="button" onClick={() => set("logoSize", id === "m" ? undefined : id)} aria-pressed={(s.logoSize ?? "m") === id}
                className={cn("h-9 px-3 rounded-[10px] text-[13px] font-semibold", (s.logoSize ?? "m") === id ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{name}</button>
            ))}
          </div>
        </Row>
      </fieldset>
    </FormGroup>
  );
}
