"use client";
/**
 * Website → Visitors: StuPanel's own counts for the published website (no Pixel or Analytics needed).
 * Visits, visitors, contact taps and booking forms; a bar per day; top pages, where people came from,
 * phone or computer, and country.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { API_URL as API, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Day = { day: string; views: number; visitors: number; contacts: number; leads: number };
type Top = { key: string; count: number };
type Report = {
  allowed: boolean; days?: number;
  totals?: { views: number; visitors: number; contacts: number; leads: number };
  before?: { views: number; visitors: number; leads: number };
  series?: Day[]; top?: Record<string, Top[]>;
};

const RANGES = [7, 30, 90, 365] as const;
const RANGE_NAME: Record<number, string> = { 7: "7 days", 30: "30 days", 90: "3 months", 365: "1 year" };
const fmt = (n: number) => n.toLocaleString("en-US");

const SOURCE: Record<string, string> = {
  direct: "Typed or saved link, WhatsApp, apps", facebook: "Facebook", instagram: "Instagram", google: "Google", bing: "Bing",
  youtube: "YouTube", whatsapp: "WhatsApp", messenger: "Messenger", tiktok: "TikTok", x: "X (Twitter)", linkedin: "LinkedIn",
};
const DEVICE: Record<string, string> = { phone: "Phone", computer: "Computer", tablet: "Tablet" };
const PAGE: Record<string, string> = {
  "/": "Home", "/portfolio": "Portfolio", "/films": "Films", "/packages": "Packages", "/about": "About", "/reviews": "Reviews",
  "/faq": "Questions", "/contact": "Book your date", "/stories": "Stories", "/privacy": "Privacy", "/terms": "Terms", "/thank-you": "Thank-you (form sent)",
};

function countryName(code: string) {
  if (code === "unknown") return "Not known";
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function change(now: number, was: number) {
  if (!was) return null;
  const p = Math.round(((now - was) / was) * 100);
  return p === 0 ? "same as before" : `${p > 0 ? "+" : ""}${p}% vs the period before`;
}

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string | null; tone?: "good" }) {
  return (
    <div className="rounded-[18px] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
      <p className="text-[13px] text-[#6B6680]">{label}</p>
      <p className={cn("text-[26px] font-bold tabular-nums leading-tight mt-0.5", tone === "good" ? "text-[#1F8A4C]" : "text-[#17151F]")}>{value}</p>
      {note && <p className="text-[12px] text-[#8A8597] mt-0.5">{note}</p>}
    </div>
  );
}

function Bars({ series }: { series: Day[] }) {
  const max = Math.max(1, ...series.map(d => d.views));
  const many = series.length > 31;
  // A year is shown by week so the bars stay readable.
  const rows: Day[] = many
    ? series.reduce<Day[]>((acc, d, i) => {
        if (i % 7 === 0) acc.push({ ...d }); else { const w = acc[acc.length - 1]; w.views += d.views; w.visitors += d.visitors; w.contacts += d.contacts; w.leads += d.leads; }
        return acc;
      }, [])
    : series;
  const top = Math.max(1, ...rows.map(d => d.views), max);
  const label = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div>
      <div className="flex items-end gap-[3px] h-[150px]" role="img" aria-label={`Visits per ${many ? "week" : "day"}`}>
        {rows.map(d => (
          <div key={d.day} className="flex-1 min-w-0 h-full flex flex-col justify-end group relative">
            <div className="w-full rounded-t-[4px] bg-[#7D5CEF]/85 group-hover:bg-[#5B3FD0] transition-colors" style={{ height: `${Math.max(d.views ? 3 : 0, (d.views / top) * 100)}%` }} />
            {d.leads > 0 && <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1F8A4C]" aria-hidden="true" />}
            <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#17151F] text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 z-10">
              {many ? `Week of ${label(d.day)}` : label(d.day)}: {fmt(d.views)} visits · {fmt(d.visitors)} visitors{d.leads ? ` · ${d.leads} booking form${d.leads > 1 ? "s" : ""}` : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-[#8A8597] mt-1.5"><span>{label(rows[0].day)}</span><span>{label(rows[rows.length - 1].day)}</span></div>
      <p className="text-[12px] text-[#8A8597] mt-1">Each bar is one {many ? "week" : "day"}. A green dot marks a day with a booking form.</p>
    </div>
  );
}

function List({ title, rows, name, empty }: { title: string; rows: Top[]; name: (k: string) => string; empty: string }) {
  const total = rows.reduce((a, r) => a + r.count, 0) || 1;
  return (
    <section className="rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
      <h3 className="text-[14px] font-bold text-[#17151F] mb-2.5">{title}</h3>
      {!rows.length ? <p className="text-[13px] text-[#8A8597]">{empty}</p> : (
        <ul className="space-y-1.5">
          {rows.slice(0, 8).map(r => (
            <li key={r.key} className="relative rounded-[10px] overflow-hidden">
              <span className="absolute inset-y-0 left-0 bg-[#F1EEF8]" style={{ width: `${Math.max(4, (r.count / total) * 100)}%` }} aria-hidden="true" />
              <span className="relative flex items-center gap-2 px-2.5 py-1.5 text-[13px]">
                <span className="flex-1 min-w-0 truncate text-[#2D2A38]">{name(r.key)}</span>
                <span className="tabular-nums font-semibold text-[#17151F]">{fmt(r.count)}</span>
                <span className="tabular-nums text-[#8A8597] w-10 text-right">{Math.round((r.count / total) * 100)}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function VisitorsTab({ active, published, albums, stories }: {
  /** Load only when the tab is open */ active: boolean; published: boolean;
  albums: { id: string; title: string }[]; stories: { id: string; title: string }[];
}) {
  const [days, setDays] = useState<number>(30);
  const [r, setR] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (d: number) => {
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/site/visitors?days=${d}`);
      if (res.ok) setR(await res.json());
    } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => { void load(days); }, 0);
    return () => clearTimeout(id);
  }, [active, days, load]);

  const pageName = (k: string) => {
    if (PAGE[k]) return PAGE[k];
    const [, kind, id] = k.split("/");
    if (kind === "portfolio") return `Album: ${albums.find(a => a.id === id)?.title ?? id}`;
    if (kind === "stories") return `Story: ${stories.find(s => s.id === id)?.title ?? id}`;
    return k;
  };

  if (!r) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#8A8597]" /></div>;
  if (!r.allowed) return <div className="rounded-[14px] border border-[#F2D9A6] bg-[#FFF8EA] px-4 py-3 text-[13px] text-[#7A5410]">Website visitors are not part of your plan.</div>;
  const t = r.totals!, b = r.before!, top = r.top ?? {};
  const rate = t.visitors ? Math.round((t.leads / t.visitors) * 1000) / 10 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-[12px] bg-white p-1 shadow-[0_1px_2px_rgba(22,18,40,.05)]" role="tablist" aria-label="Time range">
          {RANGES.map(d => (
            <button key={d} type="button" role="tab" aria-selected={days === d} onClick={() => setDays(d)}
              className={cn("h-8 px-3 rounded-[9px] text-[13px] font-semibold", days === d ? "bg-[#17151F] text-white" : "text-[#4A4658] hover:bg-[#F5F3FA]")}>{RANGE_NAME[d]}</button>
          ))}
        </div>
        <button type="button" onClick={() => void load(days)} disabled={busy} aria-label="Refresh" className="ml-auto h-9 w-9 rounded-[11px] bg-white hover:bg-[#F5F3FA] inline-flex items-center justify-center text-[#4A4658] disabled:opacity-50">
          <RefreshCw className={cn("w-4 h-4", busy && "animate-spin")} />
        </button>
      </div>

      {!published && <p className="rounded-[14px] bg-[#F5F3FA] px-4 py-3 text-[13px] text-[#4A4658]">Visits are counted once your website is published.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Visitors" value={fmt(t.visitors)} note={change(t.visitors, b.visitors)} />
        <Tile label="Pages opened" value={fmt(t.views)} note={t.visitors ? `${(t.views / t.visitors).toFixed(1)} per visitor` : null} />
        <Tile label="Booking forms" value={fmt(t.leads)} note={t.visitors ? `${rate}% of visitors` : null} tone={t.leads ? "good" : undefined} />
        <Tile label="Tapped call / WhatsApp" value={fmt(t.contacts)} />
      </div>

      <section className="rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
        <h3 className="text-[14px] font-bold text-[#17151F] mb-3">Visits</h3>
        {r.series && r.series.length > 0 && <Bars series={r.series} />}
      </section>

      <div className="grid md:grid-cols-2 gap-3">
        <List title="Pages people open" rows={top.page ?? []} name={pageName} empty="No visits yet." />
        <List title="Where they came from" rows={top.source ?? []} name={k => SOURCE[k] ?? k} empty="No visitors yet." />
        <List title="Phone or computer" rows={top.device ?? []} name={k => DEVICE[k] ?? k} empty="No visitors yet." />
        <List title="Country" rows={top.country ?? []} name={countryName} empty="No visitors yet." />
      </div>
      <p className="text-[12px] text-[#8A8597] px-1">Counted by StuPanel without cookies; search engine robots are left out. Visitors = different browsers each day. Your own preview here is not counted. New visits show within a minute.</p>
    </div>
  );
}
