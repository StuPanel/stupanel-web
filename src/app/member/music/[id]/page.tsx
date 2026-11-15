"use client";

/** One program's music, for a video editor: set the parts, choose songs, send the client their link. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Music2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { EmptyState, RowsSkeleton } from "@/components/ui/apple";
import { MusicSection } from "@/app/(app)/programs/_components/music-section";
import type { Booking } from "@/app/(app)/programs/_components/types";

type Row = { id: string; bookingNumber: string; eventName: string | null; client: { id: string; firstName: string; lastName: string | null; phone: string | null } };

export default function MemberProgramMusicPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<Row | null | undefined>(undefined);

  useEffect(() => {
    apiFetch(`${API}/music/programs`).then(async r => {
      const list: Row[] = r.ok ? await r.json() : [];
      setRow(list.find(x => x.id === id) ?? null);
    }).catch(() => setRow(null));
  }, [id]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/member/music" aria-label="Back to Music" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#17151F] hover:bg-[#F5F3FA] flex-shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="min-w-0">
          <h1 className="text-[20px] font-extrabold text-[#17151F] truncate">{row ? row.eventName || row.bookingNumber : "Music"}</h1>
          {row && <p className="text-[13px] text-[#6B6680] truncate">{row.client.firstName} {row.client.lastName ?? ""} · {row.bookingNumber}</p>}
        </div>
      </div>
      {row === undefined ? <RowsSkeleton n={3} /> : row === null ? (
        <EmptyState icon={Music2} title="Program not found" text="It may be cancelled, or music is only for video editors." />
      ) : (
        <MusicSection member booking={row as unknown as Booking} />
      )}
    </div>
  );
}
