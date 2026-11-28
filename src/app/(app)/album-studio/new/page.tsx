"use client";

/**
 * New album in three steps: the client's picks → size and page design → names. The album is laid out
 * in the browser while the studio chooses, and the preview on the right shows the real pages.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { albumApi, useWidth, type ReadySel } from "@/lib/album/api";
import { autoLayout, suggestedSpreads } from "@/lib/album/layout";
import { LOOKS } from "@/lib/album/looks";
import { isPickedMark, ratioOf, SIZES, type AlbumSize, type LookId, type Names, type Source } from "@/lib/album/types";
import { SpreadView } from "@/components/album/spread-view";
import { fmtDate } from "@/lib/format";

const STEPS = ["Photos", "Size & design", "Names"] as const;

export default function NewAlbumPage() {
  return <Suspense fallback={null}><NewAlbum /></Suspense>;
}

function NewAlbum() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState<ReadySel[] | null>(null);
  const [gallery, setGallery] = useState<string | null>(params.get("gallery"));
  const [src, setSrc] = useState<Source | null>(null);
  const [loading, setLoading] = useState(!!params.get("gallery"));
  const [size, setSize] = useState<AlbumSize>("12x36");
  const [look, setLook] = useState<LookId>("mono");
  const [pages, setPages] = useState<number | null>(null);
  const [names, setNames] = useState<Names>({});
  const [title, setTitle] = useState("");
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { albumApi.ready().then(setReady).catch(() => setReady([])); }, []);
  useEffect(() => {
    if (!gallery) return;
    let live = true;
    albumApi.source(gallery).then(s => {
      if (!live) return;
      setSrc(s);
      setTitle(t => t || s.program.name);
      setNames(n => (n.bride || n.groom ? n : { ...n, bride: s.client.firstName }));
      if (s.program.date) setNames(n => ({ ...n, date: n.date ?? fmtDate(s.program.date) }));
    }).catch(e => notify(e.message, { error: true })).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [gallery]);

  const picks = useMemo(() => {
    const all = src?.photos ?? [];
    const p = all.filter(x => isPickedMark(x.m));
    return p.length ? p : all;
  }, [src]);
  const chapters = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of picks) m.set(p.f ?? "Photos", (m.get(p.f ?? "Photos") ?? 0) + 1);
    return [...m.entries()];
  }, [picks]);
  const target = pages ?? suggestedSpreads(picks.length);
  const ratio = ratioOf(size);
  const spreads = useMemo(() => (picks.length ? autoLayout(picks, { look, spreads: target, names, ar: ratio }) : []), [picks, look, target, names, ratio]);
  const byId = useMemo(() => new Map((src?.photos ?? []).map(p => [p.id, p])), [src]);
  const shownPage = Math.min(page, Math.max(0, spreads.length - 1));

  async function create() {
    if (!gallery || !spreads.length) return;
    setSaving(true);
    try {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(names)) if (v?.trim()) clean[k] = v.trim();
      const r = await albumApi.create({ galleryId: gallery, title: title.trim() || undefined, size, look, names: clean, spreads });
      router.push(`/album-studio/${r.id}`);
    } catch (e) { notify((e as Error).message, { error: true }); setSaving(false); }
  }

  const canNext = step === 0 ? !!src && picks.length > 0 : true;

  return (
    <div className="-mx-4 sm:mx-0">
      <header className="flex flex-wrap items-center gap-3 sm:gap-6 mb-5 px-4 sm:px-0">
        <Link href="/album-studio" className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#33303F]"><ChevronLeft className="w-4 h-4" />Albums</Link>
        <h1 className="text-[18px] font-bold">New album{src ? ` · ${src.program.name}` : ""}</h1>
        <ol className="ml-auto flex items-center gap-2 sm:gap-4" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2 text-[13px] sm:text-[14px] font-semibold", i === step ? "text-[#17151F]" : "text-[#6B6680]")}>
              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-extrabold", i < step ? "bg-[#1F8A5B] text-white" : i === step ? "bg-[#17151F] text-white" : "bg-[#EEEDF2]")}>{i < step ? "✓" : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,460px)_1fr] gap-5">
        <section className="rounded-[24px] bg-white/90 p-5 sm:p-6 flex flex-col gap-5 shadow-[0_0_0_1px_rgba(40,28,96,.06),0_14px_34px_-16px_rgba(40,28,96,.26)]">
          {step === 0 && (
            <>
              <div>
                <p className="text-[13px] font-bold text-[#33303F] mb-2">Photos from the client’s selection</p>
                {ready === null ? <p className="text-[14px] text-[#6B6680]">Loading…</p> : (
                  <div className="flex flex-col gap-2">
                    {ready.map(g => (
                      <button key={g.id} onClick={() => { if (g.id !== gallery) { setGallery(g.id); setSrc(null); setLoading(true); } }} className={cn("text-left rounded-2xl border p-3 flex items-center gap-3", gallery === g.id ? "border-[#7D5CEF] bg-[#F7F4FF]" : "border-[#ECE8F2] hover:bg-[#FAF9FC]")}>
                        <span className="flex-1 min-w-0"><b className="block text-[14px] truncate">{g.program.name}</b><span className="text-[12.5px] text-[#6B6680]">{g.client} · {g.picked} picks{g.submittedAt ? ` · sent ${fmtDate(g.submittedAt)}` : ""}</span></span>
                        <span className={cn("w-5 h-5 rounded-full border-2", gallery === g.id ? "border-[#7D5CEF] bg-[#7D5CEF] shadow-[inset_0_0_0_3px_#fff]" : "border-[#CFC8DD]")} />
                      </button>
                    ))}
                    {gallery && !ready.some(g => g.id === gallery) && src && (
                      <div className="rounded-2xl border border-[#7D5CEF] bg-[#F7F4FF] p-3 text-[14px]"><b>{src.program.name}</b> · {src.gallery.title}</div>
                    )}
                    {!ready.length && !gallery && <p className="text-[14px] text-[#5B5670]">No client has sent their picks yet. Open <Link href="/photo-selection" className="font-semibold">Photo Selection</Link> to send photos to a client first.</p>}
                  </div>
                )}
              </div>
              {loading && <p className="text-[14px] text-[#6B6680] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Reading the photos…</p>}
              {src && (
                <div className="rounded-2xl bg-[#F4FBF7] border border-[#D7EEE1] p-3.5">
                  <b className="text-[14px]">{picks.length} photos</b>
                  <span className="text-[13px] text-[#4A6A58]"> · {picks.some(p => isPickedMark(p.m)) ? "the client's picks" : "all photos (nothing picked yet)"}</span>
                  <p className="text-[12.5px] font-bold text-[#33303F] mt-3 mb-1.5">Chapters, from the selection’s folders</p>
                  <ul className="flex flex-col gap-1.5">
                    {chapters.map(([n, c]) => <li key={n} className="h-10 px-3 rounded-xl bg-white flex items-center gap-2 text-[14px]"><b>{n}</b><span className="text-[#6B6680]">{c} photos</span></li>)}
                  </ul>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className="text-[13px] font-bold text-[#33303F] mb-2">Album size</p>
                <div className="flex gap-1.5 p-1 rounded-[14px] bg-[#F2EFF8]">
                  {SIZES.map(s => (
                    <button key={s.id} onClick={() => setSize(s.id)} className={cn("flex-1 h-10 rounded-[10px] text-[14px] font-semibold", size === s.id ? "bg-white text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.12),0_4px_12px_-6px_rgba(40,28,96,.3)]" : "text-[#4A4658]")}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] font-bold text-[#33303F] flex justify-between mb-2" htmlFor="pages"><span>Pages (spreads)</span><span className="tabular-nums">{target}</span></label>
                <input id="pages" type="range" min={4} max={60} value={target} onChange={e => setPages(Number(e.target.value))} className="w-full accent-[#7D5CEF]" />
                <p className="text-[12.5px] text-[#6B6680] mt-1">About {Math.round(picks.length / Math.max(1, target))} photos a page. Photos that don’t fit stay ready in the editor.</p>
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#33303F] mb-2">Page design <span className="font-medium text-[#6B6680]">· with your photos</span></p>
                <div className="grid grid-cols-2 gap-3">
                  {LOOKS.map(l => <LookPick key={l.id} id={l.id} name={l.name} on={look === l.id} onClick={() => setLook(l.id)} picks={picks} names={names} ratio={ratio} byId={byId} />)}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Album name (for you)" value={title} onChange={setTitle} placeholder="Akash & Bappy · Wedding" />
              <Field label="Bride's name (on the pages)" value={names.bride ?? ""} onChange={v => setNames(n => ({ ...n, bride: v }))} placeholder="Bappy" />
              <Field label="Groom's name" value={names.groom ?? ""} onChange={v => setNames(n => ({ ...n, groom: v }))} placeholder="Akash" />
              <Field label="Date" value={names.date ?? ""} onChange={v => setNames(n => ({ ...n, date: v }))} placeholder="2 Oct 2026" />
              <p className="text-[12.5px] text-[#6B6680]">Titles and quotes are written for you. Change any of them in the editor.</p>
            </>
          )}

          <div className="mt-auto flex gap-2.5 pt-2">
            {step > 0 && <button onClick={() => setStep(step - 1)} className="h-12 px-5 rounded-full bg-[#F2EFF8] text-[15px] font-semibold">Back</button>}
            {step < 2 ? (
              <button disabled={!canNext} onClick={() => setStep(step + 1)} className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-bold disabled:bg-[#EEE8FD] disabled:text-[#9C8FD0]">Next: {STEPS[step + 1].toLowerCase()}</button>
            ) : (
              <button disabled={saving || !spreads.length} onClick={create} className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}Make the album
              </button>
            )}
          </div>
        </section>

        <Preview spreads={spreads} page={shownPage} setPage={setPage} ratio={ratio} byId={byId} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-bold text-[#33303F] mb-1.5">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={60}
        className="w-full h-12 px-4 rounded-2xl border border-[#E4E0EC] bg-white text-[16px] outline-none focus:border-[#7D5CEF] focus:ring-2 focus:ring-[#7D5CEF]/20" />
    </label>
  );
}

function LookPick({ id, name, on, onClick, picks, names, ratio, byId }: { id: LookId; name: string; on: boolean; onClick: () => void; picks: Source["photos"]; names: Names; ratio: number; byId: Map<string, Source["photos"][number]> }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const sample = useMemo(() => (picks.length ? autoLayout(picks.slice(0, 8), { look: id, spreads: 1, names, ar: ratio })[0] : null), [picks, id, names, ratio]);
  return (
    <button onClick={onClick} className="text-left" aria-pressed={on}>
      <div ref={ref} className={cn("rounded-lg overflow-hidden", on ? "ring-2 ring-offset-2 ring-[#7D5CEF]" : "ring-1 ring-black/5")} style={{ aspectRatio: String(ratio) }}>
        {sample && w > 0 && <SpreadView spread={sample} width={w} ratio={ratio} photos={byId} fold={false} />}
      </div>
      <span className="block text-[13px] font-semibold mt-1.5">{name}</span>
    </button>
  );
}

function Preview({ spreads, page, setPage, ratio, byId }: { spreads: ReturnType<typeof autoLayout>; page: number; setPage: (n: number) => void; ratio: number; byId: Map<string, Source["photos"][number]> }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const s = spreads[page];
  return (
    <section className="rounded-[24px] bg-[#EDE7DE] p-4 sm:p-8 flex flex-col items-center justify-center gap-5 min-h-[320px]">
      <p className="text-[12px] font-bold text-[#6B6680] tracking-wide">{spreads.length ? `Live preview · page ${page + 1} of ${spreads.length}` : "Choose a photo selection to see the album"}</p>
      <div ref={ref} className="w-full max-w-[860px]">
        {s && w > 0 && <div className="shadow-[0_30px_50px_-24px_rgba(60,30,10,.55),0_4px_10px_rgba(60,30,10,.18)]"><SpreadView spread={s} width={w} ratio={ratio} photos={byId} /></div>}
      </div>
      {spreads.length > 1 && (
        <div className="flex items-center gap-3">
          <button aria-label="Previous page" onClick={() => setPage(Math.max(0, page - 1))} className="w-10 h-10 rounded-full bg-white flex items-center justify-center disabled:opacity-40" disabled={page === 0}><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-[13px] font-semibold tabular-nums w-16 text-center">{page + 1} / {spreads.length}</span>
          <button aria-label="Next page" onClick={() => setPage(Math.min(spreads.length - 1, page + 1))} className="w-10 h-10 rounded-full bg-white flex items-center justify-center disabled:opacity-40" disabled={page >= spreads.length - 1}><ChevronRight className="w-5 h-5" /></button>
        </div>
      )}
      <p className="text-[13px] text-[#5B5670] text-center max-w-[520px]">Your client’s photos in the design you pick. Frames stay off the fold, and photos are placed tall to tall, wide to wide.</p>
    </section>
  );
}
