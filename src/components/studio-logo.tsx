"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { safeLogo } from "@/lib/brand";
import { INK, useLogoLook } from "@/lib/logo-look";

/**
 * Studio logo tile used everywhere (app, portal, tracker, quotes).
 * Shows the uploaded logo; if there is none or it fails to load, shows the
 * studio's first letter instead — never a broken image.
 *
 * The tile follows the logo (lib/logo-look):
 *   • a logo with its own background (white on black…) fills the tile in that colour — no white frame
 *   • a photo fills the tile
 *   • a white see-through logo sits on a dark tile, so it never disappears
 *   • anything else sits on a white tile with a little room around it
 *
 *   tone="onDark" → the tile is on a violet / dark header (no grey border)
 */
export function StudioLogo({ url, name, size = 40, tone = "light", className }: {
  url?: string | null; name?: string | null; size?: number; tone?: "light" | "onDark"; className?: string;
}) {
  const src = safeLogo(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const look = useLogoLook(src);
  const initial = (name || "S").trim().charAt(0).toUpperCase() || "S";
  const shown = !!src && !failed;

  const own = shown && look && (look.kind === "s" || look.kind === "p") && look.hex ? `#${look.hex}` : null;
  const darkTile = shown && look?.kind === "l";
  const background = own ?? (darkTile ? INK : "#FFFFFF");
  // A white tile needs a hairline on a light page; a coloured or dark tile carries itself.
  const hairline = !own && !darkTile && tone !== "onDark";
  const pad = Math.max(2, Math.round(size * 0.1));

  return (
    <div
      style={{ width: size, height: size, background }}
      className={cn(
        "rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0",
        hairline ? "border border-[#E3DFEC]" : "shadow-[inset_0_0_0_1px_rgba(22,18,40,.08)]",
        className,
      )}>
      {shown
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src!} alt={name ?? "logo"} onError={() => setFailed(true)}
            className={cn("w-full h-full", look?.kind === "p" ? "object-cover" : "object-contain")}
            style={own ? undefined : { padding: pad }} />
        : <span className="font-bold text-[#5B3FD0]" style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>}
    </div>
  );
}
