/**
 * The picture of a Face Search link preview, served from StuPanel's own address: Facebook and WhatsApp
 * can't read Google Drive's photo links, so the gallery cover (or the studio logo) is passed through here.
 */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

type Open = { studio?: { logoUrl: string | null }; cover: { id?: string; driveFileId: string } | null; watermark?: string | null };

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = `${API}/public/face/${encodeURIComponent(token)}`;
  const g = await fetch(base, { next: { revalidate: 300 } }).then(r => (r.ok ? (r.json() as Promise<Open>) : null)).catch(() => null);
  const src = g?.cover
    ? g.watermark && g.cover.id ? `${base}/photo/${g.cover.id}/1600.jpg?v=${g.watermark}` : `https://lh3.googleusercontent.com/d/${g.cover.driveFileId}=w1200`
    : g?.studio?.logoUrl;
  if (!src) return new Response("Not found", { status: 404 });
  const img = await fetch(src, { next: { revalidate: 3600 } }).catch(() => null);
  if (!img?.ok || !img.body) return new Response("Not found", { status: 404 });
  return new Response(img.body, {
    headers: {
      "Content-Type": img.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
