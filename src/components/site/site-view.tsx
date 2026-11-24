"use client";

/**
 * A studio's public website (Home). One structure for every theme: the theme only changes the
 * colours, fonts and shapes in site.css. Used by /site/[slug] (published) and by the studio's
 * own preview of the draft.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/lib/api";
import { InnerPage } from "./site-pages";
import { FilmTheater } from "./site-film";
import { PackageBrowser } from "./site-packages";
import { PhotoViewer } from "./site-viewer";
import { OfferCards, bookChoices } from "./site-offers";
import { liveOffers, type SiteOffer } from "@/lib/site-offer-kit";
import type { SiteSeo } from "@/lib/site-seo";
import { styleOf, type SiteStyle } from "@/lib/site-style";
import { siteTrack, type SiteTrackingIds } from "./site-tracking";
import "./site.css";

export type SitePhoto = { url: string; /** 900 px copy for phones and grids */ sm?: string | null; w: number; h: number; /** Tiny blurred preview; not sent for photos inside albums */ blur?: string };
/** A person in the studio's team (About page). */
export type SiteTeamMember = { id: string; name: string; role: string; photo: string | null };
export type SiteStory = { id: string; title: string; date: string; cover: string | null; text: string };
/** How a photo sits in its frame: centre point in % and zoom (1 = fills the frame). */
export type SiteCrop = { x: number; y: number; z: number };
export const cropStyle = (c?: SiteCrop): React.CSSProperties => (c ? { objectPosition: `${c.x}% ${c.y}%`, transformOrigin: `${c.x}% ${c.y}%`, scale: c.z > 1 ? String(c.z) : undefined } : {});
export type SiteAddon = { id: string; name: string; price: number; currency: string; unit: string };
export type SiteAlbum = { id: string; title: string; tag: string; cover: string | null; photos: string[] };
export type SitePackage = {
  id: string; name: string; group: string; price: number; currency: string; team: string; lines: string[];
  /** Details for grouping and comparing (newer servers only). */
  days?: number; photoOnly?: boolean; hours?: number | null; photos?: number | null; trailers?: number | null; films?: number | null;
  note?: string; extras?: string[]; delivery?: string | null;
};
export type SiteContent = {
  script: string; headline: string; kicker: string; intro: string; heroPhotos: string[]; /** Slideshow photos of the Gallery White look */ slides?: string[]; /** Main Home photo on phones */ mobileSlides?: string[]; events: string[];
  aboutTitle: string; aboutText: string; aboutPhoto: string | null; albums: SiteAlbum[];
  filmUrl: string; filmTitle: string; filmPhoto: string | null; filmId?: string | null; showPackages: boolean; showLogo?: boolean;
  reviews: { text: string; name: string }[];
  films?: { url: string; title: string; id: string; /** Own cover photo */ cover?: string | null }[]; faqs?: { q: string; a: string }[];
  stories?: SiteStory[]; team?: SiteTeamMember[]; hide?: string[]; crop?: Record<string, SiteCrop>;
  phone: string; whatsapp: string; email: string; address: string; hours: string;
  facebook: string; instagram: string; youtube: string; footerLine: string;
  /** Google and sharing (older drafts may not have it) */
  seo?: SiteSeo;
  /** Facebook Pixel / Google Analytics / Tag Manager ids */
  tracking?: SiteTrackingIds;
  /** The studio's own fonts, colour, corners, buttons, headings, logo (empty = as the look) */
  style?: SiteStyle;
  /** Website packages, each with its own page (empty = the studio's price list) */
  offers?: SiteOffer[];
};
export type SiteData = {
  /** The studio's own domain when it works (visitors on the stupanel.com address are sent there). */
  domain?: string | null;
  /** When the published copy was made (sitemap date). */
  publishedAt?: string | null;
  slug: string; theme: string; studio: { name: string; logoUrl: string | null }; /** The studio's money */ currency?: string;
  content: SiteContent; photos: Record<string, SitePhoto>; packages: SitePackage[]; addons?: SiteAddon[];
};

export const SITE_FONTS: Record<string, string> = {
  signature: "family=Cinzel+Decorative:wght@400;700&family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Montserrat:wght@400;500;600",
  editorial: "family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Jost:wght@300;400;500",
  cream: "family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=Pinyon+Script&family=DM+Sans:wght@300;400;500",
  dark: "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Pinyon+Script&family=Jost:wght@300;400;500",
  gold: "family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Pinyon+Script&family=Mulish:wght@300;400;600",
  mono: "family=Hanken+Grotesk:wght@300;400;500;600",
};
export const fontHref = (theme: string) => `https://fonts.googleapis.com/css2?${SITE_FONTS[theme] ?? SITE_FONTS.signature}&display=swap`;

export type SitePageName = "home" | "portfolio" | "films" | "packages" | "about" | "reviews" | "faq" | "contact" | "privacy" | "terms" | "stories" | "thank-you" | "notfound";

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "S";
export const money = (n: number, cur: string) => (cur === "BDT" ? `৳ ${n.toLocaleString("en-IN")}` : `${cur} ${n.toLocaleString("en-US")}`);
/** 017… (Bangladesh) → 88017…; anything else keeps its digits. */
export const waLink = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? `https://wa.me/${d.startsWith("0") ? "88" + d : d}` : "";
};

export const ICON = {
  fb: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />,
  ig: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".6" /></>,
  yt: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5l5 2.5-5 2.5z" /></>,
  wa: <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  prev: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  menu: <path d="M4 8h16M4 16h16" />,
};
export const Ic = ({ d, size = 18, w = 1.5 }: { d: React.ReactNode; size?: number; w?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/** A photo that shows its tiny blurred copy until the real one arrives. */
export function Ph({ p, alt, eager, className, style, sizes, crop }: { p?: SitePhoto; alt: string; eager?: boolean; className?: string; style?: React.CSSProperties; /** Position and zoom chosen by the studio for this place */ crop?: SiteCrop; /** How wide it is shown (CSS sizes); picks the small or the full copy */ sizes?: string }) {
  if (!p) return <div className={`ph ${className ?? ""}`} style={{ width: "100%", height: "100%", ...style }} aria-hidden="true" />;
  const small = p.sm && p.w > 900 ? p.sm : null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`ph ${className ?? ""}`} src={p.url} srcSet={small ? `${small} 900w, ${p.url} ${p.w}w` : undefined} sizes={small ? sizes ?? "(max-width: 860px) 92vw, 50vw" : undefined}
      alt={alt} width={p.w} height={p.h} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : undefined} style={{ backgroundImage: p.blur ? `url(${p.blur})` : undefined, ...style, ...cropStyle(crop) }} />
  );
}

/** An album as a clean photo; its name and "View gallery" come in on hover (always shown on touch screens). */
export function AlbumCard({ a, photo, crop, onOpen, i, eager, count }: { a: SiteAlbum; photo?: SitePhoto; crop?: SiteCrop; onOpen: () => void; i: number; eager?: boolean; count?: boolean }) {
  return (
    <button type="button" className="alc" style={{ ["--i" as string]: Math.min(i, 9) }} onClick={onOpen} aria-label={`Open the album ${a.title}`}
      // Touch screens have no hover: the card under the finger gets the same look, and keeps it for a moment.
      onTouchStart={e => { document.querySelectorAll(".sg .alc.tch").forEach(x => x.classList.remove("tch")); e.currentTarget.classList.add("tch"); }}
      onTouchEnd={e => { const el = e.currentTarget; setTimeout(() => el.classList.remove("tch"), 1600); }}
      onTouchCancel={e => { const el = e.currentTarget; setTimeout(() => el.classList.remove("tch"), 1600); }}>
      <Ph p={photo} alt="" eager={eager} sizes="(max-width: 860px) 46vw, 300px" crop={crop} />
      <span className="alo">
        <span className="alf" aria-hidden="true" />
        <span className="pf alt">{a.title}</span>
        {a.tag && <span className="cap altag">{count ? `${a.tag}  ·  ${a.photos.length} photos` : a.tag}</span>}
        <span className="cap gold alb">View gallery</span>
      </span>
    </button>
  );
}

/** Gallery look: photos fill the first screen and change by themselves; arrows move by hand. */
function MonoHero({ slides, crops, name }: { slides: SitePhoto[]; /** One per slide, in the same order */ crops?: (SiteCrop | undefined)[]; name: string }) {
  const [n, setN] = useState(0);
  const count = slides.length;
  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setN(v => (v + 1) % count), 5500);
    return () => clearInterval(t);
  }, [count]);
  return (
    <section className="mhero" aria-label={`${name}: selected photos`}>
      {slides.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.url} src={p.url} srcSet={p.sm && p.w > 900 ? `${p.sm} 900w, ${p.url} ${p.w}w` : undefined} sizes="100vw" alt="" className={i === n ? "on" : undefined} loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : undefined}
          style={{ backgroundImage: p.blur ? `url(${p.blur})` : undefined, ...cropStyle(crops?.[i]) }} />
      ))}
      {count > 1 && <>
        <button type="button" className="mprev" aria-label="Previous photo" onClick={() => setN(v => (v - 1 + count) % count)}><Ic d={ICON.prev} size={22} w={1.2} /></button>
        <button type="button" className="mnext" aria-label="Next photo" onClick={() => setN(v => (v + 1) % count)}><Ic d={ICON.next} size={22} w={1.2} /></button>
      </>}
    </section>
  );
}

/** First five looks, computers only: more photos laid over the main Home photo, changing by themselves with a slow fade. */
function HeroSlides({ slides, crops, phone, phoneCrops }: { slides: SitePhoto[]; crops?: (SiteCrop | undefined)[]; /** Tall photos for phones; none = phones use the computer ones */ phone: SitePhoto[]; phoneCrops?: (SiteCrop | undefined)[] }) {
  // 0 = the first photo. Computers: the main photo, then `slides`. Phones: `phone` when chosen, else the same as computers.
  const [n, setN] = useState(0);
  const desk = slides.length + 1;
  useEffect(() => {
    const count = phone.length && window.matchMedia("(max-width: 860px)").matches ? phone.length : desk;
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setN(v => (v + 1) % count), 5000);
    return () => clearInterval(t);
  }, [desk, phone.length]);
  return (
    <>
      {slides.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.url} src={p.url} srcSet={p.sm && p.w > 900 ? `${p.sm} 900w, ${p.url} ${p.w}w` : undefined} sizes="(max-width: 860px) 92vw, 1400px" alt="" loading="lazy" className={`hsl${phone.length ? "" : " both"}${i + 1 === n ? " on" : ""}`} style={cropStyle(crops?.[i])} />
      ))}
      {phone.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.url} src={p.sm ?? p.url} srcSet={p.sm && p.w > 900 ? `${p.sm} 900w, ${p.url} ${p.w}w` : undefined} sizes="92vw" alt="" loading="lazy" className={`hml${i === n % phone.length ? " on" : ""}`} style={{ backgroundImage: p.blur ? `url(${p.blur})` : undefined, ...cropStyle(phoneCrops?.[i]) }} />
      ))}
    </>
  );
}

/** Gallery look: albums in groups of five, one large and four small, the large one changing sides; names sit under the photos. */
export function MonoAlbums({ albums, photos, crops, onOpen, rows }: { albums: SiteAlbum[]; photos: Record<string, SitePhoto>; crops?: Record<string, SiteCrop>; onOpen: (a: SiteAlbum) => void; /** Portfolio page: three in a row, all the same size */ rows?: boolean }) {
  const card = (a: SiteAlbum, big: boolean, eager?: boolean) => (
    <button type="button" key={a.id} className={`mal${big ? " big" : ""}`} onClick={() => onOpen(a)} aria-label={`Open the album ${a.title}`}>
      <span className="mim"><Ph p={photos[a.cover ?? a.photos[0] ?? ""]} alt="" eager={eager} sizes={big ? "(max-width: 860px) 92vw, 620px" : rows ? "(max-width: 860px) 92vw, 400px" : "(max-width: 860px) 46vw, 300px"} crop={crops?.[`album:${a.id}`]} /></span>
      <span className="mnm">{a.title}</span>
    </button>
  );
  if (rows) return <div className="mwork">{albums.map((a, i) => card(a, false, i < 3))}</div>;
  const groups: SiteAlbum[][] = [];
  for (let i = 0; i < albums.length; i += 5) groups.push(albums.slice(i, i + 5));
  return <>{groups.map((g, k) => <div key={k} className={`mgrid${k % 2 ? " flip" : ""}`}>{g.map((a, i) => card(a, i === 0))}</div>)}</>;
}

const shortDate = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "");
/** Gallery look: stories as plain rows, photo on the left, title and date beside it, a hairline between. */
export function MonoRows({ stories, photos, crops, L }: { stories: SiteStory[]; photos: Record<string, SitePhoto>; crops?: Record<string, SiteCrop>; L: (path: string) => string }) {
  return (
    <div className="mrows">
      {stories.map(x => (
        <Link key={x.id} href={L(`/stories/${x.id}`)} className="mrow">
          <span className="mri"><Ph p={photos[x.cover ?? ""]} alt="" sizes="(max-width: 860px) 92vw, 480px" crop={crops?.[`story:${x.id}`]} /></span>
          <span className="mrt">
            <span className="mrh">{x.title}</span>
            <span className="mrd">{[shortDate(x.date), "View"].filter(Boolean).join("  ·  ")}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** First five looks, Home: one story told big (photo, date, title, a few lines) and the next three as a short list beside it. */
function HomeStories({ stories, photos, crops, L }: { stories: SiteStory[]; photos: Record<string, SitePhoto>; crops?: Record<string, SiteCrop>; L: (path: string) => string }) {
  const [f, ...rest] = stories;
  const excerpt = (t: string) => { const x = t.replace(/\s+/g, " ").trim(); return x.length > 180 ? `${x.slice(0, 180).replace(/\s+\S*$/, "")}…` : x; };
  return (
    <section id="stories" className="hst">
      <div className="wrap sec">
        <div style={{ textAlign: "center" }}><Heading script="from our" title="Stories" /></div>
        <div className={`hstg${rest.length ? "" : " one"}`}>
          <Link href={L(`/stories/${f.id}`)} className="hstf rv">
            <span className="hstp"><span className="hsti"><Ph p={photos[f.cover ?? ""]} alt="" sizes="(max-width: 860px) 92vw, 720px" crop={crops?.[`story:${f.id}`]} /></span></span>
            <span className="hstx">
              {f.date && <span className="cap hstd">{shortDate(f.date)}</span>}
              <span className="hstt pf">{f.title}</span>
              {f.text && <span className="hste">{excerpt(f.text)}</span>}
              <span className="cap ul hstr">Read the story</span>
            </span>
          </Link>
          {rest.length > 0 && (
            <div className="hstl">
              {rest.map(x => (
                <Link key={x.id} href={L(`/stories/${x.id}`)} className="hstrw rv">
                  <span className="hstti"><Ph p={photos[x.cover ?? ""]} alt="" sizes="160px" crop={crops?.[`story:${x.id}`]} /></span>
                  <span className="hstrx">
                    {x.date && <span className="cap hstd">{shortDate(x.date)}</span>}
                    <span className="hstrt pf">{x.title}</span>
                  </span>
                </Link>
              ))}
              <Link href={L("/stories")} className="cap ol hsta">All stories</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Gallery look, Home: photos across the whole first screen, one plain sentence, the mosaic of albums, then the stories. */
function MonoHome({ data, L, openAlbum }: { data: SiteData; L: (path: string) => string; openAlbum: (a: SiteAlbum) => void }) {
  const { content: c, photos, studio } = data;
  const own = (c.slides ?? []).filter(id => photos[id]);
  const ids = (own.length ? own : [...c.heroPhotos, ...c.albums.map(a => a.cover ?? a.photos[0])]).filter((id, k, all): id is string => !!id && !!photos[id] && all.indexOf(id) === k).slice(0, 8);
  const stories = (c.stories ?? []).slice(0, 6);
  const hide = c.hide ?? [];
  return (
    <>
      <MonoHero slides={ids.map(id => photos[id])} crops={ids.map((id, i) => c.crop?.[`slide:${id}`] ?? (!own.length && i === 0 ? c.crop?.hero0 : undefined))} name={studio.name} />
      <section className="wrap mst">
        <h1 className="cz">{[c.script, c.headline].filter(Boolean).join(" ")}</h1>
        {c.intro && <p>{c.intro}</p>}
      </section>
      {c.albums.length > 0 && !hide.includes("albums") && (
        <section id="albums" className="wrap">
          <MonoAlbums albums={c.albums.slice(0, 10)} photos={photos} crops={c.crop} onOpen={openAlbum} />
          {c.albums.length > 5 && <div className="mmore"><Link href={L("/portfolio")} className="mlk">All work</Link></div>}
        </section>
      )}
      {stories.length > 0 && !hide.includes("stories") && <section className="wrap" style={{ paddingTop: "clamp(40px,6vw,90px)" }}><MonoRows stories={stories} photos={photos} crops={c.crop} L={L} /></section>}
      <div style={{ height: "clamp(60px,8vw,110px)" }} />
    </>
  );
}

/** Comes up from below tilted in 3D and settles flat, once, when it scrolls into view (CSS .ab3d). */
function Rise3D({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("in"); return; }
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { el.classList.add("in"); io.disconnect(); }
    }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="ab3d" style={style}>{children}</div>;
}

export function Heading({ script, title, light }: { script: string; title: string; light?: boolean }) {
  return (
    <>
      <div className="sc sch" style={light ? { color: "var(--sc2)" } : undefined}>{script}</div>
      <h2 className="cz h2">{title}</h2>
    </>
  );
}

/**
 * The studio's address as tidy lines. Lines the studio typed itself stay as they are. One long line with commas
 * becomes street lines (up to about 26 letters each) and a last line "City 3900, Country". Empty parts (", ,") go,
 * and words typed all in small letters get a capital ("mizan road" → "Mizan Road").
 */
export function addressLines(a: string): string {
  const raw = (a || "").trim();
  if (!raw) return "";
  if (raw.includes("\n")) return raw.split(/\n+/).map(l => l.trim()).filter(Boolean).join("\n");
  const SMALL = new Set(["of", "and", "the", "to", "at", "in", "on", "no", "no."]);
  const cap = (w: string) => (/^[a-z][a-z.'-]{2,}$/.test(w) && !SMALL.has(w) ? w[0].toUpperCase() + w.slice(1) : w);
  const parts = raw.split(",").map(p => p.trim().replace(/\s+/g, " ")).filter(Boolean).map(p => p.split(" ").map(cap).join(" "));
  if (parts.length < 3) return parts.join(", ");
  // The end: city, country and postcode in any order → "Feni 3900, Bangladesh".
  const code = parts.findIndex((p, i) => i >= parts.length - 3 && /^\d{3,7}$/.test(p));
  let tail: string[];
  let head: string[];
  if (code >= 0) {
    const rest = parts.filter((_, i) => i !== code);
    const last2 = rest.slice(-2);
    tail = last2.length === 2 ? [`${last2[0]} ${parts[code]}`, last2[1]] : [`${last2[0]} ${parts[code]}`];
    head = rest.slice(0, -2);
  } else {
    tail = parts.slice(-2);
    head = parts.slice(0, -2);
  }
  const lines: string[] = [];
  let cur = "";
  for (const p of head) {
    if (cur && (cur.length + p.length + 2) > 26) { lines.push(`${cur},`); cur = p; }
    else cur = cur ? `${cur}, ${p}` : p;
  }
  if (cur) lines.push(`${cur},`);
  lines.push(tail.join(", "));
  return lines.join("\n");
}

export function SiteView({ data, preview, base, page = "home", albumId, storyId, offerId }: { data: SiteData; preview?: boolean; /** "" on <address>.stupanel.com; default /site/<address> */ base?: string; page?: SitePageName; albumId?: string; storyId?: string; /** One website package's own page */ offerId?: string }) {
  const { content: c, photos, studio, packages } = data;
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);
  const [album, setAlbum] = useState<SiteAlbum | null>(() => (albumId ? data.content.albums.find(a => a.id === albumId) ?? null : null));
  const [shot, setShot] = useState<number | null>(null);
  const [rev, setRev] = useState(0);
  const [ask, setAsk] = useState("");
  // A slim bar with the menu and Book us comes back when the visitor scrolls up.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => { const y = window.scrollY; setStuck(y > 500 && y < last); last = y; };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // The opening curtain plays once per visit, not on every load.
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem("sg-in") === data.slug) root.current?.classList.add("noin");
      else sessionStorage.setItem("sg-in", data.slug);
    } catch { /* private window */ }
  }, [data.slug]);

  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollBehavior = "smooth";
    return () => { html.style.scrollBehavior = ""; };
  }, []);

  // The two hero cards follow the mouse a little (no re-render: straight to CSS).
  useEffect(() => {
    const el = hero.current;
    if (!el || !window.matchMedia("(hover:hover) and (prefers-reduced-motion:no-preference)").matches) return;
    let raf = 0;
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) - 0.5).toFixed(3));
        el.style.setProperty("--my", (((e.clientY - r.top) / r.height) - 0.5).toFixed(3));
      });
    };
    el.addEventListener("mousemove", move);
    return () => { el.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);

  // Album and photo viewer: the phone's Back button closes them; the page behind does not scroll.
  const home = page === "home";
  /** A page of this site (keeps the preview flag). */
  const L = useCallback((path: string) => `${base ?? `/site/${data.slug}`}${path}${preview ? "?preview=1" : ""}` || "/", [base, data.slug, preview]);
  // Opening an album changes the address (so its link can be shared) without leaving the page.
  const openAlbum = (a: SiteAlbum) => { history.pushState({ sgAlbum: a.id }, "", L(`/portfolio/${a.id}`)); setAlbum(a); };
  const closeAlbum = useCallback(() => {
    if (history.state?.sgAlbum) history.back();
    else { setAlbum(null); setShot(null); if (albumId) history.replaceState(null, "", L("/portfolio")); }
  }, [albumId, L]);
  useEffect(() => {
    const pop = () => { setShot(null); setAlbum(null); };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    const lock = !!album || menu;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [album, menu]);
  const shots = album ? album.photos.map(id => photos[id]).filter(Boolean) : [];
  const step = useCallback((by: number) => setShot(s => (s === null || !shots.length ? s : (s + by + shots.length) % shots.length)), [shots.length]);
  useEffect(() => {
    if (!album && !menu) return;
    const key = (e: KeyboardEvent) => {
      // The photo viewer handles its own keys.
      if (e.key === "Escape" && shot === null) { if (menu) setMenu(false); else closeAlbum(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [album, menu, shot, step, closeAlbum]);
  const closeShot = useCallback(() => setShot(null), []);

  const words = c.headline.split(/\s+/).filter(Boolean);
  const [aboutScript, ...aboutRest] = c.aboutTitle.split(/\s+/).filter(Boolean);
  const filmPoster = c.filmPhoto && photos[c.filmPhoto] ? photos[c.filmPhoto].url : c.filmId ? `https://i.ytimg.com/vi/${c.filmId}/maxresdefault.jpg` : "";
  const wa = waLink(c.whatsapp || c.phone);
  const films = c.films ?? [];
  /** The gallery look: full-screen photo, plain type, a mosaic of albums. */
  const mono = data.theme === "mono";
  const hide = c.hide ?? [];
  const router = useRouter();
  const thanks = useCallback(() => router.push(L("/thank-you")), [router, L]);
  const nav = [
    c.albums.length ? [L("/portfolio"), "Portfolio"] : null, films.length || c.filmId ? [L("/films"), "Films"] : null, [L("/about"), "About"],
    packages.length || liveOffers(data).length ? [L("/packages"), "Packages"] : null, (c.stories ?? []).length ? [L("/stories"), "Stories"] : null,
  ].filter(Boolean) as [string, string][];
  const bookHref = home && !mono ? "#book" : L("/contact");
  // Reviews and FAQ sit in the footer and the phone menu, not the top bar (Faisal, 22-NOV).
  const more = [...nav, c.reviews.length ? [L("/reviews"), "Reviews"] : null, (c.faqs ?? []).length ? [L("/faq"), "FAQ"] : null, [L("/contact"), "Contact"]].filter(Boolean) as [string, string][];
  const left = nav.slice(0, Math.ceil(nav.length / 2)), right = nav.slice(Math.ceil(nav.length / 2));
  /** Extra photos for the main Home photo (computers). */
  const heroMore = (c.slides ?? []).filter((id, k, all) => photos[id] && id !== c.heroPhotos[0] && all.indexOf(id) === k);
  /** Tall photos chosen for phones. */
  const heroPhone = (c.mobileSlides ?? []).filter((id, k, all) => photos[id] && all.indexOf(id) === k);
  const d = (s: number) => ({ animationDelay: `calc(var(--d) + ${s}s)` });
  const slot = [
    { transform: "translateY(0) rotate(0deg) scale(1)", opacity: 1, zIndex: 3 },
    { transform: "translateY(22px) rotate(3deg) scale(.96)", opacity: 0.85, zIndex: 2 },
    { transform: "translateY(44px) rotate(-3deg) scale(.92)", opacity: 0.6, zIndex: 1 },
  ];
  const nRev = c.reviews.length;
  /** The studio's own fonts, colour, corners, buttons, headings and logo place (Look → Make it yours). */
  const own = styleOf(c.style);

  return (
    <div ref={root} id="top" style={own.style} className={`sg${data.theme && data.theme !== "signature" ? ` t-${data.theme}` : ""}${home ? " home" : " noin inner"}${mono && (home || (page === "about" && !!c.aboutPhoto && !!photos[c.aboutPhoto])) ? " ovr" : ""}${own.cls}`}>
      <link rel="stylesheet" href={fontHref(data.theme)} precedence="default" />
      {own.fontQuery && <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${own.fontQuery}&display=swap`} precedence="default" />}
      <div className="prog" aria-hidden="true" />

      {home && <div className="cur" aria-hidden="true">
        <svg width="190" height="190" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="92" stroke="var(--ac)" strokeWidth="1" />
          <path d="M100 22l14 14-14 14-14-14z" stroke="var(--ac)" strokeWidth="1" />
          <text x="100" y="118" textAnchor="middle" fill="var(--ond2)" style={{ fontFamily: "var(--fd)", fontSize: 44 }}>{initials(studio.name)}</text>
          <text x="100" y="150" textAnchor="middle" fill="var(--ac)" style={{ fontFamily: "var(--fb)", fontSize: 9, letterSpacing: 5 }}>{studio.name.toUpperCase().slice(0, 22)}</text>
        </svg>
      </div>}

      <header className="wrap hd">
        <button type="button" className="mbtn" aria-label="Open the menu" aria-expanded={menu} onClick={() => setMenu(true)}><Ic d={ICON.menu} size={26} /></button>
        <nav className="cap hnav" aria-label="Main" style={{ display: "flex", gap: 34 }}>{left.map(([h, t]) => <Link key={h} className="navl" href={h} aria-current={h === L(`/${page}`) ? "page" : undefined}>{t}</Link>)}</nav>
        <Link href={L("")} style={{ textAlign: "center", gridColumn: 2 }} aria-label={`${studio.name}, home`}>
          {studio.logoUrl && c.showLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="logo" src={studio.logoUrl} alt={studio.name} />
            : <span className="cz" style={{ display: "block", fontSize: "clamp(18px,2vw,26px)", letterSpacing: ".14em", lineHeight: 1.1 }}>{studio.name}</span>}
        </Link>
        <div className="cap" style={{ display: "flex", gap: 30, justifyContent: "flex-end", alignItems: "center" }}>
          {right.map(([h, t]) => <Link key={h} className="navl" href={h} aria-current={h === L(`/${page}`) ? "page" : undefined}>{t}</Link>)}
          <Link href={bookHref} className="gold shine hbook" style={{ padding: "13px 22px" }}>Book us</Link>
        </div>
      </header>

      <div className={`mnu${menu ? " on" : ""}`} aria-hidden={!menu}>
        <button type="button" className="x" aria-label="Close the menu" onClick={() => setMenu(false)} tabIndex={menu ? 0 : -1}><Ic d={ICON.x} size={26} /></button>
        {[[L(""), "Home"] as [string, string], ...more].map(([h, t], i) => (
          <Link key={h} href={h} onClick={() => setMenu(false)} tabIndex={menu ? 0 : -1} style={{ ["--i" as string]: i }}>{t}</Link>
        ))}
      </div>

      <main>
        {!home ? <InnerPage page={page} data={data} preview={preview} L={L} openAlbum={openAlbum} wa={wa} thanks={thanks} storyId={storyId} offerId={offerId} /> : mono ? <MonoHome data={data} L={L} openAlbum={openAlbum} /> : <>
        <section ref={hero} className="wrap hero" style={{ paddingTop: 30, paddingBottom: 120 }}>
          <div className="hcol" style={{ position: "relative", padding: "0 40px 70px 0" }}>
            <div className="card dev hmain" style={{ aspectRatio: "3 / 2", rotate: "-1.5deg", translate: "calc(var(--mx, 0) * -14px) calc(var(--my, 0) * -10px)", transition: "translate .6s ease-out", ...d(0.35) }}>
              <Ph p={photos[c.heroPhotos[0]]} alt={`${studio.name}: wedding photo`} eager crop={c.crop?.[`slide:${c.heroPhotos[0]}`] ?? c.crop?.hero0} sizes="(max-width: 860px) 92vw, 1400px" />
              {(heroMore.length > 0 || heroPhone.length > 0) && <HeroSlides slides={heroMore.map(id => photos[id])} crops={heroMore.map(id => c.crop?.[`slide:${id}`])} phone={heroPhone.map(id => photos[id])} phoneCrops={heroPhone.map(id => c.crop?.[`mslide:${id}`])} />}
            </div>
            <div className="card dev hsec" style={{ position: "absolute", right: 0, bottom: 0, width: "42%", aspectRatio: "3 / 3.6", rotate: "4deg", translate: "calc(var(--mx, 0) * 26px) calc(var(--my, 0) * 18px)", transition: "translate .6s ease-out", ...d(0.7) }}>
              <Ph p={photos[c.heroPhotos[1]]} alt={`${studio.name}: portrait`} eager crop={c.crop?.hero1} />
            </div>
            <div className="bob badge" aria-hidden="true" style={{ position: "absolute", left: -18, bottom: 18, width: 128, height: 128, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", translate: "calc(var(--mx, 0) * -30px) calc(var(--my, 0) * -22px)" }}>
              <svg className="spin" viewBox="0 0 128 128" width="128" height="128" style={{ position: "absolute", inset: 0 }}>
                <defs><path id="sgc" d="M64 64m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" /></defs>
                <text fill="var(--badget)" style={{ fontFamily: "var(--fb)", fontSize: 10, letterSpacing: "3.4px", fontWeight: 600 }}><textPath href="#sgc">BOOKING THIS SEASON ✦ BOOKING THIS SEASON ✦ </textPath></text>
              </svg>
              <span className="sc" style={{ fontSize: 40, color: "var(--badget)", lineHeight: 1 }}>{initials(studio.name).toLowerCase()}</span>
            </div>
          </div>
          <div className="htxt">
            {c.script && <div className="sc hscr" style={{ lineHeight: 1, marginLeft: 6 }}><span className="wr" style={d(0.4)}>{c.script}</span></div>}
            <h1 className="cz hh1" style={{ margin: "6px 0 0", lineHeight: 1.04, letterSpacing: ".04em" }}>
              {words.map((w, i) => (
                <span key={i}><span className="wd"><span style={d(0.7 + i * 0.15)}>{w}</span></span>{words.length <= 3 ? <br /> : " "}</span>
              ))}
            </h1>
            {c.kicker && <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "30px 0 26px" }}><span style={{ width: 70, height: 1, background: "var(--ac)", flex: "none" }} /><span className="cap">{c.kicker}</span></div>}
            {c.intro && <p className="hintro" style={{ margin: "0 0 34px", maxWidth: 420 }}>{c.intro}</p>}
            <div className="hbtns" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a href="#book" className={`cap gold shine btn${c.albums.length > 0 ? " hbk" : ""}`}>Book your date</a>
              {c.albums.length > 0 && <a href="#albums" className="cap ol">See our albums</a>}
              {/* Phones: Book us is already in the header, so the one button here opens the work. */}
              {c.albums.length > 0 && <a href="#albums" className="cap gold shine btn hwk">See our work</a>}
            </div>
          </div>
        </section>

        {c.events.length > 0 && !hide.includes("marquee") && (
          <div aria-hidden="true" style={{ overflow: "hidden", padding: "10px 0 40px" }}>
            <div className="mq cz out">{[...c.events, ...c.events, ...c.events, ...c.events].map((e, i) => <span key={i} className={i % 2 ? "fill" : undefined}>{e}</span>)}</div>
          </div>
        )}

        <section id="about" className="wrap g2 sec">
          <div className="rv">
            {aboutRest.length > 0 && <div className="sc sch">{aboutScript.toLowerCase()}</div>}
            <h2 className="cz h2" style={{ marginBottom: 26 }}>{aboutRest.length ? aboutRest.join(" ") : aboutScript}</h2>
            {c.aboutText.split(/\n+/).filter(Boolean).map((t, i) => <p key={i} style={{ margin: "0 0 18px", maxWidth: 460 }}>{t}</p>)}
            <a href="#book" className="cap ul" style={{ display: "inline-block", marginTop: 12 }}>Talk to the studio</a>
          </div>
          <Rise3D style={{ position: "relative", margin: "0 22px 22px 0" }}>
            <div className="frm" aria-hidden="true" style={{ position: "absolute", inset: 0, border: "1px solid var(--ac)", transform: "translate(22px, 22px)" }} />
            <div className="ph" style={{ position: "relative", aspectRatio: "4 / 4.6", overflow: "hidden" }}>
              <Ph className="par" crop={c.crop?.about} p={photos[c.aboutPhoto ?? ""]} alt={`${studio.name} at work`} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.15)" }} />
            </div>
          </Rise3D>
        </section>

        {c.albums.length > 0 && !hide.includes("albums") && (
          <section id="albums" style={{ paddingBottom: "clamp(70px,8vw,120px)" }}>
            <div className="wrap rv" style={{ textAlign: "center", marginBottom: 40 }}><Heading script="recent" title="Albums" /></div>
              <div className="wrap agrid">
                {c.albums.slice(0, 8).map((a, i) => <AlbumCard key={a.id} a={a} photo={photos[a.cover ?? a.photos[0] ?? ""]} crop={c.crop?.[`album:${a.id}`]} onOpen={() => openAlbum(a)} i={i} />)}
              </div>
            <div style={{ textAlign: "center", marginTop: 50 }}><Link href={L("/portfolio")} className="cap ol">View all albums</Link></div>
          </section>
        )}

        {c.filmId && !hide.includes("film") && (
          <section id="film" style={{ background: "var(--dark)", color: "var(--ond)", padding: "clamp(70px,9vw,120px) 0" }}>
            <div className="wrap" style={{ textAlign: "center" }}>
              <Heading script="wedding" title="Films" light />
              <div style={{ height: 40 }} />
              <FilmTheater id={c.filmId} title={c.filmTitle} big className="cine rv" poster={filmPoster || undefined} posterStyle={c.filmPhoto ? cropStyle(c.crop?.film) : undefined} />
              {c.filmTitle && <p className="pf" style={{ margin: "34px 0 0", fontSize: 22, fontStyle: "italic" }}>{c.filmTitle}</p>}
              {films.some(f => f.id !== c.filmId) && <Link href={L("/films")} className="cap ol fmore">More films</Link>}
            </div>
          </section>
        )}

        {(c.stories ?? []).length > 0 && !hide.includes("stories") && <HomeStories stories={(c.stories ?? []).slice(0, 4)} photos={photos} crops={c.crop} L={L} />}

        {liveOffers(data).length > 0 && !hide.includes("packages") ? (
          <section id="packages" className="wrap sec" style={{ textAlign: "center" }}>
            <Heading script="our" title="Packages" />
            <OfferCards data={data} L={L} limit={6} />
            {liveOffers(data).length > 6 && <div style={{ marginTop: 44 }}><Link href={L("/packages")} className="cap ol">All packages</Link></div>}
          </section>
        ) : packages.length > 0 && !hide.includes("packages") && (
          <section id="packages" className="wrap sec" style={{ textAlign: "center" }}>
            <Heading script="our" title="Packages" />
            <PackageBrowser packages={packages} heading="h3" ask={p => <a href="#book" className="cap ul" onClick={() => setAsk(p.name)}>Ask about this</a>} />
          </section>
        )}

        {nRev > 0 && !hide.includes("reviews") && (
          <section id="reviews" style={{ background: "var(--panel)", padding: "clamp(70px,9vw,120px) 28px clamp(80px,9vw,130px)", textAlign: "center" }}>
            <Heading script="kind" title="Words" />
            <div style={{ height: 56 }} />
            <div className="deck" aria-live="polite">
              {c.reviews.map((r, i) => {
                const k = (i - rev + nRev) % nRev;
                return (
                  <figure key={i} className="rvw" aria-hidden={k !== 0} style={{ margin: 0, ...(slot[k] ?? { ...slot[2], opacity: 0 }) }}>
                    <blockquote className="pf" style={{ margin: "0 0 20px", fontSize: "clamp(17px,2vw,22px)", fontStyle: "italic", lineHeight: 1.55 }}>“{r.text}”</blockquote>
                    {r.name && <figcaption className="cap">{r.name}</figcaption>}
                  </figure>
                );
              })}
            </div>
            {nRev > 1 && <button type="button" onClick={() => setRev((rev + 1) % nRev)} className="cap ol nrv" style={{ marginTop: 60, background: "transparent", cursor: "pointer", color: "var(--ink)", fontFamily: "inherit" }}>Next review</button>}
          </section>
        )}

        <section id="book" className="wrap sec">
          <div className="rv" style={{ background: "var(--card)", boxShadow: "0 30px 70px rgba(var(--sh),.16)", padding: "clamp(44px,6vw,70px) clamp(22px, 6vw, 90px)", textAlign: "center", borderTop: "4px solid var(--ac)" }}>
            <BookForm slug={data.slug} preview={preview} packages={bookChoices(data)} kinds={c.events} ask={ask} setAsk={setAsk} wa={wa} onDone={thanks} />
          </div>
        </section>
        </>}
      </main>

      {mono ? (
        <footer className="wrap mft">
          <div>
            <span>© {new Date().getFullYear()} {studio.name}</span>
            <span className="mfl"><Link href={L("/privacy")}>Privacy Policy</Link><Link href={L("/terms")}>Terms &amp; Conditions</Link><a href="https://stupanel.com" target="_blank" rel="noopener noreferrer">Made with StuPanel</a></span>
          </div>
          <div className="mfl">
            {c.instagram && <a href={c.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
            {c.youtube && <a href={c.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>}
            {c.facebook && <a href={c.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}
            {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>}
          </div>
        </footer>
      ) : (
      <footer style={{ background: "var(--dark)", color: "var(--ond)", position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ paddingTop: "clamp(70px,9vw,110px)", textAlign: "center" }}>
          <div className="sc rv" style={{ fontSize: "clamp(34px, 3.4vw, 48px)", lineHeight: 1, color: "var(--sc2)" }}>let us tell</div>
          <h2 className="cz rv" style={{ margin: "4px 0 28px", fontSize: "clamp(26px, 3.2vw, 46px)", letterSpacing: ".08em", lineHeight: 1.1 }}>Your story next</h2>
          <Link href={bookHref} className="cap fbtn" style={{ display: "inline-block", padding: "18px 38px", border: "1px solid var(--ond2)", color: "var(--ond2)" }}>Book your date</Link>
        </div>
        <div className="wrap" style={{ paddingTop: "clamp(60px,8vw,90px)" }}>
          <div className="fline" aria-hidden="true" style={{ height: 1, background: "var(--ond2)", opacity: 0.35, transformOrigin: "left" }} />
          <div className="fcols" style={{ padding: "60px 0 56px" }}>
            <div>
              <div className="cz" style={{ fontSize: 24, letterSpacing: ".14em", lineHeight: 1.2 }}>{studio.name}</div>
              {c.footerLine && <p style={{ margin: "20px 0 0", maxWidth: 260, opacity: 0.8 }}>{c.footerLine}</p>}
            </div>
            {(c.address || c.hours) && (
              <div>
                <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 16 }}>Office</div>
                {c.address && <address className="fadr">{addressLines(c.address)}</address>}
                {c.hours && <p className="fhrs">{c.hours}</p>}
              </div>
            )}
            {(c.phone || c.email || wa) && (
              <div className="fcon">
                <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 16 }}>Contact</div>
                {c.phone && <><a className="fl" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a><br /></>}
                {c.email && <><a className="fl fem" href={`mailto:${c.email}`}>{c.email}</a><br /></>}
                {wa && <a className="fl" href={wa} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>}
              </div>
            )}
            <div>
              <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 16 }}>Explore</div>
              {more.map(([h, t]) => <span key={h}><Link className="fl" href={h}>{t}</Link><br /></span>)}
            </div>
            {(c.facebook || c.instagram || c.youtube || wa) && (
              <div>
                <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 16 }}>Follow</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {c.facebook && <a className="fic" href={c.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Ic d={ICON.fb} /></a>}
                  {c.instagram && <a className="fic" href={c.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Ic d={ICON.ig} /></a>}
                  {c.youtube && <a className="fic" href={c.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Ic d={ICON.yt} /></a>}
                  {wa && <a className="fic" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><Ic d={ICON.wa} /></a>}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="wrap" style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", paddingTop: 22, paddingBottom: 26, fontSize: 12 }}>
          <span style={{ opacity: 0.75 }}>© {new Date().getFullYear()} {studio.name}. All rights reserved.</span>
          <span style={{ display: "flex", gap: 22, opacity: 0.75, flexWrap: "wrap" }}><Link className="fl" href={L("/privacy")}>Privacy</Link><Link className="fl" href={L("/terms")}>Terms</Link><a href="https://stupanel.com" target="_blank" rel="noopener noreferrer" className="fl">Made with StuPanel</a></span>
          <a href="#top" className="cap ftop" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: "var(--ond2)" }}>Back to top<span style={{ width: 44, height: 44, border: "1px solid var(--ond2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic d={<path d="M12 20V5M5 11l7-7 7 7" />} size={14} w={1.6} /></span></a>
        </div>
      </footer>
      )}

      {album && (
        <div className="ab" role="dialog" aria-modal="true" aria-label={album.title}>
          <div className="abh">
            <div style={{ minWidth: 0 }}>
              {album.tag && <div className="cap" style={{ fontSize: 9, color: "var(--mut)" }}>{album.tag}</div>}
              <div className="pf" style={{ fontSize: "clamp(20px,3vw,30px)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
            </div>
            <button type="button" className="abx" onClick={closeAlbum} aria-label="Close the album" autoFocus><Ic d={ICON.x} size={20} /></button>
          </div>
          <div className="abg">
            {shots.map((p, i) => (
              <button type="button" key={p.url} onClick={() => setShot(i)} aria-label={`Open photo ${i + 1} of ${shots.length}`} className={i === 0 && p.w > p.h ? "wide" : undefined} style={{ ["--i" as string]: Math.min(i, 12) }}>
                <Ph p={p} alt="" eager={i < 4} sizes="(max-width: 860px) 46vw, 32vw" />
              </button>
            ))}
          </div>
        </div>
      )}
      {album && shot !== null && shots[shot] && <PhotoViewer shots={shots} at={shot} title={album.title} onStep={step} onClose={closeShot} />}
      <div className={`stk${stuck ? " on" : ""}`} aria-hidden={!stuck}>
        <button type="button" className="mbtn2" aria-label="Open the menu" onClick={() => setMenu(true)} tabIndex={stuck ? 0 : -1}><Ic d={ICON.menu} size={24} /></button>
        <Link href={L("")} className="cz" tabIndex={stuck ? 0 : -1} style={{ fontSize: 17, letterSpacing: ".14em" }}>{studio.name}</Link>
        <Link href={bookHref} className="cap gold" tabIndex={stuck ? 0 : -1} style={{ padding: "11px 18px", fontSize: 10 }}>Book us</Link>
      </div>
      {wa && !album && <a className="waf" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"><Ic d={ICON.wa} size={26} w={1.6} /></a>}
      {/* Not inside the editor's phone frame (the studio knows it is a preview there); only on the full preview page. */}
      {preview && typeof window !== "undefined" && window.self === window.top && <div className="pvb" role="status">Preview: only you can see this</div>}
    </div>
  );
}

type Ev = { kind: string; other: string; date: string; shift: string; pkg: string };
const NEW_EV: Ev = { kind: "", other: "", date: "", shift: "", pkg: "" };
/** Events offered in the form when the studio has not listed its own. */
const DEFAULT_KINDS = ["Holud", "Mehendi", "Akdh", "Wedding", "Reception", "Engagement", "Birthday"];
const OTHER = "__other";
/** What the visitor put together on the Packages page, carried to the form (this browser tab only). */
export const buildKey = (slug: string) => `sg-build-${slug}`;
export type Build = { pkg: string; addons: string[]; /** Website package: its address, its days (one event each) and the plain names of the extras */ offer?: string; days?: string[]; extras?: string[] };
export function readBuild(slug: string): Build {
  try {
    const b = JSON.parse(sessionStorage.getItem(buildKey(slug)) || "null");
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === "string").slice(0, n) : []);
    return { pkg: typeof b?.pkg === "string" ? b.pkg : "", addons: list(b?.addons, 20), offer: typeof b?.offer === "string" ? b.offer : undefined, days: list(b?.days, 6), extras: list(b?.extras, 10) };
  } catch { return { pkg: "", addons: [] }; }
}

export function BookForm({ slug, preview, packages, kinds: own, ask, setAsk, wa, bare, onDone, chosen, offer }: {
  slug: string; preview?: boolean; packages: SitePackage[]; /** The studio's own events (Website → Home); empty = the usual ones */ kinds?: string[];
  ask: string; setAsk: (v: string) => void; wa: string;
  /** The page already has the heading */ bare?: boolean; /** After a sent enquiry (goes to the Thank-you page) */ onDone?: () => void;
  /** Extras picked on a package's own page (shown and sent instead of the remembered ones) */ chosen?: string[];
  /** The website package being booked: one event per day of it, and what to send with the enquiry */ offer?: { id: string; days: string[]; extras: string[] };
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  // The first event's package is `ask` (set by "Ask about this"); the others keep their own.
  // A website package opens one event per day of it (Holud, Wedding…): the visitor only picks the dates.
  const [events, setEvents] = useState<Ev[]>(() => {
    const b = typeof window === "undefined" ? null : readBuild(slug);
    const days = offer?.days ?? (b && b.offer && b.pkg === ask ? b.days ?? [] : []);
    return days.length ? days.slice(0, 6).map((k, i) => ({ ...NEW_EV, kind: k.slice(0, 60), pkg: i ? ask : "" })) : [NEW_EV];
  });
  const kinds = [...new Set((own ?? []).map(k => k.trim()).filter(k => k && k.length <= 60))];
  const kindList = [...new Set([...(kinds.length ? kinds : DEFAULT_KINDS), ...events.map(e => e.kind).filter(k => k && k !== OTHER)])];
  /** What goes with the enquiry for a website package: its address and the extras by their plain names */
  const pkgInfo = offer ?? (() => { if (typeof window === "undefined") return undefined; const b = readBuild(slug); return b.offer && b.pkg === ask ? { id: b.offer, days: b.days ?? [], extras: b.extras ?? [] } : undefined; })();
  const [kept, setAddons] = useState<string[]>(() => (typeof window === "undefined" ? [] : readBuild(slug).addons));
  const addons = chosen ?? kept;
  const setEv = (i: number, patch: Partial<Ev>) => setEvents(list => list.map((e, k) => (k === i ? { ...e, ...patch } : e)));

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const list = events.map((ev, i) => ({
      kind: (ev.kind === OTHER ? ev.other.trim() : ev.kind).slice(0, 60) || undefined,
      date: ev.date || undefined, shift: ev.shift || undefined, packageName: (i === 0 ? ask : ev.pkg) || undefined,
    })).filter(ev => ev.kind || ev.date || ev.shift || ev.packageName);
    const body = {
      name: String(f.get("name") || "").trim(), phone: String(f.get("phone") || "").trim(), email: String(f.get("email") || "").trim() || undefined,
      date: list.find(ev => ev.date)?.date, packageName: ask || undefined,
      events: list.length > 1 || list[0]?.shift || list[0]?.kind ? list : undefined, addons: addons.length ? addons : undefined,
      message: String(f.get("message") || "").trim() || undefined, website: String(f.get("website") || "") || undefined,
      ...(pkgInfo && ask ? { offerId: pkgInfo.id, extras: pkgInfo.extras.length ? pkgInfo.extras : undefined } : {}),
    };
    if (!body.name) return setErr("Please write your name.");
    if (body.phone.replace(/\D/g, "").length < 7) return setErr("Please write a phone number we can reach you on.");
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) return setErr("Please check the email address.");
    setErr("");
    const finish = () => { try { sessionStorage.removeItem(buildKey(slug)); } catch { /* private window */ } if (onDone) onDone(); else setDone(true); };
    if (preview) return finish();
    setBusy(true);
    try {
      const res = await fetch(`${API}/public/site/${slug}/enquiry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { siteTrack("lead", { content_name: body.packageName || undefined }); finish(); }
      else if (res.status === 429) setErr("Too many tries. Please wait a minute and send again.");
      else setErr("That did not go through. Please check the phone number and send again.");
    } catch {
      setErr("No internet connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="ok" role="status">
        <div className="sc sch">thank you</div>
        <h2 className="cz h2" style={{ marginBottom: 14 }}>Enquiry sent</h2>
        <p style={{ margin: "0 auto 26px", maxWidth: 460 }}>{preview ? "This is the preview, so nothing was sent." : "We have your date. The studio will call or message you soon."}</p>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="cap ol">Chat on WhatsApp now</a>}
      </div>
    );
  }
  return (
    <>
      {!bare && <>
        <div className="sc sch">save</div>
        <h2 className="cz h2" style={{ marginBottom: 14, letterSpacing: ".1em" }}>Your date</h2>
        <p style={{ margin: "0 auto 40px", maxWidth: 460 }}>Tell us the date and we will get back to you with a quote.</p>
      </>}
      <form onSubmit={send} style={{ textAlign: "left" }} noValidate>
        <div className="fm2" style={{ marginTop: 0 }}>
          <label><span className="cap" style={{ fontSize: 10 }}>Your name</span><input type="text" name="name" autoComplete="name" maxLength={150} required /></label>
          <label><span className="cap" style={{ fontSize: 10 }}>Phone or WhatsApp</span><input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} required /></label>
        </div>
        <label style={{ display: "block", marginTop: 26 }}><span className="cap" style={{ fontSize: 10 }}>Email</span><input type="email" name="email" autoComplete="email" inputMode="email" maxLength={255} spellCheck={false} autoCapitalize="none" /></label>
        {events.map((ev, i) => (
          <fieldset key={i} className="evr">
            <legend className="cap" style={{ fontSize: 10 }}>{events.length > 1 ? `Event ${i + 1}` : "Your event"}</legend>
            <label className="evk"><span className="cap" style={{ fontSize: 10 }}>Event</span>
              <select value={ev.kind} onChange={e => setEv(i, { kind: e.target.value })}>
                <option value="">Not sure</option>
                {kindList.map(k => <option key={k} value={k}>{k}</option>)}
                <option value={OTHER}>Other</option>
              </select>
            </label>
            {ev.kind === OTHER && <label className="evo"><span className="cap" style={{ fontSize: 10 }}>Which event?</span><input type="text" value={ev.other} maxLength={60} placeholder="e.g. Aqiqah, anniversary" onChange={e => setEv(i, { other: e.target.value })} /></label>}
            <label className="evd"><span className="cap" style={{ fontSize: 10 }}>Date</span><input type="date" value={ev.date} onChange={e => setEv(i, { date: e.target.value })} /></label>
            <label className="evt"><span className="cap" style={{ fontSize: 10 }}>Time of day</span>
              <select value={ev.shift} onChange={e => setEv(i, { shift: e.target.value })}>
                <option value="">Not sure</option><option>Morning</option><option>Day</option><option>Evening</option><option>Full day</option>
              </select>
            </label>
            {packages.length > 0 && (
              <label className="evp"><span className="cap" style={{ fontSize: 10 }}>Package</span>
                <select value={i === 0 ? ask : ev.pkg} onChange={e => (i === 0 ? setAsk(e.target.value) : setEv(i, { pkg: e.target.value }))}>
                  <option value="">Not sure</option>
                  {packages.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </label>
            )}
            {events.length > 1 && <button type="button" className="evx" aria-label={`Remove event ${i + 1}`} onClick={() => { if (i === 0) setAsk(events[1].pkg); setEvents(list => list.filter((_, k) => k !== i)); }}><Ic d={ICON.x} size={16} /></button>}
          </fieldset>
        ))}
        {events.length < 6 && <button type="button" className="cap ul" style={{ marginTop: 18, fontSize: 10 }} onClick={() => setEvents(list => [...list, NEW_EV])}>+ Add another event</button>}
        {addons.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <span className="cap" style={{ fontSize: 10, display: "block", marginBottom: 8 }}>Add-ons you picked</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {addons.map(a => <button type="button" key={a} className="chip" onClick={() => setAddons(l => l.filter(x => x !== a))} aria-label={`Remove ${a}`}>{a}<Ic d={ICON.x} size={12} /></button>)}
            </div>
          </div>
        )}
        <label style={{ display: "block", marginTop: 26 }}><span className="cap" style={{ fontSize: 10 }}>Anything we should know</span><textarea name="message" maxLength={1000} placeholder="Venue, number of guests, anything special" /></label>
        <label className="hp" aria-hidden="true">Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <div style={{ textAlign: "center", marginTop: 34 }}>
          <button type="submit" disabled={busy} className="cap gold shine btn" style={{ padding: "19px 44px", opacity: busy ? 0.6 : 1 }}>{busy ? "Sending" : "Send enquiry"}</button>
        </div>
      </form>
    </>
  );
}
