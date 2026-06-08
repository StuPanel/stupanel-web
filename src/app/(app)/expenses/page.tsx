"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet, Plus, Loader2, X, CheckCircle2, AlertCircle, Trash2,
  ArrowUpRight, ArrowDownRight, ChevronRight, Settings2, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

const WALLET_TYPES = [
  { key: "cash",   label: "Cash",   color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700" },
  { key: "bkash",  label: "bKash",  color: "bg-pink-500",    light: "bg-pink-50 text-pink-700"       },
  { key: "nagad",  label: "Nagad",  color: "bg-orange-500",  light: "bg-orange-50 text-orange-700"   },
  { key: "rocket", label: "Rocket", color: "bg-purple-500",  light: "bg-purple-50 text-purple-700"   },
  { key: "bank",   label: "Bank",   color: "bg-blue-500",    light: "bg-blue-50 text-blue-700"       },
  { key: "other",  label: "Other",  color: "bg-slate-500",   light: "bg-slate-100 text-slate-700"    },
];
const WALLET_MAP = Object.fromEntries(WALLET_TYPES.map(w => [w.key, w]));

const TX_CATS = ["food", "transport", "equipment", "salary", "marketing", "rent", "utilities", "misc"];

function fmt(n: number) { return "৳" + Math.round(Math.abs(n)).toLocaleString(); }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}-${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()]}-${d.getFullYear()}`;
}

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
  const [txForm, setTxForm] = useState({ type: "debit", amount: "", description: "", category: "misc", date: new Date().toISOString().slice(0,10) });
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
    if (r.ok) { setToast({ msg: "Transaction added!", ok: true }); setTxModal(false); loadWallets(); loadTxs(); setTxForm({ type: "debit", amount: "", description: "", category: "misc", date: new Date().toISOString().slice(0,10) }); }
    else setToast({ msg: "Failed.", ok: false });
    setSaving(false);
  }

  async function deleteTx(txId: string) {
    if (!selWallet) return;
    const r = await apiFetch(`${API}/wallets/${selWallet.id}/transactions/${txId}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { loadWallets(); loadTxs(); }
  }

  async function deleteWallet(id: string) {
    if (!confirm("Delete this wallet?")) return;
    const r = await apiFetch(`${API}/wallets/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) { if (selWallet?.id === id) setSelWallet(null); loadWallets(); }
  }

  const setW = (k: string) => (e: React.ChangeEvent<any>) => setWalletForm(p => ({ ...p, [k]: e.target.value }));
  const setT = (k: string) => (e: React.ChangeEvent<any>) => setTxForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      {toast && (
        <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2",
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-600" />
            Expenses & Wallets
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Track cash, bKash, bank and other accounts</p>
        </div>
        <button onClick={() => setWalletModal(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />Add Wallet
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Balance", value: fmt(summary.totalBalance), color: "text-slate-900", bg: "bg-white" },
            { label: "This Month In", value: fmt(summary.thisMonthIncome), color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "This Month Out", value: fmt(summary.thisMonthExpense), color: "text-red-700", bg: "bg-red-50" },
            { label: "Wallets", value: String(summary.walletCount), color: "text-indigo-700", bg: "bg-indigo-50" },
          ].map(s => (
            <div key={s.label} className={cn("border border-slate-200 rounded-2xl p-4", s.bg)}>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={cn("text-xl font-extrabold mt-1", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Wallet className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No wallets yet</p>
          <p className="text-sm text-slate-400 mt-1">Add Cash, bKash, Bank accounts to track expenses</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Wallet list */}
          <div className="lg:col-span-1 space-y-2">
            {wallets.map(w => {
              const wt = WALLET_MAP[w.type] ?? WALLET_MAP.other;
              const isSelected = selWallet?.id === w.id;
              return (
                <div key={w.id}
                  onClick={() => { setSelWallet(w); setTxPage(1); }}
                  className={cn("flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all",
                    isSelected ? "border-indigo-200 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-100")}>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0", wt.color)}>
                    {wt.label[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{w.name}</p>
                    <p className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5", wt.light)}>{wt.label}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn("font-extrabold text-sm", Number(w.balance) >= 0 ? "text-emerald-600" : "text-red-500")}>{fmt(Number(w.balance))}</p>
                    <button onClick={e => { e.stopPropagation(); deleteWallet(w.id); }} className="text-[10px] text-slate-300 hover:text-red-400 mt-0.5 block transition-colors">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transactions */}
          <div className="lg:col-span-2">
            {!selWallet ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
                <Wallet className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Select a wallet to view transactions</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{selWallet.name}</p>
                    <p className="text-xs text-slate-400">Balance: <span className="font-semibold text-slate-700">{fmt(Number(selWallet.balance))}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={txFilter} onChange={e => { setTxFilter(e.target.value); setTxPage(1); }}
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none">
                      <option value="">All</option>
                      <option value="credit">Income</option>
                      <option value="debit">Expense</option>
                    </select>
                    <button onClick={() => setTxModal(true)}
                      className="flex items-center gap-1 h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                      <Plus className="w-3.5 h-3.5" />Add
                    </button>
                  </div>
                </div>

                {txLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
                ) : txs.length === 0 ? (
                  <div className="text-center py-12 text-sm text-slate-400">No transactions yet</div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {txs.map(tx => (
                      <li key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group transition-colors">
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                          tx.type === "credit" ? "bg-emerald-100" : "bg-red-100")}>
                          {tx.type === "credit"
                            ? <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                            : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {tx.category && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full capitalize">{tx.category}</span>}
                            <span className="text-[10px] text-slate-400">{fmtDate(tx.date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn("font-bold text-sm", tx.type === "credit" ? "text-emerald-600" : "text-red-500")}>
                            {tx.type === "credit" ? "+" : "-"}{fmt(Number(tx.amount))}
                          </span>
                          <button onClick={() => deleteTx(tx.id)}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-all">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {txTotal > 20 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">{txTotal} total</span>
                    <div className="flex gap-2">
                      <button disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}
                        className="h-7 px-3 text-xs rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">Prev</button>
                      <button disabled={txPage * 20 >= txTotal} onClick={() => setTxPage(p => p + 1)}
                        className="h-7 px-3 text-xs rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Wallet Modal */}
      {walletModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
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
                <div className="grid grid-cols-3 gap-2">
                  {WALLET_TYPES.map(wt => (
                    <button key={wt.key} onClick={() => setWalletForm(p => ({ ...p, type: wt.key }))}
                      className={cn("h-9 rounded-xl border text-xs font-medium transition-all", walletForm.type === wt.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:border-indigo-200")}>
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Opening Balance (৳)</label>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
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
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">Amount (৳) *</label>
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
                  <select value={txForm.category} onChange={setT("category")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none capitalize">
                    {TX_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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
