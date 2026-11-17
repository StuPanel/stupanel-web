"use client";

/** The client's chosen songs, for the editor of this program. */
import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Mic2, Piano } from "lucide-react";
import { notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { Section, card } from "@/components/ui/profile-page";
import { apiFetch, API_URL as API } from "@/lib/api";
import type { MusicPart, MusicPick } from "@/lib/music";

type Data = { status: string; submittedAt: string | null; clientNote: string | null; parts: (MusicPart & { songs: MusicPick[] })[] };

/** `onLoaded` tells the page whether the client picked any songs. */
export function EditorMusic({ assignmentId, onLoaded }: { assignmentId: string; onLoaded?: (has: boolean) => void }) {
  const [d, setD] = useState<Data | null>(null);
  /** Sound filter: every song, only songs with singing, or music only. */
  const [sound, setSound] = useState<"" | "sung" | "inst">("");
  const cb = useRef(onLoaded);
  useEffect(() => { cb.current = onLoaded; });
  useEffect(() => {
    apiFetch(`${API}/member/editing/${assignmentId}/music`).then(r => (r.ok ? r.text() : "")).then(t => { let v: Data | null = null; try { v = t ? JSON.parse(t) : null; } catch { v = null; } setD(v); cb.current?.(!!v?.parts?.length); }).catch(() => cb.current?.(false));
  }, [assignmentId]);
  if (!d || !d.parts.length) return null;
  const final = d.status === "submitted";
  const all = d.parts.flatMap(p => p.songs);
  const instCount = all.filter(s => s.instrumental).length;
  // Only worth showing when the client chose both kinds.
  const hasSound = instCount > 0 && instCount < all.length;
  const keep = (s: MusicPick) => !hasSound || !sound || (sound === "inst") === !!s.instrumental;
  const parts = d.parts.map(p => ({ ...p, shown: p.songs.map((s, i) => ({ s, i })).filter(x => keep(x.s)) })).filter(p => p.shown.length);
  return (
    <Section title="Client's songs" action={<span className="text-[12.5px] text-[#6B6680] text-right">{final ? "Final list · 1 = first choice" : "Still choosing — can change"}</span>}>
    <div className={cn(card, "p-4 sm:p-5 min-w-0")}>
      {hasSound && (
        <div role="group" aria-label="Show songs" className="flex gap-1.5 mb-3 overflow-x-auto [scrollbar-width:none]">
          {([["", "All", all.length], ["sung", "With singing", all.length - instCount], ["inst", "Instrumental", instCount]] as const).map(([id, label, n]) => {
            const on = sound === id;
            return (
              <button key={id || "all"} type="button" aria-pressed={on} onClick={() => setSound(id)}
                className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0 transition-colors",
                  on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
                {id === "inst" ? <Piano className="w-3.5 h-3.5" aria-hidden /> : id === "sung" ? <Mic2 className="w-3.5 h-3.5" aria-hidden /> : null}
                {label}<span className={cn("tabular-nums", on ? "opacity-75" : "text-[#8A8599]")}>{n}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-3">
        {parts.map(p => (
          <div key={p.key}>
            <p className="text-[13px] font-bold text-[#4A4658] mb-1.5">{p.label}</p>
            <ol className="space-y-1.5">
              {p.shown.map(({ s, i }) => (
                <li key={s.youtubeId} className="flex items-center gap-1.5">
                  <a href={s.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 flex items-center gap-2.5 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] p-2">
                    <span className="w-5 text-[12px] font-bold text-[#5B3FD0] tabular-nums text-center">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumb} alt="" className="w-14 h-9 rounded-[8px] object-cover flex-shrink-0" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="text-[13px] font-semibold text-[#17151F] line-clamp-2 sm:line-clamp-1 [overflow-wrap:anywhere]" title={s.title}>{s.title}</span>
                      {s.instrumental && <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#0F5A4C]"><Piano className="w-3 h-3" aria-hidden />Instrumental</span>}
                      {s.note && <span className="block text-[12px] text-[#9E3A8C] truncate">“{s.note}”</span>}
                    </span>
                    <ExternalLink className="w-4 h-4 text-[#6B6680] flex-shrink-0" />
                  </a>
                  <button type="button" aria-label={`Copy the YouTube link of ${s.title}`} title="Copy YouTube link"
                    onClick={async () => { try { await navigator.clipboard.writeText(s.url); notify("YouTube link copied"); } catch { notify("Could not copy. Open the song and copy its link.", { error: true }); } }}
                    className="w-11 h-11 rounded-[12px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] flex items-center justify-center flex-shrink-0"><Copy className="w-4 h-4" /></button>
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
