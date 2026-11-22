/**
 * A studio's public website: app.stupanel.com/site/<address>[/page].
 * The published copy is read on the server (readable by Google) and kept in Vercel's cache for 5 minutes;
 * Publish / Unpublish / a new address clear it at once (the API calls /api/site-refresh), so changes still show straight away.
 * ?preview=1 shows the studio's own draft instead (needs the studio to be signed in).
 */
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { API_URL } from "@/lib/api";
import { SiteView, type SiteData, type SitePageName } from "@/components/site/site-view";
import { SitePreview } from "./preview";

const PAGES: Record<string, string> = {
  portfolio: "Portfolio", films: "Films", packages: "Packages", about: "About", reviews: "Reviews",
  faq: "Questions", contact: "Book your date", privacy: "Privacy", terms: "Terms", stories: "Stories", "thank-you": "Thank you",
};

/** /portfolio/<album> opens that album; /stories/<story> is one story. Anything unknown shows the site's own "not here" page. */
function route(path: string[] | undefined): { page: SitePageName; albumId?: string; storyId?: string } {
  if (!path?.length) return { page: "home" };
  const [first, second, ...rest] = path;
  if (rest.length || !(first in PAGES)) return { page: "notfound" };
  if (second && first === "portfolio") return { page: "portfolio", albumId: second };
  if (second && first === "stories") return { page: "stories", storyId: second };
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

type Props = { params: Promise<{ slug: string; path?: string[] }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug, path }, q] = await Promise.all([params, searchParams]);
  if (q.preview) return { title: "Website preview", robots: { index: false } };
  const r = route(path);
  const d = await load(slug);
  // Here too (not only in the page): search engines get a real 308 for an old address, since metadata is
  // ready before the page streams.
  if (d && "redirect" in d) permanentRedirect(`/site/${d.redirect}${path?.length ? `/${path.join("/")}` : ""}`);
  if (d && "offline" in d) return { title: "Website not available", robots: { index: false } };
  if (!isSite(d) || r.page === "notfound") return { title: "Page not found", robots: { index: false } };
  if (r.page === "thank-you") return { title: { absolute: `Thank you | ${d.studio.name}` }, robots: { index: false } };
  const album = r.albumId ? d.content.albums.find(a => a.id === r.albumId) : undefined;
  const cover = d.photos[album?.cover ?? d.content.heroPhotos[0]]?.url;
  const story = r.storyId ? (d.content.stories ?? []).find(x => x.id === r.storyId) : undefined;
  const title = story ? `${story.title} | ${d.studio.name}` : album ? `${album.title} | ${d.studio.name}`
    : r.page === "home" ? `${d.studio.name} | ${d.content.kicker || "Wedding photography"}` : `${PAGES[r.page]} | ${d.studio.name}`;
  const description = d.content.intro || d.content.footerLine;
  return { title: { absolute: title }, description, openGraph: { title, description, images: cover ? [cover] : undefined, type: "website" } };
}

export default async function StudioSitePage({ params, searchParams }: Props) {
  const [{ slug, path }, q] = await Promise.all([params, searchParams]);
  const r = route(path);
  if (q.preview) return <SitePreview page={r.page} albumId={r.albumId} storyId={r.storyId} />;
  const data = await load(slug);
  if (data && "redirect" in data) permanentRedirect(`/site/${data.redirect}${path?.length ? `/${path.join("/")}` : ""}`);
  if (data && "offline" in data) return <SiteOffline />;
  if (!isSite(data)) notFound();
  const missing = (r.albumId && !data.content.albums.some(a => a.id === r.albumId)) || (r.storyId && !(data.content.stories ?? []).some(x => x.id === r.storyId));
  const page = missing ? "notfound" : r.page;
  return <SiteView key={`${page}-${r.storyId ?? ""}`} data={data} page={page} albumId={missing ? undefined : r.albumId} storyId={missing ? undefined : r.storyId} />;
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
