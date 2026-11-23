/** The published website of an address, from the API (Vercel keeps it 5 minutes; Publish clears it). Server only. */
import { API_URL } from "@/lib/api";
import type { SiteData } from "@/components/site/site-view";

export async function loadPublishedSite(slug: string): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  try {
    const res = await fetch(`${API_URL}/public/site/${slug}`, { next: { revalidate: 300, tags: [`site:${slug}`] } });
    if (!res.ok) return null;
    const d = await res.json();
    return d && "studio" in d ? (d as SiteData) : null;
  } catch {
    return null;
  }
}
