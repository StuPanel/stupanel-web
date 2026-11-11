"use client";

/** The client's chosen songs, for the editor of this program. */
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, card } from "@/components/ui/profile-page";
import { apiFetch, API_URL as API } from "@/lib/api";
import type { MusicPart, MusicPick } from "@/lib/music";

type Data = { status: string; submittedAt: string | null; clientNote: string | null; parts: (MusicPart & { songs: MusicPick[] })[] };

/** `onLoaded` tells the page whether the client picked any songs. */
export function EditorMusic({ assignmentId, onLoaded }: { assignmentId: string; onLoaded?: (has: boolean) => void }) {
  const [d, setD] = useState<Data | null>(null);
  const cb = useRef(onLoaded);
  useEffect(() => { cb.current = onLoaded; });
  useEffect(() => {
    apiFetch(`${API}/member/editing/${assignmentId}/music`).then(r => (r.ok ? r.text() : "")).then(t => { let v: Data | null = null; try { v = t ? JSON.parse(t) : null; } catch { v = null; } setD(v); cb.current?.(!!v?.parts?.length); }).catch(() => cb.current?.(false));
  }, [assignmentId]);
  if (!d || !d.parts.length) return null;
  const final = d.status === "submitted";
  return (
    <Section title="Client's songs" action={<span className="text-[12.5px] text-[#6B6680] text-right">{final ? "Final list · 1 = first choice" : "Still choosing — can change"}</span>}>
    <div className={cn(card, "p-4 sm:p-5 min-w-0")}>
      <div className="space-y-3">
        {d.parts.map(p => (
          <div key={p.key}>
            <p className="text-[13px] font-bold text-[#4A4658] mb-1.5">{p.label}</p>
            <ol className="space-y-1.5">
              {p.songs.map((s, i) => (
                <li key={s.youtubeId}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] p-2">
                    <span className="w-5 text-[12px] font-bold text-[#5B3FD0] tabular-nums text-center">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumb} alt="" className="w-14 h-9 rounded-[8px] object-cover flex-shrink-0" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="text-[13px] font-semibold text-[#17151F] line-clamp-2 sm:line-clamp-1 [overflow-wrap:anywhere]" title={s.title}>{s.title}</span>
                      {s.note && <span className="block text-[12px] text-[#9E3A8C] truncate">“{s.note}”</span>}
                    </span>
                    <ExternalLink className="w-4 h-4 text-[#6B6680] flex-shrink-0" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {d.clientNote && <p className="text-[13px] text-[#4A4658]"><b className="text-[#17151F]">Client&apos;s note:</b> {d.clientNote}</p>}
      </div>
    </div>
    </Section>
  );
}
