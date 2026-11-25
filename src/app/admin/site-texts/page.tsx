"use client";

/**
 * StuPanel team: the ready words behind every "Autofill" button on a studio's Website page (Faisal 25-NOV-2026).
 * Each press in a box gives the next text from its list. Fill-ins: {studio} {city} {events} {package};
 * a part in [square brackets] is dropped when a fill-in inside it is empty.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Info, Loader2, Plus, RotateCcw, Save, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";

const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });

type Item = string | { a: string; b: string };
type Field = { key: string; group: string; label: string; kind: "text" | "pair"; parts?: [string, string]; max: number; max2?: number };
type Data = { fields: Field[]; texts: Record<string, Item[]>; defaults: Record<string, Item[]>; changed: string[]; updatedAt: string | null };

const input = "w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-[14px] text-white placeholder:text-slate-500 outline-none focus:border-indigo-500";
const label = "block text-[12px] font-semibold text-slate-400 mb-1";

export default function SiteTextsAdmin() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [texts, setTexts] = useState<Record<string, Item[]> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const take = (d: Data) => { setData(d); setTexts(d.texts); };
  const load = useCallback(async () => {
    const r = await fetch(`${API}/admin/site-texts`, { headers: authH() });
    if (r.status === 401) { router.replace("/admin/login"); return; }
    if (!r.ok) { setErr(r.status === 403 ? "You don't have access to this page." : "Couldn't load the texts. Try again."); return; }
    take(await r.json());
  }, [router]);
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, [load]);

  const dirty = useMemo(() => !!data && !!texts && JSON.stringify(data.texts) !== JSON.stringify(texts), [data, texts]);
  const groups = useMemo(() => (data ? [...new Set(data.fields.map(f => f.group))] : []), [data]);
  const setItems = (key: string, items: Item[]) => setTexts(t => t && ({ ...t, [key]: items }));

  async function save() {
    if (!texts) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/site-texts`, { method: "PUT", headers: authH(), body: JSON.stringify({ texts }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't save", { error: true }); return; }
      take(d); notify("Saved — Autofill uses these words now");
    } finally { setSaving(false); }
  }
  async function reset() {
    const yes = await askConfirm({ title: "Go back to StuPanel's words?", message: "Every box gets StuPanel's own texts again. Words studios already put on their sites are not changed.", confirmLabel: "Go back", cancelLabel: "Keep mine" });
    if (!yes) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/site-texts/reset`, { method: "POST", headers: authH() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify("Couldn't reset", { error: true }); return; }
      take(d); notify("Back to StuPanel's words");
    } finally { setSaving(false); }
  }

  if (err) return <p role="alert" className="m-6 px-4 py-3 rounded-[14px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</p>;
  if (!data || !texts) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

  const total = data.fields.reduce((n, f) => n + (texts[f.key]?.length ?? 0), 0);
  return (
    <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-6 pb-32">
      <header className="flex items-start gap-3 flex-wrap">
        <span className="w-11 h-11 rounded-[14px] bg-indigo-500/15 text-indigo-300 flex items-center justify-center flex-shrink-0"><Wand2 className="w-5 h-5" /></span>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold text-white">Text templates</h1>
          <p className="text-[13.5px] text-slate-400 mt-0.5">{total} ready texts in {data.fields.length} boxes{data.updatedAt ? ` · last saved ${new Date(data.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
        </div>
        {data.changed.length > 0 && <button type="button" onClick={reset} disabled={saving} className="h-10 px-4 rounded-full bg-slate-800 border border-slate-700 text-[13px] font-semibold text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-700"><RotateCcw className="w-4 h-4" />StuPanel&apos;s words</button>}
      </header>

      <p className="mt-4 px-4 py-3 rounded-[14px] bg-slate-800/60 border border-slate-700 text-slate-300 text-[13.5px] leading-relaxed flex gap-2"><Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>On a studio&apos;s Website page, each <b>Autofill</b> press puts the next text from the box&apos;s list. Use <code className="text-indigo-300">{"{studio}"}</code>, <code className="text-indigo-300">{"{city}"}</code>, <code className="text-indigo-300">{"{events}"}</code> and, in package boxes, <code className="text-indigo-300">{"{package}"}</code>. A part in [square brackets] is left out when the studio has no value for it, e.g. <code className="text-indigo-300">{"Photography[ in {city}]"}</code>.</span></p>

      {groups.map(g => (
        <section key={g} className="mt-6">
          <h2 className="text-[13px] font-bold text-slate-300 px-1 mb-2">{g}</h2>
          <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
            {data.fields.filter(f => f.group === g).map(f => {
              const items = texts[f.key] ?? [];
              const isOpen = open === f.key;
              const changed = JSON.stringify(items) !== JSON.stringify(data.defaults[f.key]);
              const long = f.max > 200;
              return (
                <div key={f.key}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : f.key)} aria-expanded={isOpen} className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-slate-700/40">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14.5px] font-semibold text-white">{f.label}</span>
                      <span className="block text-[12.5px] text-slate-400 truncate">{items.length} text{items.length === 1 ? "" : "s"} · {typeof items[0] === "string" ? items[0] : items[0]?.a ?? "None yet"}</span>
                    </span>
                    {changed && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">Changed</span>}
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="px-3 sm:px-4 pb-4 space-y-2.5">
                      {items.map((x, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="w-6 pt-2 text-[12px] text-slate-500 tabular-nums text-right flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0 grid gap-2">
                            {f.kind === "pair" && typeof x === "object" ? (
                              <>
                                <label className="block"><span className={label}>{f.parts?.[0]}</span>
                                  <input className={input} value={x.a} maxLength={f.max} onChange={e => setItems(f.key, items.map((y, k) => (k === i ? { ...(y as { a: string; b: string }), a: e.target.value } : y)))} /></label>
                                <label className="block"><span className={label}>{f.parts?.[1]}</span>
                                  <textarea rows={2} className={input} value={x.b} maxLength={f.max2} onChange={e => setItems(f.key, items.map((y, k) => (k === i ? { ...(y as { a: string; b: string }), b: e.target.value } : y)))} /></label>
                              </>
                            ) : (
                              <textarea aria-label={`${f.label} ${i + 1}`} rows={long ? (f.max > 2000 ? 10 : 4) : 1} className={cn(input, !long && "resize-none")} value={x as string} maxLength={f.max}
                                onChange={e => setItems(f.key, items.map((y, k) => (k === i ? e.target.value : y)))} />
                            )}
                          </div>
                          <button type="button" aria-label={`Remove text ${i + 1}`} onClick={() => setItems(f.key, items.filter((_, k) => k !== i))}
                            className="w-9 h-9 rounded-full hover:bg-rose-500/15 hover:text-rose-300 flex items-center justify-center text-slate-400 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2 pl-8">
                        <button type="button" onClick={() => setItems(f.key, [...items, f.kind === "pair" ? { a: "", b: "" } : ""])} className="h-9 px-3.5 rounded-full bg-slate-700 hover:bg-slate-600 text-[13px] font-semibold text-white inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add a text</button>
                        {changed && <button type="button" onClick={() => setItems(f.key, data.defaults[f.key] ?? [])} className="h-9 px-3.5 rounded-full bg-slate-800 border border-slate-700 text-[13px] font-semibold text-slate-300 inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />StuPanel&apos;s texts for this box</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {dirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900 border border-slate-700 shadow-xl">
          <button type="button" onClick={() => setTexts(data.texts)} disabled={saving} className="h-10 px-4 rounded-full text-[13px] font-semibold text-slate-300 hover:bg-slate-800">Undo changes</button>
          <button type="button" onClick={save} disabled={saving} className="h-10 px-5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-[13px] font-semibold text-white inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
          </button>
        </div>
      )}
    </div>
  );
}
