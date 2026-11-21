"use client";

/**
 * The inner pages of a studio's website (Portfolio, Films, Packages, About, Reviews, FAQ, Contact,
 * Privacy, Terms). They sit inside the same header and footer as Home and take every colour, font
 * and shape from the theme, so each look carries through the whole site.
 */
import Link from "next/link";
import { useState } from "react";
import { BookForm, Ph, money, type SiteAlbum, type SiteData, type SitePageName } from "./site-view";

type Props = { page: SitePageName; data: SiteData; preview?: boolean; L: (path: string) => string; openAlbum: (a: SiteAlbum) => void; wa: string };

const TITLES: Record<Exclude<SitePageName, "home">, [string, string]> = {
  portfolio: ["our", "Portfolio"], films: ["wedding", "Films"], packages: ["our", "Packages"], about: ["about", "The studio"],
  reviews: ["kind", "Words"], faq: ["good to", "Know"], contact: ["save", "Your date"], privacy: ["your", "Privacy"], terms: ["the", "Terms"],
};

function PageHead({ script, title, sub }: { script: string; title: string; sub?: string }) {
  return (
    <div className="wrap pgh">
      <div className="sc" style={{ fontSize: "clamp(44px, 5vw, 70px)", lineHeight: 1 }}><span className="wr" style={{ animationDelay: ".1s" }}>{script}</span></div>
      <h1 className="cz" style={{ margin: "4px 0 0", fontSize: "clamp(36px, 5.4vw, 80px)", lineHeight: 1.06, letterSpacing: ".06em" }}>
        {title.split(/\s+/).map((w, i) => <span key={i}><span className="wd"><span style={{ animationDelay: `${0.25 + i * 0.12}s` }}>{w}</span></span>{" "}</span>)}
      </h1>
      <div className="pgl" aria-hidden="true" />
      {sub && <p style={{ margin: "22px auto 0", maxWidth: 520 }}>{sub}</p>}
    </div>
  );
}

function Film({ id, title, poster }: { id: string; title: string; poster?: string }) {
  const [on, setOn] = useState(false);
  return (
    <figure className="rv" style={{ margin: 0 }}>
      {on ? (
        <div className="film"><iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title || "Wedding film"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
      ) : (
        <button type="button" className="film" onClick={() => setOn(true)} aria-label={`Play ${title || "the film"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
          <span className="play"><span className="gold" style={{ width: 70, height: 70 }}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 4 }}><path d="M6 4l14 8-14 8z" /></svg></span></span>
        </button>
      )}
      {title && <figcaption className="pf" style={{ marginTop: 16, fontSize: 19, fontStyle: "italic", textAlign: "center" }}>{title}</figcaption>}
    </figure>
  );
}

export function InnerPage({ page, data, preview, L, openAlbum, wa }: Props) {
  const { content: c, photos, packages, studio } = data;
  const [tag, setTag] = useState("");
  const [tab, setTab] = useState(0);
  const [ask, setAsk] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("package") ?? ""));
  if (page === "home") return null;
  const [script, title] = TITLES[page];
  const askHref = (name: string) => `${L("/contact")}${preview ? "&" : "?"}package=${encodeURIComponent(name)}`;
  const cta = (
    <div className="wrap rv" style={{ textAlign: "center", paddingBottom: "clamp(70px,9vw,130px)" }}>
      <Link href={L("/contact")} className="cap gold shine btn">Book your date</Link>
    </div>
  );

  if (page === "portfolio") {
    const tags = Array.from(new Set(c.albums.map(a => a.tag).filter(Boolean)));
    const list = c.albums.filter(a => !tag || a.tag === tag);
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
            <button type="button" key={`${tag}-${a.id}`} className="al gal" style={{ ["--i" as string]: Math.min(i, 9) }} onClick={() => openAlbum(a)} aria-label={`Open the album ${a.title}`}>
              <Ph p={photos[a.cover ?? a.photos[0] ?? ""]} alt="" eager={i < 3} />
              <span className="nm"><span className="pf" style={{ fontSize: 22 }}>{a.title}</span><span className="ln" /><span className="cap" style={{ fontSize: 9 }}>{[a.tag, `${a.photos.length} photos`].filter(Boolean).join("  ·  ")}</span></span>
            </button>
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
          <div className="g2" style={{ gap: 40, alignItems: "start" }}>{films.slice(1).map(f => <Film key={f.id} {...f} />)}</div>
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
          <p className="rv" style={{ margin: "56px auto 26px", maxWidth: 520 }}>Need something between two packages, or more days? We make custom quotes every week.</p>
          <Link href={L("/contact")} className="cap gold shine btn">Ask for a custom quote</Link>
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
              <Ph className="par" p={photos[c.aboutPhoto ?? ""]} alt={`${studio.name} at work`} eager style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.15)" }} />
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

  if (page === "contact") {
    return (
      <>
        <PageHead script={script} title={title} sub="Tell us the date and the events. We answer every enquiry ourselves." />
        <section className="wrap" style={{ paddingTop: 50, paddingBottom: "clamp(70px,9vw,130px)" }}>
          <div className="ctg">
            <div style={{ background: "var(--card)", boxShadow: "0 30px 70px rgba(var(--sh),.16)", padding: "clamp(30px,5vw,56px) clamp(22px,4vw,56px)", textAlign: "center", borderTop: "4px solid var(--ac)" }} id="book">
              <BookForm slug={data.slug} preview={preview} packages={packages} ask={ask} setAsk={setAsk} wa={wa} bare />
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
