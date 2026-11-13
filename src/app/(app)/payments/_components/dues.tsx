"use client";

/**
 * Payments → Due: who owes the studio money, most overdue first.
 * Numbers on top (total due, overdue, coming up, clients), a filter, then one row per client.
 * Tap a client to see each program's total / paid / due with "Record payment" and a WhatsApp reminder.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Copy, ExternalLink, PenLine, MessageCircle, Plus, Search, Users, Wallet,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtDate, formatCurrency } from "@/lib/format";
import { waLink } from "@/lib/portal-session";
import { DUE_CATEGORY, dueReminderText, type PayTo } from "@/lib/due-reminder";
import { DueTemplateEditor, type DueTemplate } from "./due-template";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, Chips, EmptyState, Initial, RowsSkeleton, StatCard } from "@/components/ui/apple";

export type DueProgram = {
  id: string; number: string; name: string; date: string | null; status: string;
  total: number; paid: number; due: number; overdue: boolean;
};
export type DueClient = {
  id: string; name: string; firstName: string; phone: string | null;
  due: number; overdue: number; programs: DueProgram[]; lastPaidAt: string | null;
};
type Dues = {
  currency: string;
  payTo?: PayTo | null;
  totals: { due: number; overdue: number; upcoming: number; clients: number; programs: number };
  clients: DueClient[];
};
type Filter = "all" | "overdue" | "upcoming";

export function DuesView({ search, refreshKey, studioName, onRecord }: {
  search: string; refreshKey: number; studioName: string;
  onRecord: (p: DueProgram) => void;
}) {
  const [d, setD] = useState<Dues | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  // The studio's own reminder wording (WhatsApp template "due_reminder"); null = the default.
  const [tpl, setTpl] = useState<DueTemplate>(null);
  const [editingFor, setEditingFor] = useState<DueClient | null>(null);
  useEffect(() => {
    apiFetch(`${API}/wa-templates`).then(r => (r.ok ? r.json() : [])).then((list: { id: string; category: string; body: string; isActive: boolean }[]) => {
      const t = (Array.isArray(list) ? list : []).find(x => x.category === DUE_CATEGORY && x.isActive);
      setTpl(t ? { id: t.id, body: t.body } : null);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    apiFetch(`${API}/payments/dues`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((x: Dues) => { setD(x); setFailed(false); })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const cur = d?.currency;
  const m = (n: number) => formatCurrency(n, cur);

  const list = useMemo(() => {
    if (!d) return [];
    const q = search.trim().toLowerCase();
    return d.clients
      .map(c => ({
        ...c,
        programs: filter === "all" ? c.programs : c.programs.filter(p => (filter === "overdue" ? p.overdue : !p.overdue)),
      }))
      .filter(c => c.programs.length > 0)
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q) || c.programs.some(p => p.number.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)));
  }, [d, filter, search]);

  if (failed) return <EmptyState icon={AlertTriangle} title="Couldn't load what's due" text="Please try again in a moment." />;
  if (!d) return <RowsSkeleton n={6} />;

  const t = d.totals;
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <StatCard icon={Wallet} color="red" label="Total due" value={m(t.due)} sub={`${t.programs} program${t.programs === 1 ? "" : "s"}`} />
        <StatCard icon={AlertTriangle} color={t.overdue > 0 ? "red" : "green"} label="Overdue" value={m(t.overdue)} sub="Program done, not paid" />
        <StatCard icon={CalendarClock} color="violet" label="Coming up" value={m(t.upcoming)} sub="Programs not done yet" />
        <StatCard icon={Users} color="blue" label="Clients" value={String(t.clients)} sub="With money due" />
      </div>

      {t.clients === 0 ? (
        <EmptyState icon={CheckCircle2} title="No dues" text="Every booked program is fully paid." />
      ) : (
        <>
          <Chips<Filter> label="Show" value={filter} onChange={setFilter} options={[
            { value: "all", label: "All", count: t.clients },
            { value: "overdue", label: "Overdue", count: d.clients.filter(c => c.overdue > 0).length },
            { value: "upcoming", label: "Coming up", count: d.clients.filter(c => c.due > c.overdue).length },
          ]} />
          {list.length === 0 ? (
            <EmptyState icon={Search} title={search ? `Nobody matches "${search}"` : "Nothing here"} text={search ? "Try another name or number." : "Try another filter."} />
          ) : (
            <div className={cn("bg-white rounded-[20px] overflow-hidden divide-y divide-[#EEEBF4]", CARD_SHADOW)}>
              {list.map(c => (
                <ClientDue key={c.id} c={c} m={m} studioName={studioName} currency={cur} payTo={d.payTo} template={tpl?.body} open={open === c.id}
                  onToggle={() => setOpen(o => (o === c.id ? null : c.id))} onRecord={onRecord} onEditMessage={() => setEditingFor(c)} />
              ))}
            </div>
          )}
          {editingFor && (
            <DueTemplateEditor template={tpl} clientName={editingFor.name} onSaved={setTpl} onClose={() => setEditingFor(null)}
              preview={body => dueReminderText({ firstName: editingFor.firstName, clientName: editingFor.name, studio: studioName, currency: cur, payTo: d.payTo, programs: editingFor.programs, template: body })} />
          )}
        </>
      )}
    </div>
  );
}

function ClientDue({ c, m, studioName, currency, payTo, template, open, onToggle, onRecord, onEditMessage }: {
  c: DueClient; m: (n: number) => string; studioName: string; currency?: string; payTo?: PayTo | null; template?: string | null; open: boolean;
  onToggle: () => void; onRecord: (p: DueProgram) => void; onEditMessage: () => void;
}) {
  const due = c.programs.reduce((s, p) => s + p.due, 0);
  const overdue = c.programs.filter(p => p.overdue).reduce((s, p) => s + p.due, 0);
  // The reminder covers the programs shown (the filter decides: all, overdue or coming up).
  const text = dueReminderText({ firstName: c.firstName, clientName: c.name, studio: studioName, currency, payTo, programs: c.programs, template });
  const wa = waLink(c.phone, text);
  const copy = () => navigator.clipboard.writeText(text).then(() => notify("Message copied"), () => notify("Couldn't copy", { error: true }));

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 min-h-[68px] text-left hover:bg-[#F7F5FB] transition-colors">
        <Initial name={c.name} size={40} />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-[#17151F] truncate">{c.name}</span>
          <span className="block text-[12.5px] text-[#6B6680] truncate">
            {c.programs.length} program{c.programs.length === 1 ? "" : "s"}{c.lastPaidAt ? ` · last paid ${fmtDate(c.lastPaidAt)}` : " · no payment yet"}
          </span>
        </span>
        <span className="text-right flex-shrink-0">
          <span className="block text-[15px] font-extrabold text-[#C2304F] tabular-nums">{m(due)}</span>
          {overdue > 0
            ? <span className="block text-[12px] font-semibold text-[#9A5B00] tabular-nums">{m(overdue)} overdue</span>
            : <span className="block text-[12px] text-[#6B6680]">due</span>}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-[#B5B0C4] flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-4 bg-[#FBFAFD] border-t border-[#F2EFF8]">
          <ul className="pt-3 space-y-2.5">
            {c.programs.map(p => {
              const pct = p.total > 0 ? Math.min(100, (p.paid / p.total) * 100) : 0;
              return (
                <li key={p.id} className="bg-white rounded-[16px] border border-[#EEEBF4] p-3.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-[#17151F] truncate">{p.name}</p>
                      <p className="text-[12px] text-[#6B6680] tabular-nums">{p.number} · {p.date ? fmtDate(p.date) : "No date"}</p>
                    </div>
                    {p.overdue
                      ? <span className="h-6 px-2.5 rounded-full bg-[#FFF3E0] text-[#9A5B00] text-[11.5px] font-bold inline-flex items-center flex-shrink-0">Overdue</span>
                      : <span className="h-6 px-2.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[11.5px] font-bold inline-flex items-center flex-shrink-0">Coming up</span>}
                  </div>
                  <div className="mt-2.5 h-1.5 bg-[#F1EFF6] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#8E72F2] to-[#5B3FD0]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[12.5px] tabular-nums">
                    <span className="text-[#6B6680]">{m(p.total)} total · <span className="text-[#1F8A5B] font-semibold">{m(p.paid)} paid</span></span>
                    <span className="font-bold text-[#C2304F]">{m(p.due)} due</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onRecord(p)}
                      className="h-9 px-3.5 rounded-full bg-[#1F8A5B] hover:bg-[#18724A] text-white text-[13px] font-semibold inline-flex items-center gap-1.5">
                      <Plus className="w-4 h-4" />Record payment
                    </button>
                    <Link href={`/programs/${p.id}?tab=money`}
                      className="h-9 px-3.5 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />Open program
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="h-9 px-3.5 rounded-full bg-white border border-[#CDEBDB] text-[#14613F] hover:bg-[#F1FAF5] text-[13px] font-semibold inline-flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />Remind on WhatsApp
              </a>
            )}
            <button type="button" onClick={copy}
              className="h-9 px-3.5 rounded-full bg-white border border-[#E3DFEC] text-[#17151F] hover:bg-[#F5F3FA] text-[13px] font-semibold inline-flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5" />Copy message
            </button>
            <button type="button" onClick={onEditMessage}
              className="h-9 px-3.5 rounded-full bg-white border border-[#E3DFEC] text-[#17151F] hover:bg-[#F5F3FA] text-[13px] font-semibold inline-flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" />Edit message
            </button>
            <Link href={`/clients/${c.id}`}
              className="h-9 px-3.5 rounded-full bg-white border border-[#E3DFEC] text-[#17151F] hover:bg-[#F5F3FA] text-[13px] font-semibold inline-flex items-center gap-1.5">
              Open client
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
