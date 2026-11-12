"use client";

/** "See all your programs" — from a direct choosing link to the client portal (which asks for the code). */
import { ArrowRight } from "lucide-react";

export type LinkBrand = {
  studio: string; logoUrl: string | null; phone: string | null; color: string | null;
  firstName: string; portalUrl: string | null;
};

export function PortalLink({ url, icon: Icon }: { url: string; icon: React.ElementType }) {
  return (
    <a href={url} className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#5B3FD0] hover:underline">
      <Icon className="w-4 h-4" />See all your programs in your client portal<ArrowRight className="w-3.5 h-3.5" />
    </a>
  );
}
