"use client";

/**
 * StuPanel team: every studio's website in one place.
 *  • Websites — each studio's site and whether visitors can see it; take one offline (and put it back).
 *  • Addresses — addresses nobody may take for now: a deleted studio's, an old one after a rename, or blocked
 *    by StuPanel. Free any of them at once, or block a new one.
 *  • Rules — how long addresses stay held, and how long a site stays online after a plan ends unpaid.
 * Lists are paged (50 at a time) so this stays quick with any number of studios.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Ban, ChevronLeft, ChevronRight, ExternalLink, Globe, Loader2, Lock, Power, Search, Settings2, ShieldBan, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { askConfirm, askText, notify } from "@/components/feedback";
import { can, getPlatformUser } from "@/lib/platform-api";
import { siteUrl } from "@/lib/site-url";
import { DomainPanel } from "./domain-panel";
import { StatsTab } from "./stats-tab";

const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
const msg = (d: { message?: string | string[] }) => (Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save";

type Site = {
  companyId: string; studioName: string; slug: string; theme: string; isPublished: boolean; publishedAt: string | null; updatedAt: string;
  adminOffline: boolean; adminOfflineReason: string | null; photos: number; state: string;
  /** <address>.stupanel.com on Vercel: added | add (waiting) | failed | null */ domain: string | null; domainError: string | null;
  /** The studio's own domain */ customDomain: string | null; customDomainState: "pending" | "live" | null;
};
type Hold = { slug: string; reason: "deleted" | "renamed" | "blocked"; redirectTo: string | null; releaseAt: string | null; note: string | null; studioName: string | null; createdAt: string; daysLeft: number | null };
type Rules = { holdDeletedDays: number; holdRenamedDays: number; unpaidGraceDays: number };

const STATE: Record<string, [string, string]> = {
  online: ["Online", "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"],
  draft: ["Not published", "bg-slate-700/60 text-slate-300 border-slate-600"],
  offline_admin: ["Taken offline by StuPanel", "bg-rose-500/15 text-rose-300 border-rose-500/30"],
  offline_closed: ["Offline: studio closed", "bg-amber-500/15 text-amber-300 border-amber-500/30"],
  offline_unpaid: ["Offline: plan unpaid", "bg-amber-500/15 text-amber-300 border-amber-500/30"],
};
const REASON: Record<Hold["reason"], string> = { deleted: "Studio deleted", renamed: "Old address (renamed)", blocked: "Blocked" };
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Pager({ page, total, size, go }: { page: number; total: number; size: number; go: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages < 2) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-slate-400">
      <span className="tabular-nums">Page {page} of {pages}</span>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)} className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 inline-flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => go(page + 1)} className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 inline-flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

export default function AdminWebsitesPage() {
  const router = useRouter();
  const me = getPlatformUser();
  const mayChange = !me || can(me, "studios.suspend");
  const mayRules = !me || can(me, "settings.manage");
  const [tab, setTab] = useState<"sites" | "stats" | "names" | "rules">("sites");
  /** A studio's own domain open in the side panel (also /admin/websites?company=<id>, e.g. from a support ticket). */
  const [domainOf, setDomainOf] = useState<string | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("company");
    if (!c) return;
    const id = setTimeout(() => setDomainOf(c), 0);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t !== "sites" && t !== "stats" && t !== "names" && t !== "rules") return;
    const id = setTimeout(() => setTab(t), 0);
    return () => clearTimeout(id);
  }, []);

  // Websites
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sites, setSites] = useState<{ total: number; pageSize: number; sites: Site[] } | null>(null);
  // Addresses
  const [nq, setNq] = useState("");
  const [reason, setReason] = useState("");
  const [npage, setNpage] = useState(1);
  const [names, setNames] = useState<{ total: number; pageSize: number; counts: Record<string, number>; names: Hold[] } | null>(null);
  // Rules
  const [rules, setRules] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);

  const get = useCallback(async (path: string) => {
    const r = await fetch(`${API}/admin/websites${path}`, { headers: authH() });
    if (r.status === 401) { router.replace("/admin/login"); return null; }
    return r.ok ? r.json() : null;
  }, [router]);

  const loadSites = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page) });
    if (q.trim()) p.set("search", q.trim());
    if (filter) p.set("filter", filter);
    setSites(await get(`?${p}`));
  }, [get, page, q, filter]);
  const loadNames = useCallback(async () => {
    const p = new URLSearchParams({ page: String(npage) });
    if (nq.trim()) p.set("search", nq.trim());
    if (reason) p.set("reason", reason);
    setNames(await get(`/names?${p}`));
  }, [get, npage, nq, reason]);

  useEffect(() => {
    if (tab !== "sites") return;
    const id = setTimeout(() => { void loadSites(); }, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [tab, loadSites, q]);
  useEffect(() => {
    if (tab !== "names") return;
    const id = setTimeout(() => { void loadNames(); }, nq ? 300 : 0);
    return () => clearTimeout(id);
  }, [tab, loadNames, nq]);
  useEffect(() => {
    if (tab === "sites" || rules) return;
    const id = setTimeout(async () => setRules(await get("/settings")), 0);
    return () => clearTimeout(id);
  }, [tab, rules, get]);

  async function post(path: string, body: unknown, done: string, method = "POST") {
    const r = await fetch(`${API}/admin/websites${path}`, { method, headers: authH(), body: JSON.stringify(body ?? {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(msg(d), { error: true }); return null; }
    notify(done);
    return d;
  }

  async function takeOffline(s: Site) {
    const why = await askText({ title: `Take ${s.studioName}'s website offline?`, message: "Visitors see \"This website is not available right now\". The studio can't publish it back; only StuPanel can. Note for the studio (optional):", value: "", confirmLabel: "Take offline" });
    if (why === null) return;
    if (await post(`/${s.companyId}/offline`, { offline: true, reason: why }, "Website taken offline")) void loadSites();
  }
  async function putBack(s: Site) {
    if (!(await askConfirm({ title: `Put ${s.studioName}'s website back online?`, message: "Visitors can see it again (if the studio has published it and its plan is in order).", confirmLabel: "Put back online" }))) return;
    if (await post(`/${s.companyId}/offline`, { offline: false }, "Website is back online")) void loadSites();
  }
  async function free(h: Hold) {
    const what = h.reason === "blocked" ? "Anyone can use this address again." : h.reason === "renamed" ? "Visitors are no longer sent to the new address, and any studio can take this one." : "Any studio can take this address now. Old links to the deleted studio would lead to whoever takes it.";
    if (!(await askConfirm({ title: `Free “${h.slug}” now?`, message: what, confirmLabel: "Free it now" }))) return;
    if (await post(`/names/${encodeURIComponent(h.slug)}/free`, {}, `“${h.slug}” is free`)) void loadNames();
  }
  async function block() {
    const slug = await askText({ title: "Block an address", message: "Nobody can use it until you free it — e.g. bank, bkash, login. Small letters, numbers and - only.", value: "", confirmLabel: "Next" });
    if (!slug) return;
    const note = await askText({ title: `Why block “${slug.trim().toLowerCase()}”?`, message: "A short note for the team (optional).", value: "", confirmLabel: "Block" });
    if (note === null) return;
    if (await post("/names", { slug, note }, "Address blocked")) { setReason(""); setNpage(1); void loadNames(); }
  }
  async function saveRules() {
    if (!rules) return;
    setSaving(true);
    const d = await post("/settings", rules, "Rules saved", "PUT");
    setSaving(false);
    if (d) setRules(d);
  }

  const tabs = [
    ["sites", "Websites", Globe],
    ["stats", "Visits & bookings", BarChart3],
    ["names", `Held addresses${names ? ` (${Object.values(names.counts).reduce((a, b) => a + b, 0)})` : ""}`, Lock],
    ["rules", "Rules", Settings2],
  ] as const;

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Websites</h1>
        <p className="text-sm text-slate-400 mt-0.5">Every studio&apos;s website, the addresses nobody may take for now, and the rules for both</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
            className={cn("h-9 px-3.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5", tab === id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === "sites" && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search studio or address" aria-label="Search studio or address"
                className="h-9 w-full pl-9 pr-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500" />
            </div>
            <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} aria-label="Show"
              className="h-9 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none focus:border-indigo-500">
              <option value="">All websites</option>
              <option value="published">Published</option>
              <option value="draft">Not published</option>
              <option value="offline">Taken offline by StuPanel</option>
            </select>
            {sites && <span className="text-xs text-slate-400 sm:ml-auto tabular-nums">{sites.total} website{sites.total === 1 ? "" : "s"}</span>}
          </div>

          {!sites ? <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
            : sites.sites.length === 0 ? <p className="py-12 text-center text-slate-400 text-sm">No websites match.</p>
            : (
              <div className="rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700/70 bg-slate-800/40">
                {sites.sites.map(s => {
                  const [label, tone] = STATE[s.state] ?? [s.state, STATE.draft[1]];
                  return (
                    <div key={s.companyId} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white truncate">{s.studioName}</span>
                          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", tone)}>{label}</span>
                        </div>
                        <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <a href={siteUrl(s.slug)} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-white inline-flex items-center gap-1">{s.slug}<ExternalLink className="w-3.5 h-3.5" /></a>
                          {s.domain && s.domain !== "added" && <span className={s.domain === "failed" ? "text-rose-300" : "text-amber-300"} title={s.domainError ?? undefined}>{s.domain === "failed" ? "Address couldn't be set up" : "Address being set up (about a minute)"}</span>}
                          {s.customDomain && (
                            <button type="button" onClick={() => setDomainOf(s.companyId)} className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white">
                              <span className={cn("w-2 h-2 rounded-full", s.customDomainState === "live" ? "bg-emerald-400" : "bg-amber-400")} aria-hidden="true" />
                              {s.customDomain}<span className="text-slate-500">{s.customDomainState === "live" ? "working" : "waiting"}</span>
                            </button>
                          )}
                          <span>{s.photos} photos</span>
                          <span>Published {date(s.publishedAt)}</span>
                          <span>Changed {date(s.updatedAt)}</span>
                        </div>
                        {s.adminOffline && s.adminOfflineReason && <p className="text-xs text-rose-300/90 mt-1">Note: {s.adminOfflineReason}</p>}
                      </div>
                      {mayChange && (s.adminOffline
                        ? <button type="button" onClick={() => putBack(s)} className="h-9 px-3.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 self-start md:self-auto"><Power className="w-4 h-4" />Put back online</button>
                        : <button type="button" onClick={() => takeOffline(s)} className="h-9 px-3.5 rounded-lg bg-slate-800 border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-sm font-semibold inline-flex items-center gap-1.5 self-start md:self-auto"><Ban className="w-4 h-4" />Take offline</button>)}
                    </div>
                  );
                })}
              </div>
            )}
          {sites && <Pager page={page} total={sites.total} size={sites.pageSize} go={setPage} />}
          {domainOf && <DomainPanel companyId={domainOf} onClose={() => { setDomainOf(null); if (window.location.search.includes("company=")) window.history.replaceState(null, "", "/admin/websites"); }} />}
        </section>
      )}

      {tab === "stats" && <StatsTab />}

      {tab === "names" && (
        <section className="space-y-3">
          <p className="text-sm text-slate-400 max-w-3xl">
            A deleted studio&apos;s address waits {rules ? `${rules.holdDeletedDays} days` : "a while"} so its old links and Google results don&apos;t lead to another studio.
            After a rename the old address sends visitors to the new one for a while, and only that studio can take it back. Blocked addresses stay until you free them.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={nq} onChange={e => { setNq(e.target.value); setNpage(1); }} placeholder="Search address" aria-label="Search address"
                className="h-9 w-full pl-9 pr-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500" />
            </div>
            {(["", "deleted", "renamed", "blocked"] as const).map(r => (
              <button key={r || "all"} type="button" onClick={() => { setReason(r); setNpage(1); }} aria-pressed={reason === r}
                className={cn("h-9 px-3 rounded-lg text-sm font-medium", reason === r ? "bg-slate-200 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
                {r ? REASON[r] : "All"}{r && names?.counts[r] ? ` (${names.counts[r]})` : ""}
              </button>
            ))}
            {mayChange && <button type="button" onClick={block} className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 sm:ml-auto"><ShieldBan className="w-4 h-4" />Block an address</button>}
          </div>

          {!names ? <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
            : names.names.length === 0 ? <p className="py-12 text-center text-slate-400 text-sm">No addresses are held{reason ? " for this reason" : ""}.</p>
            : (
              <div className="rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700/70 bg-slate-800/40">
                {names.names.map(h => (
                  <div key={h.slug} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{h.slug}</span>
                        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", h.reason === "blocked" ? STATE.offline_admin[1] : h.reason === "renamed" ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : STATE.draft[1])}>{REASON[h.reason]}</span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {h.studioName && <span>{h.studioName}</span>}
                        {h.redirectTo && <span>Sends visitors to <span className="text-slate-200">{h.redirectTo}</span></span>}
                        <span>{h.daysLeft === null ? "Held until freed" : h.daysLeft === 0 ? "Free today" : `Free in ${h.daysLeft} day${h.daysLeft === 1 ? "" : "s"} (${date(h.releaseAt)})`}</span>
                        {h.note && <span>Note: {h.note}</span>}
                      </div>
                    </div>
                    {mayChange && <button type="button" onClick={() => free(h)} className="h-9 px-3.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 self-start md:self-auto"><Unlock className="w-4 h-4" />Free now</button>}
                  </div>
                ))}
              </div>
            )}
          {names && <Pager page={npage} total={names.total} size={names.pageSize} go={setNpage} />}
        </section>
      )}

      {tab === "rules" && (
        <section className="max-w-2xl space-y-4">
          {!rules ? <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div> : (
            <>
              {([
                ["holdDeletedDays", "Deleted studio's address", "Days nobody else can take it after the studio is deleted. 0 = free at once. A single studio can also be freed at once from Held addresses, or when you delete it.", 3650],
                ["holdRenamedDays", "Old address after a rename", "Days the old address sends visitors to the new one and stays the studio's. 0 = free at once.", 3650],
                ["unpaidGraceDays", "Website after a plan ends unpaid", "Days the website stays online after the plan's end date, then visitors see \"not available\". It comes back as soon as the studio pays.", 365],
              ] as const).map(([key, title, help, max]) => (
                <label key={key} className="block rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="block text-sm text-slate-400 mt-0.5">{help}</span>
                  <span className="mt-3 inline-flex items-center gap-2">
                    <input type="number" min={0} max={max} inputMode="numeric" value={rules[key]} disabled={!mayRules}
                      onChange={e => setRules({ ...rules, [key]: Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0))) })}
                      className="h-10 w-28 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white tabular-nums outline-none focus:border-indigo-500 disabled:opacity-60" />
                    <span className="text-sm text-slate-400">days</span>
                  </span>
                </label>
              ))}
              {mayRules && (
                <button type="button" onClick={saveRules} disabled={saving} className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save rules
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
