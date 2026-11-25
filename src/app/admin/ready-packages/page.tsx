"use client";

/**
 * StuPanel team: the ready-made packages and add-ons a NEW studio gets when it signs up (and that older studios can
 * add from Packages → Ready-made). Prices are in Bangladesh taka; other currencies use the rates below.
 * A change here never touches studios that already have them.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Info, Loader2, PackagePlus, RotateCcw, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";
import { EXTRA_UNITS } from "@/lib/extras";

const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });

type Pkg = {
  key: string; name: string; group: string; category: string; description: string; price: number;
  durationUnit: "hours" | "days"; durationHours: number; durationDays?: number; days: string[];
  gets?: string[]; off?: boolean; [k: string]: unknown;
};
type Extra = { key: string; name: string; category: string; unit: string; price: number; description?: string; onWebsite?: boolean; off?: boolean };
type Data = { packages: Pkg[]; extras: Extra[]; rates: Record<string, number>; groups: string[]; changed: boolean; updatedAt: string | null; studiosWithThem: number };

const input = "w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-900 text-[14px] text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 disabled:opacity-50";
const label = "block text-[12px] font-semibold text-slate-400 mb-1";
const tk = (n: number) => `৳ ${Math.round(n).toLocaleString("en-IN")}`;

function Switch({ on, set, name }: { on: boolean; set: (v: boolean) => void; name: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={name} onClick={() => set(!on)}
      className={cn("relative w-11 h-6 rounded-full transition-colors flex-shrink-0", on ? "bg-indigo-500" : "bg-slate-600")}>
      <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export default function ReadyPackagesAdmin() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [list, setList] = useState<{ packages: Pkg[]; extras: Extra[]; rates: Record<string, number> } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const take = (d: Data) => { setData(d); setList({ packages: d.packages, extras: d.extras, rates: d.rates }); };
  const load = useCallback(async () => {
    const r = await fetch(`${API}/admin/ready-packages`, { headers: authH() });
    if (r.status === 401) { router.replace("/admin/login"); return; }
    if (!r.ok) { setErr(r.status === 403 ? "You don't have access to this page." : "Couldn't load the list. Try again."); return; }
    take(await r.json());
  }, [router]);
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, [load]);

  const dirty = useMemo(() => !!data && !!list && JSON.stringify({ packages: data.packages, extras: data.extras, rates: data.rates }) !== JSON.stringify(list), [data, list]);
  const putPkg = (key: string, p: Partial<Pkg>) => setList(l => l && ({ ...l, packages: l.packages.map(x => (x.key === key ? { ...x, ...p } : x)) }));
  const putExtra = (key: string, p: Partial<Extra>) => setList(l => l && ({ ...l, extras: l.extras.map(x => (x.key === key ? { ...x, ...p } : x)) }));
  const clash = useMemo(() => {
    if (!list) return "";
    for (const all of [list.packages, list.extras] as { name: string }[][]) {
      const seen = new Set<string>();
      for (const x of all) { const n = x.name.trim().toLowerCase(); if (!n) return "Every package and add-on needs a name."; if (seen.has(n)) return `Two have the name "${x.name.trim()}".`; seen.add(n); }
    }
    return "";
  }, [list]);

  async function save() {
    if (!list || clash) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/ready-packages`, { method: "PUT", headers: authH(), body: JSON.stringify(list) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save", { error: true }); return; }
      take(d); notify("Saved — new studios get this list");
    } finally { setSaving(false); }
  }
  async function reset() {
    const yes = await askConfirm({ title: "Go back to StuPanel's list?", message: "Your changes to the packages, add-ons and rates are replaced with StuPanel's own 25 packages and 16 add-ons. Studios that already have packages are not changed.", confirmLabel: "Go back", cancelLabel: "Keep my list" });
    if (!yes) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/ready-packages/reset`, { method: "POST", headers: authH() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't reset", { error: true }); return; }
      take(d); notify("Back to StuPanel's list");
    } finally { setSaving(false); }
  }

  if (err) return <p role="alert" className="m-6 px-4 py-3 rounded-[14px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</p>;
  if (!data || !list) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

  const on = list.packages.filter(p => !p.off).length, xon = list.extras.filter(x => !x.off).length;
  return (
    <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-6 pb-32">
      <header className="flex items-start gap-3 flex-wrap">
        <span className="w-11 h-11 rounded-[14px] bg-indigo-500/15 text-indigo-300 flex items-center justify-center flex-shrink-0"><PackagePlus className="w-5 h-5" /></span>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold text-white">Ready-made packages</h1>
          <p className="text-[13.5px] text-slate-400 mt-0.5">{on} of {list.packages.length} packages and {xon} of {list.extras.length} add-ons are given · {data.studiosWithThem} studio{data.studiosWithThem === 1 ? "" : "s"} got them at sign-up{data.updatedAt ? ` · last saved ${new Date(data.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
        </div>
        {data.changed && <button type="button" onClick={reset} disabled={saving} className="h-10 px-4 rounded-full bg-slate-800 border border-slate-700 text-[13px] font-semibold text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-700"><RotateCcw className="w-4 h-4" />StuPanel&apos;s list</button>}
      </header>

      <p className="mt-4 px-4 py-3 rounded-[14px] bg-slate-800/60 border border-slate-700 text-slate-300 text-[13.5px] leading-relaxed flex gap-2"><Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        A change here is only for studios that sign up after it (and for older studios that add them from Packages → Ready-made). Studios that already have them keep theirs as they are. Prices are in taka; other currencies use the rates at the bottom.</p>

      {data.groups.map(g => {
        const rows = list.packages.filter(p => p.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="mt-6">
            <h2 className="text-[13px] font-bold text-slate-300 px-1 mb-2">{g}</h2>
            <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
              {rows.map(p => {
                const isOpen = open === p.key;
                return (
                  <div key={p.key} className={cn(p.off && "bg-slate-900/50")}>
                    <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
                      <Switch on={!p.off} set={v => putPkg(p.key, { off: v ? undefined : true })} name={`Give ${p.name}`} />
                      <button type="button" onClick={() => setOpen(isOpen ? null : p.key)} aria-expanded={isOpen} className="flex-1 min-w-0 text-left">
                        <span className={cn("block text-[14.5px] font-semibold truncate", p.off ? "text-slate-500" : "text-white")}>{p.name || "No name"}</span>
                        <span className="block text-[12.5px] text-slate-400 truncate">{p.category} · {p.durationUnit === "days" ? `${p.durationDays ?? p.days.length} days` : `${p.durationHours} hours`} · {p.days.join(", ")}</span>
                      </button>
                      <input aria-label={`Price of ${p.name}`} inputMode="numeric" value={p.price || ""} onChange={e => putPkg(p.key, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={cn(input, "w-[104px] text-right tabular-nums")} />
                      <button type="button" aria-label={isOpen ? `Close ${p.name}` : `Edit ${p.name}`} onClick={() => setOpen(isOpen ? null : p.key)} className="w-9 h-9 rounded-full hover:bg-slate-700 flex items-center justify-center text-slate-400"><ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} /></button>
                    </div>
                    {isOpen && (
                      <div className="px-3 sm:px-4 pb-4 grid sm:grid-cols-2 gap-3">
                        <label className="block"><span className={label}>Name</span><input className={input} value={p.name} maxLength={80} onChange={e => putPkg(p.key, { name: e.target.value })} /></label>
                        <label className="block"><span className={label}>Group on the website</span>
                          <select className={input} value={p.group} onChange={e => putPkg(p.key, { group: e.target.value })}>{data.groups.map(x => <option key={x}>{x}</option>)}</select></label>
                        <label className="block sm:col-span-2"><span className={label}>Description (first line shows under the name)</span>
                          <textarea className={cn(input, "h-auto min-h-[76px] py-2 leading-relaxed")} value={p.description} maxLength={1000} onChange={e => putPkg(p.key, { description: e.target.value })} /></label>
                        <label className="block"><span className={label}>{p.durationUnit === "days" ? "Hours each day" : "Hours"}</span>
                          <input className={input} inputMode="numeric" value={p.durationHours || ""} onChange={e => putPkg(p.key, { durationHours: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
                        <label className="block"><span className={label}>Days it covers (comma between)</span>
                          <input className={input} value={p.days.join(", ")} onChange={e => putPkg(p.key, { days: e.target.value.split(",").map(s => s.trimStart()).slice(0, 7) })} onBlur={() => putPkg(p.key, { days: p.days.map(s => s.trim()).filter(Boolean) })} /></label>
                        <label className="block sm:col-span-2"><span className={label}>What the client also gets (one per line)</span>
                          <textarea className={cn(input, "h-auto min-h-[64px] py-2 leading-relaxed")} value={(p.gets ?? []).join("\n")} onChange={e => putPkg(p.key, { gets: e.target.value.split("\n").slice(0, 8) })} onBlur={() => putPkg(p.key, { gets: (p.gets ?? []).map(s => s.trim()).filter(Boolean) })} /></label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="mt-8">
        <h2 className="text-[13px] font-bold text-slate-300 px-1 mb-2 inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Add-ons</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
          {list.extras.map(x => (
            <div key={x.key} className={cn("px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap", x.off && "bg-slate-900/50")}>
              <Switch on={!x.off} set={v => putExtra(x.key, { off: v ? undefined : true })} name={`Give ${x.name}`} />
              <input aria-label="Add-on name" className={cn(input, "flex-1 min-w-[160px]")} value={x.name} maxLength={80} onChange={e => putExtra(x.key, { name: e.target.value })} />
              <select aria-label={`How ${x.name} is counted`} className={cn(input, "w-[130px]")} value={x.unit} onChange={e => putExtra(x.key, { unit: e.target.value })}>
                {EXTRA_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
              <input aria-label={`Price of ${x.name}`} inputMode="numeric" value={x.price || ""} onChange={e => putExtra(x.key, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={cn(input, "w-[96px] text-right tabular-nums")} />
              <label className="flex items-center gap-2 text-[12.5px] text-slate-300 min-h-[40px]"><input type="checkbox" className="w-4 h-4 accent-indigo-500" checked={!!x.onWebsite} onChange={e => putExtra(x.key, { onWebsite: e.target.checked || undefined })} />On the website</label>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-bold text-slate-300 px-1 mb-1">Currency rates</h2>
        <p className="text-[12.5px] text-slate-400 px-1 mb-2">How much one taka is in each currency. A studio in another country gets the prices converted and rounded (for example {tk(20000)} → about {Math.round(20000 * (list.rates.USD ?? 0))} USD).</p>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.keys(list.rates).map(c => (
            <label key={`${c}-${list.rates[c]}`} className="block"><span className={label}>{c}</span>
              <input className={cn(input, "tabular-nums")} inputMode="decimal" disabled={c === "BDT"} defaultValue={String(list.rates[c])}
                onBlur={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) setList(l => l && ({ ...l, rates: { ...l.rates, [c]: v } })); else e.target.value = String(list.rates[c]); }} /></label>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 lg:left-60 bg-slate-950/95 backdrop-blur border-t border-slate-800 px-4 py-3 flex items-center gap-3 justify-end z-20">
        {clash ? <span role="alert" className="text-[13px] text-rose-300 mr-auto">{clash}</span> : dirty && <span className="text-[13px] text-slate-400 mr-auto">Not saved yet</span>}
        <button type="button" disabled={!dirty || saving} onClick={() => take(data)} className="h-11 px-5 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold disabled:opacity-40">Undo changes</button>
        <button type="button" disabled={!dirty || saving || !!clash} onClick={save} className="h-11 px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
        </button>
      </div>
    </div>
  );
}
