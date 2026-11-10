"use client";

/**
 * Photo selection — every gallery where a client chooses photos for their album(s).
 * Cards show the photos, where the client is (getting ready → choosing → sent → album started),
 * each album's progress against its limit, and the time left.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Images, Loader2, Plus, Send, Sparkles, Stamp } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, EmptyState, MainButton, PageHeader, SearchField } from "@/components/ui/apple";
import { albumProgress, apiUrl, STATUS_LABEL, STATUS_STYLE, timeLeft, type GalleryCard } from "@/lib/photos";
import { NewSelection } from "./_components/new-selection";

type Filter = "all" | "preparing" | "open" | "submitted" | "taken";

export default function PhotoSelectionPage() {
  const router = useRouter();
  const [list, setList] = useState<GalleryCard[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/photo-selection`).catch(() => null);
    setList(r?.ok ? await r.json() : []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => d && setEnabled(d.features?.photoSelection !== false)).catch(() => {});
  }, []);
  // Old links (?open=<id>) from emails / notifications
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("open"); if (id) router.replace(`/photo-selection/${id}`); }, [router]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, preparing: 0, open: 0, submitted: 0, taken: 0 };
    for (const g of list ?? []) { if (g.status === "closed") continue; c.all++; if (g.status in c) c[g.status as Filter]++; }
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (list ?? []).filter(g =>
      (filter === "all" ? g.status !== "closed" : g.status === filter) &&
      (!k || `${g.title} ${g.client.name} ${g.program.name} ${g.program.number}`.toLowerCase().includes(k)));
  }, [list, q, filter]);

  const chips: { id: Filter; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Images },
    { id: "preparing", label: "Getting ready", icon: Loader2 },
    { id: "open", label: "Choosing", icon: Clock3 },
    { id: "submitted", label: "Sent", icon: Send },
    { id: "taken", label: "Album started", icon: CheckCircle2 },
  ];

  return (
    <div>
      <PageHeader icon={Images} color="red" title="Photo selection"
        sub="Clients pick the photos for their albums in their portal">
        <SearchField className="flex-1 min-w-0 sm:w-56 sm:flex-none" value={q} onChange={setQ} placeholder="Search" />
        <MainButton icon={Plus} onClick={() => setCreating(true)}>New</MainButton>
      </PageHeader>

      {enabled === false && (
        <div className="mb-5 rounded-[18px] bg-[#FDECEF] p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#C2304F] flex-shrink-0" />
          <p className="flex-1 text-[14px] text-[#6E1C2D]"><b>Photo selection is turned off,</b> so clients can&apos;t see it in their portal.</p>
          <Link href="/settings?pane=features" className="h-10 px-4 rounded-full bg-[#C2304F] text-white text-[13px] font-semibold inline-flex items-center flex-shrink-0">Turn on</Link>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-4 [scrollbar-width:none]" role="tablist" aria-label="Filter">
        {chips.map(c => (
          <button key={c.id} type="button" role="tab" aria-selected={filter === c.id} onClick={() => setFilter(c.id)}
            className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors",
              filter === c.id ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]")}>
            {c.label}
            {counts[c.id] > 0 && <span className={cn("h-5 min-w-5 px-1.5 rounded-full text-[12px] font-bold inline-flex items-center justify-center", filter === c.id ? "bg-white/20" : "bg-[#F5F3FA] text-[#6B6680]")}>{counts[c.id]}</span>}
          </button>
        ))}
        <Link href="/settings?pane=watermark" className="ml-auto h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 bg-white text-[#4A4658] hover:bg-[#F5F3FA]">
          <Stamp className="w-3.5 h-3.5 text-[#C2304F]" />Watermark
        </Link>
      </div>

      {list === null ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className={cn("bg-white rounded-[22px] p-3", CARD_SHADOW)}><div className="sp-skel aspect-[16/9] rounded-[16px]" /><div className="sp-skel h-4 w-2/3 rounded-full mt-4" /><div className="sp-skel h-3 w-1/2 rounded-full mt-2" /></div>)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Images} title="No photo selections yet"
          text="Make one for a program: add its photos from Drive or your computer, set how many go in each album, and send it to the client."
          action={<MainButton icon={Plus} onClick={() => setCreating(true)}>New photo selection</MainButton>} />
      ) : shown.length === 0 ? (
        <p className="text-center text-sm text-[#6B6680] py-12">Nothing here.</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((g, i) => <Card key={g.id} g={g} i={i} />)}
        </div>
      )}

      {creating && <NewSelection onClose={() => setCreating(false)} onCreated={id => router.push(`/photo-selection/${id}`)} />}
    </div>
  );
}

function Card({ g, i }: { g: GalleryCard; i: number }) {
  const left = g.status === "open" || g.status === "submitted" ? timeLeft(g.deadline) : null;
  const covers = g.covers.slice(0, 4);
  const attention = g.reopenRequestedAt ? "Wants to change" : g.changedAfterSubmitAt ? "Changed after sending" : null;
  return (
    <Link href={`/photo-selection/${g.id}`}
      className={cn("group bg-white rounded-[22px] p-2.5 block transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(22,18,40,.35)] sp-pop-in", CARD_SHADOW)}
      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <div className="relative aspect-[16/9] rounded-[16px] overflow-hidden bg-[#F5F3FA]">
        {covers.length ? (
          <div className={cn("absolute inset-0 grid gap-0.5", covers.length >= 3 ? "grid-cols-[2fr_1fr] grid-rows-2" : covers.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
            {covers.slice(0, 3).map((c, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={apiUrl(c)} alt="" loading="lazy"
                className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]", covers.length >= 3 && k === 0 && "row-span-2")} />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#A29DB3] gap-1">
            <Images className="w-7 h-7" />
            <span className="text-[12px] font-semibold">{g.counts.working ? "Making previews…" : "No photos yet"}</span>
          </div>
        )}
        <span className={cn("absolute left-2 top-2 h-7 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1 backdrop-blur", STATUS_STYLE[g.status])}>
          {STATUS_LABEL[g.status]}
        </span>
        {attention && <span className="absolute right-2 top-2 h-7 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1 bg-[#C2304F] text-white"><Sparkles className="w-3.5 h-3.5" />{attention}</span>}
        {g.counts.total > 0 && <span className="absolute right-2 bottom-2 h-7 px-2.5 rounded-full bg-black/55 text-white text-[12px] font-semibold inline-flex items-center backdrop-blur">{g.counts.ready}{g.counts.ready !== g.counts.total ? ` / ${g.counts.total}` : ""} photos</span>}
      </div>
      <div className="px-1.5 pt-3 pb-1.5">
        <p className="text-[15px] font-bold text-[#17151F] truncate">{g.title}</p>
        <p className="text-[13px] text-[#6B6680] truncate">{g.client.name} · {g.program.number}</p>
        {g.albums.length > 0 && (
          <div className="mt-3 space-y-2">
            {g.albums.slice(0, 3).map(a => {
              const p = albumProgress(a, a.picked);
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="font-semibold text-[#4A4658] truncate">{a.name}</span>
                    <span className={cn("font-bold tabular-nums", p.over ? "text-[#C2304F]" : p.okRange ? "text-[#1F8A5B]" : "text-[#6B6680]")}>{p.text}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F5F3FA] overflow-hidden">
                    <div className={cn("h-full rounded-full transition-[width] duration-700", p.over ? "bg-[#C2304F]" : p.okRange ? "bg-[#1F8A5B]" : "bg-[#7D5CEF]")} style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              );
            })}
            {g.albums.length > 3 && <p className="text-[12px] text-[#6B6680]">+{g.albums.length - 3} more albums</p>}
          </div>
        )}
        {left && (
          <p className={cn("mt-3 text-[12.5px] font-semibold inline-flex items-center gap-1", left.over ? "text-[#C2304F]" : left.soon ? "text-[#9E3A8C]" : "text-[#6B6680]")}>
            <CalendarClock className="w-3.5 h-3.5" />{left.text}
          </p>
        )}
      </div>
    </Link>
  );
}
