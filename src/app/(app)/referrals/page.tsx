"use client";
/**
 * Referrals — who brought programs to the studio: team members, clients and anyone else.
 * Only program referrals are listed here (Faisal 24-NOV); who referred a client shows on the client's profile.
 * Data: GET /referrers/report. Money counts booked programs only (cancelled/refunded are left out).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, ChevronDown, ChevronUp, HandCoins, Handshake, Wallet } from "lucide-react";
import { ReferralPayDrawer, rateLabel } from "./_components/referral-pay-drawer";
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
  rateType?: "percent" | "fixed" | null;
  rateValue?: number | null;
  earned: number;
  paid: number;
  owed: number;
  waiting: number;
  clients: { id: string; name: string; createdAt: string }[];
  programs: { id: string; number: string; name: string; date?: string | null; status: string; total: number; earned?: number; owed?: number; waiting?: number; paid?: number; clientDue?: number; rate?: { type: "percent" | "fixed"; value: number } }[];
}

type Filter = "all" | ReferrerKind;

export default function ReferralsPage() {
  const [groups, setGroups] = useState<ReferralGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Referral pay on (Settings → Referrals) and the studio's usual rate. */
  const [rules, setRules] = useState<{ pay: boolean; rateType: "percent" | "fixed"; rateValue: number } | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, st] = await Promise.all([apiFetch(`${API}/referrers/report`), apiFetch(`${API}/companies/settings`).catch(() => null)]);
      const data = res.ok ? await res.json() : [];
      // Only people who brought at least one program; a client's own referrer stays on the client profile.
      setGroups((Array.isArray(data) ? data : []).filter((g: ReferralGroup) => g.programs?.length > 0));
      const s = st?.ok ? await st.json() : null;
      setRules(s?.referrals ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = groups.filter(g => (filter === "all" || g.kind === filter) && (!q || g.name.toLowerCase().includes(q) || (g.phone ?? "").includes(q)));
  const totals = groups.reduce(
    (acc, g) => ({ programs: acc.programs + g.programCount, revenue: acc.revenue + g.revenue }),
    { programs: 0, revenue: 0 },
  );
  const payOn = !!rules?.pay;
  const owedAll = groups.reduce((s, g) => s + (g.owed || 0), 0);
  const waitingAll = groups.reduce((s, g) => s + (g.waiting || 0), 0);
  const kinds = (["member", "client", "person"] as ReferrerKind[]).filter(k => groups.some(g => g.kind === k));

  return (
    <div>
      <PageHeader icon={Handshake} color="teal" title="Referrals" sub={<>Who brought programs to you — your team, clients and others</>}>
        {groups.length > 0 && <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search referrer" />}
      </PageHeader>

      {!loading && groups.length > 0 && (
        <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 mb-5", payOn ? "lg:grid-cols-4" : "sm:grid-cols-3")}>
          <StatCard icon={Handshake} color="teal" label="People who referred" value={String(groups.length)} />
          <StatCard icon={CalendarCheck} color="blue" label="Programs referred" value={String(totals.programs)} sub="Booked, not cancelled" />
          <StatCard icon={Wallet} color="green" label="Money from referrals" value={formatCurrency(totals.revenue)} sub="Booked programs" />
          {payOn && <StatCard icon={HandCoins} color="orchid" label="Referral pay to give" value={formatCurrency(owedAll)} sub={waitingAll > 0 ? `${formatCurrency(waitingAll)} waiting for client payments` : "Nothing waiting"} />}
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
          text={groups.length === 0 ? "When you add or edit a program, choose who brought it." : "Try another name or filter."} />
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
                      {g.programCount} program{g.programCount === 1 ? "" : "s"}{g.phone ? ` · ${g.phone}` : g.email ? ` · ${g.email}` : ""}
                    </span>
                  </span>
                  <span className="text-right flex-shrink-0">
                    {payOn ? (
                      // Referral pay on: the person's referral pay is the main number; the programs' price is under it
                      <>
                        <span className="block text-sm font-bold text-[#823072] tabular-nums">{g.earned > 0 ? `${formatCurrency(g.earned)} referral pay` : "No referral pay"}</span>
                        <span className={cn("block text-[11.5px] font-semibold tabular-nums", g.owed > 0 ? "text-[#1F8A5B]" : g.waiting > 0 ? "text-[#9A5B00]" : "text-[#8A859A]")}>
                          {g.owed > 0 ? `${formatCurrency(g.owed)} to pay now` : g.waiting > 0 ? `${formatCurrency(g.waiting)} waiting` : `Programs ${formatCurrency(g.revenue)}`}
                        </span>
                      </>
                    ) : (
                      <span className="block text-sm font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(g.revenue)}</span>
                    )}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="bg-[#FBFAFE] border-t border-[#EEEBF4]">
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
                                <span className="text-right flex-shrink-0">
                                  <span className={cn("block text-sm font-semibold tabular-nums", off ? "text-[#9A95AC]" : "text-[#17151F]")}>{formatCurrency(p.total)}</span>
                                  {payOn && !off && (
                                    <span className={cn("block text-[11.5px] font-semibold tabular-nums", (p.owed ?? 0) > 0 ? "text-[#1F8A5B]" : (p.waiting ?? 0) > 0 ? "text-[#9A5B00]" : "text-[#8A859A]")}>
                                      {!(p.earned ?? 0) ? "No referral pay" : (p.owed ?? 0) > 0 ? `Referral ${formatCurrency(p.owed!)} to pay` : (p.waiting ?? 0) > 0 ? `Referral ${formatCurrency(p.waiting!)} · ${(p.clientDue ?? 0) > 0 ? `client owes ${formatCurrency(p.clientDue!)}` : "waiting"}` : `Referral ${formatCurrency(p.earned!)} paid`}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <div className="pl-[4.25rem] pr-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {payOn && (
                        <button type="button" onClick={() => setPaying(g.id)}
                          className="h-9 px-4 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] text-white text-[13px] font-semibold inline-flex items-center gap-1.5">
                          <HandCoins className="w-4 h-4" />Referral pay
                        </button>
                      )}
                      {payOn && <span className="text-[12.5px] text-[#6B6680]">{g.rateType && g.rateValue !== null && g.rateValue !== undefined ? `Own rate: ${rateLabel(g.rateType, g.rateValue)}` : rules ? `Studio's rate: ${rateLabel(rules.rateType, rules.rateValue)}` : ""}</span>}
                      {profile && <Link href={profile} className="text-[13px] font-semibold text-[#5B3FD0] hover:underline">Open {g.kind === "member" ? "team member" : "client"} profile</Link>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Group>
      )}

      {paying && <ReferralPayDrawer referrerId={paying} onClose={() => setPaying(null)} onChanged={load} />}
    </div>
  );
}
