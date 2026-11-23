/**
 * A studio's public website: app.stupanel.com/site/<address>[/page].
 * The published copy is read on the server (readable by Google) and kept in Vercel's cache for 5 minutes;
 * Publish / Unpublish / a new address clear it at once (the API calls /api/site-refresh), so changes still show straight away.
 * ?preview=1 shows the studio's own draft instead (needs the studio to be signed in).
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { SITE_ROOT } from "@/lib/site-url";
import { API_URL } from "@/lib/api";
import { SiteView, type SiteData, type SitePageName } from "@/components/site/site-view";
import { SitePreview } from "./preview";
import { SiteBeacon, SiteTracking } from "@/components/site/site-tracking";
import { ldJson, offerSummary, pageSeo, shareImage, siteHome, structuredData } from "@/lib/site-seo";
import { liveOffers } from "@/lib/site-offer-kit";

const PAGES: Record<string, string> = {
  portfolio: "Portfolio", films: "Films", packages: "Packages", about: "About", reviews: "Reviews",
  faq: "Questions", contact: "Book your date", privacy: "Privacy", terms: "Terms", stories: "Stories", "thank-you": "Thank you",
};

/** /portfolio/<album> opens that album; /stories/<story> is one story; /packages/<package> is one website package.
 *  Anything unknown shows the site's own "not here" page. */
function route(path: string[] | undefined): { page: SitePageName; albumId?: string; storyId?: string; offerId?: string } {
  if (!path?.length) return { page: "home" };
  const [first, second, ...rest] = path;
  if (rest.length || !(first in PAGES)) return { page: "notfound" };
  if (second && first === "portfolio") return { page: "portfolio", albumId: second };
  if (second && first === "stories") return { page: "stories", storyId: second };
  if (second && first === "packages") return { page: "packages", offerId: decodeURIComponent(second).toLowerCase() };
  return second ? { page: "notfound" } : { page: first as SitePageName };
}

/** The site, or { redirect } (an old address after a rename), or { offline } (closed, unpaid or taken down). */
type Loaded = SiteData | { redirect: string } | { offline: true };
const isSite = (d: Loaded | null): d is SiteData => !!d && "studio" in d;

async function load(slug: string): Promise<Loaded | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  try {
    const res = await fetch(`${API_URL}/public/site/${slug}`, { next: { revalidate: 300, tags: [`site:${slug}`] } });
    return res.ok ? ((await res.json()) as Loaded) : null;
  } catch {
    return null;
  }
}

/** Served on <address>.stupanel.com (the middleware rewrote it here)? Then links have no /site/<address> part. */
async function onSubdomain(slug: string) {
  return (await headers()).get("x-site-host") === slug;
}
/** A live own domain: visitors on <address>.stupanel.com go there (not on the domain itself, not the preview). */
async function toOwnDomain(slug: string, domain: string | null | undefined, path?: string[]) {
  if (!domain) return;
  const h = await headers();
  if (h.get("x-site-host") !== slug || h.get("x-site-domain") === domain) return;
  permanentRedirect(`https://${domain}${path?.length ? `/${path.join("/")}` : "/"}`);
}
/** Where an old address (after a rename) sends visitors. */
async function movedTo(slug: string, to: string, path?: string[]) {
  const rest = path?.length ? `/${path.join("/")}` : "";
  return (await onSubdomain(slug)) ? `https://${to}.${SITE_ROOT}${rest || "/"}` : `/site/${to}${rest}`;
}

/** On the studio's own domain an old address (renamed lately) is shown directly, not redirected. */
async function loadHere(slug: string): Promise<Loaded | null> {
  const d = await load(slug);
  if (d && "redirect" in d && (await headers()).get("x-site-domain")) return load(d.redirect);
  return d;
}

type Props = { params: Promise<{ slug: string; path?: string[] }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug, path }, q] = await Promise.all([params, searchParams]);
  if (q.preview) return { title: "Website preview", robots: { index: false } };
  const r = route(path);
  const d = await loadHere(slug);
  // Here too (not only in the page): search engines get a real 308 for an old address, since metadata is
  // ready before the page streams.
  if (d && "redirect" in d) permanentRedirect(await movedTo(slug, d.redirect, path));
  if (d && "offline" in d) return { title: "Website not available", robots: { index: false } };
  if (isSite(d)) await toOwnDomain(slug, d.domain, path);
  if (!isSite(d) || r.page === "notfound") return { title: "Page not found", robots: { index: false } };
  if (r.page === "thank-you") return { title: { absolute: `Thank you | ${d.studio.name}` }, robots: { index: false } };
  const album = r.albumId ? d.content.albums.find(a => a.id === r.albumId) : undefined;
  const story = r.storyId ? (d.content.stories ?? []).find(x => x.id === r.storyId) : undefined;
  const offer = r.offerId ? liveOffers(d).find(x => x.id === r.offerId) : undefined;
  const own = pageSeo(d, r.page);
  const title = offer ? `${offer.name} | ${d.studio.name}` : story ? `${story.title} | ${d.studio.name}` : album ? `${album.title} | ${d.studio.name}` : own.title;
  const description = offer ? offerSummary(offer, d) : story ? story.text.replace(/\s+/g, " ").slice(0, 155) : album ? `${album.title} — ${album.photos.length} photos by ${d.studio.name}.` : own.description;
  // Each page's own picture: the package cover, the album cover, the story picture — with its Adjust.
  const img = offer ? shareImage(d, offer.cover ?? offer.photos[0], `offer:${offer.id}`)
    : album ? shareImage(d, album.cover ?? album.photos[0], `album:${album.id}`)
    : story ? shareImage(d, story.cover ?? undefined, `story:${story.id}`)
    : shareImage(d);
  const home = siteHome(d);
  const here = r.page === "home" ? "/" : `/${r.page}${r.albumId ? `/${r.albumId}` : r.storyId ? `/${r.storyId}` : r.offerId ? `/${r.offerId}` : ""}`;
  const seo = d.content.seo;
  return {
    title: { absolute: title }, description,
    metadataBase: new URL(home),
    alternates: { canonical: `${home}${here}` },
    robots: seo?.hidden ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description, url: `${home}${here}`, siteName: d.studio.name, type: "website", images: img ? [img] : undefined },
    twitter: { card: img ? "summary_large_image" : "summary", title, description, images: img ? [img.url] : undefined },
    verification: { google: seo?.google || undefined, other: seo?.bing ? { "msvalidate.01": seo.bing } : undefined },
  };
}

export default async function StudioSitePage({ params, searchParams }: Props) {
  const [{ slug, path }, q] = await Promise.all([params, searchParams]);
  const r = route(path);
  if (q.preview) return <SitePreview page={r.page} albumId={r.albumId} storyId={r.storyId} offerId={r.offerId} />;
  const data = await loadHere(slug);
  if (data && "redirect" in data) permanentRedirect(await movedTo(slug, data.redirect, path));
  if (data && "offline" in data) return <SiteOffline />;
  if (!isSite(data)) notFound();
  await toOwnDomain(slug, data.domain, path);
  const missing = (r.albumId && !data.content.albums.some(a => a.id === r.albumId)) || (r.storyId && !(data.content.stories ?? []).some(x => x.id === r.storyId))
    || (r.offerId && !liveOffers(data).some(x => x.id === r.offerId));
  const page = missing ? "notfound" : r.page;
  const base = (await onSubdomain(slug)) ? "" : undefined;
  const ld = structuredData(data, page, missing ? undefined : r.offerId);
  return <>
    {data.content.tracking && <SiteTracking ids={data.content.tracking} />}
    <SiteBeacon slug={data.slug} />
    {ld.map((o, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(o) }} />)}
    <SiteView key={`${page}-${r.storyId ?? ""}-${r.offerId ?? ""}`} data={data} base={base} page={page} albumId={missing ? undefined : r.albumId} storyId={missing ? undefined : r.storyId} offerId={missing ? undefined : r.offerId} />
  </>;
}

/** Closed, unpaid or taken down: no studio name, no reason — just that it isn't available. */
function SiteOffline() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#F7F5F2", color: "#2A2622", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8A8178" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginBottom: 18 }}>
          <circle cx="12" cy="12" r="9" /><path d="M8 12h8" />
        </svg>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 10px" }}>This website is not available right now</h1>
        <p style={{ margin: 0, color: "#6B635B", lineHeight: 1.6 }}>Please check back later.</p>
      </div>
    </main>
  );
}
