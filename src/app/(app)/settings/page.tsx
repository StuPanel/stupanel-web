"use client";

/**
 * Settings — laid out like macOS System Settings.
 * Desktop: sidebar (search + grouped panes) on the left, the pane on the right.
 * Mobile: the list first; tapping a pane slides into it with a back button.
 * Search finds any single setting and jumps straight to it.
 * Every change saves by itself (see _ui.tsx).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { GROUPS, paneById, searchSettings, type PaneId } from "./_registry";
import { PaneHeader, SettingsCtx, Tile, type Company, type SaveState, type StudioSettings } from "./_ui";
import { BrandingPane, GeneralPane, OnlinePane } from "./_panes/studio";
import { CatalogPane, InvoicesPane, PaymentPane, QuotesPane, TaxPane } from "./_panes/money";
import { BookingsPane, NotificationsPane, PortalPane } from "./_panes/work";
import { IntegrationsPane, SecurityPane } from "./_panes/account";
import { DeliveryRulesPane, FeaturesPane, TeamPayPane, WorkTypesPane } from "./_panes/studio-setup";

const PANE_VIEWS: Record<PaneId, () => React.ReactElement> = {
  general: GeneralPane, branding: BrandingPane, online: OnlinePane,
  payment: PaymentPane, quotes: QuotesPane, invoices: InvoicesPane, tax: TaxPane, catalog: CatalogPane,
  features: FeaturesPane, worktypes: WorkTypesPane, team: TeamPayPane, delivery: DeliveryRulesPane,
  bookings: BookingsPane, portal: PortalPane, notifications: NotificationsPane,
  security: SecurityPane, integrations: IntegrationsPane,
};

// Old links used ?tab=… — keep them working.
const OLD_TABS: Record<string, PaneId> = {
  studio: "general", branding: "branding", social: "online", payment: "payment", quotation: "quotes",
  invoice: "invoices", tax: "tax", catalog: "catalog", booking: "bookings", portal: "portal",
  notifications: "notifications", security: "security", integrations: "integrations",
};

function paneFromUrl(): PaneId | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const id = p.get("pane") ?? OLD_TABS[p.get("tab") ?? ""];
  return id && paneById(id) ? (id as PaneId) : null;
}

export default function SettingsPage() {
  const [data, setData] = useState<Company | null>(null);
  const [studio, setStudio] = useState<StudioSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [pane, setPane] = useState<PaneId>("general");
  const [mobileOpen, setMobileOpen] = useState(false); // mobile: showing a pane (not the list)
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [state, setState] = useState<SaveState>("idle");
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromUrl = paneFromUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl) { setPane(fromUrl); setMobileOpen(true); }
    apiFetch(`${API}/companies/me`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
    apiFetch(`${API}/companies/settings`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setStudio(d))
      .catch(() => setStudio(null));
  }, []);

  const savedOk = useCallback(() => {
    setState("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setState("idle"), 1800);
  }, []);

  // Studio settings (features, work types, shifts…): send only the changed section.
  const patchStudio = useCallback(async <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => {
    let before: StudioSettings | null = null;
    setStudio(s => { before = s; return s ? { ...s, [key]: value } : s; });
    setState("saving");
    try {
      const r = await apiFetch(`${API}/companies/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save");
      setStudio(d as StudioSettings);
      savedOk();
      return true;
    } catch (e) {
      if (before) setStudio(before);
      setState("error");
      notify(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Couldn't save — check your internet", { error: true });
      return false;
    }
  }, [savedOk]);

  // Save one or more fields. Shows the change at once; puts it back if saving fails.
  const patch = useCallback(async (payload: Record<string, unknown>) => {
    let before: Company | null = null;
    setData(d => { before = d; return d ? { ...d, ...payload } : d; });
    setState("saving");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    try {
      const r = await apiFetch(`${API}/companies/me`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save");
      }
      setState("saved");
      savedTimer.current = setTimeout(() => setState("idle"), 1800);
      return true;
    } catch (e) {
      if (before) setData(before);
      setState("error");
      notify(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Couldn't save — check your internet", { error: true });
      return false;
    }
  }, []);

  const results = useMemo(() => searchSettings(q), [q]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCursor(0); }, [q]);

  const openPane = useCallback((id: PaneId, rowId?: string) => {
    setPane(id);
    setMobileOpen(true);
    window.history.replaceState({}, "", `${window.location.pathname}?pane=${id}`);
    if (!rowId) { contentRef.current?.scrollIntoView({ block: "start" }); window.scrollTo({ top: 0 }); return; }
    // Wait for the pane to render, then scroll to the setting and flash it.
    setTimeout(() => {
      const el = document.getElementById(`set-${rowId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("sp-set-flash");
      void el.offsetWidth;
      el.classList.add("sp-set-flash");
      const field = el.querySelector<HTMLElement>("input:not([type=file]), select, textarea");
      field?.focus({ preventScroll: true });
    }, 120);
  }, []);

  function pick(i: number) {
    const r = results[i];
    if (!r) return;
    openPane(r.pane.id, r.entry.id || undefined);
    setQ("");
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(cursor); (e.target as HTMLInputElement).blur(); }
    else if (e.key === "Escape") { setQ(""); }
  }

  // "/" or Ctrl/⌘+K jumps to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        const desktop = window.matchMedia("(min-width: 768px)").matches;
        if (!desktop) setMobileOpen(false);
        setTimeout(() => (desktop ? searchRef : mobileSearchRef).current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (failed) return (
    <div className="max-w-md mx-auto text-center py-20">
      <p className="text-base font-bold text-[#17151F]">Couldn&apos;t load settings</p>
      <p className="text-sm text-[#6B6680] mt-1">Check your internet and try again.</p>
      <button onClick={() => window.location.reload()} className="mt-5 h-11 px-5 rounded-full bg-[#16141D] text-white text-sm font-semibold">Try again</button>
    </div>
  );

  if (!data) return <SettingsSkeleton />;

  const current = paneById(pane)!;
  const View = PANE_VIEWS[pane];

  const searchBox = (ref: React.RefObject<HTMLInputElement | null>, id: string, onWhite = true) => (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680] pointer-events-none" />
      <input ref={ref} id={id} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onSearchKey}
        placeholder="Search settings" aria-label="Search settings" autoComplete="off"
        role="combobox" aria-expanded={!!q} aria-controls={`${id}-results`}
        aria-activedescendant={q && results[cursor] ? `${id}-opt-${cursor}` : undefined}
        className={cn("w-full h-11 pl-10 pr-16 rounded-full text-sm", onWhite ? "bg-[#F5F3FA]" : "bg-white shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]",
          " text-[#17151F] placeholder:text-[#6B6680] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40")} />
      {q ? (
        <button onClick={() => setQ("")} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-white">
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 h-6 px-2 items-center rounded-md bg-white text-[11px] font-semibold text-[#6B6680] border border-[#E3DFEC]">/</kbd>
      )}
    </div>
  );

  const resultList = (id: string, big?: boolean) => (
    <div id={`${id}-results`} role="listbox" aria-label="Search results">
      {results.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <p className="text-sm font-semibold text-[#17151F]">No settings match &ldquo;{q}&rdquo;</p>
          <p className="text-xs text-[#6B6680] mt-1">Try another word, like &ldquo;logo&rdquo;, &ldquo;bKash&rdquo; or &ldquo;invoice&rdquo;.</p>
        </div>
      ) : results.map((r, i) => (
        <button key={`${r.pane.id}-${r.entry.id}`} id={`${id}-opt-${i}`} role="option" aria-selected={i === cursor}
          onMouseEnter={() => setCursor(i)} onClick={() => pick(i)}
          className={cn("w-full flex items-center gap-3 rounded-[14px] text-left transition-colors",
            big ? "px-4 py-3" : "px-2.5 py-2", i === cursor ? "bg-[#EEE8FD]" : "hover:bg-[#F5F3FA]")}>
          <Tile icon={r.pane.icon} color={r.pane.color} size={big ? 30 : 24} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[#17151F] truncate"><Highlight text={r.entry.label} q={q} /></span>
            <span className="block text-xs text-[#6B6680] truncate">{r.entry.id ? `${r.pane.title} › ${r.entry.section}` : r.pane.sub}</span>
          </span>
          {big && <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />}
        </button>
      ))}
    </div>
  );

  return (
    <SettingsCtx.Provider value={{ data, patch, state, studio, patchStudio }}>
      <div className="max-w-[1120px] md:grid md:grid-cols-[272px_minmax(0,1fr)] md:gap-6 md:items-start">

        {/* ── Desktop sidebar ── */}
        <aside className="hidden md:flex flex-col sticky top-[68px] max-h-[calc(100vh-5.5rem)] bg-white rounded-[22px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
          <div className="p-3 pb-2">{searchBox(searchRef, "settings-search")}</div>
          <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Settings sections">
            {q ? resultList("settings-search") : GROUPS.map(g => (
              <div key={g.title} className="mt-3 first:mt-1">
                <p className="px-2.5 mb-1 text-xs font-bold text-[#6B6680]">{g.title}</p>
                {g.panes.map(p => {
                  const active = p.id === pane;
                  return (
                    <button key={p.id} onClick={() => openPane(p.id)} aria-current={active ? "page" : undefined}
                      className={cn("w-full h-10 px-2.5 rounded-[12px] flex items-center gap-3 text-sm transition-colors",
                        active ? "bg-[#EEE8FD] text-[#5B3FD0] font-bold" : "text-[#17151F] font-medium hover:bg-[#F5F3FA]")}>
                      <Tile icon={p.icon} color={p.color} size={26} />
                      <span className="truncate">{p.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Mobile list ── */}
        <div className={cn("md:hidden", mobileOpen && "hidden")}>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-[#17151F] px-1 pt-1">Settings</h1>
          <div className="mt-3 mb-5">{searchBox(mobileSearchRef, "settings-search-m", false)}</div>
          {q ? (
            <div className="bg-white rounded-[20px] p-1.5 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">{resultList("settings-search-m", true)}</div>
          ) : GROUPS.map(g => (
            <section key={g.title} className="mb-6">
              <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">{g.title}</h2>
              <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
                {g.panes.map((p, i) => (
                  <button key={p.id} onClick={() => openPane(p.id)}
                    className="w-full flex items-center gap-3 pl-4 pr-3 min-h-[56px] text-left active:bg-[#F5F3FA]">
                    <Tile icon={p.icon} color={p.color} size={30} />
                    <span className={cn("flex-1 min-w-0 py-3 flex items-center gap-2", i > 0 && "border-t border-[#EEEBF4]")}>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold text-[#17151F]">{p.title}</span>
                        <span className="block text-xs text-[#6B6680] truncate">{p.sub}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── Pane ── */}
        <div ref={contentRef} className={cn("min-w-0 max-w-[820px] w-full scroll-mt-24", !mobileOpen && "hidden md:block")}>
          <div key={pane} className="sp-pane-in">
            <PaneHeader icon={current.icon} color={current.color} title={current.title} sub={current.sub}
              onBack={() => { setMobileOpen(false); window.history.replaceState({}, "", window.location.pathname); }} />
            <View />
          </div>
        </div>
      </div>
    </SettingsCtx.Provider>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const word = q.trim().split(/\s+/)[0]?.toLowerCase();
  const i = word ? text.toLowerCase().indexOf(word) : -1;
  if (!word || i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="bg-transparent text-[#5B3FD0]">{text.slice(i, i + word.length)}</mark>{text.slice(i + word.length)}</>;
}

function SettingsSkeleton() {
  return (
    <div className="max-w-[1120px] md:grid md:grid-cols-[272px_minmax(0,1fr)] md:gap-6" aria-busy="true" aria-label="Loading settings">
      <div className="hidden md:block bg-white rounded-[22px] p-3 space-y-2">
        <div className="sp-skel h-11 rounded-full" />
        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="sp-skel h-9 rounded-[12px]" />)}
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-4"><div className="sp-skel w-[52px] h-[52px] rounded-[15px]" /><div className="sp-skel h-7 w-48 rounded-full" /></div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[20px] p-4 space-y-4">
            {Array.from({ length: 3 }).map((__, j) => <div key={j} className="sp-skel h-8 rounded-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

