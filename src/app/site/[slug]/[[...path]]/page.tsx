/**
 * A studio's public website: app.stupanel.com/site/<address>[/page].
 * The published copy is fetched on the server (fast first paint, readable by Google);
 * ?preview=1 shows the studio's own draft instead (needs the studio to be signed in).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_URL } from "@/lib/api";
import { SiteView, type SiteData, type SitePageName } from "@/components/site/site-view";
import { SitePreview } from "./preview";

const PAGES: Record<string, string> = {
  portfolio: "Portfolio", films: "Films", packages: "Packages", about: "About", reviews: "Reviews",
  faq: "Questions", contact: "Book your date", privacy: "Privacy", terms: "Terms",
};

/** /portfolio/<album> opens that album on the Portfolio page. Anything unknown is "not found". */
function route(path: string[] | undefined): { page: SitePageName; albumId?: string } | null {
  if (!path?.length) return { page: "home" };
  const [first, second, ...rest] = path;
  if (rest.length || !(first in PAGES)) return null;
  if (second && first !== "portfolio") return null;
  return { page: first as SitePageName, albumId: second };
}

async function load(slug: string): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  try {
    const res = await fetch(`${API_URL}/public/site/${slug}`, { next: { revalidate: 30 } });
    return res.ok ? ((await res.json()) as SiteData) : null;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string; path?: string[] }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug, path }, q] = await Promise.all([params, searchParams]);
  if (q.preview) return { title: "Website preview", robots: { index: false } };
  const r = route(path);
  const d = r ? await load(slug) : null;
  if (!d || !r) return { title: "Page not found", robots: { index: false } };
  const album = r.albumId ? d.content.albums.find(a => a.id === r.albumId) : undefined;
  const cover = d.photos[album?.cover ?? d.content.heroPhotos[0]]?.url;
  const title = album ? `${album.title} | ${d.studio.name}`
    : r.page === "home" ? `${d.studio.name} | ${d.content.kicker || "Wedding photography"}` : `${PAGES[r.page]} | ${d.studio.name}`;
  const description = d.content.intro || d.content.footerLine;
  return { title: { absolute: title }, description, openGraph: { title, description, images: cover ? [cover] : undefined, type: "website" } };
}

export default async function StudioSitePage({ params, searchParams }: Props) {
  const [{ slug, path }, q] = await Promise.all([params, searchParams]);
  const r = route(path);
  if (!r) notFound();
  if (q.preview) return <SitePreview page={r.page} albumId={r.albumId} />;
  const data = await load(slug);
  if (!data) notFound();
  if (r.albumId && !data.content.albums.some(a => a.id === r.albumId)) notFound();
  return <SiteView key={r.page} data={data} page={r.page} albumId={r.albumId} />;
}
