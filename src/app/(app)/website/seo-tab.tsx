"use client";
/**
 * Website → Settings → Google & sharing. What Google shows for each page, the picture a shared link shows
 * (WhatsApp, Facebook, Messenger), the Search Console code and the switch to keep the site out of search.
 * Empty boxes mean "automatic": the preview shows what visitors will get. Goes live with Publish, like the rest.
 */
import { useState } from "react";
import { ChevronDown, Copy, ExternalLink, ImagePlus, X } from "lucide-react";
import { Field, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import type { SiteContent, SiteData } from "@/components/site/site-view";
import { DESC_FIT, EMPTY_SEO, SEO_PAGES, TITLE_FIT, autoSeo, type SiteSeo } from "@/lib/site-seo";

type Photo = { id: string; url: string; thumbUrl?: string | null; blur: string };

function Count({ n, fit }: { n: number; fit: number }) {
  return <span className={cn("tabular-nums", n > fit ? "text-[#B45309]" : "text-[#8A8597]")}>{n}/{fit}{n > fit ? " · Google may cut the end" : ""}</span>;
}

/** Roughly how a Google result looks: address, blue title, grey text. */
function GoogleCard({ url, name, title, description }: { url: string; name: string; title: string; description: string }) {
  const host = url.replace(/^https?:\/\//, "");
  return (
    <div className="rounded-[14px] border border-[#E6E2EF] bg-white p-3.5 font-[Arial,sans-serif]">
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-[#F1EEF8] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 leading-tight">
          <p className="text-[14px] text-[#202124] truncate">{name}</p>
          <p className="text-[12px] text-[#4D5156] truncate">{host}</p>
        </div>
      </div>
      <p className="mt-2 text-[19px] leading-snug text-[#1A0DAB] line-clamp-1">{title}</p>
      <p className="mt-0.5 text-[14px] leading-[1.5] text-[#4D5156] line-clamp-2">{description}</p>
    </div>
  );
}

/** Roughly how a shared link looks in WhatsApp / Facebook: picture, address, title, text. */
function ShareCard({ photo, url, title, description }: { photo?: Photo; url: string; title: string; description: string }) {
  return (
    <div className="rounded-[14px] border border-[#E6E2EF] bg-[#F7F5FB] overflow-hidden max-w-[420px]">
      <div className="aspect-[1.91/1] bg-[#ECE9F3] flex items-center justify-center text-[#8A8597]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={photo.thumbUrl || photo.url} alt="" className="w-full h-full object-cover" style={{ backgroundImage: `url(${photo.blur})`, backgroundSize: "cover" }} /> : <span className="text-sm">No picture</span>}
      </div>
      <div className="px-3.5 py-2.5">
        <p className="text-[12px] text-[#6B6680] truncate">{url.replace(/^https?:\/\//, "")}</p>
        <p className="text-[15px] font-semibold text-[#17151F] line-clamp-1">{title}</p>
        <p className="text-[13px] text-[#4A4658] line-clamp-2">{description}</p>
      </div>
    </div>
  );
}

export function SeoTab({ content, studio, url, allowed, photo, onChange, onChoosePicture }: {
  content: SiteContent; studio: SiteData["studio"];
  /** The website's address (own domain when it works) */
  url: string;
  /** Own titles, picture and codes are part of the plan */
  allowed: boolean;
  photo: (id: string | null | undefined) => Photo | undefined;
  onChange: (seo: SiteSeo) => void;
  onChoosePicture: () => void;
}) {
  const seo: SiteSeo = { ...EMPTY_SEO, ...(content.seo ?? {}) };
  const put = (patch: Partial<SiteSeo>) => onChange({ ...seo, ...patch });
  const fake = { content, studio, slug: "", photos: {}, packages: [] } as unknown as SiteData;
  const auto = autoSeo(fake, "home");
  const title = seo.title || auto.title, description = seo.description || auto.description;
  const pic = photo(seo.image) ?? photo(content.heroPhotos[0]) ?? photo(content.slides?.[0]);
  const [open, setOpen] = useState<string | null>(null);
  const sitemap = `${url}/sitemap.xml`;
  const copy = (t: string, what: string) => { navigator.clipboard.writeText(t); notify(`${what} copied`); };

  return (
    <>
      {!allowed && (
        <div className="mb-4 rounded-[14px] border border-[#F2D9A6] bg-[#FFF8EA] px-4 py-3 text-[13px] text-[#7A5410]">
          Your own Google titles, share picture and Search Console code are not part of your plan. Google still gets good automatic titles.
        </div>
      )}
      <fieldset disabled={!allowed} className="contents">
        <FormGroup title="How Google shows your website" note="Empty boxes are filled in for you from your Home page. Changes go live when you publish.">
          <div className="px-4 py-3.5"><GoogleCard url={url} name={studio.name} title={title} description={description} /></div>
          <Field label="Title" hint={<Count n={title.length} fit={TITLE_FIT} />}>
            {id => <input id={id} className={inputCls} value={seo.title} maxLength={70} placeholder={auto.title} onChange={e => put({ title: e.target.value })} />}
          </Field>
          <Field label="Description" hint={<><Count n={description.length} fit={DESC_FIT} /> · Say what you shoot and where, e.g. &ldquo;Wedding photography and films in Feni and Chattogram.&rdquo;</>}>
            {id => <textarea id={id} rows={3} className={cn(inputCls, "h-auto py-2.5 resize-none")} value={seo.description} maxLength={170} placeholder={auto.description} onChange={e => put({ description: e.target.value })} />}
          </Field>
        </FormGroup>

        <FormGroup title="When someone shares your link" note="WhatsApp, Facebook and Messenger show this picture with the title. A wide photo works best.">
          <div className="px-4 py-3.5 flex flex-col sm:flex-row gap-4 sm:items-start">
            <div className="relative w-[112px] flex-shrink-0">
              <button type="button" onClick={onChoosePicture} aria-label={seo.image ? "Change share picture" : "Choose share picture"}
                className="w-[112px] h-[112px] rounded-[14px] overflow-hidden bg-[#F5F3FA] border border-dashed border-[#C9C3DA] hover:border-[#7D5CEF] flex items-center justify-center text-[#6B6680] transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photo(seo.image) ? <img src={photo(seo.image)!.thumbUrl || photo(seo.image)!.url} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-6 h-6" />}
              </button>
              {seo.image && <button type="button" onClick={() => put({ image: null })} aria-label="Remove share picture" className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#17151F] text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>}
              <p className="text-xs text-[#6B6680] mt-1.5 text-center">{seo.image ? "Share picture" : "Main photo is used"}</p>
            </div>
            <div className="flex-1 min-w-0"><ShareCard photo={pic} url={url} title={title} description={description} /></div>
          </div>
        </FormGroup>

        <FormGroup title="Each page (optional)" note="Every page already gets its own title. Write your own only where you want different words.">
          {SEO_PAGES.map(([key, name]) => {
            const own = seo.pages[key] ?? { title: "", description: "" };
            const a = autoSeo(fake, key);
            const mine = !!(own.title || own.description);
            const setPage = (p: Partial<typeof own>) => {
              const next = { ...own, ...p };
              const pages = { ...seo.pages };
              if (next.title || next.description) pages[key] = next; else delete pages[key];
              put({ pages });
            };
            return (
              <div key={key}>
                <button type="button" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#FAF9FD]">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-[#17151F]">{name}</span>
                    <span className="block text-[13px] text-[#6B6680] truncate">{own.title || a.title}</span>
                  </span>
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", mine ? "bg-[#EAF7EF] text-[#1F8A4C]" : "bg-[#F1EEF8] text-[#6B6680]")}>{mine ? "Your words" : "Automatic"}</span>
                  <ChevronDown className={cn("w-4 h-4 text-[#8A8597] transition-transform", open === key && "rotate-180")} aria-hidden="true" />
                </button>
                {open === key && (
                  <div className="px-4 pb-4 space-y-3">
                    <label className="block">
                      <span className="text-[13px] font-semibold text-[#4A4658]">Title</span>
                      <input className={cn(inputCls, "mt-1")} value={own.title} maxLength={70} placeholder={a.title} onChange={e => setPage({ title: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-[13px] font-semibold text-[#4A4658]">Description</span>
                      <textarea rows={2} className={cn(inputCls, "mt-1 h-auto py-2.5 resize-none")} value={own.description} maxLength={170} placeholder={a.description} onChange={e => setPage({ description: e.target.value })} />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </FormGroup>

        <FormGroup title="Google Search Console" note="Free from Google. It tells Google about your website and shows how many people find you in search.">
          <ol className="px-4 py-3.5 space-y-2 text-[14px] text-[#2D2A38]">
            <li className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-[#F1EEF8] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span>Open <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-[#5B3FD0] font-semibold inline-flex items-center gap-0.5">Search Console<ExternalLink className="w-3.5 h-3.5" /></a> and sign in with Google.</span></li>
            <li className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-[#F1EEF8] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <span>Choose <b>URL prefix</b> and type <b className="break-all">{url}</b></span></li>
            <li className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-[#F1EEF8] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              <span>Under <b>HTML tag</b>, copy the code, paste it below and <b>Publish</b>. Then press <b>Verify</b> in Search Console.</span></li>
            <li className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-[#F1EEF8] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
              <span>In <b>Sitemaps</b>, add <b>sitemap.xml</b> and press Submit.</span></li>
          </ol>
          <Field label="Google code" hint="Paste the whole tag or just the code — both work.">
            {id => <input id={id} className={inputCls} value={seo.google} maxLength={400} autoCapitalize="none" spellCheck={false} placeholder='<meta name="google-site-verification" content="…" />' onChange={e => put({ google: e.target.value })} />}
          </Field>
          <Field label="Bing code (optional)">
            {id => <input id={id} className={inputCls} value={seo.bing} maxLength={400} autoCapitalize="none" spellCheck={false} placeholder='<meta name="msvalidate.01" content="…" />' onChange={e => put({ bing: e.target.value })} />}
          </Field>
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-[#17151F]">Sitemap</p>
              <p className="text-[13px] text-[#6B6680] break-all">{sitemap}</p>
            </div>
            <button type="button" onClick={() => copy(sitemap, "Sitemap link")} className="h-10 px-3.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-sm font-semibold inline-flex items-center gap-1.5"><Copy className="w-4 h-4" />Copy</button>
          </div>
        </FormGroup>
      </fieldset>

      <FormGroup title="Search engines">
        <SwitchRow label="Show my website in Google" hint={seo.hidden ? "Off: Google and other search engines are asked not to list it. People with the link can still open it." : "On: anyone can find it in search."}
          on={!seo.hidden} onChange={v => put({ hidden: !v })} />
      </FormGroup>
    </>
  );
}
