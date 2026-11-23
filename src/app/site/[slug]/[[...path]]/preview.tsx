"use client";

/** The studio's draft website, as visitors would see it. Asks the API as the signed-in studio. */
import { useEffect, useRef, useState } from "react";
import { API_URL as API, apiFetch } from "@/lib/api";
import { SiteView, type SiteData, type SitePageName } from "@/components/site/site-view";

export function SitePreview({ page, albumId, storyId, offerId }: { page: SitePageName; albumId?: string; storyId?: string; offerId?: string }) {
  const [data, setData] = useState<SiteData | null>(null);
  const [bad, setBad] = useState(false);
  /** Contact details the server fills from the studio's settings when the website's own boxes are empty. */
  const base = useRef<{ phone: string; email: string; address: string } | null>(null);
  useEffect(() => {
    let on = true;
    apiFetch(`${API}/site/preview`).then(async r => {
      if (!on) return;
      if (!r.ok) return setBad(true);
      const d = (await r.json()) as SiteData;
      base.current = { phone: d.content.phone, email: d.content.email, address: d.content.address };
      setData(d);
      // Inside the editor: ask it for the newest draft (changes then come as they are made, without a reload).
      if (window.parent !== window) window.parent.postMessage({ type: "sg-ready" }, window.location.origin);
    }).catch(() => on && setBad(true));
    return () => { on = false; };
  }, []);
  useEffect(() => {
    const yt = (v?: string | null) => /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/.exec(v || "")?.[1] ?? null;
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.type !== "sg-draft") return;
      const m = e.data as { theme: string; content: SiteData["content"]; photos: SiteData["photos"]; styleOk: boolean };
      setData(d => {
        if (!d) return d;
        const b = base.current;
        const c = m.content;
        return {
          ...d, theme: m.theme || d.theme, photos: { ...d.photos, ...m.photos },
          content: {
            ...c,
            phone: c.phone || b?.phone || "", email: c.email || b?.email || "", address: c.address || b?.address || "",
            filmId: yt(c.filmUrl), style: m.styleOk ? c.style : {}, tracking: undefined,
            offers: (c.offers ?? []).map(o => ({ ...o, filmId: yt(o.film) })),
          },
        };
      });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  if (bad) return <p style={{ padding: 40, textAlign: "center", font: "500 16px system-ui" }}>The preview could not load. Open it again from the Website page.</p>;
  if (!data) return <div style={{ minHeight: "100dvh", background: "#17151F" }} aria-busy="true" />;
  return <SiteView key={`${page}-${storyId ?? ""}-${offerId ?? ""}`} data={data} preview page={page} albumId={albumId} storyId={storyId} offerId={offerId} />;
}
