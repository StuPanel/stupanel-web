"use client";

/**
 * Direct link to choose songs for one program — no access code. The same music screen as
 * the client portal, so whatever is picked or sent here shows in the portal too (and the
 * other way round). The link opens only this one program's music.
 */
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Link2Off } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { fmtDate } from "@/lib/format";
import { linkMusicApi } from "@/lib/select-api";
import type { ClientMusic } from "@/lib/music";
import { CARD_SHADOW } from "@/components/ui/apple";
import { PublicLoading, PublicMessage, PublicShell } from "@/components/public/public-shell";
import { PortalLink, type LinkBrand } from "@/components/public/portal-link";
import { PortalMusic } from "@/app/portal/[token]/_components/portal-music";

export default function MusicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const api = useMemo(() => linkMusicApi(token), [token]);
  const [data, setData] = useState<{ music: ClientMusic; brand: LinkBrand } | null>(null);
  const [failed, setFailed] = useState(false);
  const [first, setFirst] = useState(true);

  const load = useCallback(() => {
    fetch(api.url(""))
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (failed) return <PublicMessage icon={Link2Off} tone="red" title="This link is not working" text="Please ask the studio for a new one." />;
  if (!data) return <PublicLoading />;
  const { music, brand } = data;
  return (
    <PublicShell studio={{ name: brand.studio, logoUrl: brand.logoUrl }} sub="Choose your music" width="max-w-[640px]">
      <div className={`bg-white rounded-[22px] pt-5 ${CARD_SHADOW}`}>
        <div className="px-5 pb-4">
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-[#17151F]">Hi {brand.firstName || "there"}!</h1>
          <p className="text-[14px] text-[#6B6680] mt-1">
            Pick the songs you want in the videos of <span className="font-semibold text-[#33303F]">{music.program}</span>
            {music.eventDate ? <> ({fmtDate(music.eventDate)})</> : null}.
          </p>
        </div>
        <PortalMusic api={api} music={music} brand={BRAND} autoOpen={first}
          onChanged={() => { setFirst(false); load(); }} />
      </div>
      {brand.portalUrl && <PortalLink url={brand.portalUrl} icon={LayoutGrid} />}
    </PublicShell>
  );
}
