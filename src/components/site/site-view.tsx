"use client";

/**
 * A studio's public website (Home). One structure for every theme: the theme only changes the
 * colours, fonts and shapes in site.css. Used by /site/[slug] (published) and by the studio's
 * own preview of the draft.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { API_URL as API } from "@/lib/api";
import "./site.css";

export type SitePhoto = { url: string; w: number; h: number; blur: string };
export type SiteAlbum = { id: string; title: string; tag: string; cover: string | null; photos: string[] };
export type SitePackage = { id: string; name: string; group: string; price: number; currency: string; team: string; lines: string[] };
export type SiteContent = {
  script: string; headline: string; kicker: string; intro: string; heroPhotos: string[]; events: string[];
  aboutTitle: string; aboutText: string; aboutPhoto: string | null; albums: SiteAlbum[];
  filmUrl: string; filmTitle: string; filmPhoto: string | null; filmId?: string | null; showPackages: boolean;
  reviews: { text: string; name: string }[];
  phone: string; whatsapp: string; email: string; address: string; hours: string;
  facebook: string; instagram: string; youtube: string; footerLine: string;
};
export type SiteData = {
  slug: string; theme: string; studio: { name: string; logoUrl: string | null };
  content: SiteContent; photos: Record<string, SitePhoto>; packages: SitePackage[];
};

export const SITE_FONTS: Record<string, string> = {
  signature: "family=Cinzel+Decorative:wght@400;700&family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Montserrat:wght@400;500;600",
  editorial: "family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Jost:wght@300;400;500",
  cream: "family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=Pinyon+Script&family=DM+Sans:wght@300;400;500",
  dark: "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Pinyon+Script&family=Jost:wght@300;400;500",
  gold: "family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Pinyon+Script&family=Mulish:wght@300;400;600",
};
export const fontHref = (theme: string) => `https://fonts.googleapis.com/css2?${SITE_FONTS[theme] ?? SITE_FONTS.signature}&display=swap`;

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "S";
const money = (n: number, cur: string) => (cur === "BDT" ? `৳ ${n.toLocaleString("en-IN")}` : `${cur} ${n.toLocaleString("en-US")}`);
/** 017… (Bangladesh) → 88017…; anything else keeps its digits. */
const waLink = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? `https://wa.me/${d.startsWith("0") ? "88" + d : d}` : "";
};

const ICON = {
  fb: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />,
  ig: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".6" /></>,
  yt: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5l5 2.5-5 2.5z" /></>,
  wa: <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  prev: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  menu: <path d="M4 8h16M4 16h16" />,
};
const Ic = ({ d, size = 18, w = 1.5 }: { d: React.ReactNode; size?: number; w?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/** A photo that shows its tiny blurred copy until the real one arrives. */
function Ph({ p, alt, eager, className, style }: { p?: SitePhoto; alt: string; eager?: boolean; className?: string; style?: React.CSSProperties }) {
  if (!p) return <div className={`ph ${className ?? ""}`} style={{ width: "100%", height: "100%", ...style }} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`ph ${className ?? ""}`} src={p.url} alt={alt} width={p.w} height={p.h} loading={eager ? "eager" : "lazy"} decoding="async"
      fetchPriority={eager ? "high" : undefined} style={{ backgroundImage: `url(${p.blur})`, ...style }} />
  );
}

function Heading({ script, title, light }: { script: string; title: string; light?: boolean }) {
  return (
    <>
      <div className="sc sch" style={light ? { color: "var(--sc2)" } : undefined}>{script}</div>
      <h2 className="cz h2">{title}</h2>
    </>
  );
}

export function SiteView({ data, preview }: { data: SiteData; preview?: boolean }) {
  const { content: c, photos, studio, packages } = data;
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);
  const [album, setAlbum] = useState<SiteAlbum | null>(null);
  const [shot, setShot] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState(0);
  const [rev, setRev] = useState(0);
  const [ask, setAsk] = useState("");

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
  const openAlbum = (a: SiteAlbum) => { history.pushState({ sgAlbum: a.id }, ""); setAlbum(a); };
  const closeAlbum = useCallback(() => { if (history.state?.sgAlbum) history.back(); else { setAlbum(null); setShot(null); } }, []);
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
      if (e.key === "Escape") { if (menu) setMenu(false); else if (shot !== null) setShot(null); else closeAlbum(); }
      if (shot !== null && e.key === "ArrowRight") step(1);
      if (shot !== null && e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [album, menu, shot, step, closeAlbum]);
  const touch = useRef(0);

  const groups = Array.from(new Set(packages.map(p => p.group)));
  const shown = packages.filter(p => p.group === groups[Math.min(tab, groups.length - 1)]);
  const words = c.headline.split(/\s+/).filter(Boolean);
  const [aboutScript, ...aboutRest] = c.aboutTitle.split(/\s+/).filter(Boolean);
  const half = Math.ceil(c.albums.length / 2);
  const rows = c.albums.length > 5 ? [c.albums.slice(0, half), c.albums.slice(half)] : [c.albums];
  const filmPoster = c.filmPhoto && photos[c.filmPhoto] ? photos[c.filmPhoto].url : c.filmId ? `https://i.ytimg.com/vi/${c.filmId}/maxresdefault.jpg` : "";
  const wa = waLink(c.whatsapp || c.phone);
  const nav = [
    c.albums.length ? ["#albums", "Photos"] : null, c.filmId ? ["#film", "Films"] : null, ["#about", "About"],
    packages.length ? ["#packages", "Packages"] : null, c.reviews.length ? ["#reviews", "Reviews"] : null,
  ].filter(Boolean) as [string, string][];
  const left = nav.slice(0, Math.ceil(nav.length / 2)), right = nav.slice(Math.ceil(nav.length / 2));
  const d = (s: number) => ({ animationDelay: `calc(var(--d) + ${s}s)` });
  const slot = [
    { transform: "translateY(0) rotate(0deg) scale(1)", opacity: 1, zIndex: 3 },
    { transform: "translateY(22px) rotate(3deg) scale(.96)", opacity: 0.85, zIndex: 2 },
    { transform: "translateY(44px) rotate(-3deg) scale(.92)", opacity: 0.6, zIndex: 1 },
  ];
  const nRev = c.reviews.length;

  return (
    <div ref={root} id="top" className={`sg${data.theme && data.theme !== "signature" ? ` t-${data.theme}` : ""}`}>
      <link rel="stylesheet" href={fontHref(data.theme)} precedence="default" />
      <div className="prog" aria-hidden="true" />

      <div className="cur" aria-hidden="true">
        <svg width="190" height="190" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="92" stroke="var(--ac)" strokeWidth="1" />
          <path d="M100 22l14 14-14 14-14-14z" stroke="var(--ac)" strokeWidth="1" />
          <text x="100" y="118" textAnchor="middle" fill="var(--ond2)" style={{ fontFamily: "var(--fd)", fontSize: 44 }}>{initials(studio.name)}</text>
          <text x="100" y="150" textAnchor="middle" fill="var(--ac)" style={{ fontFamily: "var(--fb)", fontSize: 9, letterSpacing: 5 }}>{studio.name.toUpperCase().slice(0, 22)}</text>
        </svg>
      </div>

      <header className="wrap hd">
        <button type="button" className="mbtn" aria-label="Open the menu" aria-expanded={menu} onClick={() => setMenu(true)}><Ic d={ICON.menu} size={26} /></button>
        <nav className="cap hnav" aria-label="Main" style={{ display: "flex", gap: 34 }}>{left.map(([h, t]) => <a key={h} className="navl" href={h}>{t}</a>)}</nav>
        <a href="#top" style={{ textAlign: "center", gridColumn: 2 }} aria-label={studio.name}>
          {studio.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="logo" src={studio.logoUrl} alt={studio.name} />
            : <span className="cz" style={{ display: "block", fontSize: "clamp(18px,2vw,26px)", letterSpacing: ".14em", lineHeight: 1.1 }}>{studio.name}</span>}
        </a>
        <div className="cap" style={{ display: "flex", gap: 30, justifyContent: "flex-end", alignItems: "center" }}>
          {right.map(([h, t]) => <a key={h} className="navl" href={h}>{t}</a>)}
          <a href="#book" className="gold shine hbook" style={{ padding: "13px 22px" }}>Book us</a>
        </div>
      </header>

      <div className={`mnu${menu ? " on" : ""}`} aria-hidden={!menu}>
        <button type="button" className="x" aria-label="Close the menu" onClick={() => setMenu(false)} tabIndex={menu ? 0 : -1}><Ic d={ICON.x} size={26} /></button>
        {[...nav, ["#book", "Book us"] as [string, string]].map(([h, t], i) => (
          <a key={h} href={h} onClick={() => setMenu(false)} tabIndex={menu ? 0 : -1} style={{ ["--i" as string]: i }}>{t}</a>
        ))}
      </div>

      <main>
        <section ref={hero} className="wrap hero" style={{ paddingTop: 30, paddingBottom: 120 }}>
          <div className="hcol" style={{ position: "relative", padding: "0 40px 70px 0" }}>
            <div className="card dev" style={{ aspectRatio: "4 / 3.1", rotate: "-1.5deg", translate: "calc(var(--mx, 0) * -14px) calc(var(--my, 0) * -10px)", transition: "translate .6s ease-out", ...d(0.35) }}>
              <Ph p={photos[c.heroPhotos[0]]} alt={`${studio.name}: wedding photo`} eager />
            </div>
            <div className="card dev" style={{ position: "absolute", right: 0, bottom: 0, width: "42%", aspectRatio: "3 / 3.6", rotate: "4deg", translate: "calc(var(--mx, 0) * 26px) calc(var(--my, 0) * 18px)", transition: "translate .6s ease-out", ...d(0.7) }}>
              <Ph p={photos[c.heroPhotos[1]]} alt={`${studio.name}: portrait`} eager />
            </div>
            <div className="bob badge" aria-hidden="true" style={{ position: "absolute", left: -18, bottom: 18, width: 128, height: 128, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", translate: "calc(var(--mx, 0) * -30px) calc(var(--my, 0) * -22px)" }}>
              <svg className="spin" viewBox="0 0 128 128" width="128" height="128" style={{ position: "absolute", inset: 0 }}>
                <defs><path id="sgc" d="M64 64m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" /></defs>
                <text fill="var(--badget)" style={{ fontFamily: "var(--fb)", fontSize: 10, letterSpacing: "3.4px", fontWeight: 600 }}><textPath href="#sgc">BOOKING THIS SEASON ✦ BOOKING THIS SEASON ✦ </textPath></text>
              </svg>
              <span className="sc" style={{ fontSize: 40, color: "var(--badget)", lineHeight: 1 }}>{initials(studio.name).toLowerCase()}</span>
            </div>
          </div>
          <div>
            {c.script && <div className="sc" style={{ fontSize: "clamp(44px, 5vw, 74px)", lineHeight: 1, marginLeft: 6 }}><span className="wr" style={d(0.4)}>{c.script}</span></div>}
            <h1 className="cz" style={{ margin: "6px 0 0", fontSize: "clamp(42px, 6.2vw, 96px)", lineHeight: 1.04, letterSpacing: ".04em" }}>
              {words.map((w, i) => (
                <span key={i}><span className="wd"><span style={d(0.7 + i * 0.15)}>{w}</span></span>{words.length <= 3 ? <br /> : " "}</span>
              ))}
            </h1>
            {c.kicker && <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "30px 0 26px" }}><span style={{ width: 70, height: 1, background: "var(--ac)", flex: "none" }} /><span className="cap">{c.kicker}</span></div>}
            {c.intro && <p style={{ margin: "0 0 34px", maxWidth: 420 }}>{c.intro}</p>}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a href="#book" className="cap gold shine btn">Book your date</a>
              {c.albums.length > 0 && <a href="#albums" className="cap ol">See our albums</a>}
            </div>
          </div>
        </section>

        {c.events.length > 0 && (
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
          <div style={{ position: "relative", margin: "0 22px 22px 0" }}>
            <div className="frm" aria-hidden="true" style={{ position: "absolute", inset: 0, border: "1px solid var(--ac)", transform: "translate(22px, 22px)" }} />
            <div className="ph" style={{ position: "relative", aspectRatio: "4 / 4.6", overflow: "hidden" }}>
              <Ph className="par" p={photos[c.aboutPhoto ?? ""]} alt={`${studio.name} at work`} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.15)" }} />
            </div>
          </div>
        </section>

        {c.albums.length > 0 && (
          <section id="albums" style={{ paddingBottom: "clamp(80px,10vw,150px)", overflow: "hidden" }}>
            <div className="wrap rv" style={{ textAlign: "center", marginBottom: 54 }}><Heading script="recent" title="Albums" /></div>
            {rows.map((row, r) => (
              <div key={r} className={`rowx ${r ? "slR" : "slL"}`} style={{ marginBottom: r ? 0 : 26, padding: "14px 0" }}>
                {[...row, ...(row.length < 6 ? row : [])].map((a, i) => (
                  <button type="button" key={`${a.id}-${i}`} className="al" onClick={() => openAlbum(a)} aria-label={`Open the album ${a.title}`}>
                    <Ph p={photos[a.cover ?? a.photos[0] ?? ""]} alt="" />
                    <span className="nm"><span className="pf" style={{ fontSize: 21 }}>{a.title}</span><span className="ln" />{a.tag && <span className="cap" style={{ fontSize: 9 }}>{a.tag}</span>}</span>
                  </button>
                ))}
              </div>
            ))}
          </section>
        )}

        {c.filmId && (
          <section id="film" style={{ background: "var(--dark)", color: "var(--ond)", padding: "clamp(70px,9vw,120px) 0" }}>
            <div className="wrap" style={{ textAlign: "center" }}>
              <Heading script="wedding" title="Films" light />
              <div style={{ height: 50 }} />
              {playing ? (
                <div className="film"><iframe src={`https://www.youtube-nocookie.com/embed/${c.filmId}?autoplay=1&rel=0`} title={c.filmTitle || "Wedding film"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
              ) : (
                <button type="button" className="film iris" onClick={() => setPlaying(true)} aria-label={`Play ${c.filmTitle || "the wedding film"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {filmPoster && <img src={filmPoster} alt="" loading="lazy" decoding="async" />}
                  <span className="play"><span className="gold"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 5 }}><path d="M6 4l14 8-14 8z" /></svg></span></span>
                </button>
              )}
              {c.filmTitle && <p className="pf" style={{ margin: "34px 0 0", fontSize: 22, fontStyle: "italic" }}>{c.filmTitle}</p>}
            </div>
          </section>
        )}

        {packages.length > 0 && (
          <section id="packages" className="wrap sec" style={{ textAlign: "center" }}>
            <Heading script="our" title="Packages" />
            {groups.length > 1 && (
              <div className="cap" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", margin: "30px 0 14px" }}>
                {groups.map((g, i) => <button key={g} type="button" className="tab cap" onClick={() => setTab(i)} aria-pressed={i === tab}>{g}</button>)}
              </div>
            )}
            <div className="g3" style={{ marginTop: 30 }}>
              {shown.map((p, i) => (
                <div key={`${tab}-${p.id}`} className="pk" style={{ animationName: `sgpk${i % 3}`, animationDelay: `${i * 0.12}s` }}>
                  <h3 className="pf" style={{ margin: 0, fontSize: 30, fontWeight: 400 }}>{p.name}</h3>
                  <div className="pf" style={{ fontSize: 24, color: "var(--mut)", margin: "8px 0 6px", fontVariantNumeric: "tabular-nums" }}>{money(p.price, p.currency)}</div>
                  {p.team && <div className="cap" style={{ fontSize: 10, marginBottom: 20 }}>{p.team}</div>}
                  <p style={{ margin: "0 0 26px", whiteSpace: "pre-line" }}>{p.lines.join("\n")}</p>
                  <a href="#book" className="cap ul" onClick={() => setAsk(p.name)}>Ask about this</a>
                </div>
              ))}
            </div>
          </section>
        )}

        {nRev > 0 && (
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
            {nRev > 1 && <button type="button" onClick={() => setRev((rev + 1) % nRev)} className="cap ol" style={{ marginTop: 60, background: "transparent", cursor: "pointer", color: "var(--ink)", fontFamily: "inherit" }}>Next review</button>}
          </section>
        )}

        <section id="book" className="wrap sec">
          <div className="rv" style={{ background: "var(--card)", boxShadow: "0 30px 70px rgba(var(--sh),.16)", padding: "clamp(44px,6vw,70px) clamp(22px, 6vw, 90px)", textAlign: "center", borderTop: "4px solid var(--ac)" }}>
            <BookForm slug={data.slug} preview={preview} packages={packages} ask={ask} setAsk={setAsk} wa={wa} />
          </div>
        </section>
      </main>

      <footer style={{ background: "var(--dark)", color: "var(--ond)", position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ paddingTop: "clamp(70px,9vw,110px)", textAlign: "center" }}>
          <div className="sc rv" style={{ fontSize: "clamp(44px, 5vw, 70px)", lineHeight: 1, color: "var(--sc2)" }}>let us tell</div>
          <h2 className="cz rv" style={{ margin: "4px 0 34px", fontSize: "clamp(30px, 5vw, 76px)", letterSpacing: ".08em", lineHeight: 1.1 }}>Your story next</h2>
          <a href="#book" className="cap fbtn" style={{ display: "inline-block", padding: "18px 38px", border: "1px solid var(--ond2)", color: "var(--ond2)" }}>Book your date</a>
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
                <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 16 }}>Studio</div>
                <div style={{ opacity: 0.85, whiteSpace: "pre-line" }}>{[c.address, c.hours].filter(Boolean).join("\n")}</div>
              </div>
            )}
            {(c.phone || c.email || wa) && (
              <div>
                <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 16 }}>Contact</div>
                {c.phone && <><a className="fl" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a><br /></>}
                {c.email && <><a className="fl" href={`mailto:${c.email}`} style={{ overflowWrap: "anywhere" }}>{c.email}</a><br /></>}
                {wa && <a className="fl" href={wa} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>}
              </div>
            )}
            <div>
              <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 16 }}>Explore</div>
              {[...nav, ["#book", "Book us"] as [string, string]].map(([h, t]) => <span key={h}><a className="fl" href={h}>{t}</a><br /></span>)}
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
        <div aria-hidden="true" className="fbig cz">{studio.name}</div>
        <div className="wrap" style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", paddingTop: 22, paddingBottom: 26, fontSize: 12 }}>
          <span style={{ opacity: 0.75 }}>© {new Date().getFullYear()} {studio.name}. All rights reserved.</span>
          <a href="https://stupanel.com" target="_blank" rel="noopener noreferrer" className="fl" style={{ opacity: 0.6 }}>Made with StuPanel</a>
          <a href="#top" className="cap ftop" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: "var(--ond2)" }}>Back to top<span style={{ width: 44, height: 44, border: "1px solid var(--ond2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic d={<path d="M12 20V5M5 11l7-7 7 7" />} size={14} w={1.6} /></span></a>
        </div>
      </footer>

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
              <button type="button" key={p.url} onClick={() => setShot(i)} aria-label={`Open photo ${i + 1} of ${shots.length}`} style={{ ["--i" as string]: Math.min(i, 12) }}>
                <Ph p={p} alt="" eager={i < 4} />
              </button>
            ))}
          </div>
        </div>
      )}
      {album && shot !== null && shots[shot] && (
        <div className="vw" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setShot(null)}
          onTouchStart={e => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={e => { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) { e.preventDefault(); step(dx < 0 ? 1 : -1); } }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={shots[shot].url} src={shots[shot].url} alt={`${album.title}, photo ${shot + 1}`} onClick={e => e.stopPropagation()} />
          <button type="button" className="vx" aria-label="Close the photo" onClick={() => setShot(null)}><Ic d={ICON.x} size={20} /></button>
          {shots.length > 1 && <>
            <button type="button" className="vp" aria-label="Previous photo" onClick={e => { e.stopPropagation(); step(-1); }}><Ic d={ICON.prev} size={20} /></button>
            <button type="button" className="vn" aria-label="Next photo" onClick={e => { e.stopPropagation(); step(1); }}><Ic d={ICON.next} size={20} /></button>
          </>}
          <div className="vc" aria-hidden="true">{shot + 1} / {shots.length}</div>
        </div>
      )}
      {preview && <div className="pvb" role="status">Preview: only you can see this</div>}
    </div>
  );
}

function BookForm({ slug, preview, packages, ask, setAsk, wa }: { slug: string; preview?: boolean; packages: SitePackage[]; ask: string; setAsk: (v: string) => void; wa: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get("name") || "").trim(), phone: String(f.get("phone") || "").trim(),
      date: String(f.get("date") || "") || undefined, packageName: ask || undefined,
      message: String(f.get("message") || "").trim() || undefined, website: String(f.get("website") || "") || undefined,
    };
    if (!body.name) return setErr("Please write your name.");
    if (body.phone.replace(/\D/g, "").length < 7) return setErr("Please write a phone number we can reach you on.");
    setErr("");
    if (preview) return setDone(true);
    setBusy(true);
    try {
      const res = await fetch(`${API}/public/site/${slug}/enquiry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) setDone(true);
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
        <svg width="74" height="74" viewBox="0 0 74 74" fill="none" aria-hidden="true" style={{ margin: "0 auto 18px", display: "block" }}>
          <circle cx="37" cy="37" r="36" stroke="var(--ac)" strokeWidth="1" /><path className="okc" d="M22 38l10 10 20-22" stroke="var(--ac)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="sc sch">thank you</div>
        <h2 className="cz h2" style={{ marginBottom: 14 }}>Enquiry sent</h2>
        <p style={{ margin: "0 auto 26px", maxWidth: 460 }}>{preview ? "This is the preview, so nothing was sent." : "We have your date. The studio will call or message you soon."}</p>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="cap ol">Chat on WhatsApp now</a>}
      </div>
    );
  }
  return (
    <>
      <div className="sc sch">save</div>
      <h2 className="cz h2" style={{ marginBottom: 14, letterSpacing: ".1em" }}>Your date</h2>
      <p style={{ margin: "0 auto 40px", maxWidth: 460 }}>Tell us the date and we will get back to you with a quote.</p>
      <form onSubmit={send} style={{ textAlign: "left" }} noValidate>
        <div className="fm">
          <label><span className="cap" style={{ fontSize: 10 }}>Your name</span><input type="text" name="name" autoComplete="name" maxLength={150} required /></label>
          <label><span className="cap" style={{ fontSize: 10 }}>Phone or WhatsApp</span><input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} required /></label>
          <label><span className="cap" style={{ fontSize: 10 }}>Wedding date</span><input type="date" name="date" /></label>
        </div>
        <div className="fm2">
          {packages.length > 0 && (
            <label><span className="cap" style={{ fontSize: 10 }}>Package (if you have one in mind)</span>
              <select name="packageName" value={ask} onChange={e => setAsk(e.target.value)}>
                <option value="">Not sure yet</option>
                {packages.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </label>
          )}
          <label style={packages.length ? undefined : { gridColumn: "1 / -1" }}><span className="cap" style={{ fontSize: 10 }}>Anything we should know</span><textarea name="message" maxLength={1000} placeholder="Venue, events, number of days" /></label>
        </div>
        <label className="hp" aria-hidden="true">Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <div style={{ textAlign: "center", marginTop: 34 }}>
          <button type="submit" disabled={busy} className="cap gold shine btn" style={{ padding: "19px 44px", opacity: busy ? 0.6 : 1 }}>{busy ? "Sending" : "Send enquiry"}</button>
        </div>
      </form>
    </>
  );
}
