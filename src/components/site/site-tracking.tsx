"use client";
/**
 * A studio website's own Facebook Pixel, Google Analytics 4 and Google Tag Manager (only on the published
 * site, never in the studio's preview). Counts:
 *  - a page view on the first load and on every move to another page of the site,
 *  - "Contact" when a visitor taps a phone, WhatsApp, Messenger or email link,
 *  - "Lead" when the booking form is sent (siteTrack("lead") from the form),
 *  - for a website package: "ViewContent" on its page, "InitiateCheckout" on "Book this package", and the
 *    package's id, name and total with the Lead (so ads can be judged package by package).
 */
import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { API_URL } from "@/lib/api";

export type SiteTrackingIds = { fbPixel?: string; ga?: string; gtm?: string };

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };

/** A website package in the words Facebook and Google use (id, name, value, currency). */
export function packageDetail(o: { id: string; name: string }, value: number | null | undefined, currency: string) {
  return {
    content_name: o.name, content_ids: [o.id], content_type: "product", currency,
    ...(typeof value === "number" ? { value } : {}),
    items: [{ item_id: o.id, item_name: o.name, ...(typeof value === "number" ? { price: value } : {}) }],
  };
}

/** Tell the studio's pixel / analytics that something happened. Does nothing when the site has none. */
export function siteTrack(what: "lead" | "contact" | "checkout", detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as W;
  if (what === "checkout") {
    w.fbq?.("track", "InitiateCheckout", detail);
    w.gtag?.("event", "begin_checkout", detail);
    w.dataLayer?.push({ event: "site_package_book", ...detail });
  } else if (what === "lead") {
    w.fbq?.("track", "Lead", detail);
    w.gtag?.("event", "generate_lead", detail);
    w.dataLayer?.push({ event: "site_lead", ...detail });
  } else {
    w.fbq?.("track", "Contact", detail);
    w.gtag?.("event", "contact", detail);
    w.dataLayer?.push({ event: "site_contact", ...detail });
  }
}

let lastPath: string | null = null;
const ok = (re: RegExp, v?: string) => (v && re.test(v) ? v : "");

export function SiteTracking({ ids }: { ids: SiteTrackingIds }) {
  // The server already checked them; checked again because they go into a script.
  const fb = ok(/^\d{8,20}$/, ids.fbPixel), ga = ok(/^G-[A-Z0-9]{4,15}$/, ids.ga), gtm = ok(/^GTM-[A-Z0-9]{4,12}$/, ids.gtm);
  const path = usePathname();

  // Moving inside the site: the Pixel and GA4 (enhanced measurement, on by default) count page changes by
  // themselves, so sending one here would count it twice. Tag Manager gets "site_page_view" for its triggers.
  // This box is drawn again on every page, so the last page is kept outside it.
  useEffect(() => {
    if (lastPath === null || lastPath === path) { lastPath = path; return; }
    lastPath = path;
    if (gtm) (window as W).dataLayer?.push({ event: "site_page_view", page: window.location.pathname });
  }, [path, gtm]);

  // Taps on phone / WhatsApp / Messenger / email links.
  useEffect(() => {
    if (!fb && !ga && !gtm) return;
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const h = a.href;
      const how = h.startsWith("tel:") ? "phone" : /wa\.me|whatsapp\.com/.test(h) ? "whatsapp" : /m\.me\/|messenger\.com/.test(h) ? "messenger" : h.startsWith("mailto:") ? "email" : null;
      if (how) siteTrack("contact", { method: how });
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [fb, ga, gtm]);

  if (!fb && !ga && !gtm) return null;
  return (
    <>
      {fb && (
        <>
          <Script id="site-fb-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fb}');fbq('track','PageView');`}</Script>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <noscript><img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${fb}&ev=PageView&noscript=1`} /></noscript>
        </>
      )}
      {ga && (
        <>
          <Script id="site-ga-src" src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="site-ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}</Script>
        </>
      )}
      {gtm && (
        <>
          <Script id="site-gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}</Script>
          <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" /></noscript>
        </>
      )}
    </>
  );
}

/**
 * StuPanel's own visitor counter (the studio sees it in Website → Visitors). A tiny beacon per page, no cookie:
 * the browser only remembers the day of its last visit, so the first page of a day counts as a visitor.
 */
export function SiteBeacon({ slug }: { slug: string }) {
  const path = usePathname();
  const base = useRef<string | null>(null);

  useEffect(() => {
    const send = (q: Record<string, string>) => {
      try {
        const url = `${API_URL}/public/site/${slug}/hit?${new URLSearchParams(q)}`;
        if (!navigator.sendBeacon?.(url)) void fetch(url, { method: "POST", keepalive: true, mode: "no-cors" });
      } catch { /* counting never bothers a visitor */ }
    };
    // The page path without /site/<address> (app links) — same on the subdomain and the own domain.
    const p = window.location.pathname.replace(new RegExp(`^/site/${slug}(?=/|$)`), "") || "/";
    if (base.current === p) return;
    base.current = p;
    const today = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
    let first = false;
    try {
      const k = `sv:${slug}`;
      first = localStorage.getItem(k) !== today;
      if (first) localStorage.setItem(k, today);
    } catch { first = false; }
    const q: Record<string, string> = { k: "view", p };
    if (first) {
      q.n = "1";
      if (document.referrer) q.r = document.referrer.slice(0, 300);
      const utm = new URLSearchParams(window.location.search).get("utm_source");
      if (utm) q.u = utm.slice(0, 40);
    }
    send(q);
  }, [path, slug]);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const h = a.href;
      if (h.startsWith("tel:") || h.startsWith("mailto:") || /wa\.me|whatsapp\.com|m\.me\/|messenger\.com/.test(h)) {
        try { navigator.sendBeacon?.(`${API_URL}/public/site/${slug}/hit?k=contact`); } catch { /* ignore */ }
      }
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [slug]);

  return null;
}
