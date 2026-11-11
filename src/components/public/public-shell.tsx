"use client";

/**
 * The frame for every page a client opens (portal, quote, invoice, receipt, tracker, contract):
 * the same soft backdrop and glass as the studio app, a frosted top bar with the studio's logo,
 * the page content in the middle, and a quiet footer.
 */
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudioLogo } from "@/components/studio-logo";
import { CARD_SHADOW } from "@/components/ui/apple";

export function PublicShell({ studio, sub, right, children, width = "max-w-[880px]", footer, className }: {
  studio?: { name?: string | null; logoUrl?: string | null } | null;
  /** Small line under the studio name, e.g. "Client portal" */
  sub?: string;
  /** Buttons on the right of the top bar */
  right?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-dvh sp-shell flex flex-col print:bg-white">
      <div className="sp-scene print:hidden" aria-hidden="true" />
      {studio && (
        <header className="sticky top-0 z-30 sp-topbar border-b border-white/60 print:hidden">
          <div className={cn("mx-auto px-4 h-16 flex items-center gap-3", width)}>
            <StudioLogo url={studio.logoUrl} name={studio.name} size={38} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold tracking-[-0.01em] text-[#17151F] truncate leading-tight">{studio.name}</p>
              {sub && <p className="text-[12px] text-[#6B6680] truncate">{sub}</p>}
            </div>
            {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
          </div>
        </header>
      )}
      <main className={cn("flex-1 w-full mx-auto px-3 sm:px-4 py-5 sm:py-8", width, className)}>{children}</main>
      <footer className="pb-7 pt-2 text-center text-[12px] text-[#8A8599] print:hidden">
        {footer ?? <>Sent with <span className="font-semibold text-[#4A4658]">StuPanel</span></>}
      </footer>
    </div>
  );
}

/** Full-page loading spinner on the backdrop. */
export function PublicLoading() {
  return (
    <div className="min-h-dvh sp-shell flex items-center justify-center">
      <div className="sp-scene" aria-hidden="true" />
      <Loader2 className="w-7 h-7 animate-spin text-[#7D5CEF]" aria-label="Loading" />
    </div>
  );
}

/** A centred message card ("This link isn't working…"). */
export function PublicMessage({ icon: Icon, tone = "violet", title, text, children }: {
  icon: React.ElementType; tone?: "violet" | "red" | "green"; title: string; text?: React.ReactNode; children?: React.ReactNode;
}) {
  const ring = { violet: "bg-[#EEE8FD] text-[#5B3FD0]", red: "bg-[#FDECEF] text-[#C2304F]", green: "bg-[#E7F5EE] text-[#1F8A5B]" }[tone];
  return (
    <div className="min-h-dvh sp-shell flex items-center justify-center p-5">
      <div className="sp-scene" aria-hidden="true" />
      <div className={cn("w-full max-w-sm bg-white rounded-[24px] p-7 text-center", CARD_SHADOW)}>
        <span className={cn("w-14 h-14 rounded-full flex items-center justify-center mx-auto", ring)}><Icon className="w-6 h-6" /></span>
        <h1 className="mt-4 text-lg font-extrabold tracking-[-0.01em] text-[#17151F]">{title}</h1>
        {text && <p className="mt-1.5 text-sm text-[#6B6680] leading-relaxed">{text}</p>}
        {children}
      </div>
    </div>
  );
}
