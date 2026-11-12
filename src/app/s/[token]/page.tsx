"use client";

/**
 * Direct link to choose album photos — no access code. The same chooser as the client
 * portal, so whatever is chosen or sent here shows in the portal too (and the other way round).
 * The link opens only this one selection.
 */
import { use, useCallback, useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { linkPhotoApi } from "@/lib/select-api";
import type { ClientGallery } from "@/lib/photos";
import { Chooser } from "@/app/portal/[token]/_components/portal-photos";
import { PortalLink, type LinkBrand } from "@/components/public/portal-link";

export default function PhotoLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const api = useMemo(() => linkPhotoApi(token), [token]);
  const [brand, setBrand] = useState<LinkBrand | null>(null);
  const loaded = useCallback((g: ClientGallery) => setBrand((g as ClientGallery & { brand?: LinkBrand }).brand ?? null), []);
  return (
    <Chooser api={api} brand={BRAND} onLoaded={loaded}
      failText="This link is not working. Please ask the studio for a new one."
      after={brand?.portalUrl ? <PortalLink url={brand.portalUrl} icon={LayoutGrid} /> : null} />
  );
}
