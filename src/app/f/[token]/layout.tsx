/**
 * The link preview of a Face Search guest link (WhatsApp, Facebook, Messenger): the studio's name, the gallery
 * and its cover photo, instead of StuPanel's own card. Read on the server from the same public data the page uses.
 */
import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
const APP = (process.env.NEXT_PUBLIC_APP_URL || "https://app.stupanel.com").replace(/\/$/, "");

type Open = {
  title: string; studio: { name: string; logoUrl: string | null };
  cover: { id?: string; driveFileId: string; width: number | null; height: number | null } | null;
  watermark?: string | null;
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const base = `${API}/public/face/${encodeURIComponent(token)}`;
  let g: Open | null = null;
  try {
    const r = await fetch(base, { next: { revalidate: 300 } });
    if (r.ok) g = (await r.json()) as Open;
  } catch { /* fall back to a plain card */ }
  if (!g?.title) return { title: "Your photos", robots: { index: false, follow: false } };

  const studio = g.studio?.name || "Your studio";
  const title = `${g.title} — ${studio}`;
  const description = `Your photos from ${g.title}, by ${studio}. Take one selfie and see every photo you are in.`;
  const image = g.cover
    ? g.watermark && g.cover.id ? `${base}/photo/${g.cover.id}/1600.jpg?v=${g.watermark}` : `https://lh3.googleusercontent.com/d/${g.cover.driveFileId}=w1200`
    : g.studio?.logoUrl || undefined;
  const url = `${APP}/f/${encodeURIComponent(token)}`;

  return {
    title, description,
    robots: { index: false, follow: false },
    openGraph: { type: "website", url, siteName: studio, title, description, ...(image ? { images: [{ url: image, alt: g.title }] } : {}) },
    twitter: { card: image && g.cover ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
