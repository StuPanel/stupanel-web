"use client";

/** The studio's draft website, as visitors would see it. Asks the API as the signed-in studio. */
import { useEffect, useState } from "react";
import { API_URL as API, apiFetch } from "@/lib/api";
import { SiteView, type SiteData, type SitePageName } from "@/components/site/site-view";

export function SitePreview({ page, albumId }: { page: SitePageName; albumId?: string }) {
  const [data, setData] = useState<SiteData | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let on = true;
    apiFetch(`${API}/site/preview`).then(async r => { if (!on) return; if (r.ok) setData(await r.json()); else setBad(true); }).catch(() => on && setBad(true));
    return () => { on = false; };
  }, []);
  if (bad) return <p style={{ padding: 40, textAlign: "center", font: "500 16px system-ui" }}>The preview could not load. Open it again from the Website page.</p>;
  if (!data) return <div style={{ minHeight: "100dvh", background: "#17151F" }} aria-busy="true" />;
  return <SiteView key={page} data={data} preview page={page} albumId={albumId} />;
}
