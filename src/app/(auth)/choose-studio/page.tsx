"use client";

/**
 * After "Continue with Google" for someone in several studios: pick one.
 * The ticket is short-lived and only opens the studios it lists.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { StudioList } from "@/components/studio-list";
import { enterSession, postPublic, type Session, type StudioCard } from "@/lib/studio-session";

type TicketInfo = { studios: StudioCard[] };

function Chooser() {
  const params = useSearchParams();
  const ticket = params.get("ticket") ?? "";
  const [info, setInfo] = useState<TicketInfo | null>(null);
  const [failed, setError] = useState("");
  const error = failed || (ticket ? "" : "This sign-in link has expired. Please sign in again.");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!ticket) return;
    postPublic<TicketInfo>("/auth/ticket-studios", { ticket }).then(r => {
      if (r.ok) setInfo(r.data); else setError(r.error);
    });
  }, [ticket]);

  async function pick(s: StudioCard) {
    setBusy(s.userId); setError("");
    const r = await postPublic<Session>("/auth/choose-studio", { ticket, userId: s.userId });
    if (!r.ok) { setBusy(null); setError(r.error); return; }
    enterSession(r.data);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#17151F]">Choose a studio</h2>
        <p className="text-[#6B6680] mt-1 text-sm">You work with more than one studio. You can switch any time from the studio name.</p>
      </div>
      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</div>}
      {info ? <StudioList studios={info.studios} busyId={busy} onPick={pick} />
        : !error && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>}
      <Link href="/login" className="inline-block mt-6 text-sm font-semibold text-[#7D5CEF] hover:text-[#5B3FD0]">← Back to sign in</Link>
    </div>
  );
}

export default function ChooseStudioPage() {
  return <Suspense fallback={null}><Chooser /></Suspense>;
}
