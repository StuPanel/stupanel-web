"use client";

/** The client's chosen songs, for the editor of this program. */
import { useEffect, useState } from "react";
import { ExternalLink, Music2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import type { MusicPart, MusicPick } from "@/lib/music";

type Data = { status: string; submittedAt: string | null; clientNote: string | null; parts: (MusicPart & { songs: MusicPick[] })[] };

export function EditorMusic({ assignmentId }: { assignmentId: string }) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    apiFetch(`${API}/member/editing/${assignmentId}/music`).then(r => (r.ok ? r.text() : "")).then(t => { try { setD(t ? JSON.parse(t) : null); } catch { setD(null); } }).catch(() => {});
  }, [assignmentId]);
  if (!d || !d.parts.length) return null;
  const final = d.status === "submitted";
  return (
    <div className="min-w-0 bg-white rounded-[20px] p-4 sp-card shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-9 h-9 rounded-[12px] bg-[#F7E6F3] flex items-center justify-center"><Music2 className="w-4 h-4 text-[#9E3A8C]" /></span>
        <div>
          <p className="text-[15px] font-bold text-[#17151F]">Client&apos;s songs</p>
          <p className="text-[12.5px] text-[#6B6680]">{final ? "Final list from the client. 1 = first choice." : "The client is still choosing — this can change."}</p>
        </div>
      </div>
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
  );
}
