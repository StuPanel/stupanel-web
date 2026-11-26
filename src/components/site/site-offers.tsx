"use client";
/**
 * Website packages: a Packages page of cards and one page per package (its own link, for Facebook ads).
 * One structure for every look; site.css gives each look its own cards, hero and motion.
 * The cards arrange themselves for any number of packages (one, two, an odd last row…), so the page never
 * looks empty or ragged.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AutoArt, BookForm, ICON, Ic, Ph, buildKey, money, type SiteCrop, type SiteData, type SitePackage, type SitePhoto } from "./site-view";
import { FilmTheater } from "./site-film";
import { PhotoViewer } from "./site-viewer";
import "./site-offers.css";
import { packageDetail, siteTrack } from "./site-tracking";
import { extraCost, liveOffers, priceNow, type SiteOffer } from "@/lib/site-offer-kit";

export { liveOffers, priceNow, type SiteOffer };

/** Looks whose cards sit two in a row (wide photos / rows); the others sit three in a row. */
const TWO_UP = new Set(["editorial", "dark"]);
/** Small counts get their own arrangement (one wide card, two side by side, two by two). */
const COUNT: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four" };

const endsText = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

/** For the enquiry form: website packages when there are any, else the studio's price list. */
export function bookChoices(d: SiteData): SitePackage[] {
  const live = liveOffers(d);
  if (!live.length) return d.packages;
  return live.map(o => ({ id: o.id, name: o.name, group: o.group, price: o.price ?? 0, currency: d.currency ?? "BDT", team: "", lines: [] }));
}

/** Whole days left of an offer, counting today (0 = it ended; its last day = 1). */
function daysLeft(ends: string, now = new Date()): number {
  if (!ends) return 0;
  const end = new Date(`${ends}T23:59:59`).getTime();
  return end < now.getTime() ? 0 : Math.ceil((end - now.getTime()) / 86400000);
}
/** The label on a card: the studio's own words, else the offer and how long it runs. */
function offerBadge(o: SiteOffer, offer: boolean): string {
  if (o.badge) return o.badge;
  if (!offer) return "";
  if (!o.ends) return "Offer";
  const left = daysLeft(o.ends);
  return left === 1 ? "Offer ends today" : left > 1 && left <= 7 ? `Offer: ${left} days left` : `Offer until ${endsText(o.ends)}`;
}

/**
 * "Offer ends in 2d 05h 12m 09s" on a package's page, ticking in the visitor's own time (the offer runs to the
 * end of its last day). Nothing on the server or after it ended, so the page never shows a wrong clock.
 */
function OfferCountdown({ ends }: { ends: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(`${ends}T23:59:59`).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    const first = setTimeout(tick, 0), id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [ends]);
  if (left === null || left <= 0) return null;
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60), sec = left % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  const cells: [string, string][] = d > 0 ? [[String(d), d === 1 ? "day" : "days"], [two(h), "hrs"], [two(m), "min"], [two(sec), "sec"]] : [[two(h), "hrs"], [two(m), "min"], [two(sec), "sec"]];
  return (
    <div className="ofcd" role="timer" aria-label={`Offer ends in ${d ? `${d} day${d > 1 ? "s" : ""} ` : ""}${h} hours ${m} minutes`}>
      <span className="ofcdl">Offer ends in</span>
      <span className="ofcdc" aria-hidden="true">{cells.map(([v, l]) => <span key={l}><b>{v}</b><i>{l}</i></span>)}</span>
    </div>
  );
}

function PriceLine({ o, cur, big }: { o: SiteOffer; cur: string; big?: boolean }) {
  const p = priceNow(o);
  if (p.price === null) return <span className="ofpr ask">Ask for the price</span>;
  return (
    <span className={`ofpr${big ? " big" : ""}`}>
      {o.from && <span className="offrom">from </span>}{money(p.price, cur)}
      {p.was !== null && <s className="ofwas">{money(p.was, cur)}</s>}
    </span>
  );
}

/** One package card. The look decides its shape (photo with words on it, a framed card, a plain photo…). */
function OfferCard({ o, i, photo, crop, href, cur, theme }: { o: SiteOffer; i: number; photo?: SitePhoto; crop?: SiteCrop; href: string; cur: string; theme: string }) {
  const p = priceNow(o);
  const badge = offerBadge(o, p.offer);
  return (
    <Link href={href} className={`ofc${badge ? " has-b" : ""}`} style={{ ["--i" as string]: Math.min(i, 8) }}>
      <span className="ofi">
        {photo ? <Ph p={photo} alt="" eager={i < 3} crop={crop} sizes="(max-width: 860px) 92vw, 33vw" /> : <AutoArt name={o.name} />}
        {badge && <span className="ofb" suppressHydrationWarning>{badge}</span>}
        {theme === "dark" && <span className="ofplay" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" /></svg></span>}
      </span>
      <span className="oft">
        {o.group && <span className="ofgr">{o.group}</span>}
        <span className="ofn">{o.name}</span>
        {o.tagline && <span className="oftg">{o.tagline}</span>}
        {o.facts.length > 0 && <span className="off">{o.facts.slice(0, 3).map((f, k) => <span key={k}>{[f.v, f.l].filter(Boolean).join(" ")}</span>)}</span>}
        <span className="ofrow"><PriceLine o={o} cur={cur} /><span className="ofv">View package</span></span>
      </span>
    </Link>
  );
}

/**
 * The cards. Category tabs when there are two or more categories. The grid fits any count:
 * one card lies wide, two sit side by side, an odd last row is centred.
 */
export function OfferCards({ data, L, limit }: { data: SiteData; L: (path: string) => string; /** Home: only the first few */ limit?: number }) {
  const all = liveOffers(data);
  const groups = useMemo(() => Array.from(new Set(all.map(o => o.group).filter(Boolean))), [all]);
  const [tab, setTab] = useState("");
  const list = (tab ? all.filter(o => o.group === tab) : all).slice(0, limit ?? 99);
  const cur = data.currency ?? "BDT";
  const crops = data.content.crop ?? {};
  const theme = data.theme || "signature";
  const n = list.length;
  return (
    <div className={`ofw th-${theme}`}>
      {!limit && groups.length > 1 && (
        <div className="oftabs" role="group" aria-label="Category">
          <button type="button" aria-pressed={!tab} onClick={() => setTab("")}>All <span>{all.length}</span></button>
          {groups.map(g => <button key={g} type="button" aria-pressed={tab === g} onClick={() => setTab(g)}>{g} <span>{all.filter(o => o.group === g).length}</span></button>)}
        </div>
      )}
      <div key={tab} className={`ofg ${TWO_UP.has(theme) ? "g2" : "g3"} ${COUNT[n] ?? ""} ${n === 1 || n === 2 || n === 4 ? "" : n % 3 === 1 ? "r1" : n % 3 === 2 ? "r2" : "r0"}${n % 2 ? " odd" : " even"}`}>
        {list.map((o, i) => <OfferCard key={o.id} o={o} i={i} photo={data.photos[o.cover ?? o.photos[0] ?? ""]} crop={crops[`offer:${o.id}`]} href={L(`/packages/${o.id}`)} cur={cur} theme={theme} />)}
      </div>
    </div>
  );
}

/** One package's own page. */
export function OfferPage({ o, data, L, preview, wa }: { o: SiteOffer; data: SiteData; L: (path: string) => string; preview?: boolean; wa: string }) {
  const router = useRouter();
  const cur = data.currency ?? "BDT";
  const p = priceNow(o);
  const [pick, setPick] = useState<string[]>([]);
  const [shot, setShot] = useState<number | null>(null);
  const [ask, setAsk] = useState(o.name);
  const theme = data.theme || "signature";
  const crops = data.content.crop ?? {};
  const ids = [o.cover, ...o.photos].filter((id, k, all): id is string => !!id && !!data.photos[id] && all.indexOf(id) === k);
  const shots = ids.map(id => data.photos[id]);
  const extras = o.extras.filter(e => pick.includes(e.name));
  // Per-day extras (priced for one event): on a package of several days the visitor picks the days
  const dayNames = o.days.map(d => d.name);
  const manyDays = dayNames.length > 1;
  const [dayPick, setDayPick] = useState<Record<string, string[]>>({});
  const daysOf = (name: string) => dayPick[name] ?? dayNames;
  const cost = (e: SiteOffer["extras"][number]) => extraCost(e, dayNames.length, daysOf(e.name));
  const total = p.price === null ? null : p.price + extras.reduce((s, e) => s + cost(e), 0);
  const extraDays = Object.fromEntries(extras.filter(e => e.perDay && manyDays).map(e => [e.name, daysOf(e.name)]));
  const addonNames = extras.map(e => {
    const c = cost(e);
    const on = e.perDay && manyDays ? ` — ${daysOf(e.name).join(", ")}` : "";
    return c ? `${e.name}${on} (+${money(c, cur)})` : `${e.name}${on}`;
  });
  const badge = offerBadge(o, p.offer);
  // Facebook / Google count a look at a package (for ads that show one package).
  useEffect(() => {
    if (preview) return;
    const w = window as unknown as { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void };
    w.fbq?.("track", "ViewContent", { content_name: o.name, content_ids: [o.id], content_type: "product", value: o.price ?? undefined, currency: cur });
    w.gtag?.("event", "view_item", { items: [{ item_id: o.id, item_name: o.name, price: o.price ?? undefined }], currency: cur });
  }, [o.id, o.name, o.price, cur, preview]);
  // What the visitor chose goes with them to the booking form.
  useEffect(() => {
    try { sessionStorage.setItem(buildKey(data.slug), JSON.stringify({ pkg: o.name, addons: addonNames, offer: o.id, days: o.days.map(d => d.name), extras: extras.map(e => e.name), extraDays })); } catch { /* private window */ }
  }, [data.slug, o.name, o.id, addonNames.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const waText = `Hi ${data.studio.name}, I would like to know about the ${o.name} package${extras.length ? ` with ${extras.map(e => e.name).join(", ")}` : ""}${total !== null ? ` (${money(total, cur)})` : ""}.${typeof window !== "undefined" ? ` ${window.location.href.split("?")[0]}` : ""}`;
  const waHref = wa ? `${wa}?text=${encodeURIComponent(waText)}` : "";
  const book = () => { siteTrack("checkout", packageDetail(o, total, cur)); router.push(L("/contact")); };
  const toggle = (name: string) => setPick(l => (l.includes(name) ? l.filter(x => x !== name) : [...l, name]));
  /** A day on or off for a per-day extra (at least one day stays). */
  const flipDay = (name: string, day: string) => setDayPick(m => {
    const cur = m[name] ?? dayNames;
    const next = cur.includes(day) ? cur.filter(d => d !== day) : dayNames.filter(d => d === day || cur.includes(d));
    return next.length ? { ...m, [name]: next } : m;
  });
  const count = shots.length;
  const step = useCallback((by: number) => setShot(s => (s === null ? s : (s + by + count) % count)), [count]);
  const closeShot = useCallback(() => setShot(null), []);
  const over = theme === "signature" || theme === "dark";
  const mono = theme === "mono";

  const crumbs = <p className="ofcr"><Link href={L("/packages")}>Packages</Link>{o.group && <> / {o.group}</>}</p>;
  const heading = (
    <div className="ofh">
      {badge && <span className="ofb" suppressHydrationWarning>{badge}</span>}
      <h1 className="ofh1">{o.name}</h1>
      {o.tagline && <p className="ofh2">{o.tagline}</p>}
    </div>
  );
  const photoBtn = (k: number, cls?: string, sizes?: string) => shots[k] && (
    <button key={k} type="button" className={`ofph ${cls ?? ""}`} onClick={() => setShot(k)} aria-label={`Open photo ${k + 1} of ${shots.length}`}>
      <Ph p={shots[k]} alt="" eager={k < 3} sizes={sizes ?? "(max-width: 860px) 92vw, 50vw"} crop={k === 0 ? crops[`offer:${o.id}`] : undefined} />
    </button>
  );

  const box = (
    <aside className="ofbox" aria-label="Price and booking">
      <PriceLine o={o} cur={cur} big />
      {p.offer && o.ends && <OfferCountdown ends={o.ends} />}
      {o.facts.length > 0 && <div className="ofts">{o.facts.map((f, k) => <div key={k}><b>{f.v}</b><span>{f.l}</span></div>)}</div>}
      {o.extras.length > 0 && (
        <fieldset className="ofx">
          <legend>Add extras</legend>
          {o.extras.map(e => {
            const on = pick.includes(e.name);
            const perDay = !!e.perDay && manyDays;
            return (
              <div key={e.name} className="ofxi">
                <label className={on ? "on" : undefined}>
                  <input type="checkbox" checked={on} onChange={() => toggle(e.name)} />
                  <span className="ofxn">{e.name}{perDay && <small className="ofxu"> per day</small>}</span>
                  <span>{e.price ? `+${money(on ? cost(e) : e.price, cur)}` : "Free"}</span>
                </label>
                {on && perDay && (
                  <div className="ofxd" role="group" aria-label={`Days for ${e.name}`}>
                    {dayNames.map(d => (
                      <button key={d} type="button" aria-pressed={daysOf(e.name).includes(d)} onClick={() => flipDay(e.name, d)}>{d}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      {total !== null && extras.length > 0 && <p className="oftot"><span>Total</span><b aria-live="polite">{money(total, cur)}</b></p>}
      <button type="button" className="ofbk gold" onClick={book}>Book this package</button>
      {waHref && <a className="ofwa" href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => siteTrack("contact", { content_name: o.name, method: "whatsapp" })}>Ask on WhatsApp</a>}
      <p className="oftr">No payment now. We confirm your date first.</p>
    </aside>
  );

  const body = (
    <div className="ofmain">
      {o.days.length > 0 && (
        <section className="ofsec rv">
          <h2 className="ofh3">{o.days.length > 1 ? `Your ${o.days.length} days` : "The day"}</h2>
          <ol className="ofdays">
            {o.days.map((d, k) => (
              <li key={k}>
                <span className="ofdn">{o.days.length > 1 ? `Day ${k + 1}` : "Day"}</span>
                <span className="ofdt"><b>{d.name}</b>{d.team && <span>{d.team}</span>}</span>
                {d.hours && <span className="ofdh">{d.hours}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {o.gets.length > 0 && (
        <section className="ofsec rv">
          <h2 className="ofh3">What you get</h2>
          <ul className="ofgets">
            {o.gets.map((g, k) => <li key={k}><Ic d={<path d="M5 12l5 5 9-10" />} size={16} w={2} /><span><b>{g.t}</b>{g.d && <span>{g.d}</span>}</span></li>)}
          </ul>
        </section>
      )}
      {!mono && shots.length > 3 && (
        <section className="ofsec ofmore rv" aria-label="More photos">
          {shots.slice(3, 9).map((_, k) => photoBtn(k + 3, undefined, "(max-width: 860px) 46vw, 30vw"))}
        </section>
      )}
      {o.filmId && (
        <section id="film" className="ofsec rv">
          <h2 className="ofh3">The film</h2>
          <FilmTheater id={o.filmId} title={o.name} />
        </section>
      )}
      {(o.note || o.faqs.length > 0) && (
        <section className="ofsec ofnote rv">
          <h2 className="ofh3">Good to know</h2>
          {o.note && o.note.split(/\n+/).map((t, k) => <p key={k}>{t}</p>)}
          {o.faqs.map((f, k) => <details key={k}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>
      )}
      <section className="ofsec ofform rv" id="ask">
        <h2 className="ofh3">Ask for your date</h2>
        <BookForm slug={data.slug} preview={preview} packages={bookChoices(data)} kinds={data.content.events} ask={ask} setAsk={setAsk} wa={wa} bare chosen={addonNames} offer={{ id: o.id, days: o.days.map(d => d.name), extras: extras.map(e => e.name), extraDays }} onDone={() => router.push(L("/thank-you"))} />
      </section>
    </div>
  );

  return (
    <div className={`ofpage th-${theme}${over ? " over" : ""}${mono ? " split" : ""}`}>
      {mono ? (
        <div className="wrap ofsplit">
          <div className="ofstack">{shots.length ? shots.map((_, k) => photoBtn(k, k === 0 ? "first" : undefined, "(max-width: 860px) 100vw, 60vw")) : <AutoArt name={o.name} className="first" />}</div>
          <div className="ofside">{crumbs}{heading}{box}{body}</div>
        </div>
      ) : (
        <>
          {over ? (
            <section className="ofhero">
              <div className="ofhi">{shots.length ? photoBtn(0, "ofhb", "100vw") : <AutoArt name={o.name} className="ofhb" />}</div>
              <div className="wrap ofho">
                {crumbs}{heading}
                {o.filmId && <a href="#film" className="ofpl" aria-label="Watch the film"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg></a>}
              </div>
            </section>
          ) : (
            <section className="wrap oftop">
              {crumbs}
              {theme === "cream" ? <>
                {shots.length ? <div className={`ofmos m${Math.min(shots.length, 3)}`}>{photoBtn(0, "a")}{photoBtn(1, "b", "30vw")}{photoBtn(2, "c", "30vw")}</div> : <div className="ofmos m1"><AutoArt name={o.name} className="a" /></div>}
                {heading}
              </> : <>
                {heading}
                {shots.length ? <div className={`ofmos m${Math.min(shots.length, 3)}`}>{photoBtn(0, "a", "(max-width: 860px) 92vw, 1280px")}{photoBtn(1, "b", "30vw")}{photoBtn(2, "c", "30vw")}</div> : <div className="ofmos m1"><AutoArt name={o.name} className="a" /></div>}
              </>}
            </section>
          )}
          <div className="wrap ofbody">{body}{box}</div>
        </>
      )}
      <div className="ofbar" role="region" aria-label="Book this package">
        <span className="ofbt">{total !== null ? <><small>{extras.length ? "Total" : o.from ? "From" : "Price"}</small><b>{money(total, cur)}</b></> : <b>{o.name}</b>}</span>
        {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="ofbw" aria-label="Ask on WhatsApp"><Ic d={ICON.wa} size={22} w={1.6} /></a>}
        <button type="button" className="gold" onClick={book}>Book this</button>
      </div>
      {shot !== null && shots[shot] && <PhotoViewer shots={shots} at={shot} title={o.name} onStep={step} onClose={closeShot} />}
    </div>
  );
}
