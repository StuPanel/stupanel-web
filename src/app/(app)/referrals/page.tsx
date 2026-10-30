"use client";

import { Handshake as HeaderIcon } from "lucide-react";
import { EmptyState, Group, Initial, PageHeader, RowsSkeleton, SearchField, StatCard } from "@/components/ui/apple";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { Handshake, ChevronDown, ChevronUp, Users, Wallet, Calendar } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate } from "@/lib/format";

interface ReferralGroup {
  key: string;
  name: string;
  referrerClientId?: string;
  phone?: string;
  clientCount: number;
  bookingCount: number;
  revenue: number;
  clients: { id: string; name: string; createdAt: string }[];
}

export default function ReferralsPage() {
  const [groups, setGroups] = useState<ReferralGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/clients/referrals-report`);
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totals = groups.reduce(
    (acc, g) => ({ clients: acc.clients + g.clientCount, bookings: acc.bookings + g.bookingCount, revenue: acc.revenue + g.revenue }),
    { clients: 0, bookings: 0, revenue: 0 },
  );

  return (
    <div>
      <PageHeader icon={HeaderIcon} color="teal" title="Referrals" sub={<>Who brings you business — clients referred by each person</>}>
        {groups.length > 0 && <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search referrer" />}
      </PageHeader>

      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-7">
          <StatCard icon={Handshake} color="teal" label="People who referred" value={String(groups.length)} />
          <StatCard icon={Users} color="blue" label="Clients referred" value={String(totals.clients)} sub={`${totals.bookings} programs`} />
          <StatCard icon={Wallet} color="green" label="Money from referrals" value={formatCurrency(totals.revenue, "BDT")} />
        </div>
      )}

      {loading ? (
        <RowsSkeleton n={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Handshake} title={groups.length === 0 ? "No referrals yet" : `No one matches "${search}"`}
          text={groups.length === 0 ? "Set a client's Source to \"Referral\" and add who referred them." : "Try another name."} />
      ) : (
        <Group>
          {filtered.map(g => {
            const isOpen = expanded === g.key;
            return (
              <div key={g.key}>
                <button onClick={() => setExpanded(isOpen ? null : g.key)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] text-left hover:bg-[#F7F5FB] transition-colors">
                  <Initial name={g.name} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[#17151F] truncate">
                      {g.name}
                      {g.referrerClientId && <span className="ml-2 text-[11px] font-bold text-[#126B66] bg-[#E0F2F1] px-1.5 py-0.5 rounded-full">Client</span>}
                    </span>
                    <span className="block text-xs text-[#6B6680] truncate mt-0.5">
                      {g.clientCount} client{g.clientCount === 1 ? "" : "s"} · {g.bookingCount} program{g.bookingCount === 1 ? "" : "s"}{g.phone ? ` · ${g.phone}` : ""}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[#1F8A5B] tabular-nums flex-shrink-0">{formatCurrency(g.revenue, "BDT")}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="bg-[#FBFAFE] border-t border-[#EEEBF4] divide-y divide-[#EEEBF4]">
                    {g.clients.map(c => (
                      <a key={c.id} href={`/clients?view=${c.id}`} className="flex items-center justify-between gap-3 pl-[4.25rem] pr-5 py-2.5 hover:bg-[#F5F3FA]">
                        <span className="text-sm text-[#17151F] truncate">{c.name}</span>
                        <span className="text-xs text-[#6B6680] flex items-center gap-1 flex-shrink-0"><Calendar className="w-3 h-3" />Added {fmtDate(c.createdAt)}</span>
                      </a>
                    ))}
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
