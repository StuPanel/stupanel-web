"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, BellRing, CalendarDays, MessageCircle, Phone, Plus, Sparkles, Target, Trophy, Wallet } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, MainButton, PageHeader, SearchField, StatCard } from "@/components/ui/apple";
import { CLIENT_SOURCES } from "@/components/client-form-fields";
import { waLink } from "@/lib/portal-session";
import { LeadDrawer } from "./_components/lead-drawer";
import {
  LOST_REASONS, STAGES, ago, followUpInfo, lostLabel, money, shortDay, stageOf,
  type Lead, type LeadStage, type LeadStats,
} from "./_components/lead-kit";
import { fmtMoney, fmtMoneyShort } from "@/lib/format";

const sourceLabel = (s: string) => CLIENT_SOURCES.find(c => c.value === s)?.label ?? (s === "other" ? "Other" : s);
const FU_TONE = {
  late: "bg-[#FDECEF] text-[#C2304F]",
  today: "bg-[#FCF0DE] text-[#B4690E]",
  soon: "bg-[#EEE8FD] text-[#5B3FD0]",
  later: "bg-[#F5F3FA] text-[#6B6680]",
};

function LeadCard({ lead, onOpen, onDragStart, dragging }: {
  lead: Lead; onOpen: () => void; onDragStart: (e: React.DragEvent) => void; dragging: boolean;
}) {
  const dates = Array.isArray(lead.eventDates) ? lead.eventDates : [];
  const fu = lead.stage !== "booked" && lead.stage !== "lost" ? followUpInfo(lead.followUpAt) : null;
  const wa = waLink(lead.phone, `Assalamu Alaikum ${lead.name.split(" ")[0]}, `);
  const value = money(lead.booking?.grandTotal ?? lead.quote?.grandTotal ?? lead.budget);
  return (
    <div role="button" tabIndex={0} draggable onDragStart={onDragStart} onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      data-lead={lead.id}
      className={cn("group bg-white rounded-[16px] p-3.5 cursor-pointer select-none transition-all hover:-translate-y-px outline-none focus-visible:ring-2 focus-visible:ring-[#7D5CEF]",
        CARD_SHADOW, dragging && "opacity-40")}>
      <div className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-[14.5px] font-bold text-[#17151F] leading-snug truncate">{lead.name}</p>
        {value > 0 && <span className="text-[13px] font-bold text-[#17151F] tabular-nums">{fmtMoneyShort(value)}</span>}
      </div>
      {(lead.eventType || dates.length > 0) && (
        <p className="mt-1 text-[12.5px] text-[#4A4658] flex items-center gap-1.5 min-w-0">
          {dates.length > 0 && <><CalendarDays className="w-3.5 h-3.5 text-[#7D5CEF] flex-shrink-0" /><span className="font-semibold">{shortDay(dates[0])}{dates.length > 1 ? ` +${dates.length - 1}` : ""}</span></>}
          {lead.eventType && <span className="truncate">{dates.length > 0 ? "· " : ""}{lead.eventType}</span>}
        </p>
      )}
      {lead.stage === "lost" && <p className="mt-1 text-[12px] text-[#6B6680]">{lostLabel(lead.lostReason)}</p>}
      {lead.stage === "booked" && lead.booking && <p className="mt-1 text-[12px] text-[#1F8A5B] font-semibold truncate">✓ {lead.booking.eventName || lead.booking.bookingNumber}</p>}
      {lead.stage !== "booked" && lead.quote && <p className="mt-1 text-[12px] text-[#9E3A8C] font-semibold">Quote {lead.quote.quoteNumber} · {lead.quote.status}</p>}
      <div className="mt-2.5 flex items-center gap-1.5">
        {fu && <span className={cn("h-6 px-2 rounded-full text-[11px] font-bold inline-flex items-center gap-1", FU_TONE[fu.tone])}>
          {(fu.tone === "late" || fu.tone === "today") && <BellRing className="w-3 h-3" />}{fu.text}
        </span>}
        {!fu && lead.source && <span className="h-6 px-2 rounded-full bg-[#F5F3FA] text-[11px] font-semibold text-[#6B6680] inline-flex items-center">{sourceLabel(lead.source)}</span>}
        <span className="flex-1" />
        {lead.phone && (
          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} aria-label={`Call ${lead.name}`}
            className="w-7 h-7 rounded-full bg-[#E3EEF9] text-[#1F5C99] flex items-center justify-center hover:brightness-95"><Phone className="w-3.5 h-3.5" /></a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} aria-label={`WhatsApp ${lead.name}`}
            className="w-7 h-7 rounded-full bg-[#E2F4EA] text-[#1F8A5B] flex items-center justify-center hover:brightness-95"><MessageCircle className="w-3.5 h-3.5" /></a>
        )}
      </div>
      {lead.lastContactAt && <p className="mt-2 text-[11px] text-[#A29DB3]">Last talked {ago(lead.lastContactAt)}</p>}
    </div>
  );
}

function Insights({ stats }: { stats: LeadStats }) {
  const maxSrc = Math.max(1, ...stats.sources.map(s => s.total));
  const maxLost = Math.max(1, ...stats.lostReasons.map(s => s.count));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}>
        <p className="text-[15px] font-bold text-[#17151F]">Where leads come from</p>
        <p className="text-[12.5px] text-[#6B6680] mb-4">How many came, and how many booked</p>
        {stats.sources.length === 0 && <p className="text-[13px] text-[#A29DB3]">No leads yet.</p>}
        <ul className="space-y-3">
          {stats.sources.map(s => (
            <li key={s.source}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-semibold text-[#17151F]">{sourceLabel(s.source)}</span>
                <span className="text-[#6B6680] tabular-nums">{s.total} lead{s.total > 1 ? "s" : ""} · <b className="text-[#1F8A5B]">{s.won} booked</b></span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-[#F5F3FA] overflow-hidden flex">
                <span className="h-full bg-[#1F8A5B]" style={{ width: `${(s.won / maxSrc) * 100}%` }} />
                <span className="h-full bg-[#C9BCF7]" style={{ width: `${((s.total - s.won) / maxSrc) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("bg-white rounded-[20px] p-5", CARD_SHADOW)}>
        <p className="text-[15px] font-bold text-[#17151F]">Why leads were lost</p>
        <p className="text-[12.5px] text-[#6B6680] mb-4">Fix the top reason and win more</p>
        {stats.lostReasons.length === 0 && <p className="text-[13px] text-[#A29DB3]">Nothing lost yet. 🎉</p>}
        <ul className="space-y-3">
          {stats.lostReasons.map(r => (
            <li key={r.reason}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-semibold text-[#17151F]">{lostLabel(r.reason)}</span>
                <span className="text-[#6B6680] tabular-nums">{r.count}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-[#F5F3FA] overflow-hidden">
                <span className="block h-full bg-[#C2304F]/70 rounded-full" style={{ width: `${(r.count / maxLost) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LeadsBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "due">("all");
  const [source, setSource] = useState("");
  const [mobileStage, setMobileStage] = useState<LeadStage>("new");
  const [drawer, setDrawer] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ stage: LeadStage; index: number } | null>(null);
  const [lostAsk, setLostAsk] = useState<{ id: string; index: number } | null>(null);
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/leads`);
      if (r.ok) { const d = await r.json(); setLeads(d.leads ?? []); setStats(d.stats ?? null); }
    } catch { /* keep what we have */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.workTypes) setWorkTypes((d.workTypes as { name?: string; active?: boolean }[]).filter(w => w.active !== false && w.name).map(w => w.name!));
    }).catch(() => {});
  }, []);

  // ?open=<leadId> (from notifications) and ?new=1
  useEffect(() => {
    const id = params.get("open");
    if (params.get("new")) { setDrawer({ open: true, lead: null }); router.replace("/leads", { scroll: false }); return; }
    if (!id || loading) return;
    const l = leads.find(x => x.id === id);
    if (l) setDrawer({ open: true, lead: l });
    router.replace("/leads", { scroll: false });
  }, [params, leads, loading, router]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return leads.filter(l =>
      (!q || [l.name, l.phone, l.email, l.eventType, l.venue].some(v => v?.toLowerCase().includes(q))) &&
      (!source || (l.source || "other") === source) &&
      (filter === "all" || (l.followUpAt && new Date(l.followUpAt) <= end && l.stage !== "booked" && l.stage !== "lost")));
  }, [leads, search, source, filter]);

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map(s => [s.key, [] as Lead[]])) as Record<LeadStage, Lead[]>;
    for (const l of shown) (m[l.stage] ?? m.new).push(l);
    return m;
  }, [shown]);

  async function move(id: string, stage: LeadStage, index: number, lostReason?: string) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    if (stage === "lost" && lead.stage !== "lost" && !lostReason) { setLostAsk({ id, index }); return; }
    // Optimistic: place it, then save
    setLeads(prev => {
      const rest = prev.filter(l => l.id !== id);
      const col = rest.filter(l => l.stage === stage).sort((a, b) => a.position - b.position);
      const moved = { ...lead, stage, ...(lostReason ? { lostReason } : {}) };
      col.splice(Math.min(index, col.length), 0, moved);
      const pos = new Map(col.map((l, i) => [l.id, i]));
      return [...rest.filter(l => l.stage !== stage), ...col].map(l => (pos.has(l.id) ? { ...l, position: pos.get(l.id)! } : l));
    });
    const r = await apiFetch(`${API}/leads/${id}/move`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, position: index, ...(lostReason ? { lostReason } : {}) }),
    }).catch(() => null);
    if (!r?.ok) notify("Couldn't move it — try again", { error: true });
    else if (stage !== lead.stage) notify(`${lead.name} → ${stageOf(stage).label}`);
    load();
  }

  function dropIndex(stage: LeadStage, clientY: number) {
    const col = colRefs.current[stage];
    if (!col) return 0;
    const cards = [...col.querySelectorAll<HTMLElement>("[data-lead]")].filter(c => c.dataset.lead !== dragId);
    const i = cards.findIndex(c => { const r = c.getBoundingClientRect(); return clientY < r.top + r.height / 2; });
    return i === -1 ? cards.length : i;
  }

  const openNew = () => setDrawer({ open: true, lead: null });
  const st = stats;

  return (
    <div>
      <PageHeader icon={Target} color="violet" title="Leads"
        sub={st ? `${st.open} open · ${fmtMoney(st.openValue)} in the pipeline` : "People who asked about a shoot"}>
        <SearchField className="flex-1 min-w-0 sm:w-60 sm:flex-none" value={search} onChange={setSearch} placeholder="Search leads" />
        <MainButton onClick={openNew} icon={Plus}>Add lead</MainButton>
      </PageHeader>

      {st && leads.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={Wallet} color="violet" label="In the pipeline" value={fmtMoneyShort(st.openValue)} sub={`${st.open} open lead${st.open === 1 ? "" : "s"}`} />
          <button type="button" onClick={() => setFilter(f => (f === "due" ? "all" : "due"))} className={cn("text-left rounded-[20px] transition-shadow", filter === "due" && "ring-2 ring-[#B4690E]")}>
            <StatCard icon={BellRing} color={st.overdue ? "red" : "orchid"} label="Follow up today" value={st.followUpsDue}
              sub={st.overdue ? `${st.overdue} overdue` : filter === "due" ? "Showing these only" : "Tap to see them"} />
          </button>
          <StatCard icon={Trophy} color="green" label="Win rate" value={st.winRate == null ? "—" : `${st.winRate}%`} sub={`${st.won} booked · ${st.lost} lost`} />
          <StatCard icon={Sparkles} color="blue" label="New this week" value={st.newThisWeek} sub={st.sources[0] ? `Most from ${sourceLabel(st.sources[0].source)}` : undefined} />
        </div>
      )}

      {leads.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-4 [scrollbar-width:none]">
          <button type="button" onClick={() => { setSource(""); setFilter("all"); }}
            className={cn("h-8 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap", !source && filter === "all" ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658]")}>All</button>
          {(st?.sources ?? []).map(s => (
            <button key={s.source} type="button" onClick={() => setSource(source === s.source ? "" : s.source)}
              className={cn("h-8 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap", source === s.source ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658]")}>
              {sourceLabel(s.source)} <span className="opacity-60">{s.total}</span>
            </button>
          ))}
          <span className="flex-1" />
          <button type="button" onClick={() => setShowInsights(v => !v)}
            className={cn("h-8 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5", showInsights ? "bg-[#7D5CEF] text-white" : "bg-white text-[#5B3FD0]")}>
            <BarChart3 className="w-3.5 h-3.5" />Insights
          </button>
        </div>
      )}

      {showInsights && st && <Insights stats={st} />}

      {loading ? (
        <div className="flex gap-3 overflow-hidden">{STAGES.slice(0, 4).map(s => <div key={s.key} className="w-[272px] h-64 rounded-[20px] bg-white/60 animate-pulse flex-shrink-0" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState icon={Target} title="No leads yet"
          text="When someone asks about a shoot — on Facebook, WhatsApp or a call — add them here. Follow up on time and turn them into bookings."
          action={<MainButton onClick={openNew} icon={Plus}>Add your first lead</MainButton>} />
      ) : (
        <>
          {/* Phone: one column at a time */}
          <div className="lg:hidden">
            <div role="tablist" aria-label="Stage" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-3 [scrollbar-width:none]">
              {STAGES.map(s => (
                <button key={s.key} type="button" role="tab" aria-selected={mobileStage === s.key} onClick={() => setMobileStage(s.key)}
                  className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5",
                    mobileStage === s.key ? "text-white" : "bg-white text-[#4A4658]")}
                  style={mobileStage === s.key ? { background: s.color } : undefined}>
                  {s.label}<span className="opacity-70">{byStage[s.key].length}</span>
                </button>
              ))}
            </div>
            {stats?.perStage[mobileStage]?.value ? <p className="px-1 mb-2 text-[12.5px] text-[#6B6680]">{fmtMoney(stats.perStage[mobileStage].value)} in {stageOf(mobileStage).label.toLowerCase()}</p> : null}
            <div className="space-y-2.5">
              {byStage[mobileStage].length === 0 && <p className="text-center text-[13px] text-[#A29DB3] py-10">Nothing here.</p>}
              {byStage[mobileStage].map(l => (
                <LeadCard key={l.id} lead={l} dragging={false} onDragStart={e => e.preventDefault()} onOpen={() => setDrawer({ open: true, lead: l })} />
              ))}
            </div>
          </div>

          {/* Desktop: the board */}
          <div className="hidden lg:flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 items-start">
            {STAGES.map(s => {
              const list = byStage[s.key];
              const value = list.reduce((n, l) => n + money(l.booking?.grandTotal ?? l.quote?.grandTotal ?? l.budget), 0);
              const isOver = over?.stage === s.key;
              return (
                <div key={s.key} className={cn("w-[272px] flex-shrink-0 rounded-[20px] p-2 transition-colors", isOver ? "bg-[#EEE8FD]" : "bg-[#EFEDF5]")}
                  onDragOver={e => { if (!dragId) return; e.preventDefault(); const index = dropIndex(s.key, e.clientY); if (over?.stage !== s.key || over.index !== index) setOver({ stage: s.key, index }); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(o => (o?.stage === s.key ? null : o)); }}
                  onDrop={e => { e.preventDefault(); const id = dragId; const index = dropIndex(s.key, e.clientY); setDragId(null); setOver(null); if (id) move(id, s.key, index); }}>
                  <div className="flex items-center gap-2 px-2 pt-1.5 pb-2.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <p className="text-[13.5px] font-bold text-[#17151F]">{s.label}</p>
                    <span className="text-[12px] font-semibold text-[#6B6680] bg-white rounded-full px-1.5 min-w-[20px] text-center">{list.length}</span>
                    <span className="flex-1" />
                    {value > 0 && <span className="text-[12px] font-semibold text-[#6B6680] tabular-nums">{fmtMoneyShort(value)}</span>}
                  </div>
                  <div ref={el => { colRefs.current[s.key] = el; }} className="space-y-2 min-h-[80px]">
                    {list.map((l, i) => (
                      <div key={l.id}>
                        {isOver && over!.index === i && dragId !== l.id && <div className="h-1 rounded-full bg-[#7D5CEF] mb-2" />}
                        <LeadCard lead={l} dragging={dragId === l.id}
                          onDragStart={e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); setDragId(l.id); }}
                          onOpen={() => setDrawer({ open: true, lead: l })} />
                      </div>
                    ))}
                    {isOver && over!.index >= list.filter(l => l.id !== dragId).length && <div className="h-1 rounded-full bg-[#7D5CEF]" />}
                    {s.key === "new" && (
                      <button type="button" onClick={openNew}
                        className="w-full h-10 rounded-[14px] border-2 border-dashed border-[#D9D3EA] text-[13px] font-semibold text-[#6B6680] hover:border-[#7D5CEF] hover:text-[#5B3FD0] inline-flex items-center justify-center gap-1.5">
                        <Plus className="w-4 h-4" />Add lead
                      </button>
                    )}
                    {list.length === 0 && s.key !== "new" && <p className="text-center text-[12px] text-[#A29DB3] py-6">Drag a lead here</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {lostAsk && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/25" onClick={() => setLostAsk(null)} />
          <div role="dialog" aria-modal="true" aria-label="Why was it lost?"
            className="fixed z-[70] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-sm bg-white rounded-[22px] p-5 shadow-2xl">
            <p className="text-[17px] font-bold text-[#17151F]">Why was it lost?</p>
            <p className="text-[13px] text-[#6B6680] mt-0.5 mb-4">This shows in Insights, so you can win more next time.</p>
            <div className="grid gap-2">
              {LOST_REASONS.map(r => (
                <button key={r.value} type="button" onClick={() => { const a = lostAsk; setLostAsk(null); move(a.id, "lost", a.index, r.value); }}
                  className="h-11 rounded-[14px] bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[14px] font-semibold text-[#17151F] text-left px-4">{r.label}</button>
              ))}
            </div>
            <button type="button" onClick={() => setLostAsk(null)} className="mt-3 w-full h-10 text-[13px] font-semibold text-[#6B6680]">Cancel</button>
          </div>
        </>
      )}

      <LeadDrawer open={drawer.open} lead={drawer.lead} workTypes={workTypes}
        onClose={() => setDrawer({ open: false, lead: null })}
        onSaved={() => { load(); }} />
    </div>
  );
}

export default function LeadsPage() {
  return <Suspense><LeadsBoard /></Suspense>;
}
