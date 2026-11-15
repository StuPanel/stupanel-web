"use client";

/**
 * Photo selection — every gallery where a client chooses photos for their album(s).
 * One row each (like Programs), so a long list stays short: a cover photo, the title, client and program,
 * how far the client is with the albums, the time left and where it stands. The ones that need the studio come first.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Archive, CalendarClock, CheckCircle2, ChevronRight, Clock3, Images, Loader2, Plus, Send, Sparkles } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EmptyState, Group, MainButton, PageHeader, RowsSkeleton, SearchField } from "@/components/ui/apple";
import { albumProgress, drivePhoto, STATUS_LABEL, timeLeft, type GalleryCard } from "@/lib/photos";
import { NewSelection } from "./_components/new-selection";

type Filter = "all" | "preparing" | "open" | "submitted" | "taken" | "closed";

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
    const c: Record<Filter, number> = { all: 0, preparing: 0, open: 0, submitted: 0, taken: 0, closed: 0 };
    for (const g of list ?? []) { if (g.status !== "closed") c.all++; if (g.status in c) c[g.status as Filter]++; }
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (list ?? []).filter(g =>
      (filter === "all" ? g.status !== "closed" : g.status === filter) &&
      (!k || `${g.title} ${g.client.name} ${g.program.name} ${g.program.number}`.toLowerCase().includes(k)))
      .sort((a, b) => rank(a) - rank(b) || soonest(a) - soonest(b) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [list, q, filter]);

  const chips: { id: Filter; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Images },
    { id: "preparing", label: "Getting ready", icon: Loader2 },
    { id: "open", label: "Choosing", icon: Clock3 },
    { id: "submitted", label: "Sent", icon: Send },
    { id: "taken", label: "Album started", icon: CheckCircle2 },
    ...(counts.closed ? [{ id: "closed" as Filter, label: "Closed", icon: Archive }] : []),
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
      </div>

      {list === null ? (
        <RowsSkeleton n={5} />
      ) : list.length === 0 ? (
        <EmptyState icon={Images} title="No photo selections yet"
          text="Make one for a program: add its photos from Drive or your computer, set how many go in each album, and send it to the client."
          action={<MainButton icon={Plus} onClick={() => setCreating(true)}>New photo selection</MainButton>} />
      ) : shown.length === 0 ? (
        <p className="text-center text-sm text-[#6B6680] py-12">Nothing here.</p>
      ) : (
        <Group>
          {shown.map(g => <Row key={g.id} g={g} />)}
        </Group>
      )}

      {creating && <NewSelection onClose={() => setCreating(false)} onCreated={id => router.push(`/photo-selection/${id}`)} />}
    </div>
  );
}

/** Needs the studio first: a change asked / made after sending → sent → choosing → getting ready → album started → closed. */
function rank(g: GalleryCard) {
  if (g.reopenRequestedAt || g.changedAfterSubmitAt) return 0;
  return ({ submitted: 1, open: 2, preparing: 3, taken: 4, closed: 5 } as Record<string, number>)[g.status] ?? 6;
}
/** Among the same kind: the closest deadline first (none = last). */
const soonest = (g: GalleryCard) => (g.deadline && (g.status === "open" || g.status === "submitted") ? new Date(g.deadline).getTime() : Number.MAX_SAFE_INTEGER);

const ROW_STATUS: Record<string, { badge: string; dot: string }> = {
  preparing: { badge: "bg-[#F1EFF6] text-[#4A4658]", dot: "bg-[#B5B0C4]" },
  open: { badge: "bg-[#EEE8FD] text-[#5B3FD0]", dot: "bg-[#7D5CEF]" },
  submitted: { badge: "bg-[#E2F4EA] text-[#1F8A5B]", dot: "bg-[#1F8A5B]" },
  taken: { badge: "bg-[#E6EEF8] text-[#1F5C99]", dot: "bg-[#1F5C99]" },
  closed: { badge: "bg-[#F5F3FA] text-[#A29DB3]", dot: "bg-[#D6D2E0]" },
};

/** One selection as a row: cover · title + client/program · albums progress · time left · status. */
function Row({ g }: { g: GalleryCard }) {
  const left = g.status === "open" || g.status === "submitted" ? timeLeft(g.deadline) : null;
  const attention = g.reopenRequestedAt ? "Wants to change" : g.changedAfterSubmitAt ? "Changed after sending" : null;
  const st = ROW_STATUS[g.status] ?? ROW_STATUS.preparing;
  const cover = g.covers[0];
  // Albums: one → "12 / 20–30" with its bar; more → how many are done, and the bar of all of them together.
  const one = g.albums.length === 1 ? albumProgress(g.albums[0], g.albums[0].picked) : null;
  const done = g.albums.filter(a => albumProgress(a, a.picked).okRange).length;
  const pct = one ? one.pct : g.albums.length ? Math.round(g.albums.reduce((n, a) => n + albumProgress(a, a.picked).pct, 0) / g.albums.length) : 0;
  const over = one ? one.over : g.albums.some(a => albumProgress(a, a.picked).over);
  const ok = one ? one.okRange : g.albums.length > 0 && done === g.albums.length;
  const photos = g.counts.total ? `${g.counts.ready}${g.counts.ready !== g.counts.total ? ` / ${g.counts.total}` : ""} photos` : g.counts.working ? "Getting photos ready…" : "No photos yet";
  return (
    <Link href={`/photo-selection/${g.id}`}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[76px] hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-[12px] overflow-hidden bg-[#F5F3FA] flex-shrink-0 flex items-center justify-center text-[#A29DB3]">
        {cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={drivePhoto(cover)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          : g.counts.working ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />}
        {attention && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#C2304F] ring-2 ring-white sm:hidden" aria-hidden />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] flex items-center gap-1.5 min-w-0">
          <span className="truncate">{g.title}</span>
          {attention && <span className="hidden sm:inline-flex h-5 px-2 rounded-full bg-[#C2304F] text-white text-[11px] font-bold items-center gap-1 flex-shrink-0"><Sparkles className="w-3 h-3" />{attention}</span>}
        </p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">{g.client.name} · {g.program.number} · {photos}</p>
        {/* Phone: the albums and time left on a third line */}
        <p className="text-xs mt-0.5 truncate md:hidden">
          {attention && <span className="font-semibold text-[#C2304F]">{attention} · </span>}
          {g.albums.length > 0 && <span className={cn("font-semibold tabular-nums", over ? "text-[#C2304F]" : ok ? "text-[#1F8A5B]" : "text-[#4A4658]")}>{one ? `${one.text} chosen` : `${done}/${g.albums.length} albums done`}</span>}
          {left && <span className={cn(left.over ? "text-[#C2304F]" : left.soon ? "text-[#9E3A8C]" : "text-[#6B6680]")}>{g.albums.length ? " · " : ""}{left.text}</span>}
        </p>
      </div>

      {/* Computer: albums progress */}
      {g.albums.length > 0 && (
        <div className="hidden md:block w-40 flex-shrink-0">
          <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
            <span className="text-[#6B6680] truncate">{one ? g.albums[0].name : `${g.albums.length} albums`}</span>
            <span className={cn("font-bold tabular-nums whitespace-nowrap", over ? "text-[#C2304F]" : ok ? "text-[#1F8A5B]" : "text-[#4A4658]")}>{one ? one.text : `${done}/${g.albums.length} done`}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F1EFF6] overflow-hidden">
            <div className={cn("h-full rounded-full", over ? "bg-[#C2304F]" : ok ? "bg-[#1F8A5B]" : "bg-[#7D5CEF]")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Computer: time left */}
      <div className="hidden lg:flex w-28 flex-shrink-0 justify-end">
        {left ? (
          <span className={cn("text-[12.5px] font-semibold inline-flex items-center gap-1 whitespace-nowrap", left.over ? "text-[#C2304F]" : left.soon ? "text-[#9E3A8C]" : "text-[#6B6680]")}>
            <CalendarClock className="w-3.5 h-3.5" />{left.text}
          </span>
        ) : <span className="text-[12px] text-[#B5B0C4]">—</span>}
      </div>

      <span className={cn("hidden md:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", st.badge)}>{STATUS_LABEL[g.status]}</span>
      <span className={cn("md:hidden w-2.5 h-2.5 rounded-full flex-shrink-0", st.dot)} title={STATUS_LABEL[g.status]} />
      <ChevronRight className="w-4 h-4 text-[#C9C2DA] flex-shrink-0 hidden sm:block" />
    </Link>
  );
}
