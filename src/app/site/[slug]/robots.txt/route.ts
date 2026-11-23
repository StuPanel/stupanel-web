/** <address>.stupanel.com/robots.txt (or the studio's own domain): open to search engines unless the studio hid the website. */
import { loadPublishedSite } from "@/lib/site-load";
import { siteHome } from "@/lib/site-seo";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await loadPublishedSite(slug);
  const body = !d || d.content.seo?.hidden
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /thank-you\n\nSitemap: ${siteHome(d)}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=60" } });
}
