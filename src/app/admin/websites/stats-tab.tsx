"use client";
/**
 * Super Admin → Websites → Visits & bookings: which studios' websites get visitors, how many booking forms
 * they bring, and how many new bookings each studio made (from anywhere). Ranked by one number, 50 a page.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { siteUrl } from "@/lib/site-url";

const authH = () => ({ Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });

type Row = {
  companyId: string; studioName: string; slug: string | null; published: boolean; domain: string | null;
  visitors: number; views: number; contacts: number; forms: number; formsBooked: number; bookings: number;
};
type Totals = { views: number; visitors: number; sitesVisited: number; forms: number; formsBooked: number; bookings: number; studiosBooking: number };
type Data = { days: number; sort: string; page: number; pageSize: number; total: number; rows: Row[]; totals: Totals };

const RANGES: [number, string][] = [[7, "7 days"], [30, "30 days"], [90, "3 months"], [365, "1 year"]];
const SORTS: [string, string][] = [["visitors", "Visitors"], ["views", "Pages opened"], ["forms", "Website booking forms"], ["bookings", "New bookings"]];
const n = (x: number) => x.toLocaleString("en-US");

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums mt-0.5">{value}</p>
      {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
    </div>
  );
}

export function StatsTab() {
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState("visitors");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const p = new URLSearchParams({ days: String(days), sort, page: String(page), ...(q ? { search: q } : {}) });
      const r = await fetch(`${API}/admin/websites/stats?${p}`, { headers: authH() });
      if (r.ok) setD(await r.json());
    } finally { setBusy(false); }
  }, [days, sort, page, q]);
  useEffect(() => {
    const id = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(id);
  }, [load]);
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); setQ(search.trim()); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const t = d?.totals;
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  const th = (key: string, label: string) => (
    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
      <button type="button" onClick={() => { setSort(key); setPage(1); }} className={cn("hover:text-white", sort === key ? "text-indigo-300" : "")} aria-pressed={sort === key}>{label}{sort === key ? " ↓" : ""}</button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg bg-slate-800 p-1">
          {RANGES.map(([v, label]) => (
            <button key={v} type="button" onClick={() => { setDays(v); setPage(1); }} aria-pressed={days === v}
              className={cn("h-8 px-3 rounded-md text-sm font-semibold", days === v ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{label}</button>
          ))}
        </div>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} aria-label="Rank by" className="h-10 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white px-3">
          {SORTS.map(([v, label]) => <option key={v} value={v}>Rank by: {label}</option>)}
        </select>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Studio name" aria-label="Search studio"
            className="w-full h-10 rounded-lg bg-slate-800 border border-slate-700 pl-9 pr-3 text-sm text-white placeholder:text-slate-500" />
        </div>
      </div>

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Website visitors" value={n(t.visitors)} note={`${n(t.views)} pages · ${n(t.sitesVisited)} websites visited`} />
          <Tile label="Website booking forms" value={n(t.forms)} note={t.visitors ? `${Math.round((t.forms / t.visitors) * 1000) / 10}% of visitors` : undefined} />
          <Tile label="Forms that became bookings" value={n(t.formsBooked)} note={t.forms ? `${Math.round((t.formsBooked / t.forms) * 100)}% of forms` : undefined} />
          <Tile label="New bookings (all studios)" value={n(t.bookings)} note={`${n(t.studiosBooking)} studios booked something`} />
        </div>
      )}

      <div className="rounded-xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80 text-slate-400 text-xs">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Studio</th>
              {th("visitors", "Visitors")}
              {th("views", "Pages")}
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Call / WhatsApp</th>
              {th("forms", "Booking forms")}
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">→ Booked</th>
              {th("bookings", "New bookings")}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/70">
            {!d ? <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></td></tr>
              : !d.rows.length ? <tr><td colSpan={7} className="py-10 text-center text-slate-400">No studio has any {SORTS.find(s => s[0] === sort)?.[1].toLowerCase()} in this time{q ? " with this name" : ""}.</td></tr>
              : d.rows.map(r => {
                const link = r.domain ? `https://${r.domain}` : r.slug ? siteUrl(r.slug) : null;
                return (
                  <tr key={r.companyId} className={cn("hover:bg-slate-800/50", busy && "opacity-60")}>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/studios/${r.companyId}`} className="font-semibold text-white hover:text-indigo-300">{r.studioName}</Link>
                      {link && <a href={link} target="_blank" rel="noreferrer" className="block text-xs text-slate-400 hover:text-indigo-300 truncate max-w-[240px]">{link.replace(/^https:\/\//, "")}<ExternalLink className="w-3 h-3 inline ml-1" /></a>}
                      {!link && <span className="block text-xs text-slate-500">No website</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">{n(r.visitors)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{n(r.views)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{n(r.contacts)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">{n(r.forms)}{r.visitors > 0 && r.forms > 0 && <span className="text-xs text-slate-500 ml-1">{Math.round((r.forms / r.visitors) * 100)}%</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300">{n(r.formsBooked)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white font-semibold">{n(r.bookings)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {d && d.total > d.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-400">
          <span>Page {page} of {pages}</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page" className="h-9 w-9 rounded-lg bg-slate-800 disabled:opacity-40 inline-flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Next page" className="h-9 w-9 rounded-lg bg-slate-800 disabled:opacity-40 inline-flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Visitors and pages: StuPanel&apos;s own counter (from 23 Nov 2026). Booking forms: enquiries sent from a studio&apos;s website; → Booked: those that became a booking.
        New bookings: programs created in this time that are booked (confirmed or later; enquiries, quotes and cancelled ones left out), from any source. Only studios with at least one of the chosen number are listed.
      </p>
    </div>
  );
}
