"use client";

import { Wallet as HeaderIcon } from "lucide-react";
import { EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, StatCard, Tile } from "@/components/ui/apple";
import { PillSelect } from "@/components/ui/pill-select";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet, Plus, Loader2, X, CheckCircle2, AlertCircle, Trash2,
  ArrowUpRight, ArrowDownRight, ChevronRight, Settings2, TrendingUp, Banknote, Smartphone, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate, localDateStr } from "@/lib/format";
import { EditableSelect } from "@/components/ui/editable-select";
import { askConfirm } from "@/components/feedback";


const WALLET_TYPES = [
  { key: "cash",   label: "Cash",   tile: "green",  icon: Banknote },
  { key: "bkash",  label: "bKash",  tile: "orchid", icon: Smartphone },
  { key: "nagad",  label: "Nagad",  tile: "red",    icon: Smartphone },
  { key: "rocket", label: "Rocket", tile: "deep",   icon: Smartphone },
  { key: "bank",   label: "Bank",   tile: "blue",   icon: Landmark },
  { key: "other",  label: "Other",  tile: "ink",    icon: Wallet },
];
const WALLET_MAP = Object.fromEntries(WALLET_TYPES.map(w => [w.key, w]));

const TX_CATS = ["food", "transport", "equipment", "salary", "marketing", "rent", "utilities", "misc"];

function fmt(n: number, currency = "BDT") { return formatCurrency(Math.round(Math.abs(n)), currency); }

interface WalletData { id: string; name: string; type: string; balance: number; totalCredit: number; totalDebit: number; }
interface TxData { id: string; type: string; amount: number; description: string; category?: string; date: string; bookingId?: string; }
interface Summary { totalBalance: number; walletCount: number; thisMonthIncome: number; thisMonthExpense: number; }

export default function ExpensesPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [selWallet, setSelWallet] = useState<WalletData | null>(null);
  const [txs, setTxs] = useState<TxData[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [walletModal, setWalletModal] = useState(false);
  const [txModal, setTxModal] = useState(false);
  const [walletForm, setWalletForm] = useState({ name: "", type: "cash", balance: "" });
  const [txForm, setTxForm] = useState({ type: "debit", amount: "", description: "", category: "misc", date: localDateStr() });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [txFilter, setTxFilter] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    const [s, w] = await Promise.all([
      apiFetch(`${API}/wallets/summary`).then(r => r.ok ? r.json() : null),
      apiFetch(`${API}/wallets`).then(r => r.ok ? r.json() : []),
    ]);
    setSummary(s);
    const ws = Array.isArray(w) ? w : [];
    setWallets(ws);
    if (!selWallet && ws.length > 0) setSelWallet(ws[0]);
    setLoading(false);
  }, []);

  const loadTxs = useCallback(async () => {
    if (!selWallet) return;
    setTxLoading(true);
    const r = await apiFetch(`${API}/wallets/${selWallet.id}/transactions?page=${txPage}${txFilter ? "&type=" + txFilter : ""}`, { headers: { "Content-Type": "application/json" } });
    if (r.ok) {
      const d = await r.json();
      setTxs(d.items ?? []);
      setTxTotal(d.total ?? 0);
    }
    setTxLoading(false);
  }, [selWallet, txPage, txFilter]);

  useEffect(() => { loadWallets(); }, [loadWallets]);
  useEffect(() => { loadTxs(); }, [loadTxs]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  async function createWallet() {
    if (!walletForm.name.trim()) return;
    setSaving(true);
    const r = await apiFetch(`${API}/wallets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: walletForm.name, type: walletForm.type, balance: Number(walletForm.balance) || 0 }),
    });
    if (r.ok) { setToast({ msg: "Wallet created!", ok: true }); setWalletModal(false); loadWallets(); }
    else setToast({ msg: "Failed.", ok: false });
    setSaving(false);
  }

  async function addTx() {
    if (!txForm.amount || !txForm.description || !selWallet) return;
    setSaving(true);
    const r = await apiFetch(`${API}/wallets/${selWallet.id}/transactions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...txForm, amount: Number(txForm.amount) }),
    });
    if (r.ok) { setToast({ msg: "Transaction added!", ok: true }); setTxModal(false); loadWallets(); loadTxs(); setTxForm({ type: "debit", amount: "", description: "", category: "misc", date: localDateStr() }); }
    else setToast({ msg: "Failed.", ok: false });
    setSaving(false);
  }

  async function deleteTx(txId: string) {
    if (!selWallet) return;
    const r = await apiFetch(`${API}/wallets/${selWallet.id}/transactions/${txId}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { loadWallets(); loadTxs(); }
  }

  async function deleteWallet(id: string) {
    if (!(await askConfirm({ message: "Delete this wallet?", danger: true }))) return;
    const r = await apiFetch(`${API}/wallets/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { if (selWallet?.id === id) setSelWallet(null); loadWallets(); }
  }

  const setW = (k: string) => (e: React.ChangeEvent<any>) => setWalletForm(p => ({ ...p, [k]: e.target.value }));
  const setT = (k: string) => (e: React.ChangeEvent<any>) => setTxForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {toast && (
        <div className={cn("sp-toast",
          toast.ok ? "" : "sp-toast--err")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <PageHeader icon={HeaderIcon} color="red" title="Expenses & Wallets" sub={<>Cash, bKash, bank — money in and out</>}>
        <MainButton icon={Plus} onClick={() => setWalletModal(true)}>Add wallet</MainButton>
      </PageHeader>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
          <StatCard icon={Wallet} color="violet" label="Total balance" value={fmt(summary.totalBalance)} />
          <StatCard icon={ArrowUpRight} color="green" label="In this month" value={fmt(summary.thisMonthIncome)} />
          <StatCard icon={ArrowDownRight} color="red" label="Out this month" value={fmt(summary.thisMonthExpense)} />
          <StatCard icon={Landmark} color="blue" label="Wallets" value={String(summary.walletCount ?? wallets.length)} />
        </div>
      )}

      {loading ? (
        <RowsSkeleton n={4} />
      ) : wallets.length === 0 ? (
        <EmptyState icon={Wallet} title="No wallets yet" text="Add Cash, bKash or bank accounts to track money in and out."
          action={<MainButton icon={Plus} onClick={() => setWalletModal(true)}>Add wallet</MainButton>} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-5">
          <div className="lg:col-span-1">
            <Group title="Wallets">
              {wallets.map(w => {
                const wt = WALLET_MAP[w.type] ?? WALLET_MAP.other;
                const isSelected = selWallet?.id === w.id;
                return (
                  <div key={w.id} role="button" tabIndex={0}
                    onClick={() => { setSelWallet(w); setTxPage(1); }} onKeyDown={e => { if (e.key === "Enter") { setSelWallet(w); setTxPage(1); } }}
                    className={cn("flex items-center gap-3 px-4 py-3 min-h-[64px] cursor-pointer transition-colors", isSelected ? "bg-[#EEE8FD]" : "hover:bg-[#F7F5FB]")}>
                    <Tile icon={wt.icon} color={wt.tile} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", isSelected ? "font-bold text-[#5B3FD0]" : "font-semibold text-[#17151F]")}>{w.name}</p>
                      <p className="text-xs text-[#6B6680]">{wt.label}</p>
                    </div>
                    <p className={cn("text-sm font-bold tabular-nums flex-shrink-0", Number(w.balance) >= 0 ? "text-[#17151F]" : "text-[#C2304F]")}>{fmt(Number(w.balance))}</p>
                    <button onClick={e => { e.stopPropagation(); deleteWallet(w.id); }} aria-label={`Remove ${w.name}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#9893A8] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
            </Group>
          </div>

          <div className="lg:col-span-2">
            {!selWallet ? (
              <EmptyState icon={Wallet} title="Pick a wallet" text="Its money in and out will show here." />
            ) : (
              <Group title={<>{selWallet.name} · <span className="text-[#17151F]">{fmt(Number(selWallet.balance))}</span></>}
                action={
                  <div className="flex items-center gap-2">
                    <PillSelect small label="Show" value={txFilter || "all"} onChange={v => { setTxFilter(v === "all" ? "" : v); setTxPage(1); }}
                      options={[{ value: "all", label: "All" }, { value: "credit", label: "Money in" }, { value: "debit", label: "Money out" }]} />
                    <button onClick={() => setTxModal(true)}
                      className="h-8 px-3 rounded-full bg-[#16141D] text-white text-xs font-semibold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add</button>
                  </div>
                }>
                {txLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>
                ) : txs.length === 0 ? (
                  <div className="text-center py-12 text-sm text-[#6B6680]">Nothing recorded yet</div>
                ) : txs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[60px] hover:bg-[#F7F5FB] group transition-colors">
                    <Tile icon={tx.type === "credit" ? ArrowUpRight : ArrowDownRight} color={tx.type === "credit" ? "green" : "red"} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#17151F] truncate">{tx.description}</p>
                      <p className="text-xs text-[#6B6680] truncate mt-0.5">
                        {tx.category && <span className="capitalize">{tx.category} · </span>}{fmtDate(tx.date)}
                      </p>
                    </div>
                    <span className={cn("text-sm font-bold tabular-nums flex-shrink-0", tx.type === "credit" ? "text-[#1F8A5B]" : "text-[#C2304F]")}>
                      {tx.type === "credit" ? "+" : "−"}{fmt(Number(tx.amount))}
                    </span>
                    <button onClick={() => deleteTx(tx.id)} aria-label="Delete"
                      className="sm:opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full flex items-center justify-center text-[#9893A8] hover:bg-[#FDECEF] hover:text-[#C2304F] transition-all flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </Group>
            )}
            {selWallet && txTotal > 20 && <Pager page={txPage} pages={Math.ceil(txTotal / 20)} onChange={setTxPage} />}
          </div>
        </div>
      )}

      {/* Create Wallet Modal */}
      {walletModal && (
        <div className="sp-backdrop z-50" onClick={e => { if (e.target === e.currentTarget) setWalletModal(false); }}>
          <div className="sp-drawer pointer-events-auto sm:max-w-md flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Add Wallet</h2>
              <button onClick={() => setWalletModal(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Wallet Name *</label>
                <input value={walletForm.name} onChange={setW("name")} placeholder="e.g. Main Cash, Personal bKash"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Type</label>
                <EditableSelect value={walletForm.type} onChange={v => setWalletForm(p => ({ ...p, type: v }))}
                  options={WALLET_TYPES.map(wt => ({ value: wt.key, label: wt.label }))} className="h-9 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Opening Balance</label>
                <input type="number" value={walletForm.balance} onChange={setW("balance")} placeholder="0"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setWalletModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={createWallet} disabled={saving} className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Create Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {txModal && selWallet && (
        <div className="sp-backdrop z-50" onClick={e => { if (e.target === e.currentTarget) setTxModal(false); }}>
          <div className="sp-drawer pointer-events-auto sm:max-w-md flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Add Transaction</h2>
              <button onClick={() => setTxModal(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ key: "credit", label: "Income (+)", color: "border-emerald-500 bg-emerald-500 text-white" },
                    { key: "debit", label: "Expense (-)", color: "border-red-500 bg-red-500 text-white" }].map(t => (
                    <button key={t.key} onClick={() => setTxForm(p => ({ ...p, type: t.key }))}
                      className={cn("h-10 rounded-xl border text-sm font-medium transition-all",
                        txForm.type === t.key ? t.color : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Amount *</label>
                <input type="number" value={txForm.amount} onChange={setT("amount")} placeholder="0" autoFocus
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Description *</label>
                <input value={txForm.description} onChange={setT("description")} placeholder="What is this for?"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Category</label>
                  <EditableSelect value={txForm.category} onChange={v => setTxForm(p => ({ ...p, category: v }))}
                    options={TX_CATS.map(c => ({ value: c, label: c }))} className="h-10 rounded-xl capitalize" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Date</label>
                  <input type="date" value={txForm.date} onChange={setT("date")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setTxModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={addTx} disabled={saving || !txForm.amount || !txForm.description}
                className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Add Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
