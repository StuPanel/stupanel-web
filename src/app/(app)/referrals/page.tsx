"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Handshake, Search, ChevronDown, ChevronUp, User, Users, Wallet, Calendar } from "lucide-react";
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Handshake className="w-6 h-6 text-indigo-600" /> Referrals
          </h1>
          <p className="text-sm text-slate-500 mt-1">See who's bringing you business — clients referred by each person.</p>
        </div>
      </div>

      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><Handshake className="w-3.5 h-3.5" /> Referrers</div>
            <p className="text-xl font-bold text-slate-900">{groups.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><Users className="w-3.5 h-3.5" /> Clients Referred</div>
            <p className="text-xl font-bold text-slate-900">{totals.clients}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><Wallet className="w-3.5 h-3.5" /> Revenue from Referrals</div>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.revenue, "BDT")}</p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search referrer name..."
          className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Handshake className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{groups.length === 0 ? "No referrals tracked yet" : "No matching referrer"}</p>
          <p className="text-sm text-slate-400 mt-1">Set a client's Source to &quot;Referral&quot; and name who referred them to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(g => {
            const isOpen = expanded === g.key;
            return (
              <div key={g.key} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : g.key)}
                  className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-slate-50/60 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                      {g.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm truncate">{g.name}</p>
                        {g.referrerClientId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-0.5 flex-shrink-0">
                            <User className="w-2.5 h-2.5" /> Client
                          </span>
                        )}
                      </div>
                      {g.phone && <p className="text-xs text-slate-400">{g.phone}</p>}
                    </div>
                    <div className="sm:hidden flex-shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 pl-[3.25rem] sm:pl-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{g.clientCount}</p>
                      <p className="text-[10px] text-slate-400">Clients</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{g.bookingCount}</p>
                      <p className="text-[10px] text-slate-400">Programs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(g.revenue, "BDT")}</p>
                      <p className="text-[10px] text-slate-400">Revenue</p>
                    </div>
                    <div className="hidden sm:block flex-shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {g.clients.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 pl-12 sm:pl-[4.25rem]">
                        <p className="text-sm text-slate-700 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0"><Calendar className="w-3 h-3" /> {fmtDate(c.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
