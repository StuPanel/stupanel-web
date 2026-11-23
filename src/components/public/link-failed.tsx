"use client";
/**
 * What a client sees when a link from the studio does not open. If the studio is only paused (its StuPanel plan
 * ended and was not renewed), say so and who to contact; otherwise the page's own "not working" message.
 */
import { useEffect, useState } from "react";
import { PauseCircle } from "lucide-react";
import { PublicMessage } from "@/components/public/public-shell";
import type { LinkKind } from "@/lib/link-card";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

export function LinkFailed({ kind, token, children }: { kind: LinkKind; token: string; children: React.ReactNode }) {
  const [paused, setPaused] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    fetch(`${API}/public/link-card?kind=${kind}&token=${encodeURIComponent(token)}&why=1`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { studio: string; paused: boolean } | null) => setPaused(d?.paused ? d.studio : null))
      .catch(() => setPaused(null));
  }, [kind, token]);
  if (paused === undefined) return null;
  if (paused) return <PublicMessage icon={PauseCircle} title="This link is paused for now" text={`Please contact ${paused} — they can open it again.`} />;
  return <>{children}</>;
}
