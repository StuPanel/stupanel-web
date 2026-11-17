"use client";

/**
 * Buy credits: choose a pack, send the money (bKash / Nagad / Rocket), type the transaction ID.
 * StuPanel checks the payment and the credits arrive at once. The newest orders show their state.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, Clock3, Copy, Loader2, ShoppingBag, XCircle } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, Group } from "@/components/ui/apple";
import { FormDrawer, inputCls } from "@/components/ui/form-kit";
import { dayTime, errText, num } from "@/lib/face";

type Pack = { id: string; name: string; credits: number; priceBdt: number; badge: string | null; perCredit: number };
type Order = { id: string; pack: string; credits: number; amountBdt: number; method: string; reference: string; status: "pending" | "paid" | "rejected"; rejectReason: string | null; createdAt: string };
type Shop = { packs: Pack[]; numbers: { method: string; number: string }[]; orders: Order[]; canBuy: boolean };

const METHOD: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", gateway: "Online payment" };
const taka = (n: number) => `৳${num(n)}`;
const STATE = {
  pending: { label: "Being checked", cls: "bg-[#FFF3E0] text-[#8A5200]", icon: Clock3 },
  paid: { label: "Credits added", cls: "bg-[#E2F4EA] text-[#176B47]", icon: CheckCircle2 },
  rejected: { label: "Not accepted", cls: "bg-[#FDECEF] text-[#A82743]", icon: XCircle },
} as const;

export function BuyCredits({ onBought }: { onBought: () => void }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [pick, setPick] = useState<Pack | null>(null);

  const load = useCallback(() => apiFetch(`${API}/face-search/credits/shop`).then(r => (r.ok ? r.json() : null)).then((d: Shop | null) => { if (d) setShop(d); }).catch(() => null), []);
  useEffect(() => { void load(); }, [load]);

  // While a payment is being checked, look again now and then, so the credits show up without a reload.
  const waiting = shop?.orders.some(o => o.status === "pending") ?? false;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { void load().then(() => onBought()); }, 30000);
    return () => clearInterval(t);
  }, [waiting, load, onBought]);

  if (!shop) return <div className={cn("bg-white rounded-[20px] p-5 mb-5 flex justify-center text-[#A29DB3]", CARD_SHADOW)}><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!shop.canBuy && !shop.orders.length) return null;

  return (
    <div className="mb-5">
      {shop.canBuy && (
        <section aria-labelledby="buy-credits-title" className="mb-5">
          <div className="flex items-end justify-between gap-3 mb-3 px-1">
            <div>
              <h2 id="buy-credits-title" className="text-[17px] font-extrabold tracking-[-0.01em] text-[#17151F]">Buy credits</h2>
              <p className="text-[13px] text-[#6B6680]">Credits you buy never expire. 1 credit adds 1 photo.</p>
            </div>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {shop.packs.map(p => (
              <li key={p.id} className="min-w-0">
                <button type="button" onClick={() => setPick(p)}
                  className={cn("relative w-full h-full text-left bg-white rounded-[20px] p-4 flex flex-col gap-1 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", CARD_SHADOW, p.badge && "ring-2 ring-[#7D5CEF]")}>
                  {p.badge && <span className="absolute -top-2.5 left-4 h-5 px-2 rounded-full bg-[#7D5CEF] text-white text-[11.5px] font-bold inline-flex items-center">{p.badge}</span>}
                  <span className="text-[13px] font-semibold text-[#6B6680]">{p.name}</span>
                  <span className="text-[26px] leading-tight font-extrabold tracking-[-0.03em] text-[#17151F] tabular-nums">{num(p.credits)}</span>
                  <span className="text-xs text-[#6B6680]">credits</span>
                  <span className="mt-2 text-[17px] font-bold text-[#17151F] tabular-nums">{taka(p.priceBdt)}</span>
                  <span className="text-xs text-[#6B6680] tabular-nums">৳{p.perCredit.toFixed(2)} per photo</span>
                  <span className="mt-3 h-10 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center justify-center">Choose</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shop.orders.length > 0 && (
        <Group title="Your orders" flush>
          {shop.orders.map(o => {
            const st = STATE[o.status] ?? STATE.pending;
            return (
              <div key={o.id} className="px-4 py-3 flex items-center gap-3 min-h-[60px] border-t first:border-t-0 border-[#EEEBF4]">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#17151F]">{o.pack} · {num(o.credits)} credits · {taka(o.amountBdt)}</p>
                  <p className={cn("text-xs truncate", o.status === "rejected" ? "text-[#A82743]" : "text-[#6B6680]")}>
                    {o.status === "rejected" && o.rejectReason ? o.rejectReason : `${METHOD[o.method] ?? o.method} · ${o.reference} · ${dayTime(o.createdAt)}`}
                  </p>
                </div>
                <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center gap-1", st.cls)}><st.icon className="w-3.5 h-3.5" />{st.label}</span>
              </div>
            );
          })}
        </Group>
      )}

      {pick && <PayDrawer pack={pick} numbers={shop.numbers} onClose={() => setPick(null)} onSent={() => { setPick(null); void load(); }} />}
    </div>
  );
}

function PayDrawer({ pack, numbers, onClose, onSent }: { pack: Pack; numbers: Shop["numbers"]; onClose: () => void; onSent: () => void }) {
  const [method, setMethod] = useState(numbers[0]?.method ?? "bkash");
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [err, setErr] = useState<{ sender?: string; trx?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const to = numbers.find(n => n.method === method);

  async function copy(text: string) { try { await navigator.clipboard.writeText(text); notify("Number copied"); } catch { notify("Could not copy. Type the number by hand.", { error: true }); } }

  async function send() {
    const e: typeof err = {};
    const s = sender.replace(/[\s-]/g, "").replace(/^\+?88/, "");
    const t = trx.trim().toUpperCase();
    if (!/^01[3-9]\d{8,9}$/.test(s)) e.sender = "Type the 11-digit number you sent the money from (like 01XXXXXXXXX).";
    if (!/^[A-Z0-9]{6,20}$/.test(t)) e.trx = "The transaction ID is 6 to 20 letters or numbers. It is in the payment message.";
    setErr(e);
    if (e.sender || e.trx || saving) return;
    setSaving(true);
    const r = await apiFetch(`${API}/face-search/credits/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId: pack.id, method, senderNumber: s, trxId: t }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setSaving(false);
    if (!r?.ok) return setErr({ form: errText(d, "Could not send the payment details. Please try again.") });
    notify("Sent. Your credits are added as soon as the payment is checked.");
    onSent();
  }

  return (
    <FormDrawer open onClose={onClose} icon={ShoppingBag} color="violet" title={`${pack.name}: ${num(pack.credits)} credits`} sub={`${taka(pack.priceBdt)} · ৳${pack.perCredit.toFixed(2)} per photo`}
      footer={<>
        <button type="button" onClick={onClose} className="h-12 px-5 rounded-full bg-[#F5F3FA] text-[15px] font-semibold text-[#17151F]">Cancel</button>
        <button type="button" onClick={send} disabled={saving} className="flex-1 h-12 rounded-full bg-[#7D5CEF] text-white text-[15px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}I have paid {taka(pack.priceBdt)}
        </button>
      </>}>
      <ol className="space-y-4">
        <li className={cn("bg-white rounded-[20px] p-4", CARD_SHADOW)}>
          <p className="text-[13px] font-bold text-[#17151F] mb-2.5">1. Choose how you pay</p>
          <div role="radiogroup" aria-label="How you pay" className="flex flex-wrap gap-2">
            {numbers.map(n => (
              <button key={n.method} type="button" role="radio" aria-checked={method === n.method} onClick={() => setMethod(n.method)}
                className={cn("h-11 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", method === n.method ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#17151F]")}>
                {method === n.method && <Check className="w-4 h-4" />}{METHOD[n.method] ?? n.method}
              </button>
            ))}
          </div>
        </li>
        <li className={cn("bg-white rounded-[20px] p-4", CARD_SHADOW)}>
          <p className="text-[13px] font-bold text-[#17151F] mb-1">2. Send {taka(pack.priceBdt)} to this {METHOD[method] ?? method} number</p>
          <p className="text-xs text-[#6B6680] mb-2.5">Use Send Money. Send the exact amount.</p>
          <div className="flex items-center gap-3 rounded-[14px] bg-[#F5F3FA] px-4 py-3">
            <p className="flex-1 text-[20px] font-extrabold tracking-[0.02em] text-[#17151F] tabular-nums">{to?.number}</p>
            <button type="button" onClick={() => to && copy(to.number)} className="h-10 px-4 rounded-full bg-white text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 flex-shrink-0"><Copy className="w-4 h-4" />Copy</button>
          </div>
        </li>
        <li className={cn("bg-white rounded-[20px] p-4 space-y-3.5", CARD_SHADOW)}>
          <p className="text-[13px] font-bold text-[#17151F]">3. Tell us about the payment</p>
          <div>
            <label htmlFor="bc-sender" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Number you sent from</label>
            <input id="bc-sender" className={inputCls} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={sender} aria-invalid={!!err.sender} aria-describedby={err.sender ? "bc-sender-err" : undefined}
              onChange={e => setSender(e.target.value)} />
            {err.sender && <p id="bc-sender-err" role="alert" className="text-xs text-[#A82743] mt-1.5">{err.sender}</p>}
          </div>
          <div>
            <label htmlFor="bc-trx" className="block text-xs font-semibold text-[#6B6680] mb-1.5">Transaction ID</label>
            <input id="bc-trx" className={cn(inputCls, "uppercase tracking-[0.04em]")} autoCapitalize="characters" autoComplete="off" placeholder="9HK2ABC3DE" value={trx} aria-invalid={!!err.trx} aria-describedby={err.trx ? "bc-trx-err" : "bc-trx-help"}
              onChange={e => setTrx(e.target.value)} />
            {err.trx ? <p id="bc-trx-err" role="alert" className="text-xs text-[#A82743] mt-1.5">{err.trx}</p> : <p id="bc-trx-help" className="text-xs text-[#6B6680] mt-1.5">It is in the message you get after sending the money.</p>}
          </div>
        </li>
      </ol>
      {err.form && <p role="alert" className="mt-4 rounded-[14px] bg-[#FDECEF] text-[#A82743] text-[13.5px] px-3.5 py-3">{err.form}</p>}
      <p className="text-xs text-[#6B6680] mt-4 px-1">StuPanel checks every payment by hand, usually within a few hours. Your {num(pack.credits)} credits are added the moment it is checked.</p>
    </FormDrawer>
  );
}
