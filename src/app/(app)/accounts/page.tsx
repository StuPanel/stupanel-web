"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, History, Landmark, Loader2, Pencil, Plus,
  Smartphone, Star, Trash2, Wallet, X,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate, localDateStr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { EditableSelect } from "@/components/ui/editable-select";
import { Chips, EmptyState, Group, PageHeader, Pager, RowsSkeleton, SearchField, StatCard, Tile } from "@/components/ui/apple";

const TYPES = [
  { key: "cash", label: "Cash", tile: "green", icon: Banknote },
  { key: "bkash", label: "bKash", tile: "orchid", icon: Smartphone },
  { key: "nagad", label: "Nagad", tile: "red", icon: Smartphone },
  { key: "rocket", label: "Rocket", tile: "deep", icon: Smartphone },
  { key: "bank", label: "Bank", tile: "blue", icon: Landmark },
  { key: "other", label: "Other", tile: "ink", icon: Wallet },
] as const;
const TYPE = Object.fromEntries(TYPES.map(t => [t.key, t])) as Record<string, (typeof TYPES)[number]>;

const SOURCE: Record<string, string> = {
  client_payment: "Client payment", other_income: "Other income", expense: "Expense", team_payment: "Team pay",
  salary: "Salary", refund: "Refund", transfer_in: "Transfer in", transfer_out: "Transfer out",
};
const EXPENSE_CATS = ["transport", "food", "equipment", "rent", "utilities", "marketing", "printing", "album", "internet", "bank_charge", "misc"];
const INCOME_CATS = ["equipment_rent", "print_sale", "album_sale", "other"];
const label = (s?: string | null) => (s ?? "").replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const money = (n: number) => formatCurrency(Math.round(n * 100) / 100);

interface Account {
  id: string; name: string; type: string; accountNumber?: string | null; bankName?: string | null; branch?: string | null;
  openingBalance: number; balance: number; isDefault: boolean; isActive: boolean;
}
interface Line {
  id: string; direction: "in" | "out"; amount: number; date: string; description: string; category?: string | null;
  sourceType?: string | null; bookingId?: string | null; transferId?: string | null; account: { id: string; name: string; type: string };
  createdBy?: string | null; edited: boolean; balanceAfter: number | null; editable: boolean;
}
type Drawer =
  | { kind: "account"; account?: Account }
  | { kind: "entry"; dir: "income" | "expense"; line?: Line }
  | { kind: "transfer" }
  | null;

const inputCls = "w-full h-11 px-3.5 rounded-2xl border border-[#E7E3F0] bg-white text-[15px] text-[#17151F] placeholder:text-[#A29DB3] focus:outline-none focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/10";
function Field({ label: l, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return <label className="block"><span className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">{l}</span>{children}{hint && <span className="block text-xs text-[#6B6680] mt-1">{hint}</span>}</label>;
}

function AccountsInner() {
  const q = useSearchParams();
  const [data, setData] = useState<{ accounts: Account[]; total: number; thisMonth: { in: number; out: number } } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [totals, setTotals] = useState({ in: 0, out: 0 });
  const [loadingLines, setLoadingLines] = useState(true);
  const [accountId, setAccountId] = useState<string>("");
  const [dir, setDir] = useState<"all" | "in" | "out">(q.get("tab") === "out" ? "out" : "all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [drawer, setDrawer] = useState<Drawer>(null);

  const loadAccounts = useCallback(async () => {
    const r = await apiFetch(`${API}/accounts`);
    if (r.ok) setData(await r.json());
  }, []);
  const loadLines = useCallback(async (p = 1) => {
    setLoadingLines(true);
    const qs = new URLSearchParams({ page: String(p) });
    if (accountId) qs.set("accountId", accountId);
    if (dir !== "all") qs.set("direction", dir);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (search.trim()) qs.set("search", search.trim());
    const r = await apiFetch(`${API}/accounts/transactions?${qs}`);
    if (r.ok) { const d = await r.json(); setLines(d.data); setTotals(d.totals); setPages(d.meta.totalPages); setPage(p); }
    setLoadingLines(false);
  }, [accountId, dir, from, to, search]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { const t = setTimeout(() => loadLines(1), search ? 300 : 0); return () => clearTimeout(t); }, [loadLines, search]);
  const reload = () => { loadAccounts(); loadLines(page); };

  const active = useMemo(() => (data?.accounts ?? []).filter(a => a.isActive), [data]);
  const sel = data?.accounts.find(a => a.id === accountId);

  async function removeLine(l: Line) {
    if (!(await askConfirm({ title: l.transferId ? "Delete this transfer?" : "Delete this entry?", message: l.transferId ? "Both sides of the transfer will be removed. The change is kept in the history." : `${l.description} · ${money(l.amount)}. The change is kept in the history.`, danger: true, confirmLabel: "Delete" }))) return;
    const r = await apiFetch(`${API}/accounts/transactions/${l.id}`, { method: "DELETE" });
    if (!r.ok) { const b = await r.json().catch(() => ({})); notify(b.message || "Could not delete", { error: true }); return; }
    notify("Deleted"); reload();
  }

  return (
    <div>
      <PageHeader icon={Landmark} color="blue" title="Accounts" sub="Cash, bKash, bank — where every taka is">
        <button onClick={() => setDrawer({ kind: "entry", dir: "income" })} className="h-10 px-4 rounded-full bg-white text-[14px] font-semibold text-[#1F8A5B] inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]"><ArrowDownLeft className="w-4 h-4" />Money in</button>
        <button onClick={() => setDrawer({ kind: "entry", dir: "expense" })} className="h-10 px-4 rounded-full bg-white text-[14px] font-semibold text-[#C2304F] inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]"><ArrowUpRight className="w-4 h-4" />Expense</button>
        <button onClick={() => setDrawer({ kind: "transfer" })} disabled={active.length < 2} className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] text-white text-[14px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><ArrowLeftRight className="w-4 h-4" />Transfer</button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard icon={Landmark} color="blue" label="Money in all accounts" value={data ? money(data.total) : "…"} />
        <StatCard icon={ArrowDownLeft} color="green" label="In this month" value={data ? money(data.thisMonth.in) : "…"} />
        <StatCard icon={ArrowUpRight} color="red" label="Out this month" value={data ? money(data.thisMonth.out) : "…"} />
      </div>

      <Group title="Your accounts" action={<button onClick={() => setDrawer({ kind: "account" })} className="text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1"><Plus className="w-4 h-4" />Add account</button>}>
        {!data ? <RowsSkeleton n={2} /> : data.accounts.map(a => {
          const t = TYPE[a.type] ?? TYPE.other;
          const on = accountId === a.id;
          return (
            <div key={a.id} className={cn("flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-colors", on ? "bg-[#EEE8FD]" : "hover:bg-[#F7F5FB]", !a.isActive && "opacity-55")}>
              <button onClick={() => setAccountId(on ? "" : a.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Tile icon={t.icon} color={t.tile} size={36} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[#17151F] truncate">{a.name}{a.isDefault && <Star className="w-3.5 h-3.5 text-[#7D5CEF] fill-[#7D5CEF]" aria-label="Main account" />}{!a.isActive && <span className="text-[11px] font-normal text-[#6B6680]">· off</span>}</span>
                  <span className="block text-xs text-[#6B6680] truncate">{t.label}{a.accountNumber ? ` · ${a.accountNumber}` : ""}{a.bankName ? ` · ${a.bankName}${a.branch ? `, ${a.branch}` : ""}` : ""}</span>
                </span>
              </button>
              <span className={cn("text-[16px] font-bold tabular-nums", a.balance < 0 ? "text-[#C2304F]" : "text-[#17151F]")}>{money(a.balance)}</span>
              <button onClick={() => setDrawer({ kind: "account", account: a })} aria-label={`Edit ${a.name}`} className="p-2 rounded-full text-[#6B6680] hover:bg-white"><Pencil className="w-4 h-4" /></button>
            </div>
          );
        })}
      </Group>

      <div className="mt-6 mb-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <Chips label="Show" value={dir} onChange={setDir} options={[{ value: "all", label: "All" }, { value: "in", label: "Money in" }, { value: "out", label: "Money out" }]} />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} aria-label="From date" className="h-10 px-3 rounded-full border border-[#E7E3F0] bg-white text-sm" />
          <span className="text-[#A29DB3] text-sm">to</span>
          <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} aria-label="To date" className="h-10 px-3 rounded-full border border-[#E7E3F0] bg-white text-sm" />
          <SearchField value={search} onChange={setSearch} placeholder="Search entries" className="w-full sm:w-56" />
        </div>
      </div>

      <Group title={sel ? `${sel.name} — statement` : "All money in & out"}
        note={<span className="tabular-nums">In <b className="text-[#1F8A5B]">{money(totals.in)}</b> · Out <b className="text-[#C2304F]">{money(totals.out)}</b>{sel && <> · Opening {money(sel.openingBalance)}</>}</span>}
        action={sel ? <button onClick={() => setAccountId("")} className="text-[13px] font-semibold text-[#5B3FD0]">Show all</button> : undefined}>
        {loadingLines ? <RowsSkeleton n={4} /> : lines.length === 0 ? (
          <EmptyState icon={Wallet} title="Nothing here yet" text="Client payments, expenses, team pay and transfers show up here." />
        ) : lines.map(l => (
          <div key={l.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
            <span className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0", l.direction === "in" ? "bg-[#E9F5EF] text-[#1F8A5B]" : "bg-[#FDECEF] text-[#C2304F]")}>
              {l.sourceType?.startsWith("transfer") ? <ArrowLeftRight className="w-4 h-4" /> : l.direction === "in" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#17151F] truncate">{l.description}</p>
              <p className="text-xs text-[#6B6680] truncate">
                {fmtDate(l.date)} · {l.account.name} · {SOURCE[l.sourceType ?? ""] ?? "Entry"}{l.category ? ` · ${label(l.category)}` : ""}{l.createdBy ? ` · by ${l.createdBy}` : ""}
                {l.edited && <span className="inline-flex items-center gap-0.5 ml-1 text-[#9E3A8C]"><History className="w-3 h-3" />edited</span>}
                {l.bookingId && <> · <Link href={`/programs?view=${l.bookingId}`} className="text-[#5B3FD0] font-semibold">Program</Link></>}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={cn("text-[15px] font-bold tabular-nums", l.direction === "in" ? "text-[#1F8A5B]" : "text-[#C2304F]")}>{l.direction === "in" ? "+" : "−"} {money(l.amount)}</p>
              {l.balanceAfter !== null && <p className="text-[11px] text-[#6B6680] tabular-nums">Balance {money(l.balanceAfter)}</p>}
            </div>
            {(l.editable || l.transferId) && (
              <div className="flex">
                {l.editable && !l.transferId && <button onClick={() => setDrawer({ kind: "entry", dir: l.direction === "in" ? "income" : "expense", line: l })} aria-label="Edit entry" className="p-2 rounded-full text-[#6B6680] hover:bg-[#F5F3FA]"><Pencil className="w-4 h-4" /></button>}
                <button onClick={() => removeLine(l)} aria-label="Delete entry" className="p-2 rounded-full text-[#6B6680] hover:text-[#C2304F] hover:bg-[#FDECEF]"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        ))}
      </Group>
      <div className="mt-4"><Pager page={page} pages={pages} onChange={p => loadLines(p)} /></div>

      {drawer && <DrawerShell onClose={() => setDrawer(null)}>
        {drawer.kind === "account" && <AccountForm account={drawer.account} onDone={() => { setDrawer(null); reload(); }} />}
        {drawer.kind === "entry" && <EntryForm dir={drawer.dir} line={drawer.line} accounts={active} onDone={() => { setDrawer(null); reload(); }} />}
        {drawer.kind === "transfer" && <TransferForm accounts={active} onDone={() => { setDrawer(null); reload(); }} />}
      </DrawerShell>}
    </div>
  );
}

function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sp-backdrop z-50" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="sp-drawer pointer-events-auto sm:max-w-md flex flex-col overflow-y-auto bg-[#F5F3FA]">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#6B6680] z-10"><X className="w-4 h-4" /></button>
        {children}
      </div>
    </div>
  );
}

function FormHead({ icon, color, title, sub }: { icon: React.ElementType; color: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-6 pt-6 pb-4 pr-16">
      <Tile icon={icon} color={color} size={40} />
      <div><h2 className="text-[19px] font-extrabold text-[#17151F]">{title}</h2>{sub && <p className="text-[13px] text-[#6B6680]">{sub}</p>}</div>
    </div>
  );
}
function SaveBar({ saving, label: l, disabled, onClick }: { saving: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="mt-auto sticky bottom-0 px-6 py-4 bg-[#F5F3FA]/95 backdrop-blur border-t border-[#EEEBF4]">
      <button onClick={onClick} disabled={saving || disabled} className="w-full h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}{l}
      </button>
    </div>
  );
}

function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const [f, setF] = useState({
    name: account?.name ?? "", type: account?.type ?? "bkash", accountNumber: account?.accountNumber ?? "",
    bankName: account?.bankName ?? "", branch: account?.branch ?? "", openingBalance: account ? String(account.openingBalance) : "",
    isDefault: account?.isDefault ?? false, isActive: account?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const body = { ...f, name: f.name.trim(), openingBalance: Number(f.openingBalance) || 0 };
    const r = await apiFetch(`${API}/accounts${account ? `/${account.id}` : ""}`, { method: account ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(account ? body : { ...body, isActive: undefined }) });
    setSaving(false);
    if (!r.ok) { const b = await r.json().catch(() => ({})); notify(Array.isArray(b.message) ? b.message[0] : b.message || "Could not save", { error: true }); return; }
    notify(account ? "Account saved" : "Account added"); onDone();
  }
  async function archive() {
    if (!account || !(await askConfirm({ title: `Remove ${account.name}?`, message: "Only possible when the balance is 0. Its history is kept.", danger: true, confirmLabel: "Remove" }))) return;
    const r = await apiFetch(`${API}/accounts/${account.id}/archive`, { method: "POST" });
    if (!r.ok) { const b = await r.json().catch(() => ({})); notify(b.message || "Could not remove", { error: true }); return; }
    notify("Account removed"); onDone();
  }
  return (
    <>
      <FormHead icon={TYPE[f.type]?.icon ?? Wallet} color={TYPE[f.type]?.tile ?? "ink"} title={account ? "Edit account" : "New account"} sub="Cash box, mobile wallet or bank account" />
      <div className="px-6 pb-6 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(t => (
            <button key={t.key} type="button" onClick={() => setF({ ...f, type: t.key })}
              className={cn("h-16 rounded-2xl bg-white flex flex-col items-center justify-center gap-1 text-[13px] font-semibold border-2 transition-colors", f.type === t.key ? "border-[#7D5CEF] text-[#5B3FD0]" : "border-transparent text-[#4A4658]")}>
              <Tile icon={t.icon} color={t.tile} size={22} />{t.label}
            </button>
          ))}
        </div>
        <Field label="Name"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder={f.type === "bank" ? "e.g. DBBL — Studio" : f.type === "cash" ? "e.g. Studio Cash" : "e.g. bKash Merchant"} className={inputCls} /></Field>
        {f.type !== "cash" && <Field label={f.type === "bank" ? "Account number" : "Number"}><input value={f.accountNumber} onChange={e => setF({ ...f, accountNumber: e.target.value })} inputMode="numeric" className={inputCls} /></Field>}
        {f.type === "bank" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank"><input value={f.bankName} onChange={e => setF({ ...f, bankName: e.target.value })} className={inputCls} /></Field>
            <Field label="Branch"><input value={f.branch} onChange={e => setF({ ...f, branch: e.target.value })} className={inputCls} /></Field>
          </div>
        )}
        <Field label="Money already in it (opening balance)" hint="What this account had before you started using StuPanel."><input value={f.openingBalance} onChange={e => setF({ ...f, openingBalance: e.target.value.replace(/[^\d.-]/g, "") })} inputMode="decimal" placeholder="0" className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-[14px] text-[#4A4658]"><input type="checkbox" checked={f.isDefault} onChange={e => setF({ ...f, isDefault: e.target.checked })} className="accent-[#7D5CEF] w-4 h-4" />Main account (picked first)</label>
        {account && !account.isDefault && <label className="flex items-center gap-2 text-[14px] text-[#4A4658]"><input type="checkbox" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} className="accent-[#7D5CEF] w-4 h-4" />In use (turn off to hide it from pickers)</label>}
        {account && !account.isDefault && <button type="button" onClick={archive} className="text-[13px] font-semibold text-[#C2304F]">Remove this account</button>}
      </div>
      <SaveBar saving={saving} disabled={f.name.trim().length < 2} label={account ? "Save" : "Add account"} onClick={save} />
    </>
  );
}

function EntryForm({ dir, line, accounts, onDone }: { dir: "income" | "expense"; line?: Line; accounts: Account[]; onDone: () => void }) {
  const def = accounts.find(a => a.isDefault) ?? accounts[0];
  const [f, setF] = useState({
    walletId: line?.account.id ?? def?.id ?? "", amount: line ? String(line.amount) : "", date: line ? line.date.slice(0, 10) : localDateStr(),
    description: line?.description ?? "", category: line?.category ?? (dir === "expense" ? "misc" : "other"),
  });
  const [saving, setSaving] = useState(false);
  const acc = accounts.find(a => a.id === f.walletId);
  const amt = Number(f.amount) || 0;
  const goesNegative = dir === "expense" && acc && acc.balance + (line && line.account.id === acc.id ? line.amount : 0) - amt < 0;
  async function save() {
    setSaving(true);
    const body = { walletId: f.walletId, amount: amt, date: new Date(`${f.date}T12:00:00+06:00`).toISOString(), description: f.description.trim(), category: f.category || undefined };
    const r = await apiFetch(`${API}/accounts/transactions${line ? `/${line.id}` : ""}`, { method: line ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(line ? body : { ...body, kind: dir }) });
    setSaving(false);
    if (!r.ok) { const b = await r.json().catch(() => ({})); notify(Array.isArray(b.message) ? b.message[0] : b.message || "Could not save", { error: true }); return; }
    notify(line ? "Saved — the change is kept in the history" : dir === "expense" ? "Expense saved" : "Money in saved"); onDone();
  }
  return (
    <>
      <FormHead icon={dir === "expense" ? ArrowUpRight : ArrowDownLeft} color={dir === "expense" ? "red" : "green"} title={line ? "Edit entry" : dir === "expense" ? "New expense" : "Other money in"} sub={dir === "expense" ? "Rent, transport, printing…" : "Not from a program — e.g. gear rent, print sale"} />
      <div className="px-6 pb-6 space-y-4">
        <Field label="Amount"><input value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="0" autoFocus className={cn(inputCls, "text-[22px] font-bold h-14")} /></Field>
        <Field label={dir === "expense" ? "Paid from" : "Received in"}>
          <select value={f.walletId} onChange={e => setF({ ...f, walletId: e.target.value })} className={inputCls}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {money(a.balance)}</option>)}
          </select>
        </Field>
        {goesNegative && <p className="flex items-center gap-1.5 text-[13px] text-[#9E3A8C] bg-[#FBF2FA] rounded-xl px-3 py-2"><AlertTriangle className="w-4 h-4" />{acc?.name} will go below zero. You can still save.</p>}
        <Field label="What for"><input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder={dir === "expense" ? "e.g. Office rent — November" : "e.g. Drone rent to Rahim"} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <EditableSelect value={f.category} onChange={v => setF({ ...f, category: v })} options={(dir === "expense" ? EXPENSE_CATS : INCOME_CATS).map(c => ({ value: c, label: label(c) }))} />
          </Field>
          <Field label="Date"><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
        </div>
      </div>
      <SaveBar saving={saving} disabled={!f.walletId || amt <= 0 || !f.description.trim()} label={line ? "Save" : dir === "expense" ? `Save expense${amt ? ` · ${money(amt)}` : ""}` : `Save${amt ? ` · ${money(amt)}` : ""}`} onClick={save} />
    </>
  );
}

function TransferForm({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [f, setF] = useState({ fromId: accounts[0]?.id ?? "", toId: accounts[1]?.id ?? "", amount: "", fee: "", date: localDateStr(), note: "" });
  const [saving, setSaving] = useState(false);
  const from = accounts.find(a => a.id === f.fromId);
  const amt = Number(f.amount) || 0;
  const fee = Number(f.fee) || 0;
  async function save() {
    setSaving(true);
    const r = await apiFetch(`${API}/accounts/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromId: f.fromId, toId: f.toId, amount: amt, fee: fee || undefined, note: f.note.trim() || undefined, date: new Date(`${f.date}T12:00:00+06:00`).toISOString() }) });
    setSaving(false);
    if (!r.ok) { const b = await r.json().catch(() => ({})); notify(Array.isArray(b.message) ? b.message[0] : b.message || "Could not move", { error: true }); return; }
    notify("Money moved"); onDone();
  }
  return (
    <>
      <FormHead icon={ArrowLeftRight} color="violet" title="Move money" sub="e.g. bKash cash-out, cash to bank" />
      <div className="px-6 pb-6 space-y-4">
        <Field label="From"><select value={f.fromId} onChange={e => setF({ ...f, fromId: e.target.value })} className={inputCls}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {money(a.balance)}</option>)}</select></Field>
        <Field label="To"><select value={f.toId} onChange={e => setF({ ...f, toId: e.target.value })} className={inputCls}>{accounts.filter(a => a.id !== f.fromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount"><input value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="0" className={inputCls} /></Field>
          <Field label="Charge (optional)" hint="e.g. cash-out fee"><input value={f.fee} onChange={e => setF({ ...f, fee: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="0" className={inputCls} /></Field>
        </div>
        {from && from.balance - amt - fee < 0 && <p className="flex items-center gap-1.5 text-[13px] text-[#9E3A8C] bg-[#FBF2FA] rounded-xl px-3 py-2"><AlertTriangle className="w-4 h-4" />{from.name} will go below zero. You can still save.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
          <Field label="Note (optional)"><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} className={inputCls} /></Field>
        </div>
      </div>
      <SaveBar saving={saving} disabled={!f.fromId || !f.toId || f.fromId === f.toId || amt <= 0} label={`Move${amt ? ` ${money(amt)}` : ""}`} onClick={save} />
    </>
  );
}

export default function AccountsPage() {
  return <Suspense><AccountsInner /></Suspense>;
}
