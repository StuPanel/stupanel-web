"use client";

/**
 * View-only photos for the family (photo selection → Family link).
 * Watermarked previews, no download and nothing to change. Shows the couple's
 * picks once they have sent them.
 */
import { use, useEffect, useMemo, useState } from "react";
import { Heart, ImageOff, Images, Lock, Star } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Chips } from "@/components/ui/apple";
import { PublicLoading, PublicMessage, PublicShell } from "@/components/public/public-shell";
import { PhotoViewer } from "@/components/photo-viewer";
import { photoUrl, type SharedGallery } from "@/lib/photos";

type Filter = "all" | "chosen" | "highlights" | `a:${string}`;

export default function FamilyGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [g, setG] = useState<SharedGallery | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/public/photo-share/${encodeURIComponent(token)}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "x"); return r.json(); })
      .then(setG)
      .catch(() => setErr("This link is not working. Please ask the studio for a new one."));
  }, [token]);

  const chosen = g?.photos.filter(p => p.c).length ?? 0;
  const highlights = g?.photos.filter(p => p.hl).length ?? 0;
  const shown = useMemo(() => (g?.photos ?? []).filter(p =>
    filter === "all" ? true : filter === "chosen" ? p.c : filter === "highlights" ? p.hl : p.a === filter.slice(2)), [g, filter]);

  if (err) return <PublicMessage icon={ImageOff} tone="red" title="Photos not found" text={err} />;
  if (!g) return <PublicLoading />;

  const options: { value: Filter; label: string; count?: number }[] = [
    { value: "all", label: "All photos", count: g.photos.length },
    ...(chosen ? [{ value: "chosen" as Filter, label: `Chosen by ${g.client}`, count: chosen }] : []),
    ...(highlights ? [{ value: "highlights" as Filter, label: "Highlights", count: highlights }] : []),
    ...(g.albums.length > 1 ? g.albums.map(a => ({ value: `a:${a.id}` as Filter, label: a.name, count: g.photos.filter(p => p.a === a.id).length })) : []),
  ];
  const vp = view !== null ? shown[view] : null;
  const date = g.event.date ? new Date(g.event.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <PublicShell studio={g.studio} sub="Photos to view" width="max-w-[1280px]"
      footer={<>Shared by {g.studio.name} · <span className="font-semibold text-[#4A4658]">StuPanel</span></>}>
      <section className="mb-5">
        <h1 className="text-[26px] sm:text-[32px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{g.event.name || g.title}</h1>
        <p className="mt-1 text-[13.5px] text-[#6B6680]">{[date, `${g.photos.length} photos`].filter(Boolean).join(" · ")}</p>
        <p className={cn("mt-3 inline-flex items-center gap-2 bg-white rounded-full px-3.5 py-2 text-[12.5px] text-[#4A4658]", CARD_SHADOW)}>
          <Lock className="w-3.5 h-3.5 text-[#6B6680]" />Preview copies to look at — the studio delivers the final photos.
        </p>
      </section>

      {options.length > 1 && <Chips<Filter> label="Show" value={filter} onChange={v => { setFilter(v); setView(null); }} options={options} />}

      {shown.length === 0 ? (
        <div className={cn("bg-white rounded-[22px] py-14 text-center", CARD_SHADOW)}>
          <Images className="w-8 h-8 mx-auto text-[#B5B0C4]" />
          <p className="mt-3 text-[15px] font-semibold text-[#17151F]">No photos here yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2" onContextMenu={e => e.preventDefault()}>
          {shown.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setView(i)} aria-label={`Photo ${i + 1}`}
              className="relative aspect-square rounded-[12px] overflow-hidden bg-[#EEEBF4] group [content-visibility:auto] [contain-intrinsic-size:160px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(g.id, p.id, "t", g.img)} alt="" loading="lazy" decoding="async" draggable={false}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04] select-none" />
              <span className="absolute left-1.5 top-1.5 flex gap-1">
                {p.c && <span className="w-6 h-6 rounded-full bg-white/95 text-[#C2304F] flex items-center justify-center shadow" title={`Chosen by ${g.client}`}><Heart className="w-3.5 h-3.5" fill="currentColor" /></span>}
                {p.hl && <span className="w-6 h-6 rounded-full bg-white/95 text-[#9E3A8C] flex items-center justify-center shadow" title="Highlight"><Star className="w-3.5 h-3.5" fill="currentColor" /></span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {vp && view !== null && (
        <PhotoViewer count={shown.length} index={view} onIndex={setView} onClose={() => setView(null)}
          src={photoUrl(g.id, vp.id, "v", g.img)}
          preload={[shown[view + 1], shown[view + 2], shown[view - 1]].filter(Boolean).map(p => photoUrl(g.id, p!.id, "v", g.img))}
          title={`${view + 1} of ${shown.length}`} sub={g.albums.find(a => a.id === vp.a)?.name}
          footer={vp.c ? <p className="text-center text-[13px] text-white/85 inline-flex items-center justify-center gap-1.5 w-full"><Heart className="w-4 h-4 text-[#FF8FA6]" fill="currentColor" />Chosen by {g.client}</p> : undefined} />
      )}
    </PublicShell>
  );
}
