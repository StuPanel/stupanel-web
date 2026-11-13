/**
 * The studio's website and social profiles (Settings → Social & Links), as small pills.
 * Shown to clients at the bottom of the portal and of a quote. Nothing renders when the studio saved none.
 */
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudioLinkFields = {
  website?: string | null; facebookUrl?: string | null; instagramUrl?: string | null;
  youtubeUrl?: string | null; tiktokUrl?: string | null;
  otherLinks?: { label?: string; url?: string }[] | null;
};

/** Only real web addresses; a bare "facebook.com/x" gets https:// in front. */
function href(raw?: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v || /\s/.test(v)) return null;
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try { const u = new URL(url); return u.hostname.includes(".") ? u.toString() : null; } catch { return null; }
}

export function studioLinks(s: StudioLinkFields): { label: string; url: string }[] {
  const list: { label: string; url: string | null }[] = [
    { label: "Website", url: href(s.website) },
    { label: "Facebook", url: href(s.facebookUrl) },
    { label: "Instagram", url: href(s.instagramUrl) },
    { label: "YouTube", url: href(s.youtubeUrl) },
    { label: "TikTok", url: href(s.tiktokUrl) },
    ...(Array.isArray(s.otherLinks) ? s.otherLinks : []).map(l => ({ label: (l?.label ?? "").trim() || "Link", url: href(l?.url) })),
  ];
  return list.filter((l): l is { label: string; url: string } => !!l.url);
}

export function StudioLinks({ studio, className }: { studio: StudioLinkFields; className?: string }) {
  const links = studioLinks(studio);
  if (!links.length) return null;
  return (
    <nav aria-label="Studio links" className={cn("flex flex-wrap justify-center gap-2 print:hidden", className)}>
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
          className="h-8 px-3 rounded-full bg-white border border-[#E9E5F1] text-[12.5px] font-semibold text-[#4A4658] hover:text-[#5B3FD0] hover:border-[#CFC4F7] inline-flex items-center gap-1.5 max-w-[220px]">
          <span className="truncate">{l.label}</span><ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      ))}
    </nav>
  );
}
