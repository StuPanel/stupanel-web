"use client";

/**
 * The client's album proof (no login; the link is the key). They turn the pages like a book, write a note on
 * any page and approve the album when it is right. Words are in Bangla for the client.
 */
import { use, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Expand, Loader2, MessageCircle, X } from "lucide-react";
import { proofApi, useWidth } from "@/lib/album/api";
import { ratioOf, type APhoto, type ProofView } from "@/lib/album/types";
import { SpreadView } from "@/components/album/spread-view";

const BN = (n: number) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[Number(d)]);

export default function AlbumProofPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ProofView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [big, setBig] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { proofApi.view(token).then(setData).catch(e => setErr(e.message)); }, [token]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

  const photos = useMemo(() => new Map((data?.photos ?? []).map(p => [p.id, p as unknown as APhoto])), [data]);
  const n = data?.spreads.length ?? 0;
  const s = data?.spreads[page];
  const ratio = data ? ratioOf(data.size) : 3;
  const mine = (data?.notes ?? []).filter(x => x.spread === s?.id);
  const approved = !!data?.approvedAt;
  const go = (d: 1 | -1) => { const j = page + d; if (j < 0 || j >= n) return; setDir(d); setPage(j); setWriting(false); };

  // Arrow keys on a computer.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest("textarea")) return; if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); if (e.key === "Escape") setBig(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  async function send() {
    if (!s || !text.trim()) return;
    setBusy(true);
    try {
      const r = await proofApi.note(token, s.id, text.trim());
      setData(d => (d ? { ...d, notes: [...d.notes, r] } : d));
      setText(""); setWriting(false); setToast("মন্তব্য স্টুডিওতে পাঠানো হয়েছে");
    } catch (e) { setToast((e as Error).message); } finally { setBusy(false); }
  }
  async function approve() {
    setBusy(true);
    try { const r = await proofApi.approve(token); setData(d => (d ? { ...d, approvedAt: r.approvedAt, status: "approved" } : d)); setAsking(false); setToast("ধন্যবাদ! অ্যালবাম প্রিন্টের জন্য রেডি"); }
    catch (e) { setToast((e as Error).message); } finally { setBusy(false); }
  }

  if (err) return <Shell><p className="m-auto max-w-[320px] text-center text-[15px] leading-relaxed text-[#E9DFD3] px-6">{err}</p></Shell>;
  if (!data || !s) return <Shell><Loader2 className="m-auto w-6 h-6 animate-spin text-[#E6C77A]" aria-label="Loading" /></Shell>;

  return (
    <Shell>
      <header className="pt-8 px-5 text-center">
        <p className="text-[12.5px] text-[#BFB3A8]">{data.studio.name || "আপনার স্টুডিও"} · আপনার অ্যালবাম</p>
        <h1 className="mt-1 text-[34px] leading-tight text-[#E6C77A]" style={{ fontFamily: "'Pinyon Script', cursive" }}>{data.title}</h1>
        <p className="text-[13px] text-[#BFB3A8] mt-1">{BN(n)}টি পাতা · {approved ? "অ্যাপ্রুভ করা হয়েছে ✓" : "প্রতিটা পাতা দেখে মন্তব্য দিন"}</p>
      </header>

      <main className="flex-1 flex flex-col justify-center gap-4 px-3 py-5 w-full max-w-[1100px] mx-auto">
        <Book key={page} spread={s} dir={dir} ratio={ratio} photos={photos} onSwipe={go} onOpen={() => setBig(true)} studio={data.studio} />
        <div className="flex items-center justify-center gap-3">
          <button aria-label="আগের পাতা" onClick={() => go(-1)} disabled={page === 0} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-[13px] text-[#BFB3A8] tabular-nums min-w-[110px] text-center">পাতা {BN(page + 1)} / {BN(n)}{s.chapter ? ` · ${s.chapter}` : ""}</span>
          <button aria-label="পরের পাতা" onClick={() => go(1)} disabled={page >= n - 1} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
          <button aria-label="বড় করে দেখুন" onClick={() => setBig(true)} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"><Expand className="w-[18px] h-[18px]" /></button>
        </div>

        {mine.map(m => (
          <div key={m.id} className="mx-1 rounded-2xl bg-white/[.07] border border-white/10 px-4 py-3">
            <p className="text-[12px] text-[#E6C77A] font-semibold flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" />আপনার মন্তব্য</p>
            <p className="text-[15px] leading-relaxed mt-1 whitespace-pre-wrap">{m.text}</p>
          </div>
        ))}
        {writing && (
          <div className="mx-1 rounded-2xl bg-white/[.07] border border-white/15 p-3 flex flex-col gap-2">
            <label htmlFor="note" className="text-[13px] text-[#E6C77A] font-semibold">এই পাতায় কী বদলাবেন?</label>
            <textarea id="note" autoFocus rows={3} maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder="যেমন: বাঁ দিকের ছবিটা বড় করুন"
              className="w-full rounded-xl bg-black/30 border border-white/15 p-3 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-[#E6C77A]" />
            <div className="flex gap-2">
              <button onClick={() => setWriting(false)} className="h-11 px-4 rounded-full bg-white/10 text-[15px]">বাতিল</button>
              <button onClick={send} disabled={busy || !text.trim()} className="flex-1 h-11 rounded-full bg-[#E6C77A] text-[#2A1A00] text-[15px] font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}পাঠান</button>
            </div>
          </div>
        )}
      </main>

      <footer className="px-4 pb-8 pt-2 flex flex-col gap-2.5 w-full max-w-[520px] mx-auto">
        {approved ? (
          <p className="h-[52px] rounded-full bg-[#1F8A5B]/20 border border-[#1F8A5B]/50 text-[#BFF0D6] text-[15px] font-semibold flex items-center justify-center gap-2"><Check className="w-5 h-5" />আপনি অ্যালবামটি অ্যাপ্রুভ করেছেন</p>
        ) : (
          <div className="flex gap-2.5">
            <button onClick={() => setWriting(true)} disabled={writing} className="flex-1 h-[52px] rounded-full border border-white/20 bg-white/[.06] text-[15px] font-semibold disabled:opacity-50">এই পাতায় মন্তব্য</button>
            <button onClick={() => setAsking(true)} className="flex-1 h-[52px] rounded-full bg-[#E6C77A] text-[#2A1A00] text-[15px] font-bold">সব ঠিক আছে ✓</button>
          </div>
        )}
        <p className="text-center text-[12px] text-[#8F857C]">{approved ? "কিছু বদলাতে চাইলে স্টুডিওকে ফোন করুন" + (data.studio.phone ? ` · ${data.studio.phone}` : "") : "সব পাতা দেখা হলে “সব ঠিক আছে” চাপুন — তারপর প্রিন্টে যাবে"}</p>
      </footer>

      {asking && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal aria-label="অ্যাপ্রুভ করুন">
          <div className="w-full max-w-[420px] rounded-[24px] bg-[#221D20] border border-white/10 p-6 flex flex-col gap-4">
            <h2 className="text-[20px] font-bold">অ্যালবাম ফাইনাল করবেন?</h2>
            <p className="text-[15px] text-[#D8CEC4] leading-relaxed">সব {BN(n)}টি পাতা ঠিক থাকলে চাপুন। এরপর স্টুডিও অ্যালবামটি প্রিন্টে পাঠাবে, আর এখান থেকে বদলানো যাবে না।</p>
            <div className="flex gap-2">
              <button onClick={() => setAsking(false)} className="h-12 px-5 rounded-full bg-white/10 text-[15px]">আরেকবার দেখি</button>
              <button onClick={approve} disabled={busy} className="flex-1 h-12 rounded-full bg-[#E6C77A] text-[#2A1A00] text-[15px] font-bold inline-flex items-center justify-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}হ্যাঁ, ফাইনাল</button>
            </div>
          </div>
        </div>
      )}
      {big && <Big spread={s} ratio={ratio} photos={photos} onClose={() => setBig(false)} onSwipe={go} label={`পাতা ${BN(page + 1)} / ${BN(n)}`} studio={data.studio} />}
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-full bg-white text-[#17151F] px-4 py-2.5 text-[14px] font-semibold shadow-lg">{toast}</div>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col text-[#F4EEE6]" style={{ fontFamily: "'Hind Siliguri','Plus Jakarta Sans',system-ui,sans-serif", background: "radial-gradient(80% 50% at 50% 0%,#3A1318,transparent 70%),#151215" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" />
      {children}
    </div>
  );
}

/** One page with a short turn when it changes; swipe sideways to turn. */
function Book({ spread, dir, ratio, photos, onSwipe, onOpen, studio }: { spread: ProofView["spreads"][number]; dir: 1 | -1; ratio: number; photos: Map<string, APhoto>; onSwipe: (d: 1 | -1) => void; onOpen: () => void; studio: ProofView["studio"] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const start = useRef<number | null>(null);
  return (
    <div ref={ref} className="w-full touch-pan-y" onPointerDown={e => { start.current = e.clientX; }}
      onPointerUp={e => { const s = start.current; start.current = null; if (s === null) return; const dx = e.clientX - s; if (Math.abs(dx) > 40) onSwipe(dx < 0 ? 1 : -1); else onOpen(); }}>
      {w > 0 && (
        <div className="album-turn shadow-[0_24px_40px_-18px_rgba(0,0,0,.85)]" style={{ ["--from" as string]: dir > 0 ? "8deg" : "-8deg" }}>
          <SpreadView spread={spread} width={w} ratio={ratio} photos={photos} studio={studio} />
        </div>
      )}
      <style>{`.album-turn{animation:albumTurn .45s cubic-bezier(.2,.8,.2,1) both;transform-origin:50% 50%}@keyframes albumTurn{from{opacity:0;transform:perspective(1200px) rotateY(var(--from)) translateX(calc(var(--from) * 2))}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.album-turn{animation:none}}`}</style>
    </div>
  );
}

/** Full screen. On a phone held upright the page turns sideways to fill the screen. */
function Big({ spread, ratio, photos, onClose, onSwipe, label, studio }: { spread: ProofView["spreads"][number]; ratio: number; photos: Map<string, APhoto>; onClose: () => void; onSwipe: (d: 1 | -1) => void; label: string; studio: ProofView["studio"] }) {
  const [vw, setVw] = useState(0), [vh, setVh] = useState(0);
  useEffect(() => { const f = () => { setVw(window.innerWidth); setVh(window.innerHeight); }; f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const upright = vh > vw;
  const long = upright ? vh - 24 : vw - 24, short = upright ? vw - 24 : vh - 90;
  const width = Math.min(long, short * ratio);
  const start = useRef<number | null>(null);
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" role="dialog" aria-modal aria-label="বড় করে দেখা"
      onPointerDown={e => { start.current = upright ? e.clientY : e.clientX; }}
      onPointerUp={e => { const s = start.current; start.current = null; if (s === null) return; const d = (upright ? e.clientY : e.clientX) - s; if (Math.abs(d) > 40) onSwipe(d < 0 ? 1 : -1); }}>
      <div style={{ transform: upright ? "rotate(90deg)" : undefined }}>
        <SpreadView spread={spread} width={width} ratio={ratio} photos={photos} studio={studio} />
      </div>
      <span className="absolute left-4 top-4 text-[13px] text-white/70">{label}</span>
      <button aria-label="বন্ধ করুন" onClick={onClose} onPointerDown={e => e.stopPropagation()} className="absolute right-3 top-3 w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
    </div>
  );
}
