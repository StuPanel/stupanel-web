"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock, Loader2, Save, X, XCircle } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm } from "@/components/feedback";

function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

type Method = "bkash" | "nagad" | "rocket";
interface Req {
  id: string; number: string; state: "pending" | "approved" | "rejected"; amount: number; currency: string;
  method: Method; trxId: string; senderNumber: string | null; planName: string | null; interval: "monthly" | "yearly" | null;
  rejectReason: string | null; submittedAt: string; approvedAt: string | null; periodEnd: string | null;
  company: { id: string; name: string; email: string | null; phone: string | null; subscriptionStatus: string; subscriptionEndsAt: string | null; trialEndsAt: string | null };
}

const METHOD_LABEL: Record<Method, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };
const NUMBER_KEYS: { method: Method; key: string }[] = [
  { method: "bkash", key: "billing.bkash_number" },
  { method: "nagad", key: "billing.nagad_number" },
  { method: "rocket", key: "billing.rocket_number" },
];

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function AdminBillingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [savingNumbers, setSavingNumbers] = useState(false);

  async function load(which = tab) {
    setLoading(true);
    const res = await fetch(`${API}/admin/billing/requests?status=${which}`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    setRows(await res.json());
    setLoading(false);
  }

  async function loadNumbers() {
    const res = await fetch(`${API}/admin/settings`, { headers: authH() });
    if (!res.ok) return;
    const all: { key: string; value: string }[] = await res.json();
    const out: Record<string, string> = {};
    for (const { key } of NUMBER_KEYS) out[key] = all.find((s) => s.key === key)?.value ?? "";
    setNumbers(out);
  }

  useEffect(() => { load(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);
  useEffect(() => { loadNumbers(); }, []);

  function flash(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  async function approve(r: Req) {
    if (!(await askConfirm({ message: `Confirm ${METHOD_LABEL[r.method]} payment ${r.trxId} of ৳${r.amount} from ${r.company.name}?\n\nOnly confirm after checking the money arrived in your account.`, title: "Confirm payment?", confirmLabel: "Yes, confirm" }))) return;
    setBusy(r.id);
    const res = await fetch(`${API}/admin/billing/requests/${r.id}/approve`, { method: "POST", headers: authH() });
    const b = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) { flash(`${r.company.name} activated until ${fmt(b.periodEnd)}`); load(); }
    else flash(b.message ?? "Could not approve", false);
  }

  async function reject() {
    if (!rejecting) return;
    setBusy(rejecting.id);
    const res = await fetch(`${API}/admin/billing/requests/${rejecting.id}/reject`, {
      method: "POST", headers: authH(), body: JSON.stringify({ reason }),
    });
    const b = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) { flash("Request rejected"); setRejecting(null); setReason(""); load(); }
    else flash(Array.isArray(b.message) ? b.message[0] : b.message ?? "Could not reject", false);
  }

  async function saveNumbers() {
    setSavingNumbers(true);
    for (const { method, key } of NUMBER_KEYS) {
      await fetch(`${API}/admin/settings`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ key, value: (numbers[key] ?? "").trim(), category: "billing", description: `${METHOD_LABEL[method]} personal number shown on the studio billing page (leave empty to hide)` }),
      });
    }
    setSavingNumbers(false);
    flash("Payment numbers saved");
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Payments</h1>
        <p className="text-sm text-slate-400 mt-1">Check the money in your bKash / Nagad / Rocket app, then confirm. Confirming activates the studio&apos;s plan automatically.</p>
      </div>

      {msg && (
        <div className={cn("rounded-lg px-4 py-2.5 text-sm font-medium", msg.ok ? "bg-emerald-950/50 text-emerald-300" : "bg-red-950/50 text-red-300")}>{msg.text}</div>
      )}

      {/* Payment numbers */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <p className="font-semibold text-white">Payment numbers</p>
        <p className="text-xs text-slate-400 mt-0.5">Shown to studios on their billing page. Leave empty to hide a method.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {NUMBER_KEYS.map(({ method, key }) => (
            <label key={key} className="block">
              <span className="text-xs font-medium text-slate-300">{METHOD_LABEL[method]} number</span>
              <input value={numbers[key] ?? ""} onChange={(e) => setNumbers((n) => ({ ...n, [key]: e.target.value }))}
                placeholder="01XXXXXXXXX" inputMode="tel"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </label>
          ))}
        </div>
        <button onClick={saveNumbers} disabled={savingNumbers}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          {savingNumbers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save numbers
        </button>
        <p className="text-xs text-slate-400 mt-3">Plan prices can be changed on the Plans page.</p>
      </div>

      {/* Requests */}
      <div className="rounded-xl border border-slate-700 bg-slate-800">
        <div className="flex items-center gap-1 border-b border-slate-700 px-3 pt-3">
          {(["pending", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px",
                tab === t ? "border-violet-500 text-violet-300" : "border-transparent text-slate-400 hover:text-white")}>
              {t === "pending" ? "Waiting" : "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-violet-600" /></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">{tab === "pending" ? "No payments waiting." : "No payments yet."}</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {rows.map((r) => (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{r.company.name}</p>
                    <span className="text-xs text-slate-400">{r.number}</span>
                    {r.state === "approved" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Confirmed</span>}
                    {r.state === "rejected" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400"><XCircle className="w-3.5 h-3.5" />Rejected</span>}
                    {r.state === "pending" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300"><Clock className="w-3.5 h-3.5" />Waiting</span>}
                  </div>
                  <p className="text-sm text-slate-300 mt-1">
                    <span className="font-semibold">৳{r.amount.toLocaleString("en-IN")}</span> · {METHOD_LABEL[r.method]} · TrxID <span className="font-mono font-semibold">{r.trxId}</span> · from <span className="font-mono">{r.senderNumber}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.planName} · {r.interval === "yearly" ? "Yearly" : "Monthly"} · submitted {fmt(r.submittedAt)}
                    {r.company.phone ? ` · ${r.company.phone}` : ""}{r.company.email ? ` · ${r.company.email}` : ""}
                  </p>
                  {r.state === "rejected" && r.rejectReason && <p className="text-xs text-red-400 mt-0.5">Reason: {r.rejectReason}</p>}
                  {r.state === "approved" && <p className="text-xs text-emerald-400 mt-0.5">Active until {fmt(r.periodEnd)}</p>}
                </div>
                {r.state === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => { setRejecting(r); setReason(""); }} disabled={busy === r.id}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-60">
                      Reject
                    </button>
                    <button onClick={() => approve(r)} disabled={busy === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                      {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejecting(null)} />
          <div className="relative w-full max-w-md rounded-xl bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">Reject payment from {rejecting.company.name}</p>
              <button onClick={() => setRejecting(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-400 mt-1">The studio will see this reason.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="e.g. No payment found with this TrxID"
              className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancel</button>
              <button onClick={reject} disabled={reason.trim().length < 3 || busy === rejecting.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
