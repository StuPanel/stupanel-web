"use client";

/**
 * Album Studio — print albums laid out from the client's photo selection, in the browser, for free.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, EmptyState, MainButton, PageHeader, RowsSkeleton, SearchField } from "@/components/ui/apple";
import { albumApi, useWidth, type ReadySel } from "@/lib/album/api";
import { lookOf } from "@/lib/album/looks";
import { ratioOf, sizeOf, STATUS, type AlbumListRow, type AlbumStatus } from "@/lib/album/types";
import { SpreadView } from "@/components/album/spread-view";
import { fmtDate } from "@/lib/format";

const TABS: { id: "all" | AlbumStatus; label: string }[] = [
  { id: "all", label: "All" }, { id: "draft", label: "Draft" }, { id: "client", label: "With client" }, { id: "approved", label: "Approved" }, { id: "lab", label: "Sent to lab" },
];

export default function AlbumStudioPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AlbumListRow[] | null>(null);
  const [ready, setReady] = useState<ReadySel[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | AlbumStatus>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    albumApi.list().then(setRows).catch(e => { setErr(e.message); setRows([]); });
    albumApi.ready().then(setReady).catch(() => setReady([]));
  }, []);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (rows ?? []).filter(r => (tab === "all" || r.status === tab) && (!k || r.title.toLowerCase().includes(k)));
  }, [rows, tab, q]);
  const count = (t: "all" | AlbumStatus) => (rows ?? []).filter(r => t === "all" || r.status === t).length;

  return (
    <div>
      <PageHeader icon={BookOpen} color="red" title="Album Studio" sub="Print-ready wedding albums from your clients' picks, laid out in a minute">
        <SearchField className="flex-1 min-w-0 sm:w-52 sm:flex-none" value={q} onChange={setQ} placeholder="Search albums" />
        <MainButton icon={Plus} onClick={() => router.push("/album-studio/new")}>New album</MainButton>
      </PageHeader>

      {ready.length > 0 && (
        <section className={cn("mb-5 rounded-[22px] bg-gradient-to-r from-white to-[#FFF7E8] p-4 flex flex-wrap items-center gap-3", CARD_SHADOW)}>
          <span className="w-10 h-10 rounded-xl bg-[#FFF0D6] text-[#A15C00] flex items-center justify-center flex-shrink-0"><Check className="w-5 h-5" /></span>
          <div className="flex-1 min-w-[220px]">
            <b className="text-[15px]">{ready.length === 1 ? "1 program is ready for an album" : `${ready.length} programs are ready for an album`}</b>
            <p className="text-[13px] text-[#5B5670]">The clients finished picking their photos. One click starts the album with their picks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ready.slice(0, 4).map(g => (
              <Link key={g.id} href={`/album-studio/new?gallery=${g.id}`} className="h-10 px-3.5 rounded-full border border-[#E7DCC8] bg-white text-[13px] font-semibold inline-flex items-center hover:bg-[#FFFBF3]">
                {g.program.name} · {g.picked} picks
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5", tab === t.id ? "bg-[#17151F] text-white" : "bg-white/70 text-[#4A4658] hover:bg-white")}>
            {t.label}<span className="opacity-60 tabular-nums">{count(t.id)}</span>
          </button>
        ))}
      </div>

      {err && <div role="alert" className="mb-4 rounded-[18px] bg-[#FDECEF] p-4 text-[14px] text-[#7A1F33]">{err}</div>}
      {rows === null ? <RowsSkeleton n={3} /> : shown.length === 0 ? (
        <EmptyState icon={BookOpen} title={rows.length ? "No albums here" : "No albums yet"}
          text="Start one from a photo selection the client has sent. The pages are laid out for you; then change anything you like."
          action={<MainButton icon={Plus} onClick={() => router.push("/album-studio/new")}>New album</MainButton>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(r => <AlbumCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function AlbumCard({ r }: { r: AlbumListRow }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const st = STATUS[r.status] ?? STATUS.draft;
  return (
    <Link href={`/album-studio/${r.id}`} className={cn("block rounded-[22px] bg-white/90 p-4 hover:-translate-y-0.5 transition-transform", CARD_SHADOW)}>
      <div ref={ref} className="rounded-md overflow-hidden shadow-[0_18px_30px_-18px_rgba(40,28,96,.55),0_2px_6px_rgba(22,18,40,.12)]" style={{ aspectRatio: String(ratioOf(r.size)) }}>
        {r.cover && w > 0 ? <SpreadView spread={r.cover} width={w} ratio={ratioOf(r.size)} photos={new Map((r.coverPhotos ?? []).map(p => [p.id, p]))} /> : <div className="w-full h-full bg-[#EDE7DE]" />}
      </div>
      <div className="flex items-start gap-2 mt-3.5">
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-bold truncate">{r.title}</h3>
          <p className="text-[13px] text-[#5B5670]">{sizeOf(r.size).label} · {r.pages} {r.pages === 1 ? "page" : "pages"} · {lookOf(r.look).name}</p>
        </div>
        <span className="h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center flex-shrink-0" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
      </div>
      <p className="mt-2.5 text-[13px] text-[#4A4658] flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#5B3FD0]" />Changed {fmtDate(r.updatedAt)}</p>
    </Link>
  );
}
