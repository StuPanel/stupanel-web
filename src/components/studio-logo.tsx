"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { safeLogo } from "@/lib/brand";

/**
 * Studio logo tile used everywhere (app, portal, tracker, quotes).
 * Shows the uploaded logo; if there is none or it fails to load, shows the
 * studio's first letter instead — never a broken image.
 *
 *   tone="light"  → white tile (on light backgrounds)
 *   tone="onDark" → translucent white tile (on violet / dark headers)
 */
export function StudioLogo({ url, name, size = 40, tone = "light", className }: {
  url?: string | null; name?: string | null; size?: number; tone?: "light" | "onDark"; className?: string;
}) {
  const src = safeLogo(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const initial = (name || "S").trim().charAt(0).toUpperCase() || "S";

  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0",
        tone === "onDark" ? "bg-white" : "bg-white border border-[#E3DFEC]",
        className,
      )}>
      {src && !failed
        ? <img src={src} alt={name ?? "logo"} className="w-full h-full object-contain p-1" onError={() => setFailed(true)} />
        : <span className="font-bold text-[#5B3FD0]" style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>}
    </div>
  );
}
