"use client";
/**
 * Referrals — who brings the studio business: team members, clients and anyone else.
 * Data: GET /referrers/report. Money counts booked programs only (cancelled/refunded are left out).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, Handshake, Users, Wallet } from "lucide-react";
import { EmptyState, Group, Initial, PageHeader, RowsSkeleton, SearchField, StatCard } from "@/components/ui/apple";
import { KindChip, KIND_LABEL, type ReferrerKind } from "@/components/ui/referrer-picker";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency, fmtDate } from "@/lib/format";
import { STATUS_CFG } from "../programs/_components/constants";

interface ReferralGroup {
  id: string;
  kind: ReferrerKind;
  name: string;
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
  clientId?: string | null;
  clientCount: number;
  programCount: number;
  revenue: number;
  clients: { id: string; name: string; createdAt: string }[];
  programs: { id: string; number: string; name: string; date?: string | null; status: string; total: number }[];
}

type Filter = "all" | ReferrerKind;

export default function ReferralsPage() {
  const [groups, setGroups] = useState<ReferralGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/referrers/report`);
      const data = res.ok ? await res.json() : [];
      setGroups(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = groups.filter(g => (filter === "all" || g.kind === filter) && (!q || g.name.toLowerCase().includes(q) || (g.phone ?? "").includes(q)));
  const totals = groups.reduce(
    (acc, g) => ({ clients: acc.clients + g.clientCount, programs: acc.programs + g.programCount, revenue: acc.revenue + g.revenue }),
    { clients: 0, programs: 0, revenue: 0 },
  );
  const kinds = (["member", "client", "person"] as ReferrerKind[]).filter(k => groups.some(g => g.kind === k));

  return (
    <div>
      <PageHeader icon={Handshake} color="teal" title="Referrals" sub={<>Who brings you business — your team, clients and others</>}>
        {groups.length > 0 && <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search referrer" />}
      </PageHeader>

      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
          <StatCard icon={Handshake} color="teal" label="People who referred" value={String(groups.length)} />
          <StatCard icon={Users} color="blue" label="Clients referred" value={String(totals.clients)} sub={`${totals.programs} program${totals.programs === 1 ? "" : "s"}`} />
          <StatCard icon={Wallet} color="green" label="Money from referrals" value={formatCurrency(totals.revenue)} sub="Booked programs" />
        </div>
      )}

      {!loading && kinds.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" role="tablist" aria-label="Who referred">
          {(["all", ...kinds] as Filter[]).map(k => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={cn("h-9 px-4 rounded-full text-[13.5px] font-semibold flex-shrink-0 transition-colors",
                filter === k ? "bg-[#17151F] text-white" : "bg-white text-[#4A4560] border border-[#E4E0EE] hover:bg-[#F7F5FB]")}>
              {k === "all" ? "Everyone" : KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <RowsSkeleton n={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Handshake} title={groups.length === 0 ? "No referrals yet" : "No one matches"}
          text={groups.length === 0 ? "When you add a client or a program, choose who referred them." : "Try another name or filter."} />
      ) : (
        <Group>
          {filtered.map(g => {
            const isOpen = expanded === g.id;
            const profile = g.kind === "member" && g.userId ? `/team/${g.userId}` : g.kind === "client" && g.clientId ? `/clients/${g.clientId}` : null;
            return (
              <div key={g.id}>
                <button onClick={() => setExpanded(isOpen ? null : g.id)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] text-left hover:bg-[#F7F5FB] transition-colors">
                  <Initial name={g.name} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-[#17151F] truncate">{g.name}</span>
                      <KindChip kind={g.kind} />
                    </span>
                    <span className="block text-xs text-[#6B6680] truncate mt-0.5">
                      {g.clientCount} client{g.clientCount === 1 ? "" : "s"} · {g.programCount} program{g.programCount === 1 ? "" : "s"}{g.phone ? ` · ${g.phone}` : g.email ? ` · ${g.email}` : ""}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[#1F8A5B] tabular-nums flex-shrink-0">{formatCurrency(g.revenue)}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="bg-[#FBFAFE] border-t border-[#EEEBF4]">
                    {g.clients.length > 0 && (
                      <>
                        <p className="pl-[4.25rem] pr-5 pt-3 pb-1 text-[12px] font-semibold text-[#6B6680]">Clients</p>
                        <div className="divide-y divide-[#EEEBF4]">
                          {g.clients.map(c => (
                            <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 pl-[4.25rem] pr-5 py-2.5 hover:bg-[#F5F3FA]">
                              <span className="text-sm text-[#17151F] truncate">{c.name}</span>
                              <span className="text-xs text-[#6B6680] flex items-center gap-1 flex-shrink-0"><Calendar className="w-3 h-3" />Added {fmtDate(c.createdAt)}</span>
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                    {g.programs.length > 0 && (
                      <>
                        <p className="pl-[4.25rem] pr-5 pt-3 pb-1 text-[12px] font-semibold text-[#6B6680]">Programs</p>
                        <div className="divide-y divide-[#EEEBF4]">
                          {g.programs.map(p => {
                            const st = STATUS_CFG[p.status as keyof typeof STATUS_CFG];
                            const off = p.status === "cancelled" || p.status === "refunded";
                            return (
                              <Link key={p.id} href={`/programs?view=${p.id}`} className="flex items-center justify-between gap-3 pl-[4.25rem] pr-5 py-2.5 hover:bg-[#F5F3FA]">
                                <span className="min-w-0">
                                  <span className={cn("block text-sm truncate", off ? "text-[#9A95AC] line-through" : "text-[#17151F]")}>{p.name}</span>
                                  <span className="block text-xs text-[#6B6680] truncate">{p.number}{p.date ? ` · ${fmtDate(p.date)}` : ""}{st ? ` · ${st.label}` : ""}</span>
                                </span>
                                <span className={cn("text-sm font-semibold tabular-nums flex-shrink-0", off ? "text-[#9A95AC]" : "text-[#17151F]")}>{formatCurrency(p.total)}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {profile && (
                      <div className="pl-[4.25rem] pr-5 py-3">
                        <Link href={profile} className="text-[13px] font-semibold text-[#5B3FD0] hover:underline">Open {g.kind === "member" ? "team member" : "client"} profile</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Group>
      )}
    </div>
  );
}
