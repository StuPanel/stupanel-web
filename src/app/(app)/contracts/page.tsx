"use client";

/**
 * Contracts — agreements clients read and sign online.
 * "Contracts": every contract with where it stands (Draft → Sent → Opened → Signed).
 * "Templates": ready wording to start from, and the studio's own.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Copy, Eye, FileSignature, FileText, PencilLine, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, Chips, EmptyState, MainButton, PageHeader, RowsSkeleton, SearchField, Tile, type TileColor } from "@/components/ui/apple";
import { STATUS_META, ago, clientFull, contractLink, fmtDay, type ContractRow, type ContractStatus, type ContractTemplate } from "@/lib/contracts";
import { TemplateDrawer } from "./_components/template-drawer";

type Filter = "all" | ContractStatus;
const ICON: Record<ContractStatus, { icon: React.ElementType; color: TileColor }> = {
  draft: { icon: PencilLine, color: "ink" }, sent: { icon: Send, color: "blue" }, viewed: { icon: Eye, color: "orchid" }, signed: { icon: CheckCircle2, color: "green" },
};

function activityLine(c: ContractRow) {
  if (c.status === "signed") return `Signed ${fmtDay(c.signedAt)}${c.signerName ? ` by ${c.signerName}` : ""}`;
  if (c.status === "viewed") return `Opened ${ago(c.lastViewedAt ?? c.viewedAt ?? c.updatedAt)}${c.viewCount > 1 ? ` · ${c.viewCount} times` : ""}`;
  if (c.status === "sent") return `Sent ${fmtDay(c.sentAt)} · not opened yet`;
  return `Draft · changed ${fmtDay(c.updatedAt)}`;
}

export default function ContractsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"contracts" | "templates">("contracts");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tpl, setTpl] = useState<{ starters: ContractTemplate[]; custom: ContractTemplate[] } | null>(null);
  const [drawer, setDrawer] = useState<{ template?: ContractTemplate; startFrom?: ContractTemplate } | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    const p = new URLSearchParams(); if (filter !== "all") p.set("status", filter); if (search.trim()) p.set("search", search.trim());
    const r = await apiFetch(`${API}/contracts?${p}`).catch(() => null);
    if (n !== seq.current) return;
    if (!r?.ok) { setRows([]); notify("Couldn't load contracts", { error: true }); return; }
    const d = await r.json(); setRows(d.data ?? []); setCounts(d.counts ?? {});
  }, [filter, search]);
  useEffect(() => { const t = setTimeout(load, search ? 250 : 0); return () => clearTimeout(t); }, [load, search]);

  const loadTpl = useCallback(() => apiFetch(`${API}/contracts/templates`).then(r => (r.ok ? r.json() : null)).then(d => d && setTpl(d)).catch(() => undefined), []);
  useEffect(() => { if (tab === "templates" && !tpl) void loadTpl(); }, [tab, tpl, loadTpl]);

  async function copyLink(c: ContractRow) {
    // Copying a draft's link means the studio is sending it — make it live first
    if (c.status === "draft") {
      const r = await apiFetch(`${API}/contracts/${c.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't get the link", { error: true }); return; }
    }
    try { await navigator.clipboard.writeText(contractLink(c.publicToken)); notify(c.status === "draft" ? "Link copied — the contract is now ready to sign" : "Link copied"); }
    catch { notify("Couldn't copy the link", { error: true }); }
    if (c.status === "draft") void load();
  }
  async function remove(c: ContractRow) {
    if (!(await askConfirm({ title: `Delete "${c.title}"?`, message: c.status === "draft" ? "This draft will be removed." : "The client's link will stop working.", confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/contracts/${c.id}`, { method: "DELETE" });
    if (!r.ok) { notify("Couldn't delete", { error: true }); return; }
    notify("Contract deleted"); void load();
  }
  async function removeTpl(t: ContractTemplate) {
    if (!(await askConfirm({ title: `Delete "${t.name}"?`, message: "Contracts already made from it stay as they are.", confirmLabel: "Delete", danger: true }))) return;
    const r = await apiFetch(`${API}/contracts/templates/${t.id}`, { method: "DELETE" });
    if (!r.ok) { notify("Couldn't delete", { error: true }); return; }
    notify("Template deleted"); void loadTpl();
  }

  const total = counts.all ?? 0;
  const signedPct = total ? Math.round(((counts.signed ?? 0) / total) * 100) : 0;
  const waiting = (counts.sent ?? 0) + (counts.viewed ?? 0);

  return (
    <div className="max-w-5xl">
      <PageHeader icon={FileSignature} color="ink" title="Contracts"
        sub={total ? <>{counts.signed ?? 0} signed{waiting ? <> · <span className="font-semibold text-[#9E3A8C]">{waiting} waiting for the client</span></> : ""}{counts.draft ? ` · ${counts.draft} draft${counts.draft === 1 ? "" : "s"}` : ""}</> : "Agreements your clients read and sign online"}>
        {tab === "contracts" && <SearchField value={search} onChange={setSearch} placeholder="Search contracts" className="flex-1 sm:w-56" />}
        <MainButton onClick={() => router.push("/contracts/new")} icon={Plus}>New contract</MainButton>
      </PageHeader>

      <div role="tablist" aria-label="Section" className="inline-flex p-1 rounded-full bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)] mb-4">
        {([["contracts", "Contracts"], ["templates", "Templates"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("h-9 px-4 rounded-full text-[13px] font-semibold", tab === k ? "bg-[#16141D] text-white" : "text-[#4A4658]")}>{l}</button>
        ))}
      </div>

      {tab === "contracts" ? (
        <>
          {total > 0 && (
            <div className={cn("bg-white rounded-[20px] p-4 mb-4", CARD_SHADOW)}>
              <div className="flex items-center justify-between text-[13px] mb-2">
                <span className="font-semibold text-[#17151F]">{counts.signed ?? 0} of {total} signed</span>
                <span className="text-[#6B6680] tabular-nums">{signedPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#F1EFF6] overflow-hidden flex" role="img" aria-label={`${signedPct}% of contracts are signed`}>
                {(["signed", "viewed", "sent", "draft"] as const).map(k => (counts[k] ? <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS_META[k].dot }} /> : null))}
              </div>
            </div>
          )}
          <Chips<Filter> label="Filter by status" value={filter} onChange={setFilter} options={[
            { value: "all", label: "All", count: counts.all ?? 0 },
            ...(["draft", "sent", "viewed", "signed"] as const).map(k => ({ value: k as Filter, label: STATUS_META[k].label, count: counts[k] ?? 0, dot: STATUS_META[k].dot })),
          ]} />

          {rows === null ? <RowsSkeleton />
            : rows.length === 0 ? (
              <EmptyState icon={FileSignature} title={search || filter !== "all" ? "No contracts here" : "No contracts yet"}
                text={search || filter !== "all" ? "Try another search or filter." : "Make one from a program — the days, package and price fill in, and your client signs on their phone."}
                action={!search && filter === "all" ? <MainButton onClick={() => router.push("/contracts/new")} icon={Plus}>New contract</MainButton> : undefined} />
            ) : (
              <ul className={cn("bg-white rounded-[20px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
                {rows.map(c => {
                  const st = STATUS_META[c.status]; const ic = ICON[c.status];
                  return (
                    <li key={c.id} className="group flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[#FAF9FD] transition-colors">
                      <Link href={`/contracts/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <Tile icon={ic.icon} color={ic.color} size={40} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-semibold text-[#17151F] truncate">{c.title}</span>
                          <span className="block text-[12.5px] text-[#6B6680] truncate">
                            {clientFull(c.client)}{c.booking ? ` · ${c.booking.eventName || c.booking.bookingNumber}` : ""} · {c.contractNumber}
                          </span>
                          <span className="block sm:hidden text-[12px] text-[#9893A8] truncate mt-0.5">{activityLine(c)}</span>
                        </span>
                        <span className="hidden sm:block text-right flex-shrink-0 max-w-[230px]">
                          <span className="block text-[12.5px] text-[#6B6680] truncate">{activityLine(c)}</span>
                        </span>
                        <span className={cn("h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center flex-shrink-0", st.cls)}>{st.label}</span>
                      </Link>
                      <span className="flex items-center gap-0.5 flex-shrink-0">
                        <button type="button" onClick={() => copyLink(c)} aria-label={`Copy the link of ${c.title}`} title="Copy link" className="w-9 h-9 rounded-full text-[#6B6680] hover:bg-[#EEE8FD] hover:text-[#5B3FD0] flex items-center justify-center"><Copy className="w-4 h-4" /></button>
                        <button type="button" onClick={() => remove(c)} aria-label={`Delete ${c.title}`} title="Delete" className="hidden sm:flex w-9 h-9 rounded-full text-[#6B6680] hover:bg-[#FDECEF] hover:text-[#C2304F] items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1 mb-2">
            <Sparkles className="w-4 h-4 text-[#7D5CEF]" /><h2 className="text-[13px] font-bold text-[#4A4658]">Ready to use</h2>
            <span className="text-[12.5px] text-[#6B6680]">Use as is, or copy and make it yours</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-7">
            {(tpl?.starters ?? []).map(t => (
              <div key={t.id} className={cn("bg-white rounded-[20px] p-4", CARD_SHADOW)}>
                <div className="flex items-start gap-3">
                  <Tile icon={FileText} color="deep" size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-[#17151F]">{t.name} <span className="ml-1 text-[11px] font-bold text-[#5B3FD0] bg-[#EEE8FD] px-2 py-0.5 rounded-full align-middle">{t.category}</span></p>
                    <p className="text-[13px] text-[#6B6680] mt-0.5">{t.description} · {t.sections.length} sections</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => router.push(`/contracts/new?template=${t.id}`)} className="h-9 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold">Use</button>
                  <button type="button" onClick={() => setDrawer({ startFrom: t })} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" />Copy &amp; edit</button>
                </div>
              </div>
            ))}
            {!tpl && [0, 1, 2, 3].map(i => <div key={i} className="sp-skel h-[120px] rounded-[20px]" />)}
          </div>

          <div className="flex items-center gap-2 px-1 mb-2">
            <h2 className="text-[13px] font-bold text-[#4A4658] flex-1">Your templates{tpl?.custom.length ? ` · ${tpl.custom.length}` : ""}</h2>
            <button type="button" onClick={() => setDrawer({})} className="h-9 px-3.5 rounded-full bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />New template</button>
          </div>
          {tpl && tpl.custom.length === 0 ? (
            <EmptyState icon={FileText} title="No templates of your own yet" text="Have your own contract? Add it once and use it for every client." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {(tpl?.custom ?? []).map(t => (
                <div key={t.id} className={cn("bg-white rounded-[20px] p-4", CARD_SHADOW)}>
                  <div className="flex items-start gap-3">
                    <Tile icon={FileText} color="ink" size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-[#17151F] truncate">{t.name}</p>
                      <p className="text-[13px] text-[#6B6680] mt-0.5 line-clamp-2">{t.description || t.sections[0]?.text || ""}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => router.push(`/contracts/new?template=${t.id}`)} className="h-9 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold">Use</button>
                    <button type="button" onClick={() => setDrawer({ template: t })} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5"><PencilLine className="w-3.5 h-3.5" />Edit</button>
                    <button type="button" onClick={() => removeTpl(t)} aria-label={`Delete ${t.name}`} className="h-9 w-9 rounded-full text-[#C2304F] hover:bg-[#FDECEF] flex items-center justify-center ml-auto"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {drawer && <TemplateDrawer template={drawer.template} startFrom={drawer.startFrom} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); void loadTpl(); }} />}
    </div>
  );
}
