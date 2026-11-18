"use client";

/**
 * A program's cover on the client portal: the photo the studio chose, cropped around the
 * focus point it set, so the faces stay in view on a phone, a tablet and a computer.
 * No cover chosen → a quiet dark page with the studio's name and the program's name
 * (never a random photo).
 */
import { cn } from "@/lib/utils";
import { display } from "./portal-fonts";
import type { PortalBooking } from "./portal-data";

export function Cover({ cover, studio, className, children, dim = "bottom", blur }: {
  cover?: PortalBooking["cover"]; studio: string; className?: string; children?: React.ReactNode;
  /** Where the photo darkens so the white words on it stay readable. */
  dim?: "bottom" | "all" | "none";
  /** Money due: show the photo soft, behind the lock. */
  blur?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-[#17151F] isolate", className)}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" referrerPolicy="no-referrer" decoding="async"
          className={cn("absolute inset-0 w-full h-full object-cover", blur && "scale-110 blur-[14px] saturate-[.8]")}
          style={{ objectPosition: `${cover.x}% ${cover.y}%` }} />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_90%_at_80%_0%,#3A3446_0%,#17151F_60%)]">
          <span className={cn(display.className, "absolute -right-3 -top-6 text-[160px] leading-none text-white/[.06] select-none")}>{studio.charAt(0)}</span>
        </div>
      )}
      {dim !== "none" && (
        <div aria-hidden="true" className={cn("absolute inset-0",
          dim === "all" ? "bg-[#0B0A0E]/55" : "bg-[linear-gradient(180deg,rgba(11,10,14,.25)_0%,rgba(11,10,14,0)_32%,rgba(11,10,14,.78)_100%)]")} />
      )}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** The program's name in the display face, for over a cover. */
export function CoverTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h1 className={cn(display.className, "font-medium leading-[1.02] tracking-[-0.01em] text-balance", className)}>{children}</h1>;
}
