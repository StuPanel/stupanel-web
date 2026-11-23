/**
 * Google and sharing for studio websites: titles, descriptions, share picture, the site's own address,
 * structured data (schema.org) and the sitemap. Plain functions, used by the page, sitemap.xml and the editor.
 */
import type { SiteData, SitePageName } from "@/components/site/site-view";
import { priceNow, type SiteOffer } from "@/lib/site-offer-kit";
import { SITE_ROOT } from "@/lib/site-url";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

export type SiteSeo = {
  title: string; description: string; image: string | null;
  pages: Record<string, { title: string; description: string }>;
  google: string; bing: string; hidden: boolean;
};
export const EMPTY_SEO: SiteSeo = { title: "", description: "", image: null, pages: {}, google: "", bing: "", hidden: false };

/** Pages with their own Google title (Home uses the main title). Name = what the visitor sees in the menu. */
export const SEO_PAGES: [key: string, name: string][] = [
  ["portfolio", "Portfolio"], ["films", "Films"], ["packages", "Packages"], ["about", "About"],
  ["reviews", "Reviews"], ["faq", "Questions"], ["contact", "Book your date"], ["stories", "Stories"],
];
const PAGE_NAME: Record<string, string> = Object.fromEntries([...SEO_PAGES, ["privacy", "Privacy"], ["terms", "Terms"]]);

/** Google shows about 60 characters of a title and 155 of a description. */
export const TITLE_FIT = 60;
export const DESC_FIT = 155;

/** https://pickphoto.com (live own domain) or https://pickphoto.stupanel.com — no trailing slash. */
export function siteHome(d: Pick<SiteData, "slug" | "domain">) {
  return d.domain ? `https://${d.domain}` : `https://${d.slug}.${SITE_ROOT}`;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

/** Automatic title and description of a page (what Google gets when the studio leaves the boxes empty). */
export function autoSeo(d: SiteData, page: string) {
  const c = d.content, name = d.studio.name;
  const desc = c.intro || c.footerLine || `Wedding photography and films by ${name}.`;
  if (page === "home") return { title: `${name} | ${c.kicker || "Wedding photography"}`, description: cut(desc, DESC_FIT) };
  const about = c.aboutText ? cut(c.aboutText.replace(/\s+/g, " "), DESC_FIT) : desc;
  const per: Record<string, string> = {
    portfolio: `Wedding albums by ${name}: holud, wedding and reception.`,
    films: `Wedding films and trailers by ${name}.`,
    packages: `Photography and film packages of ${name}, with prices.`,
    about,
    reviews: `What couples say about ${name}.`,
    faq: `Questions couples ask ${name} before booking.`,
    contact: `Check your date and book ${name}.`,
    stories: `Wedding stories by ${name}.`,
  };
  return { title: `${PAGE_NAME[page] ?? "Page"} | ${name}`, description: cut(per[page] ?? desc, DESC_FIT) };
}

/** Title and description Google gets for a page: the studio's own words, else automatic. */
export function pageSeo(d: SiteData, page: string) {
  const seo = { ...EMPTY_SEO, ...(d.content.seo ?? {}) };
  const auto = autoSeo(d, page);
  if (page === "home") return { title: seo.title || auto.title, description: seo.description || auto.description };
  const own = seo.pages[page];
  return { title: own?.title || auto.title, description: own?.description || auto.description };
}

/** The picture a shared link shows: the studio's choice, else the first main photo. Phone-size copy when there is one. */
/**
 * The link picture (WhatsApp / Facebook): the photo cut by StuPanel to 1200 × 630 — the shape Facebook shows big —
 * where the studio's Adjust put it (cropKey, e.g. "offer:<id>"), as a JPEG. Width and height are given so the
 * picture shows on the very first share.
 */
export function shareImage(d: SiteData, photoId?: string | null, cropKey?: string) {
  const id = photoId ?? d.content.seo?.image ?? d.content.heroPhotos[0] ?? d.content.slides?.[0] ?? d.content.albums[0]?.cover;
  const p = id ? d.photos[id] : undefined;
  if (!p || !id) return undefined;
  const q = new URLSearchParams({ p: id, ...(cropKey && d.content.crop?.[cropKey] ? { c: cropKey } : {}) });
  return { url: `${API_URL}/public/site/${encodeURIComponent(d.slug)}/share.jpg?${q}`, width: 1200, height: 630, type: "image/jpeg" };
}

/** Pages worth listing for search engines (empty pages are left out). */
export function sitemapPaths(d: SiteData): { path: string; date?: string }[] {
  const c = d.content;
  const out: { path: string; date?: string }[] = [{ path: "/" }, { path: "/portfolio" }];
  for (const a of c.albums) out.push({ path: `/portfolio/${a.id}` });
  if (c.filmUrl || (c.films ?? []).length) out.push({ path: "/films" });
  const offers = (c.offers ?? []).filter(o => !o.hidden && o.name);
  if ((c.showPackages && d.packages.length) || offers.length) out.push({ path: "/packages" });
  for (const o of offers) out.push({ path: `/packages/${o.id}` });
  out.push({ path: "/about" });
  if (c.reviews.length) out.push({ path: "/reviews" });
  if ((c.faqs ?? []).length) out.push({ path: "/faq" });
  out.push({ path: "/contact" });
  if ((c.stories ?? []).length) {
    out.push({ path: "/stories" });
    for (const s of c.stories ?? []) out.push({ path: `/stories/${s.id}`, date: s.date || undefined });
  }
  return out;
}

/** schema.org data for Google: the studio as a local business on Home, questions and answers on the FAQ page. */
export function structuredData(d: SiteData, page: SitePageName, offerId?: string): object[] {
  const c = d.content, home = siteHome(d);
  const offer = page === "packages" && offerId ? (c.offers ?? []).find(o => o.id === offerId && !o.hidden) : undefined;
  if (offer) {
    // A package as a product (Google and Facebook read the name, picture and price).
    const img = shareImage(d, offer.cover ?? offer.photos[0], `offer:${offer.id}`);
    return [{
      "@context": "https://schema.org", "@type": "Product", name: offer.name, description: offerSummary(offer, d),
      ...(img ? { image: img.url } : {}), brand: { "@type": "Brand", name: d.studio.name },
      ...(priceNow(offer).price !== null ? { offers: { "@type": "Offer", price: priceNow(offer).price, priceCurrency: d.currency ?? "BDT", availability: "https://schema.org/InStock", url: `${home}/packages/${offer.id}` } } : {}),
    }];
  }
  if (page === "home") {
    const img = shareImage(d);
    const sameAs = [c.facebook, c.instagram, c.youtube].filter(Boolean);
    return [{
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "@id": `${home}/#studio`,
      name: d.studio.name,
      url: `${home}/`,
      description: pageSeo(d, "home").description,
      ...(img ? { image: img.url } : {}),
      ...(d.studio.logoUrl ? { logo: d.studio.logoUrl } : {}),
      ...(c.phone ? { telephone: c.phone } : {}),
      ...(c.email ? { email: c.email } : {}),
      ...(c.address ? { address: { "@type": "PostalAddress", streetAddress: c.address } } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    }, {
      "@context": "https://schema.org", "@type": "WebSite", name: d.studio.name, url: `${home}/`,
    }];
  }
  if (page === "faq" && (c.faqs ?? []).length) {
    return [{
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: (c.faqs ?? []).map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    }];
  }
  return [];
}

/** A line about a website package for Google and shared links: its tagline, else its facts and price. */
export function offerSummary(o: SiteOffer, d: SiteData): string {
  const facts = o.facts.map(f => [f.v, f.l].filter(Boolean).join(" ")).filter(Boolean).join(", ");
  const now = priceNow(o).price;
  const price = now !== null ? `${o.from ? "From " : ""}${d.currency === "BDT" || !d.currency ? "৳" : `${d.currency} `}${now.toLocaleString("en-IN")}` : "";
  const line = [o.tagline, facts, price].filter(Boolean).join(" · ");
  return (line || `${o.name} by ${d.studio.name}.`).slice(0, 155);
}

/** JSON for a <script type="application/ld+json">: "<" escaped so text can never close the tag. */
export const ldJson = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");
