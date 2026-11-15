"use client";

/**
 * Music for video editors (team members tagged "Video editor" in Team):
 * each program's songs — choose them, or ask the client to — and the studio's whole Music Library.
 */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ListMusic, Music2, Search } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { EmptyState, Group, ListRow, PageHeader, RowsSkeleton } from "@/components/ui/apple";
import { MusicLibrary } from "@/components/music/music-library";

type Row = {
  id: string; bookingNumber: string; eventName: string | null; eventDate: string | null;
  client: { firstName: string; lastName: string | null };
  music: { status: string; submittedAt: string | null } | null;
};

const STATE: Record<string, { label: string; cls: string }> = {
  none: { label: "Not started", cls: "bg-[#F1EFF6] text-[#6B6680]" },
  open: { label: "Client is choosing", cls: "bg-[#EEE8FD] text-[#5B3FD0]" },
  submitted: { label: "Client sent", cls: "bg-[#E2F4EA] text-[#1F8A5B]" },
  locked: { label: "Locked", cls: "bg-[#E6EEF8] text-[#1F5C99]" },
};

export default function MemberMusicPage() {
  const [tab, setTab] = useState<"programs" | "library">("programs");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch(`${API}/music/programs`).then(async r => {
      if (r.status === 403) { setDenied(true); setRows([]); return; }
      setRows(r.ok ? await r.json() : []);
    }).catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (rows ?? []).filter(r => !k || `${r.eventName ?? ""} ${r.bookingNumber} ${r.client.firstName} ${r.client.lastName ?? ""}`.toLowerCase().includes(k));
  }, [rows, q]);

  if (denied) return (
    <div>
      <PageHeader icon={Music2} color="orchid" title="Music" sub="For video editors" />
      <EmptyState icon={Music2} title="Music is for video editors" text="Ask your studio to tag you as Video editor in Team to choose songs for programs." />
    </div>
  );

  return (
    <div>
      {tab === "programs" && <PageHeader icon={Music2} color="orchid" title="Music" sub="Choose songs for a program, or ask the client to choose" />}
      <div className={cn("flex gap-1.5 mb-4", tab === "library" && "mb-3")} role="tablist" aria-label="Music">
        {([["programs", "Programs", ListMusic], ["library", "Music Library", Music2]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn("h-10 px-4 rounded-full text-[13.5px] font-bold inline-flex items-center gap-2 transition-colors", tab === id ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]")}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === "library" ? <MusicLibrary member /> : rows === null ? <RowsSkeleton n={5} /> : rows.length === 0 ? (
        <EmptyState icon={ListMusic} title="No programs yet" text="When the studio has programs, you choose their songs here." />
      ) : (
        <>
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6B6680] pointer-events-none" />
            <input value={q} onChange={e => setQ(e.target.value)} type="search" aria-label="Search programs" placeholder="Search a program or client"
              className="w-full h-11 pl-11 pr-4 rounded-full bg-white text-[15px] text-[#17151F] outline-none border border-transparent focus:border-[#7D5CEF] placeholder:text-[#A29DB3]" />
          </div>
          {shown.length === 0 ? <p className="text-center text-sm text-[#6B6680] py-10">Nothing matches.</p> : (
            <Group>
              {shown.map(r => {
                const st = STATE[r.music?.status ?? "none"] ?? { label: r.music?.status ?? "", cls: "bg-[#F1EFF6] text-[#6B6680]" };
                return (
                  <ListRow key={r.id} href={`/member/music/${r.id}`} icon={r.music?.status === "submitted" ? CheckCircle2 : r.music ? Clock3 : Music2} color="orchid"
                    title={r.eventName || r.bookingNumber}
                    sub={<>{r.client.firstName} {r.client.lastName ?? ""} · {r.bookingNumber}{r.eventDate ? ` · ${fmtDate(r.eventDate)}` : ""}</>}
                    right={<span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap", st.cls)}>{st.label}</span>} />
                );
              })}
            </Group>
          )}
        </>
      )}
    </div>
  );
}
