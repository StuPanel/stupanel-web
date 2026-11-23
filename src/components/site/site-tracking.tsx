"use client";
/**
 * A studio website's own Facebook Pixel, Google Analytics 4 and Google Tag Manager (only on the published
 * site, never in the studio's preview). Counts:
 *  - a page view on the first load and on every move to another page of the site,
 *  - "Contact" when a visitor taps a phone, WhatsApp, Messenger or email link,
 *  - "Lead" when the booking form is sent (siteTrack("lead") from the form).
 */
import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

export type SiteTrackingIds = { fbPixel?: string; ga?: string; gtm?: string };

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };

/** Tell the studio's pixel / analytics that something happened. Does nothing when the site has none. */
export function siteTrack(what: "lead" | "contact", detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as W;
  if (what === "lead") {
    w.fbq?.("track", "Lead", detail);
    w.gtag?.("event", "generate_lead", detail);
    w.dataLayer?.push({ event: "site_lead", ...detail });
  } else {
    w.fbq?.("track", "Contact", detail);
    w.gtag?.("event", "contact", detail);
    w.dataLayer?.push({ event: "site_contact", ...detail });
  }
}

const ok = (re: RegExp, v?: string) => (v && re.test(v) ? v : "");

export function SiteTracking({ ids }: { ids: SiteTrackingIds }) {
  // The server already checked them; checked again because they go into a script.
  const fb = ok(/^\d{8,20}$/, ids.fbPixel), ga = ok(/^G-[A-Z0-9]{4,15}$/, ids.ga), gtm = ok(/^GTM-[A-Z0-9]{4,12}$/, ids.gtm);
  const path = usePathname();
  const first = useRef(true);

  // Page views after moving inside the site (the first one is sent by the snippets themselves).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const w = window as W;
    w.fbq?.("track", "PageView");
    if (ga) w.gtag?.("event", "page_view", { page_location: window.location.href, page_title: document.title });
    w.dataLayer?.push({ event: "site_page_view", page: window.location.pathname });
  }, [path, ga]);

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
