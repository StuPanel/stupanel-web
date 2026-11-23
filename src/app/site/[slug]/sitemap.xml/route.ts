/** <address>.stupanel.com/sitemap.xml (or the studio's own domain): every page with something on it. */
import { loadPublishedSite } from "@/lib/site-load";
import { siteHome, sitemapPaths } from "@/lib/site-seo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await loadPublishedSite(slug);
  if (!d || d.content.seo?.hidden) return new Response("Not found", { status: 404 });
  const home = siteHome(d);
  const day = (d.publishedAt ?? "").slice(0, 10);
  const urls = sitemapPaths(d).map(p => {
    const date = p.date || day;
    return `  <url><loc>${esc(home + p.path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ""}</url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=60" } });
}
