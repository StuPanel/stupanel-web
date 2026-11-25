"use client";
/**
 * Packages → "Add ready-made packages": StuPanel's 25 packages and 16 add-ons (Faisal 25-NOV-2026), priced in
 * the studio's currency. The studio ticks what it wants; names it already uses are shown as "Added" and skipped.
 * New ones are marked "Sample" until the studio edits them, and go to its website draft too.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, PackagePlus, Sparkles } from "lucide-react";
import { FormDrawer } from "@/components/ui/form-kit";
import { notify } from "@/components/feedback";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { unitLabel } from "@/lib/extras";

type ReadyPkg = { key: string; name: string; group: string; category: string; description: string; price: number; days: number; hours: number; has: boolean };
type ReadyExtra = { key: string; name: string; category: string; unit: string; price: number; has: boolean };
type Ready = { currency: string; groups: string[]; packages: ReadyPkg[]; extras: ReadyExtra[] };

export function ReadyDrawer({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [data, setData] = useState<Ready | null>(null);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [pickX, setPickX] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let on = true;
    const t = setTimeout(() => { if (on) { setErr(""); setData(null); } }, 0);
    apiFetch(`${API}/packages/ready`).then(r => (r.ok ? r.json() : Promise.reject(r))).then((d: Ready) => {
      if (!on) return;
      setData(d);
      // Everything the studio doesn't have yet starts ticked
      setPick(new Set(d.packages.filter(p => !p.has).map(p => p.key)));
      setPickX(new Set(d.extras.filter(x => !x.has).map(x => x.key)));
    }).catch(() => on && setErr("Couldn't load the ready-made packages. Try again."));
    return () => { on = false; clearTimeout(t); };
  }, [open]);

  const groups = useMemo(() => (data ? data.groups.map(g => ({ g, list: data.packages.filter(p => p.group === g) })).filter(x => x.list.length) : []), [data]);
  const flip = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };
  const count = pick.size + pickX.size;

  async function add() {
    if (!count) return;
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/packages/ready`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packages: [...pick], extras: [...pickX] }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't add them.", { error: true }); return; }
      const n = (d.packages?.length ?? 0), x = (d.extras?.length ?? 0);
      notify(`${n} package${n === 1 ? "" : "s"} and ${x} extra${x === 1 ? "" : "s"} added. Check the prices.`);
      onAdded(); onClose();
    } catch { notify("Couldn't add them.", { error: true }); }
    finally { setSaving(false); }
  }

  const row = (on: boolean, has: boolean) => cn("w-full flex items-center gap-3 px-4 py-3 text-left", has ? "opacity-60" : "hover:bg-[#F7F5FB]");
  const box = (on: boolean) => cn("w-5 h-5 rounded-[6px] border flex items-center justify-center flex-shrink-0", on ? "bg-[#7D5CEF] border-[#7D5CEF] text-white" : "border-[#C9C4D6] bg-white");

  return (
    <FormDrawer open={open} onClose={onClose} icon={PackagePlus} color="violet" title="Ready-made packages" sub="Made by StuPanel — change the prices to yours"
      footer={<>
        <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-sm font-semibold">Cancel</button>
        <button type="button" onClick={add} disabled={saving || !count} className="flex-1 h-11 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{count ? `Add ${count}` : "Nothing chosen"}
        </button>
      </>}>
      {err && <p role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#C2304F] text-sm">{err}</p>}
      {!data && !err && <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>}
      {data && (
        <div className="space-y-5">
          <p className="text-[13.5px] text-[#4A4658] leading-relaxed">They go to your Packages and Extras and to your website draft. Each one shows <b>Sample</b> until you edit it. Ones you already have are left as they are.</p>
          {groups.map(({ g, list }) => (
            <section key={g}>
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-[13px] font-bold text-[#4A4658]">{g}</h3>
                <button type="button" className="text-[12.5px] font-semibold text-[#5B3FD0]" onClick={() => {
                  const keys = list.filter(p => !p.has).map(p => p.key);
                  const all = keys.every(k => pick.has(k));
                  setPick(s => { const n = new Set(s); keys.forEach(k => (all ? n.delete(k) : n.add(k))); return n; });
                }}>{list.filter(p => !p.has).every(p => pick.has(p.key)) ? "None" : "All"}</button>
              </div>
              <div className="bg-white rounded-[16px] border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
                {list.map(p => {
                  const on = !p.has && pick.has(p.key);
                  return (
                    <button key={p.key} type="button" disabled={p.has} aria-pressed={on} onClick={() => setPick(s => flip(s, p.key))} className={row(on, p.has)}>
                      <span className={box(on)}>{on && <Check className="w-3.5 h-3.5" />}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px] font-semibold text-[#17151F]">{p.name}</span>
                        <span className="block text-[12.5px] text-[#6B6680] line-clamp-2">{p.description}</span>
                        <span className="block text-[12px] text-[#8A859A] mt-0.5">{[p.category, p.days > 1 ? `${p.days} days` : `${p.hours} hours`].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="text-right flex-shrink-0">
                        <span className="block text-[14px] font-bold tabular-nums text-[#17151F]">{formatCurrency(p.price, data.currency)}</span>
                        {p.has && <span className="block text-[11.5px] font-bold text-[#1F8A5B]">Added</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <section>
            <div className="flex items-center justify-between px-1 mb-2">
              <h3 className="text-[13px] font-bold text-[#4A4658] inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Extras (add-ons)</h3>
              <button type="button" className="text-[12.5px] font-semibold text-[#5B3FD0]" onClick={() => {
                const keys = data.extras.filter(x => !x.has).map(x => x.key);
                const all = keys.every(k => pickX.has(k));
                setPickX(s => { const n = new Set(s); keys.forEach(k => (all ? n.delete(k) : n.add(k))); return n; });
              }}>{data.extras.filter(x => !x.has).every(x => pickX.has(x.key)) ? "None" : "All"}</button>
            </div>
            <div className="bg-white rounded-[16px] border border-[#EEEBF4] divide-y divide-[#EEEBF4] overflow-hidden">
              {data.extras.map(x => {
                const on = !x.has && pickX.has(x.key);
                return (
                  <button key={x.key} type="button" disabled={x.has} aria-pressed={on} onClick={() => setPickX(s => flip(s, x.key))} className={row(on, x.has)}>
                    <span className={box(on)}>{on && <Check className="w-3.5 h-3.5" />}</span>
                    <span className="flex-1 min-w-0 text-[14px] font-semibold text-[#17151F]">{x.name}</span>
                    <span className="text-right flex-shrink-0">
                      <span className="block text-[14px] font-bold tabular-nums text-[#17151F]">{formatCurrency(x.price, data.currency)}</span>
                      <span className="block text-[11.5px] text-[#6B6680]">{x.has ? <b className="text-[#1F8A5B]">Added</b> : unitLabel(x.unit)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </FormDrawer>
  );
}

/**
 * After a package is saved: when the website has packages made from it, ask whether to update them too.
 * Yes = the draft and the live site take the new name, words, team, days and price at once.
 */
export async function offerWebsiteUpdate(packageId: string, ask: (o: { title: string; message: string; confirmLabel: string; cancelLabel: string }) => Promise<boolean>) {
  const r = await apiFetch(`${API}/site/offers/linked/${packageId}`).catch(() => null);
  if (!r?.ok) return; // no website, or no access to it
  const d = await r.json().catch(() => null) as { draft: number; live: number; names: string[] } | null;
  if (!d || (!d.draft && !d.live)) return;
  const where = d.live ? "your live website" : "your website draft";
  const yes = await ask({
    title: "Update the website too?",
    message: `This package is also on ${where}${d.names.length ? ` as "${d.names.join('", "')}"` : ""}. Update it there with these changes, or keep the website as it is? Photos, offers and extras on the website stay.`,
    confirmLabel: "Update website", cancelLabel: "Keep website as it is",
  });
  if (!yes) return;
  const s = await apiFetch(`${API}/site/offers/sync/${packageId}`, { method: "POST" }).catch(() => null);
  if (!s?.ok) { notify("Couldn't update the website. Edit it in Website → Packages.", { error: true }); return; }
  const n = await s.json().catch(() => ({ draft: 0, live: 0 }));
  notify(n.live ? "Website updated — visitors see it now" : "Website draft updated — publish to show it");
}
