"use client";

/**
 * The inner pages of a studio's website (Portfolio, Films, Packages, About, Reviews, FAQ, Contact,
 * Privacy, Terms). They sit inside the same header and footer as Home and take every colour, font
 * and shape from the theme, so each look carries through the whole site.
 */
import Link from "next/link";
import { useState } from "react";
import { FilmTheater } from "./site-film";
import { AlbumCard, BookForm, MonoAlbums, MonoRows, Ph, buildKey, money, readBuild, type SiteAlbum, type SiteData, type SitePageName } from "./site-view";

type Props = { page: SitePageName; data: SiteData; preview?: boolean; L: (path: string) => string; openAlbum: (a: SiteAlbum) => void; wa: string; thanks: () => void; storyId?: string };

const TITLES: Record<Exclude<SitePageName, "home">, [string, string]> = {
  portfolio: ["our", "Portfolio"], films: ["wedding", "Films"], packages: ["our", "Packages"], about: ["about", "The studio"],
  reviews: ["kind", "Words"], faq: ["good to", "Know"], contact: ["save", "Your date"], privacy: ["your", "Privacy"], terms: ["the", "Terms"],
  stories: ["wedding", "Stories"], "thank-you": ["thank", "You"], notfound: ["lost", "Page"],
};

function PageHead({ script, title, sub }: { script: string; title: string; sub?: string }) {
  // A long title (a story's name) is set smaller so it stays two or three lines on a phone.
  const long = title.length > 24;
  return (
    <div className="wrap pgh">
      <div className="sc" style={{ fontSize: long ? "clamp(30px, 3.4vw, 46px)" : "clamp(44px, 5vw, 70px)", lineHeight: 1 }}><span className="wr" style={{ animationDelay: ".1s" }}>{script}</span></div>
      <h1 className="cz" style={{ margin: long ? "10px auto 0" : "4px 0 0", maxWidth: long ? 900 : undefined, fontSize: long ? "clamp(24px, 3.6vw, 50px)" : "clamp(36px, 5.4vw, 80px)", lineHeight: long ? 1.2 : 1.06, letterSpacing: long ? ".03em" : ".06em", textWrap: "balance" }}>
        {title.split(/\s+/).map((w, i) => <span key={i}><span className="wd"><span style={{ animationDelay: `${0.25 + i * 0.12}s` }}>{w}</span></span>{" "}</span>)}
      </h1>
      <div className="pgl" aria-hidden="true" />
      {sub && <p style={{ margin: "22px auto 0", maxWidth: 520 }}>{sub}</p>}
    </div>
  );
}

function Film({ id, title, poster }: { id: string; title: string; poster?: string }) {
  return (
    <figure className="rv" style={{ margin: 0 }}>
      <FilmTheater id={id} title={title} poster={poster} />
      {title && <figcaption className="pf" style={{ marginTop: 16, fontSize: 19, fontStyle: "italic", textAlign: "center" }}>{title}</figcaption>}
    </figure>
  );
}

const longDate = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

export function InnerPage({ page, data, preview, L, openAlbum, wa, thanks, storyId }: Props) {
  // Films page: ten at a time.
  const [filmCount, setFilmCount] = useState(10);
  const { content: c, photos, packages, studio } = data;
  const addons = data.addons ?? [];
  // Build your own: one package and any add-ons; the choice travels to the booking form.
  const [pick, setPick] = useState(() => (typeof window === "undefined" ? "" : readBuild(data.slug).pkg));
  const [extra, setExtra] = useState<string[]>(() => (typeof window === "undefined" ? [] : readBuild(data.slug).addons));
  const keep = (pkg: string, list: string[]) => { try { sessionStorage.setItem(buildKey(data.slug), JSON.stringify({ pkg, addons: list })); } catch { /* private window */ } };
  const [tag, setTag] = useState("");
  const [tab, setTab] = useState(0);
  const [ask, setAsk] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("package") ?? readBuild(data.slug).pkg));
  if (page === "home") return null;
  const [script, title] = TITLES[page];
  /** The gallery look has its own, plainer pages. */
  const mono = data.theme === "mono";
  const askHref = (name: string) => `${L("/contact")}${preview ? "&" : "?"}package=${encodeURIComponent(name)}`;
  const cta = (
    <div className="wrap rv" style={{ textAlign: "center", paddingBottom: "clamp(70px,9vw,130px)" }}>
      <Link href={L("/contact")} className="cap gold shine btn">Book your date</Link>
    </div>
  );

  if (page === "portfolio") {
    const tags = Array.from(new Set(c.albums.map(a => a.tag).filter(Boolean)));
    const list = c.albums.filter(a => !tag || a.tag === tag);
    if (mono) return (
      <section className="wrap" style={{ paddingBottom: "clamp(70px,9vw,130px)" }}>
        <div className="mhd">
          <h1 className="cz">Work</h1>
          {tags.length > 1 && <div className="mtabs">{["", ...tags].map(t => <button key={t} type="button" onClick={() => setTag(t)} aria-pressed={t === tag}>{t || "All work"}</button>)}</div>}
        </div>
        <MonoAlbums key={tag} albums={list} photos={photos} crops={c.crop} onOpen={openAlbum} rows />
        {list.length === 0 && <p>Albums are on their way.</p>}
      </section>
    );
    return (
      <>
        <PageHead script={script} title={title} sub="Every album is one family's day. Open one to see it in full." />
        {tags.length > 1 && (
          <div className="cap wrap" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
            {["", ...tags].map(t => <button key={t} type="button" className="tab cap" onClick={() => setTag(t)} aria-pressed={t === tag}>{t || "All"}</button>)}
          </div>
        )}
        <section className="wrap pgrid" style={{ paddingTop: 46, paddingBottom: "clamp(70px,9vw,130px)" }}>
          {list.map((a, i) => (
            <AlbumCard key={`${tag}-${a.id}`} a={a} photo={photos[a.cover ?? a.photos[0] ?? ""]} crop={c.crop?.[`album:${a.id}`]} onOpen={() => openAlbum(a)} i={i} eager={i < 4} count />
          ))}
          {list.length === 0 && <p style={{ gridColumn: "1 / -1", textAlign: "center" }}>Albums are on their way.</p>}
        </section>
        {cta}
      </>
    );
  }

  if (page === "films") {
    const films = [...(c.filmId ? [{ id: c.filmId, title: c.filmTitle, poster: c.filmPhoto ? photos[c.filmPhoto]?.url : undefined }] : []),
      ...(c.films ?? []).filter(f => f.id !== c.filmId).map(f => ({ id: f.id, title: f.title, poster: undefined as string | undefined }))];
    return (
      <>
        <PageHead script={script} title={title} sub="Cut to the sound of the day itself. Press play and turn the volume up." />
        <section className="wrap" style={{ paddingTop: 50, paddingBottom: "clamp(70px,9vw,130px)" }}>
          {films[0] && <div style={{ maxWidth: 1080, margin: "0 auto 60px" }}><Film {...films[0]} /></div>}
          <div className="g2" style={{ gap: 40, alignItems: "start" }}>{films.slice(1, filmCount).map(f => <Film key={f.id} {...f} />)}</div>
          {films.length > filmCount && (
            <div style={{ textAlign: "center", marginTop: 56 }}>
              <button type="button" className="cap ol" style={{ background: "transparent", color: "var(--ink)", fontFamily: "inherit", cursor: "pointer" }} onClick={() => setFilmCount(n => n + 10)}>
                Load more films ({films.length - filmCount} more)
              </button>
            </div>
          )}
          {films.length === 0 && <p style={{ textAlign: "center" }}>Films are on their way.</p>}
        </section>
        {cta}
      </>
    );
  }

  if (page === "packages") {
    const groups = Array.from(new Set(packages.map(p => p.group)));
    const shown = packages.filter(p => p.group === groups[Math.min(tab, groups.length - 1)]);
    return (
      <>
        <PageHead script={script} title={title} sub="Clear prices, no surprises. Tell us your events and we will shape one around your days." />
        <section className="wrap" style={{ paddingTop: 30, paddingBottom: "clamp(70px,9vw,130px)", textAlign: "center" }}>
          {groups.length > 1 && (
            <div className="cap" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
              {groups.map((g, i) => <button key={g} type="button" className="tab cap" onClick={() => setTab(i)} aria-pressed={i === tab}>{g}</button>)}
            </div>
          )}
          <div className="g3" style={{ marginTop: 30 }}>
            {shown.map((p, i) => (
              <div key={`${tab}-${p.id}`} className="pk" style={{ animationName: `sgpk${i % 3}`, animationDelay: `${0.2 + i * 0.1}s` }}>
                <h2 className="pf" style={{ margin: 0, fontSize: 30, fontWeight: 400 }}>{p.name}</h2>
                <div className="pf" style={{ fontSize: 24, color: "var(--mut)", margin: "8px 0 6px", fontVariantNumeric: "tabular-nums" }}>{money(p.price, p.currency)}</div>
                {p.team && <div className="cap" style={{ fontSize: 10, marginBottom: 20 }}>{p.team}</div>}
                <p style={{ margin: "0 0 26px", whiteSpace: "pre-line" }}>{p.lines.join("\n")}</p>
                <Link href={askHref(p.name)} className="cap ul">Ask about this</Link>
              </div>
            ))}
          </div>
          {packages.length === 0 && <p>Ask us for the current packages.</p>}
          {packages.length > 0 && addons.length > 0 && (() => {
            const chosen = packages.find(p => p.name === pick);
            const cur = (chosen ?? packages[0]).currency;
            const total = (chosen?.price ?? 0) + addons.filter(a => extra.includes(a.name)).reduce((n, a) => n + a.price, 0);
            const toggle = (name: string) => { const list = extra.includes(name) ? extra.filter(x => x !== name) : [...extra, name]; setExtra(list); keep(pick, list); };
            return (
              <div id="build" style={{ marginTop: "clamp(70px,9vw,120px)" }}>
                <div className="sc sch rv">build</div>
                <h2 className="cz h2 rv">Your own</h2>
                <div className="bld">
                  <div>
                    <div className="cap" style={{ fontSize: 10, color: "var(--mut)", marginBottom: 12 }}>1. Start with a package</div>
                    {packages.map(p => (
                      <label key={p.id} className="opt"><input type="radio" name="sg-pkg" checked={pick === p.name} onChange={() => { setPick(p.name); keep(p.name, extra); }} />
                        <span><span className="pf" style={{ fontSize: 19 }}>{p.name}</span>{p.group && <span style={{ display: "block", fontSize: 12, color: "var(--mut)" }}>{p.group}</span>}</span><span className="pr">{money(p.price, p.currency)}</span></label>
                    ))}
                    <div className="cap" style={{ fontSize: 10, color: "var(--mut)", margin: "30px 0 12px" }}>2. Add what you need</div>
                    {addons.map(a => (
                      <label key={a.id} className="opt"><input type="checkbox" checked={extra.includes(a.name)} onChange={() => toggle(a.name)} />
                        <span>{a.name}</span><span className="pr">+ {money(a.price, a.currency)}</span></label>
                    ))}
                  </div>
                  <div className="sum" aria-live="polite">
                    <div className="cap" style={{ fontSize: 10, color: "var(--ond2)", marginBottom: 14 }}>Your package</div>
                    <div className="row"><span>{chosen?.name ?? "No package yet"}</span><span>{chosen ? money(chosen.price, chosen.currency) : ""}</span></div>
                    {addons.filter(a => extra.includes(a.name)).map(a => <div className="row" key={a.id} style={{ opacity: 0.85 }}><span>{a.name}</span><span>{money(a.price, a.currency)}</span></div>)}
                    <div className="row tot"><span>Total</span><span>{money(total, cur)}</span></div>
                    <p style={{ margin: "14px 0 22px", fontSize: 13, opacity: 0.75 }}>A guide price for one event. The studio confirms the final quote.</p>
                    <Link href={L("/contact")} className="cap gold shine btn" style={{ display: "block", textAlign: "center" }} onClick={() => keep(pick, extra)}>Send this to the studio</Link>
                  </div>
                </div>
              </div>
            );
          })()}
          <p className="rv" style={{ margin: "56px auto 26px", maxWidth: 520 }}>Need something between two packages, or more days? We make custom quotes every week.</p>
          <Link href={L("/contact")} className="cap ol">Ask for a custom quote</Link>
        </section>
      </>
    );
  }

  if (page === "about" && mono) {
    const banner = c.aboutPhoto ? photos[c.aboutPhoto] : undefined;
    return (
      <>
        {banner && <div className="mban"><Ph p={banner} alt={`${studio.name} at work`} eager sizes="100vw" crop={c.crop?.about} /></div>}
        <section className="wrap mab">
          <h1 className="cz">About {studio.name}</h1>
          <div>
            {c.aboutTitle && <p className="mlead">{c.aboutTitle}</p>}
            {c.aboutText.split(/\n+/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
            {(c.address || c.hours) && <p style={{ whiteSpace: "pre-line", color: "var(--mut)" }}>{[c.address, c.hours].filter(Boolean).join("\n")}</p>}
            <p style={{ marginTop: 30 }}><Link href={L("/contact")} className="mlk">Book us</Link></p>
          </div>
        </section>
      </>
    );
  }

  if (page === "about") {
    return (
      <>
        <PageHead script={script} title={title} />
        <section className="wrap g2 sec">
          <div className="rv">
            <h2 className="cz h2" style={{ marginBottom: 26 }}>{c.aboutTitle}</h2>
            {c.aboutText.split(/\n+/).filter(Boolean).map((t, i) => <p key={i} style={{ margin: "0 0 18px", maxWidth: 480 }}>{t}</p>)}
            {(c.address || c.hours) && <p style={{ margin: "26px 0 0", whiteSpace: "pre-line", color: "var(--mut)" }}>{[c.address, c.hours].filter(Boolean).join("\n")}</p>}
            <Link href={L("/contact")} className="cap gold shine btn" style={{ marginTop: 30 }}>Talk to the studio</Link>
          </div>
          <div style={{ position: "relative", margin: "0 22px 22px 0" }}>
            <div className="frm" aria-hidden="true" style={{ position: "absolute", inset: 0, border: "1px solid var(--ac)", transform: "translate(22px, 22px)" }} />
            <div className="ph" style={{ position: "relative", aspectRatio: "4 / 4.6", overflow: "hidden" }}>
              <Ph className="par" crop={c.crop?.about} p={photos[c.aboutPhoto ?? ""]} alt={`${studio.name} at work`} eager style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.15)" }} />
            </div>
          </div>
        </section>
        {c.events.length > 0 && (
          <div aria-hidden="true" style={{ overflow: "hidden", padding: "0 0 60px" }}>
            <div className="mq cz out">{[...c.events, ...c.events, ...c.events, ...c.events].map((e, i) => <span key={i} className={i % 2 ? "fill" : undefined}>{e}</span>)}</div>
          </div>
        )}
      </>
    );
  }

  if (page === "reviews") {
    return (
      <>
        <PageHead script={script} title={title} sub="What families told us after their albums arrived." />
        <section style={{ background: "var(--panel)", marginTop: 56, padding: "clamp(60px,8vw,100px) 0" }}>
          <div className="wrap rvg">
            {c.reviews.map((r, i) => (
              <figure key={i} className="rvw rvc rv" style={{ margin: 0 }}>
                <span className="sc" aria-hidden="true" style={{ fontSize: 70, lineHeight: 0.6, display: "block", marginBottom: 8 }}>“</span>
                <blockquote className="pf" style={{ margin: "0 0 18px", fontSize: 19, fontStyle: "italic", lineHeight: 1.6 }}>{r.text}</blockquote>
                {r.name && <figcaption className="cap" style={{ fontSize: 10 }}>{r.name}</figcaption>}
              </figure>
            ))}
            {c.reviews.length === 0 && <p style={{ gridColumn: "1 / -1", textAlign: "center" }}>Reviews are on their way.</p>}
          </div>
        </section>
        <div style={{ height: "clamp(60px,8vw,100px)" }} />
        {cta}
      </>
    );
  }

  if (page === "faq") {
    return (
      <>
        <PageHead script={script} title={title} sub="The questions couples ask us most." />
        <section className="wrap" style={{ maxWidth: 860, paddingTop: 50, paddingBottom: "clamp(60px,8vw,100px)" }}>
          {(c.faqs ?? []).map((f, i) => (
            <details key={i} className="fq rv" name="sg-faq">
              <summary><span className="pf">{f.q}</span><span className="fqi" aria-hidden="true" /></summary>
              <p style={{ whiteSpace: "pre-line" }}>{f.a}</p>
            </details>
          ))}
          {(c.faqs ?? []).length === 0 && <p style={{ textAlign: "center" }}>Ask us anything on the Contact page.</p>}
        </section>
        {cta}
      </>
    );
  }

  if (page === "contact" && mono) {
    return (
      <section className="wrap" style={{ paddingTop: 20, paddingBottom: "clamp(70px,9vw,130px)" }}>
        <div className="mbk" id="book">
          <h1 className="cz">Make a booking</h1>
          <p className="mbs">Fill in the form and we will prepare your quotation.</p>
          <BookForm slug={data.slug} preview={preview} packages={packages} ask={ask} setAsk={setAsk} wa={wa} bare onDone={thanks} />
        </div>
        <div className="mct">
          {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {c.email && <a href={`mailto:${c.email}`} style={{ overflowWrap: "anywhere" }}>{c.email}</a>}
          {c.address && <span style={{ whiteSpace: "pre-line" }}>{c.address}</span>}
          {c.hours && <span>{c.hours}</span>}
        </div>
      </section>
    );
  }

  if (page === "contact") {
    return (
      <>
        <PageHead script={script} title={title} sub="Tell us the date and the events. We answer every enquiry ourselves." />
        <section className="wrap" style={{ paddingTop: 50, paddingBottom: "clamp(70px,9vw,130px)" }}>
          <div className="ctg">
            <div style={{ background: "var(--card)", boxShadow: "0 30px 70px rgba(var(--sh),.16)", padding: "clamp(30px,5vw,56px) clamp(22px,4vw,56px)", textAlign: "center", borderTop: "4px solid var(--ac)" }} id="book">
              <BookForm slug={data.slug} preview={preview} packages={packages} ask={ask} setAsk={setAsk} wa={wa} bare onDone={thanks} />
            </div>
            <aside>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="cap ol" style={{ display: "block", textAlign: "center", marginBottom: 34 }}>Chat on WhatsApp</a>}
              {c.phone && <><div className="cap" style={{ fontSize: 10, color: "var(--mut)" }}>Phone</div><p style={{ margin: "4px 0 22px" }}><a className="ul" style={{ borderBottomWidth: 1 }} href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a></p></>}
              {c.email && <><div className="cap" style={{ fontSize: 10, color: "var(--mut)" }}>Email</div><p style={{ margin: "4px 0 22px", overflowWrap: "anywhere" }}><a className="ul" style={{ borderBottomWidth: 1 }} href={`mailto:${c.email}`}>{c.email}</a></p></>}
              {c.address && <><div className="cap" style={{ fontSize: 10, color: "var(--mut)" }}>Studio</div><p style={{ margin: "4px 0 22px", whiteSpace: "pre-line" }}>{c.address}</p></>}
              {c.hours && <><div className="cap" style={{ fontSize: 10, color: "var(--mut)" }}>Hours</div><p style={{ margin: "4px 0 0" }}>{c.hours}</p></>}
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (page === "stories") {
    const list = c.stories ?? [];
    const story = storyId ? list.find(x => x.id === storyId) : undefined;
    if (story) {
      return (
        <>
          <PageHead script={longDate(story.date) || "a story"} title={story.title} />
          <article className="wrap" style={{ paddingTop: 50, paddingBottom: "clamp(70px,9vw,130px)" }}>
            {story.cover && photos[story.cover] && <div style={{ maxWidth: 1080, margin: "0 auto 50px", aspectRatio: "16 / 9", overflow: "hidden" }}><Ph p={photos[story.cover]} alt="" eager crop={c.crop?.[`story:${story.id}`]} sizes="(max-width: 860px) 92vw, 1080px" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
            <div className="art">{story.text.split(/\n+/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}</div>
            <div style={{ textAlign: "center", marginTop: 40 }}><Link href={L("/stories")} className="cap ul">All stories</Link></div>
          </article>
          {cta}
        </>
      );
    }
    if (mono) return (
      <section className="wrap" style={{ paddingBottom: "clamp(70px,9vw,130px)" }}>
        <div className="mhd"><h1 className="cz">Stories</h1></div>
        <MonoRows stories={list} photos={photos} crops={c.crop} L={L} />
        {list.length === 0 && <p>Stories are on their way.</p>}
      </section>
    );
    return (
      <>
        <PageHead script={script} title={title} sub="Notes from the weddings we photograph." />
        <section className="wrap stg" style={{ paddingTop: 56, paddingBottom: "clamp(70px,9vw,130px)" }}>
          {list.map((x, i) => (
            <Link key={x.id} href={L(`/stories/${x.id}`)} className="stc" style={{ ["--i" as string]: Math.min(i, 8) }}>
              <div className="im"><Ph p={photos[x.cover ?? ""]} alt="" sizes="(max-width: 860px) 92vw, 33vw" crop={c.crop?.[`story:${x.id}`]} /></div>
              {x.date && <div className="cap" style={{ fontSize: 9, color: "var(--mut)" }}>{longDate(x.date)}</div>}
              <h2 className="pf" style={{ margin: "6px 0 8px", fontSize: 26, fontWeight: 400, lineHeight: 1.25 }}>{x.title}</h2>
              <p style={{ margin: 0 }}>{x.text.replace(/\s+/g, " ").slice(0, 130)}{x.text.length > 130 ? "…" : ""}</p>
            </Link>
          ))}
          {list.length === 0 && <p style={{ gridColumn: "1 / -1", textAlign: "center" }}>Stories are on their way.</p>}
        </section>
      </>
    );
  }

  if (page === "thank-you" || page === "notfound") {
    const ok = page === "thank-you";
    return (
      <section className="wrap" style={{ textAlign: "center", paddingTop: "clamp(60px,9vw,120px)", paddingBottom: "clamp(90px,12vw,170px)" }}>
        {ok && (
          <svg width="84" height="84" viewBox="0 0 74 74" fill="none" aria-hidden="true" style={{ margin: "0 auto 22px", display: "block" }}>
            <circle className="okc" style={{ strokeDasharray: 230, strokeDashoffset: 230 }} cx="37" cy="37" r="36" stroke="var(--ac)" strokeWidth="1" /><path className="okc" d="M22 38l10 10 20-22" stroke="var(--ac)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <div className="sc" style={{ fontSize: "clamp(44px, 5vw, 70px)", lineHeight: 1 }}><span className="wr" style={{ animationDelay: ".1s" }}>{script}</span></div>
        <h1 className="cz" style={{ margin: "4px 0 22px", fontSize: "clamp(36px, 5.4vw, 80px)", lineHeight: 1.06, letterSpacing: ".06em" }}><span className="wd"><span style={{ animationDelay: ".3s" }}>{title}</span></span></h1>
        <p style={{ margin: "0 auto 34px", maxWidth: 480 }}>
          {ok ? (preview ? "This is the preview, so nothing was sent. Visitors see this page after they send the form." : `Your enquiry reached ${studio.name}. We will call or message you soon.`)
            : "This page is not here any more. The albums and packages are one tap away."}
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {ok && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="cap gold shine btn">Chat on WhatsApp</a>}
          <Link href={L("")} className="cap ol">Back to home</Link>
          {c.albums.length > 0 && <Link href={L("/portfolio")} className="cap ol">See our albums</Link>}
        </div>
      </section>
    );
  }

  // Privacy and Terms: plain words that are true for every studio site on StuPanel.
  const legal: [string, string][] = page === "privacy" ? [
    ["What this site collects", `When you send the booking form, ${studio.name} receives what you typed: your name, phone number, wedding date, the package you picked and your message. Nothing is collected if you only look around.`],
    ["What it is used for", `Only to answer your enquiry and plan your booking. ${studio.name} does not sell or share your details with advertisers.`],
    ["Where it is kept", `Enquiries are stored in StuPanel, the studio software ${studio.name} uses to manage its bookings.`],
    ["Videos and fonts", "Films play from YouTube's privacy-enhanced player and only load when you press play. Fonts are loaded from Google Fonts."],
    ["Your choices", `To see, correct or delete what you sent, contact ${studio.name} using the details on the Contact page.`],
  ] : [
    ["Photos and films", `Every photo and film on this site belongs to ${studio.name} and is shown with the families' permission. Please do not copy or reuse them.`],
    ["Prices", "Prices shown are a guide. Your final price depends on your dates, places and the events you choose, and is confirmed in your quote."],
    ["Bookings", `Sending the form is an enquiry, not a booking. Your date is held only after ${studio.name} confirms it with you.`],
    ["Changes", `${studio.name} may update this site, its packages and these terms at any time.`],
  ];
  return (
    <>
      <PageHead script={script} title={title} />
      <section className="wrap" style={{ maxWidth: 760, paddingTop: 50, paddingBottom: "clamp(70px,9vw,130px)" }}>
        {legal.map(([h, t]) => (
          <div key={h} className="rv" style={{ marginBottom: 34 }}>
            <h2 className="pf" style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 400 }}>{h}</h2>
            <p style={{ margin: 0 }}>{t}</p>
          </div>
        ))}
      </section>
    </>
  );
}
