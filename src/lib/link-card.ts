/**
 * Title and preview card for a link a studio sends its client (WhatsApp, Facebook, Messenger, the browser tab):
 * the studio's name and logo only — never the client's name or any amount (Faisal 24-NOV-2026).
 */
import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

export type LinkKind = "quote" | "invoice" | "portal" | "selection" | "family" | "music" | "contract";

export async function linkMeta(kind: LinkKind, token: string, what: string, line: string): Promise<Metadata> {
  const card = await fetch(`${API}/public/link-card?kind=${kind}&token=${encodeURIComponent(token)}`, { next: { revalidate: 600 } })
    .then(r => (r.ok ? (r.json() as Promise<{ studio: string; logoUrl: string | null }>) : null))
    .catch(() => null);
  const title = card?.studio ? `${what} — ${card.studio}` : what;
  const description = card?.studio ? line.replace("{studio}", card.studio) : line.replace(" from {studio}", "").replace("{studio}", "the studio");
  const images = card?.logoUrl ? [{ url: card.logoUrl, width: 400, height: 400 }] : undefined;
  return {
    // The studio's own name, without "| StuPanel" after it
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: card?.studio || undefined, images },
    twitter: { card: "summary", title, description, images: images?.map(i => i.url) },
  };
}
