"use client";

/**
 * AI Face Search — every face gallery of the studio. Guests scan a QR, take a selfie and get the photos they are in.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, Coins, Images, Loader2, Plus, ScanFace, Search } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, Group, MainButton, PageHeader, RowsSkeleton, SearchField } from "@/components/ui/apple";
import { FormDrawer, inputCls } from "@/components/ui/form-kit";
import { FACE_STATUS, day, errText, facePhotoUrl, num, type Credits, type FaceGallery } from "@/lib/face";

type List = { ready: boolean; off?: string | null; credits: Credits; galleries: FaceGallery[] };

export default function FaceSearchPage() {
  const router = useRouter();
  const [data, setData] = useState<List | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/face-search`).catch(() => null);
    setData(r?.ok ? await r.json() : { ready: true, credits: { plan: 0, purchased: 0, total: 0, planResetAt: null }, galleries: [] });
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (data?.galleries ?? []).filter(g => !k || `${g.title} ${g.program?.client ?? ""} ${g.program?.number ?? ""}`.toLowerCase().includes(k));
  }, [data, q]);

  return (
    <div>
      <PageHeader icon={ScanFace} color="violet" title="AI Face Search" sub="Guests scan a QR, take a selfie and get the photos they are in">
        <SearchField className="flex-1 min-w-0 sm:w-52 sm:flex-none" value={q} onChange={setQ} placeholder="Search" />
        <Link href="/face-search/credits" className={cn("h-11 px-3.5 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 flex-shrink-0", CARD_SHADOW)}>
          <Coins className="w-4 h-4 text-[#9A5B00]" /><span className="tabular-nums">{data ? num(data.credits.total) : "…"}</span><span className="hidden sm:inline text-[#6B6680] font-medium">credits</span>
        </Link>
        <MainButton icon={Plus} onClick={() => setCreating(true)}>New</MainButton>
      </PageHeader>

      {data?.off && (
        <div role="status" className="mb-4 rounded-[18px] bg-[#FDECEF] p-4 text-[14px] text-[#7A1F33]">{data.off}</div>
      )}
      {data && !data.ready && (
        <div className="mb-5 rounded-[18px] bg-[#FFF3E0] p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#8A5200] flex-shrink-0" />
          <p className="flex-1 text-[14px] text-[#6B4100]"><b>Face search is being set up.</b> You can make a gallery now; photos are read once setup is finished.</p>
        </div>
      )}

      {data === null ? (
        <RowsSkeleton n={4} />
      ) : data.galleries.length === 0 ? (
        <EmptyState icon={ScanFace} title="No face galleries yet"
          text="Make one for a program, add its photos from Google Drive, and put the QR on the tables. Each guest gets only the photos they are in."
          action={<MainButton icon={Plus} onClick={() => setCreating(true)}>New face gallery</MainButton>} />
      ) : shown.length === 0 ? (
        <p className="text-center text-sm text-[#6B6680] py-12">Nothing here.</p>
      ) : (
        <Group>{shown.map(g => <Row key={g.id} g={g} />)}</Group>
      )}

      {creating && <NewGallery onClose={() => setCreating(false)} onCreated={id => router.push(`/face-search/${id}`)} />}
    </div>
  );
}

function Row({ g }: { g: FaceGallery }) {
  const st = FACE_STATUS[g.status];
  const c = g.counts;
  const photos = c.photos ? `${num(c.ready)}${c.ready !== c.photos ? ` / ${num(c.photos)}` : ""} photos` : "No photos yet";
  return (
    <Link href={`/face-search/${g.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[76px] hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[12px] overflow-hidden bg-[#F5F3FA] flex-shrink-0 flex items-center justify-center text-[#A29DB3]">
        {g.cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={facePhotoUrl(g.cover, 160)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          : c.waiting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate">{g.title}</p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">{[g.program?.client, g.program?.number, photos].filter(Boolean).join(" · ")}</p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5 md:hidden">{num(c.guests)} guests · {num(c.found)} found photos</p>
      </div>
      <div className="hidden md:flex flex-col items-end w-36 flex-shrink-0 text-[12.5px]">
        <span className="font-bold text-[#17151F] tabular-nums">{num(c.guests)} guests</span>
        <span className="text-[#6B6680] tabular-nums">{num(c.found)} found photos</span>
      </div>
      <span className={cn("hidden md:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", st.badge)}>{st.label}</span>
      <span className={cn("md:hidden w-2.5 h-2.5 rounded-full flex-shrink-0", st.dot)} title={st.label} />
      <ChevronRight className="w-4 h-4 text-[#C9C2DA] flex-shrink-0 hidden sm:block" />
    </Link>
  );
}

type Program = { id: string; bookingNumber: string; eventName: string | null; eventDate: string | null; status: string; client?: { firstName: string; lastName: string | null } | null };

function NewGallery({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const id = setTimeout(async () => {
      const p = new URLSearchParams({ limit: "20" });
      if (q.trim()) p.set("search", q.trim());
      const r = await apiFetch(`${API}/bookings?${p}`).catch(() => null);
      const d = r?.ok ? await r.json() : { data: [] };
      if (n === seq.current) setPrograms((d.data ?? []).filter((b: Program) => !["cancelled", "refunded"].includes(b.status)));
    }, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [q]);

  const client = (b: Program) => (b.client ? `${b.client.firstName} ${b.client.lastName ?? ""}`.trim() : "");

  async function save() {
    if (!program || saving) return;
    setSaving(true);
    const r = await apiFetch(`${API}/face-search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: program.id, ...(title.trim() ? { title: title.trim() } : {}) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setSaving(false);
    if (!r?.ok) return notify(errText(d, "Could not make the gallery. Please try again."), { error: true });
    onCreated(d.id);
  }

  return (
    <FormDrawer open onClose={onClose} icon={ScanFace} color="violet" title="New face gallery" sub="Pick the program the photos belong to"
      footer={<>
        <button type="button" onClick={onClose} className="h-12 px-5 rounded-full bg-[#F5F3FA] text-[15px] font-semibold text-[#17151F]">Cancel</button>
        <button type="button" onClick={save} disabled={!program || saving}
          className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{program ? "Make the gallery" : "Choose the program"}
        </button>
      </>}>
      <div className={cn("bg-white rounded-[20px] p-3.5 mb-4", CARD_SHADOW)}>
        <div className="relative mb-2">
          <Search className="w-4 h-4 text-[#A29DB3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search programs" aria-label="Search programs" className={cn(inputCls, "pl-10")} />
        </div>
        <div className="max-h-[46vh] overflow-y-auto -mx-1">
          {programs === null ? <p className="p-4 text-sm text-[#6B6680]">Loading…</p>
            : programs.length === 0 ? <p className="p-4 text-sm text-[#6B6680]">No program found.</p>
            : programs.map(b => {
              const on = program?.id === b.id;
              return (
                <button key={b.id} type="button" onClick={() => setProgram(b)} aria-pressed={on}
                  className={cn("w-full text-left px-3 py-2.5 rounded-[12px] flex items-center gap-3 min-h-[52px] transition-colors", on ? "bg-[#EEE8FD]" : "hover:bg-[#F5F3FA]")}>
                  <span className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0", on ? "border-[#7D5CEF] bg-[#7D5CEF] shadow-[inset_0_0_0_3px_#fff]" : "border-[#D6D2E0]")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-[#17151F] truncate">{b.eventName || client(b) || b.bookingNumber}</span>
                    <span className="block text-xs text-[#6B6680] truncate">{[client(b), b.bookingNumber, day(b.eventDate)].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              );
            })}
        </div>
      </div>
      <label className="block px-1 mb-1.5 text-[13px] font-bold text-[#4A4658]" htmlFor="fs-title">Name guests see (optional)</label>
      <input id="fs-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder={program?.eventName || "Akash and Nadia's Wedding"} className={cn(inputCls, "bg-white")} />
    </FormDrawer>
  );
}
