/**
 * Website packages: plain helpers (no React), so the server pages (titles, sitemap) can use them too.
 */
import type { SiteData } from "@/components/site/site-view";

export type SiteOffer = {
  id: string; name: string; group: string; tagline: string; cover: string | null; photos: string[];
  price: number | null; was: number | null; from: boolean; badge: string; ends: string;
  facts: { v: string; l: string }[]; days: { name: string; hours: string; team: string }[];
  gets: { t: string; d: string }[];
  /** perDay: the price is for one event / day; with several days the visitor picks the days (price × days) */
  extras: { name: string; price: number; perDay?: boolean }[];
  film?: string; filmId?: string | null; note: string; faqs: { q: string; a: string }[]; hidden: boolean;
  src: string | null; srcAt: string;
};

/** Packages visitors may see (the studio can keep one off the site). */
export const liveOffers = (d: Pick<SiteData, "content">) => (d.content.offers ?? []).filter(o => !o.hidden && o.name);

/** The price today: after the offer's last day the old price comes back by itself. */
export function priceNow(o: SiteOffer): { price: number | null; was: number | null; offer: boolean } {
  const over = !!o.ends && o.ends < new Date().toISOString().slice(0, 10);
  if (over && o.was !== null) return { price: o.was, was: null, offer: false };
  return { price: o.price, was: o.was, offer: o.was !== null };
}


/** An extra's price for the days chosen (per-day extras on a package of several days count each day). */
export function extraCost(e: { price: number; perDay?: boolean }, dayCount: number, chosen?: string[]): number {
  if (!e.perDay || dayCount < 2) return e.price;
  return e.price * Math.max(1, chosen?.length ?? dayCount);
}
