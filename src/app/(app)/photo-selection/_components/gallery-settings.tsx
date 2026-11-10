"use client";

/** Settings of one photo selection: name, time to choose, albums and limits, notes, watermark, a message for the client. */
import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { Field, FormDrawer, FormGroup, SwitchRow, inputCls } from "@/components/ui/form-kit";
import type { GalleryDetail } from "@/lib/photos";

type Row = { id?: string; name: string; min: string; max: string; allowExtra: boolean; total?: number; gone?: boolean };
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "");

export function GallerySettings({ g, onClose, onSaved }: { g: GalleryDetail; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(g.title);
  const [deadline, setDeadline] = useState(toLocal(g.deadline));
  const [allowNotes, setAllowNotes] = useState(g.allowNotes);
  const [watermark, setWatermark] = useState(g.watermark);
  const [welcome, setWelcome] = useState(g.welcome ?? "");
  const [rows, setRows] = useState<Row[]>(g.albums.map(a => ({ id: a.id, name: a.name, min: a.minPicks?.toString() ?? "", max: a.maxPicks?.toString() ?? "", allowExtra: !!a.allowExtra, total: a.total })));
  const [saving, setSaving] = useState(false);

  const live = rows.filter(r => !r.gone);
  const bad = live.find(r => !r.name.trim() || (r.min && r.max && Number(r.min) > Number(r.max)));
  const missing = !title.trim() ? "Give it a name" : !live.length ? "Keep at least one album" : bad ? (!bad.name.trim() ? "Give every album a name" : `${bad.name}: fewest can't be more than most`) : "";

  async function remove(r: Row) {
    if (r.id && (r.total ?? 0) > 0 && !(await askConfirm({ title: `Remove "${r.name}"?`, message: `Its ${r.total} photos and the client's choices in it are removed too.`, confirmLabel: "Remove", danger: true }))) return;
    setRows(list => list.map(x => (x === r ? { ...x, gone: true } : x)).filter(x => x.id || !x.gone));
  }

  async function save() {
    if (missing) return;
    setSaving(true);
    try {
      const j = (u: string, method: string, body?: unknown) => apiFetch(`${API}/photo-selection/${g.id}${u}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const fail = async (r: Response) => { const d = await r.json().catch(() => ({})); throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save"); };
      const r = await j("", "PATCH", {
        title: title.trim(), deadline: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : null,
        allowNotes, watermark, welcome: welcome.trim() || null,
      });
      if (!r.ok) await fail(r);
      let order = 0;
      for (const row of rows) {
        const lim = { minPicks: row.min ? Number(row.min) : null, maxPicks: row.max ? Number(row.max) : null, allowExtra: row.allowExtra };
        if (row.gone && row.id) { const x = await j(`/albums/${row.id}`, "DELETE"); if (!x.ok) await fail(x); continue; }
        if (row.gone) continue;
        const x = row.id
          ? await j(`/albums/${row.id}`, "PATCH", { name: row.name.trim(), ...lim, sortOrder: order })
          : await j(`/albums`, "POST", { name: row.name.trim(), ...lim });
        if (!x.ok) await fail(x);
        order++;
      }
      notify("Saved");
      onSaved(); onClose();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't save", { error: true });
    } finally { setSaving(false); }
  }

  const num = "w-full h-10 px-2 rounded-[10px] bg-[#F5F3FA] text-[15px] text-center outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF]";
  const set = (r: Row, p: Partial<Row>) => setRows(list => list.map(x => (x === r ? { ...x, ...p } : x)));

  return (
    <FormDrawer open onClose={onClose} icon={Settings2} color="ink" title="Selection settings" sub={g.title}
      footer={
        <>
          <p className="flex-1 self-center text-[13px] text-[#6B6680]">{missing}</p>
          <button type="button" onClick={save} disabled={!!missing || saving}
            className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save
          </button>
        </>
      }>
      <FormGroup>
        <Field label="Name">{id => <input id={id} value={title} maxLength={150} onChange={e => setTitle(e.target.value)} className={inputCls} />}</Field>
        <Field label="Last day to choose" hint={deadline ? "The client sees a countdown. After this day they can't change their choice." : "No time limit."}>
          {id => (
            <div className="flex gap-2">
              <input id={id} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
              {deadline && <button type="button" onClick={() => setDeadline("")} className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] flex-shrink-0">No limit</button>}
            </div>
          )}
        </Field>
      </FormGroup>

      <FormGroup title="Albums and how many photos" note="Fewest and most are optional. The client is warned if they pick fewer or more.">
        <div className="p-3.5">
          <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_32px] gap-2 px-1 mb-1.5 text-[12px] font-semibold text-[#6B6680]">
            <span>Album</span><span className="text-center">Fewest</span><span className="text-center">Most</span><span />
          </div>
          <div className="space-y-2">
            {rows.filter(r => !r.gone).map((r, i) => (
              <div key={r.id ?? `n${i}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_32px] gap-2 items-center">
                  <input value={r.name} maxLength={80} onChange={e => set(r, { name: e.target.value })} aria-label="Album name"
                    className="w-full h-10 px-3 rounded-[10px] bg-[#F5F3FA] text-[15px] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF]" />
                  <input value={r.min} inputMode="numeric" onChange={e => set(r, { min: e.target.value.replace(/\D/g, "").slice(0, 4) })} aria-label={`Fewest for ${r.name}`} placeholder="—" className={num} />
                  <input value={r.max} inputMode="numeric" onChange={e => set(r, { max: e.target.value.replace(/\D/g, "").slice(0, 4) })} aria-label={`Most for ${r.name}`} placeholder="—" className={num} />
                  <button type="button" onClick={() => remove(r)} disabled={live.length === 1} aria-label={`Remove ${r.name}`}
                    className="w-8 h-8 rounded-full text-[#C2304F] hover:bg-[#FDECEF] flex items-center justify-center disabled:opacity-25"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-1 text-[12.5px] text-[#6B6680]">
                  {r.total !== undefined && <span>{r.total} photos</span>}
                  {r.max && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-[#4A4658]">
                      <input type="checkbox" checked={r.allowExtra} onChange={e => set(r, { allowExtra: e.target.checked })} className="w-4 h-4 accent-[#7D5CEF]" />
                      Allow more than {r.max}
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
          {live.length < 20 && (
            <button type="button" onClick={() => setRows(l => [...l, { name: "", min: "", max: "", allowExtra: false }])}
              className="mt-3 h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#EEE8FD]">
              <Plus className="w-4 h-4" />Add album
            </button>
          )}
        </div>
      </FormGroup>

      <FormGroup title="For the client">
        <SwitchRow label="Notes on photos" hint="The client can write a note on a photo (e.g. “make this brighter”)" on={allowNotes} onChange={setAllowNotes} />
        <SwitchRow label="Watermark" hint="Your studio watermark on the photos they see" on={watermark} onChange={setWatermark} />
        <Field label="Message on top (optional)" hint="e.g. Pick your favourite 80 for the wedding album. Tap ♥ on the ones you love most.">
          {id => <textarea id={id} value={welcome} maxLength={2000} rows={3} onChange={e => setWelcome(e.target.value)} className={cn(inputCls, "h-auto py-2.5 resize-none")} />}
        </Field>
      </FormGroup>
      <p className="px-1 text-[12.5px] text-[#6B6680]">The watermark&apos;s look is set for the whole studio in <Link href="/settings?pane=watermark" className="font-semibold text-[#5B3FD0] hover:underline">Settings → Watermark</Link>.</p>
    </FormDrawer>
  );
}
