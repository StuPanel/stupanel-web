"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Building2, Landmark, Smartphone, Wallet } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface AccountOption { id: string; name: string; type: string; accountNumber?: string | null; isDefault: boolean }

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cash: Banknote, bkash: Smartphone, nagad: Smartphone, rocket: Smartphone, bank: Building2, other: Wallet,
};

/** Which account a payment method most likely lands in. */
function suggest(list: AccountOption[], method?: string) {
  const want =
    method === "cash" ? ["cash"] :
    method === "mobile_banking" ? ["bkash", "nagad", "rocket"] :
    method && ["bank_transfer", "cheque", "credit_card", "debit_card", "online_gateway"].includes(method) ? ["bank"] : [];
  return list.find(a => want.includes(a.type)) ?? list.find(a => a.isDefault) ?? list[0];
}

let cache: AccountOption[] | null = null;

/**
 * "Which account did the money go into?" — studio cash, bKash, bank…
 * Picks the likely account for the payment method until the user chooses one.
 */
export function AccountPicker({ value, onChange, method, label = "Money went into", className, payOut }: {
  value: string;
  onChange: (id: string) => void;
  method?: string;
  label?: string;
  className?: string;
  /** Money going out: show each account's balance and warn if this amount is more than it holds. */
  payOut?: number;
}) {
  const [list, setList] = useState<AccountOption[]>(cache ?? []);
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const touched = useRef(!!value);

  useEffect(() => {
    let alive = true;
    apiFetch(`${API}/accounts/options`).then(r => r.ok ? r.json() : []).then((d: AccountOption[]) => {
      if (!alive || !Array.isArray(d)) return;
      cache = d; setList(d);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Balances are only for people who can see Accounts; others just don't get them.
  const wantBalance = payOut !== undefined;
  useEffect(() => {
    if (!wantBalance) return;
    let alive = true;
    apiFetch(`${API}/accounts`).then(r => r.ok ? r.json() : null).then(d => {
      if (!alive || !Array.isArray(d?.accounts)) return;
      setBalances(Object.fromEntries(d.accounts.map((a: { id: string; balance: number }) => [a.id, Number(a.balance)])));
    }).catch(() => {});
    return () => { alive = false; };
  }, [wantBalance]);
  const picked = balances && value ? balances[value] : undefined;
  const short = payOut !== undefined && picked !== undefined && payOut > 0 && payOut > picked;

  useEffect(() => {
    if (!list.length || touched.current) return;
    const s = suggest(list, method);
    if (s && s.id !== value) onChange(s.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, method]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-slate-600 flex items-center gap-1"><Landmark className="w-3.5 h-3.5" />{label} *</p>
      {list.length === 0 ? (
        <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
      ) : (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
          {list.map(a => {
            const Icon = ICON[a.type] ?? Wallet;
            const on = a.id === value;
            return (
              <button key={a.id} type="button" role="radio" aria-checked={on}
                onClick={() => { touched.current = true; onChange(a.id); }}
                className={cn("h-9 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 border transition-colors",
                  on ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-slate-200 hover:border-slate-300")}>
                <Icon className="w-3.5 h-3.5" />{a.name}
                {a.accountNumber && <span className={cn("font-normal", on ? "text-white/70" : "text-slate-400")}>··{a.accountNumber.slice(-4)}</span>}
                {balances && balances[a.id] !== undefined && (
                  <span className={cn("font-semibold tabular-nums", balances[a.id] < 0 ? (on ? "text-rose-200" : "text-rose-600") : (on ? "text-white/75" : "text-slate-500"))}>
                    ৳{Math.round(balances[a.id]).toLocaleString("en-IN")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {short && (
        <p role="alert" className="text-[12px] font-medium text-[#A35A00] bg-[#FFF4E5] rounded-xl px-3 py-2">
          This account has only ৳{Math.round(picked!).toLocaleString("en-IN")}. After this payment it will be ৳{Math.round(picked! - payOut!).toLocaleString("en-IN")} (minus).
        </p>
      )}
    </div>
  );
}
