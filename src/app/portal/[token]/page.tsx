"use client";

/**
 * The client portal. Organised by program so a client with many programs is never lost:
 *  • Home — what you need to do (sign, choose photos/songs, pay to get files) and what's coming up
 *  • Programs — coming up / done; tap one for everything about it in order
 *    (days → payment → agreement → album photos → music → files)
 *  • Money — paid and due, per program, with invoices, receipts and quotes
 *  • Chat — messages with the studio
 * The view lives in the address (?v=…, ?p=<program>) so the phone's back button works.
 */
import { Suspense, use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, MessageCircle, Phone, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { CARD_SHADOW } from "@/components/ui/apple";
import { PublicLoading, PublicMessage, PublicShell } from "@/components/public/public-shell";
import type { ClientGalleryCard } from "@/lib/photos";
import type { ClientMusic } from "@/lib/music";
import { portalHeaders, clearPortalSession, waLink } from "@/lib/portal-session";
import { setStudioCountry } from "@/lib/phone";
import { PortalChat } from "./_components/portal-chat";
import { PortalLock, type PortalMeta } from "./_components/portal-lock";
import { studioOf, todosFor, todosOf, type PortalData, type Todo } from "./_components/portal-data";
import { HomeView, MoneyView, PortalNav, ProgramsView, type View } from "./_components/portal-home";
import { ProgramPage } from "./_components/portal-program";

const VIEWS: View[] = ["home", "programs", "money", "chat"];
const TITLE: Record<View, string> = { home: "", programs: "Your programs", money: "Money", chat: "Messages" };

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <Suspense fallback={<PublicLoading />}><Portal token={token} /></Suspense>;
}

function Portal({ token }: { token: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gate, setGate] = useState<null | { kind: "locked" | "retired"; meta: PortalMeta | null }>(null);
  const [music, setMusic] = useState<ClientMusic[]>([]);
  const [photos, setPhotos] = useState<ClientGalleryCard[]>([]);

  const loadExtras = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        fetch(`${API}/public/portal/${token}/music`, { headers: portalHeaders(token) }),
        fetch(`${API}/public/portal/${token}/photos`, { headers: portalHeaders(token) }),
      ]);
      if (r.ok) setMusic(await r.json());
      if (p.ok) setPhotos(await p.json());
    } catch { /* music and photos are extras — the portal works without them */ }
  }, [token]);
  // Photos and music load after the portal; the state is only set once the fetch resolves.
  useEffect(() => { if (data) loadExtras(); }, [!!data]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  async function loadPortal() {
    try {
      const r = await fetch(`${API}/public/portal/${token}`, { headers: portalHeaders(token) });
      if (r.status === 401 || r.status === 410) {
        if (r.status === 401) clearPortalSession(token);
        const meta = await fetch(`${API}/public/portal/${token}/meta`).then(m => (m.ok ? m.json() : null)).catch(() => null);
        setStudioCountry(meta?.studio?.country);
        setGate({ kind: r.status === 410 ? "retired" : "locked", meta });
        return;
      }
      if (!r.ok) throw new Error();
      const d = await r.json();
      setStudioCountry(d?.company?.country);
      setData(d);
      setGate(null);
    } catch {
      setError("This portal link is invalid or has been turned off.");
    } finally {
      setLoading(false);
    }
  }

  // Load once per link; loadPortal only sets state after the fetch resolves.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { loadPortal(); }, [token]);

  // ── Where we are ──
  const pid = search.get("p");
  const openPart = search.get("open") ?? undefined;
  const v = search.get("v") as View | null;
  const view: View | null = pid ? null : v && VIEWS.includes(v) ? v : "home";

  const go = useCallback((qs: string) => {
    router.push(qs ? `?${qs}` : "?", { scroll: false });
    window.scrollTo({ top: 0 });
  }, [router]);
  const goView = (to: View) => go(to === "home" ? "" : `v=${to}`);
  const openProgram = (id: string, part?: string) => go(`p=${id}${part ? `&open=${encodeURIComponent(part)}` : ""}`);
  function onTodo(t: Todo) {
    if (t.href) { window.location.href = t.href; return; }
    if (t.bookingId) openProgram(t.bookingId, t.part === "photos" && t.galleryId ? `photos:${t.galleryId}` : t.part);
  }

  // "Pay" from the to-do list / Money opens the program at its payment card.
  useEffect(() => {
    if (!pid || openPart !== "money") return;
    const id = setTimeout(() => document.getElementById("part-money")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(id);
  }, [pid, openPart, !!data]); // eslint-disable-line react-hooks/exhaustive-deps

  const todos = useMemo(() => (data ? todosOf(data, photos, music) : []), [data, photos, music]);

  if (loading) return <PublicLoading />;
  if (gate) return <PortalLock token={token} kind={gate.kind} meta={gate.meta} onUnlocked={() => { setLoading(true); setGate(null); loadPortal(); }} />;
  if (error || !data) return <PublicMessage icon={XCircle} tone="red" title="This link isn't working" text={error || "Please ask your studio for a new link."} />;

  const brand = BRAND;
  const studio = studioOf(data);
  const chat = data.company.portalShowMessages !== false;
  const wa = data.company.phone ? waLink(data.company.phone, `Hi ${data.company.name}, `) : null;
  const program = pid ? data.bookings.find(b => b.id === pid) : undefined;
  const afterChange = () => { loadExtras(); if (openPart && pid) router.replace(`?p=${pid}`, { scroll: false }); };

  return (
    <PublicShell studio={data.company} sub="Client portal" className="pb-28 sm:pb-8"
      right={
        <>
          {data.company.phone && (
            <a href={`tel:${data.company.phone}`} aria-label={`Call ${data.company.name}`} title="Call"
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#17151F] flex items-center justify-center shadow-[0_1px_2px_rgba(22,18,40,.08)]"><Phone className="w-4 h-4" /></a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${data.company.name}`}
              className="h-10 px-3.5 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /><span className="hidden sm:inline">WhatsApp</span></a>
          )}
        </>
      }>
      {view === "home" && (
        <section className="mb-5">
          <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">Hi {data.client.firstName}!</h1>
          <p className="mt-1 text-[13.5px] text-[#6B6680] flex flex-wrap gap-x-3 gap-y-0.5">
            {data.client.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{data.client.phone}</span>}
            {data.client.email && <span className="inline-flex items-center gap-1 min-w-0"><Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{data.client.email}</span></span>}
          </p>
          {data.company.portalWelcomeMessage && (
            <p className={cn("mt-4 bg-white rounded-[20px] px-4 py-3.5 text-[14px] text-[#33303F] leading-relaxed", CARD_SHADOW)}>{data.company.portalWelcomeMessage}</p>
          )}
        </section>
      )}
      {view && view !== "home" && <h1 className="mb-4 text-[24px] sm:text-[28px] font-extrabold tracking-[-0.02em] text-[#17151F]">{TITLE[view]}</h1>}

      <PortalNav view={view ?? "programs"} onView={goView} chat={chat} badge={todos.length} />

      {view === "home" && <HomeView data={data} todos={todos} brand={brand} onTodo={onTodo} onOpen={id => openProgram(id)} onView={goView} />}
      {view === "programs" && <ProgramsView data={data} todos={todos} brand={brand} onOpen={id => openProgram(id)} />}
      {view === "money" && <MoneyView data={data} onOpen={openProgram} />}
      {view === "chat" && <PortalChat token={token} brand={brand} companyName={data.company.name} />}

      {pid && (program ? (
        <ProgramPage key={program.id} b={program} token={token} brand={brand} studio={studio}
          todos={todosFor(todos, program.id)}
          invoices={data.company.portalShowInvoices !== false ? data.invoices.filter(i => i.bookingId === program.id) : []}
          payments={data.company.portalShowPayments !== false ? data.payments.filter(p => p.bookingId === program.id) : []}
          contracts={(data.contracts ?? []).filter(c => c.bookingId === program.id)}
          photos={photos.filter(g => g.bookingId === program.id)} music={music.find(m => m.bookingId === program.id)}
          open={openPart} onBack={() => goView("programs")} onChanged={afterChange} onTodo={onTodo} />
      ) : (
        <div className={cn("bg-white rounded-[22px] p-7 text-center", CARD_SHADOW)}>
          <p className="text-[17px] font-extrabold text-[#17151F]">Program not found</p>
          <p className="mt-1 text-[14px] text-[#6B6680]">It may have been removed.</p>
          <button type="button" onClick={() => goView("programs")} className="mt-4 h-10 px-5 rounded-full bg-[#17151F] text-white text-sm font-semibold">All programs</button>
        </div>
      ))}
    </PublicShell>
  );
}
