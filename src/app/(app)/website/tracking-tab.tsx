"use client";
/**
 * Website → Settings → Ads & analytics. The studio's own Facebook Pixel and Google Analytics (and Tag Manager
 * for those who use it). Paste the id or the whole code; only the id is kept. Goes live with Publish.
 */
import { Check, ExternalLink } from "lucide-react";
import { Field, FormGroup, inputCls } from "@/components/ui/form-kit";
import { cn } from "@/lib/utils";
import type { SiteContent } from "@/components/site/site-view";

export type Tracking = { fbPixel: string; ga: string; gtm: string };
const EMPTY: Tracking = { fbPixel: "", ga: "", gtm: "" };

/** Same reading as the server: the id itself or the code Facebook / Google gives. */
export function readIds(t: Tracking) {
  const px = t.fbPixel.trim();
  const fb = /fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/.exec(px)?.[1] ?? /[?&]id=(\d{8,20})/.exec(px)?.[1] ?? (/^\d{8,20}$/.test(px) ? px : "");
  const ga = /\b(G-[A-Z0-9]{4,15})\b/i.exec(t.ga)?.[1]?.toUpperCase() ?? "";
  const gtm = /\b(GTM-[A-Z0-9]{4,12})\b/i.exec(t.gtm)?.[1]?.toUpperCase() ?? "";
  return { fb, ga, gtm };
}

function State({ raw, id }: { raw: string; id: string }) {
  if (!raw.trim()) return null;
  return id
    ? <span className="text-[#1F8A4C] inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Found: <b className="font-mono">{id}</b></span>
    : <span className="text-[#C2304F]">No id found here. Check what you pasted.</span>;
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="px-4 py-3.5 space-y-2 text-[14px] text-[#2D2A38]">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-[#F1EEF8] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span><span>{it}</span></li>
      ))}
    </ol>
  );
}

const ext = (href: string, label: string) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#5B3FD0] font-semibold inline-flex items-center gap-0.5">{label}<ExternalLink className="w-3.5 h-3.5" /></a>;

export function TrackingTab({ content, allowed, onChange }: { content: SiteContent; allowed: boolean; onChange: (t: Tracking) => void }) {
  const t: Tracking = { ...EMPTY, ...(content.tracking ?? {}) };
  const ids = readIds(t);
  const put = (p: Partial<Tracking>) => onChange({ ...t, ...p });
  const on = [ids.fb && "Facebook Pixel", ids.ga && "Google Analytics", ids.gtm && "Tag Manager"].filter(Boolean) as string[];

  return (
    <>
      {!allowed && (
        <div className="mb-4 rounded-[14px] border border-[#F2D9A6] bg-[#FFF8EA] px-4 py-3 text-[13px] text-[#7A5410]">
          Facebook Pixel and Google Analytics are not part of your plan.
        </div>
      )}
      <div className={cn("mb-5 rounded-[16px] px-4 py-3.5 text-[14px]", on.length ? "bg-[#EAF7EF] text-[#1E5E3A]" : "bg-[#F5F3FA] text-[#4A4658]")}>
        {on.length ? <>Working after you publish: <b>{on.join(", ")}</b>. Counted: every page visit, taps on phone / WhatsApp / email, and every booking form sent (as a <b>Lead</b>).</>
          : <>Add your Facebook Pixel to see in Facebook which ads bring bookings, and to show ads again to people who visited your website. Add Google Analytics to see how many people visit and from where.</>}
      </div>

      <fieldset disabled={!allowed} className="contents">
        <FormGroup title="Facebook Pixel" note="Your studio's own pixel from Meta. Booking forms sent on the website show in Facebook as Leads.">
          <Steps items={[
            <>Open {ext("https://business.facebook.com/events_manager2", "Events Manager")} with the Facebook account that runs your ads.</>,
            <>Choose your pixel (or <b>Connect data</b> → <b>Web</b> to make one).</>,
            <>Copy the <b>Pixel ID</b> (a long number) and paste it below. The whole pixel code works too. Then <b>Publish</b>.</>,
          ]} />
          <Field label="Pixel ID" hint={<State raw={t.fbPixel} id={ids.fb} />}>
            {id => <input id={id} className={inputCls} inputMode="text" autoCapitalize="none" spellCheck={false} value={t.fbPixel} maxLength={5000} placeholder="e.g. 1234567890123456" onChange={e => put({ fbPixel: e.target.value })} />}
          </Field>
        </FormGroup>

        <FormGroup title="Google Analytics" note="Free from Google: visitors per day, which pages they open, which city and which link brought them.">
          <Steps items={[
            <>Open {ext("https://analytics.google.com", "Google Analytics")} and make an account (or open yours).</>,
            <>Go to <b>Admin</b> → <b>Data streams</b> → <b>Web</b>, and add your website link.</>,
            <>Copy the <b>Measurement ID</b> (starts with <b>G-</b>) and paste it below. Then <b>Publish</b>.</>,
          ]} />
          <Field label="Measurement ID" hint={<State raw={t.ga} id={ids.ga} />}>
            {id => <input id={id} className={inputCls} autoCapitalize="characters" spellCheck={false} value={t.ga} maxLength={5000} placeholder="G-XXXXXXXXXX" onChange={e => put({ ga: e.target.value })} />}
          </Field>
        </FormGroup>

        <FormGroup title="Google Tag Manager (optional)" note="Only if you or your marketing person already use Tag Manager. Most studios don't need it.">
          <Field label="Container ID" hint={<State raw={t.gtm} id={ids.gtm} />}>
            {id => <input id={id} className={inputCls} autoCapitalize="characters" spellCheck={false} value={t.gtm} maxLength={5000} placeholder="GTM-XXXXXXX" onChange={e => put({ gtm: e.target.value })} />}
          </Field>
        </FormGroup>
      </fieldset>

      <p className="px-1 -mt-2 mb-5 text-[13px] text-[#6B6680]">Your own visits from this editor&apos;s preview are not counted.</p>
    </>
  );
}
