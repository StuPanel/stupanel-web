/**
 * A studio's public website: app.stupanel.com/site/<address>.
 * The published copy is fetched on the server (fast first paint, readable by Google);
 * ?preview=1 shows the studio's own draft instead (needs the studio to be signed in).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_URL } from "@/lib/api";
import { SiteView, type SiteData } from "@/components/site/site-view";
import { SitePreview } from "./preview";

async function load(slug: string): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  try {
    const res = await fetch(`${API_URL}/public/site/${slug}`, { next: { revalidate: 30 } });
    return res.ok ? ((await res.json()) as SiteData) : null;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  if (q.preview) return { title: "Website preview", robots: { index: false } };
  const d = await load(slug);
  if (!d) return { title: "Website not found", robots: { index: false } };
  const cover = d.photos[d.content.heroPhotos[0]]?.url;
  const title = `${d.studio.name} | ${d.content.kicker || "Wedding photography"}`;
  return {
    title, description: d.content.intro || d.content.footerLine,
    openGraph: { title, description: d.content.intro || d.content.footerLine, images: cover ? [cover] : undefined, type: "website" },
  };
}

export default async function StudioSitePage({ params, searchParams }: Props) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  if (q.preview) return <SitePreview />;
  const data = await load(slug);
  if (!data) notFound();
  return <SiteView data={data} />;
}
