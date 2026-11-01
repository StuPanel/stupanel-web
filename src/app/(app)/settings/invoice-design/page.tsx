"use client";

/**
 * Settings → Invoice designer.
 * Choices on the left, the invoice (or a money receipt) drawn live on the right.
 * Every change saves by itself.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { Group, Row, Segmented, Switch, TextArea, TextField } from "../_ui";
import {
  FONTS, PAPER, SECTION_LABEL, TEMPLATES, colorsOf, withDefaults,
  type FontId, type InvoiceDesign, type LogoPos, type PaperId, type TemplateId,
} from "@/components/invoice-doc/design";
import { InvoiceDocument, type DocStudio } from "@/components/invoice-doc/invoice-document";
import { DesignFonts, ScaledDocument } from "@/components/invoice-doc/scaled";
import { sampleInvoice, sampleReceipt } from "@/components/invoice-doc/sample";

type Loaded = { design: InvoiceDesign; company: DocStudio & { invoiceDueDays?: number; defaultTerms?: string | null; currency?: string } };

export default function InvoiceDesignerPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [d, setD] = useState<InvoiceDesign | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [show, setShow] = useState<"invoice" | "receipt">("invoice");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch(`${API}/studio-invoices/design`).then(r => r.ok ? r.json() : Promise.reject())
      .then((x: Loaded) => { setLoaded(x); setD(withDefaults(x.design)); })
      .catch(() => notify("Couldn't load the invoice design.", { error: true }));
  }, []);

  const save = useCallback((next: InvoiceDesign) => {
    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`${API}/studio-invoices/design`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ design: next }),
        });
        setState(r.ok ? "saved" : "error");
        if (!r.ok) notify("Couldn't save. Please try again.", { error: true });
      } catch { setState("error"); }
    }, 500);
  }, []);

  const update = useCallback((fn: (x: InvoiceDesign) => InvoiceDesign) => {
    setD(prev => {
      if (!prev) return prev;
      const next = fn(prev);
      save(next);
      return next;
    });
  }, [save]);

  const sample = useMemo(() => {
    if (!loaded || !d) return null;
    const c = loaded.company;
    const inv = sampleInvoice(c, { vatOn: d.vat.on, vatPercent: d.vat.percent, vatLabel: d.vat.label, dueDays: c.invoiceDueDays ?? 60, terms: c.defaultTerms, currency: c.currency });
    return { inv, rec: sampleReceipt(inv) };
  }, [loaded, d]);

  if (!d || !loaded || !sample) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#7D5CEF]" /></div>;
  }
  const colors = colorsOf(d);

  return (
    <div className="max-w-[1400px] mx-auto">
      <DesignFonts fonts={FONTS.map(f => f.id)} />
      <div className="flex items-center gap-3 mb-5">
        <Link href="/settings?pane=invoices" aria-label="Back to settings" className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-[0_1px_2px_rgba(22,18,40,.06)]"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">Invoice design</h1>
          <p className="text-sm text-[#6B6680]">How your invoices, quotations and money receipts look. Changes save by themselves.</p>
        </div>
        <span className={cn("text-xs font-semibold inline-flex items-center gap-1", state === "error" ? "text-[#C2304F]" : "text-[#6B6680]")}>
          {state === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving</>}
          {state === "saved" && <><Check className="w-3.5 h-3.5 text-[#1F8A5B]" />Saved</>}
          {state === "error" && "Not saved"}
        </span>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* ── Controls ── */}
        <div className="min-w-0">
          <Group title="Template">
            <div className="grid grid-cols-2 gap-3 p-3">
              {TEMPLATES.map(t => {
                const active = d.template === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => update(x => ({ ...x, template: t.id as TemplateId, primary: null, secondary: null }))}
                    className={cn("rounded-2xl p-2 text-left border-2 transition-colors", active ? "border-[#7D5CEF] bg-[#F7F4FF]" : "border-transparent hover:bg-[#F7F5FB]")}>
                    <div className="h-[150px] overflow-hidden rounded-lg bg-[#F5F3FA] pointer-events-none">
                      <div style={{ transform: "scale(0.215)", transformOrigin: "top left", width: PAPER.a4.w }}>
                        <InvoiceDocument data={sample.inv} design={{ ...d, template: t.id as TemplateId, primary: null, secondary: null, paper: "a4" }} />
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-bold text-[#17151F]">{t.name}</p>
                    <p className="text-[11px] text-[#6B6680]">{t.sub}</p>
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Colours" note="Only your invoices, quotations and receipts use these — not the app.">
            <Row label="Main colour">
              <ColorPick value={colors.primary} onChange={v => update(x => ({ ...x, primary: v }))} />
            </Row>
            <Row label="Second colour">
              <ColorPick value={colors.secondary} onChange={v => update(x => ({ ...x, secondary: v }))} />
            </Row>
            {(d.primary || d.secondary) && (
              <Row label="Template colours" hint="Go back to the template's own colours">
                <button type="button" onClick={() => update(x => ({ ...x, primary: null, secondary: null }))} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Reset</button>
              </Row>
            )}
          </Group>

          <Group title="Fonts">
            <div className="grid grid-cols-2 gap-2 p-3">
              {FONTS.map(f => (
                <button key={f.id} type="button" onClick={() => update(x => ({ ...x, font: f.id as FontId }))}
                  className={cn("rounded-xl px-3 py-2.5 text-left border-2", d.font === f.id ? "border-[#7D5CEF] bg-[#F7F4FF]" : "border-[#EEEBF4] hover:bg-[#F7F5FB]")}>
                  <span className="block text-[20px] leading-tight text-[#17151F]" style={{ fontFamily: `'${f.head}', serif`, fontWeight: f.headWeight }}>Invoice</span>
                  <span className="block text-[12px] text-[#6B6680]" style={{ fontFamily: `'${f.body}', sans-serif` }}>{f.name} · {f.head}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="Logo" note={!loaded.company.logoUrl ? <>No logo yet — add it in <Link href="/settings?pane=branding" className="font-semibold text-[#5B3FD0]">Branding</Link>.</> : undefined}>
            <Row label="Place" stack>
              <Segmented<LogoPos> label="Logo place" value={d.logo.position} onChange={v => update(x => ({ ...x, logo: { ...x.logo, position: v } }))}
                options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }, { value: "title", label: "Next to title" }]} />
            </Row>
            <Row label="Size" stack>
              <input type="range" min={32} max={160} step={4} value={d.logo.size} aria-label="Logo size"
                onChange={e => { const v = Number(e.target.value); update(x => ({ ...x, logo: { ...x.logo, size: v } })); }}
                className="w-full accent-[#7D5CEF]" />
            </Row>
            <Row label="Show studio name">
              <Switch label="Show studio name" on={d.logo.showName} onChange={v => update(x => ({ ...x, logo: { ...x.logo, showName: v } }))} />
            </Row>
          </Group>

          <Group title="Paper size" note="PDF and print use this size. The content arranges itself to fit.">
            <Row label="Size" stack>
              <Segmented<PaperId> label="Paper size" value={d.paper} onChange={v => update(x => ({ ...x, paper: v }))}
                options={(Object.keys(PAPER) as PaperId[]).map(k => ({ value: k, label: PAPER[k].name }))} />
            </Row>
          </Group>

          <Group title="What to show" note="Use the arrows to change the order.">
            {d.sections.map((s, i) => (
              <div key={s.key} className="px-4 sm:px-5 py-2.5 flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => update(x => ({ ...x, sections: move(x.sections, i, -1) }))} className="w-7 h-5 flex items-center justify-center text-[#6B6680] disabled:opacity-25"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label="Move down" disabled={i === d.sections.length - 1} onClick={() => update(x => ({ ...x, sections: move(x.sections, i, 1) }))} className="w-7 h-5 flex items-center justify-center text-[#6B6680] disabled:opacity-25"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
                <span className={cn("flex-1 text-sm font-semibold", s.on ? "text-[#17151F]" : "text-[#A29DB3]")}>{SECTION_LABEL[s.key]}</span>
                <Switch label={SECTION_LABEL[s.key]} on={s.on} onChange={v => update(x => ({ ...x, sections: x.sections.map(y => y.key === s.key ? { ...y, on: v } : y) }))} />
              </div>
            ))}
          </Group>

          <Group title="Table columns">
            <Row label="Line number"><Switch label="Line number" on={d.columns.no} onChange={v => update(x => ({ ...x, columns: { ...x.columns, no: v } }))} /></Row>
            <Row label="Quantity"><Switch label="Quantity" on={d.columns.qty} onChange={v => update(x => ({ ...x, columns: { ...x.columns, qty: v } }))} /></Row>
            <Row label="Rate"><Switch label="Rate" on={d.columns.rate} onChange={v => update(x => ({ ...x, columns: { ...x.columns, rate: v } }))} /></Row>
          </Group>

          <Group title="VAT" note="Off by default. When on, it is added to every program's invoice total.">
            <Row label="Add VAT"><Switch label="Add VAT" on={d.vat.on} onChange={v => update(x => ({ ...x, vat: { ...x.vat, on: v } }))} /></Row>
            {d.vat.on && <>
              <Row label="Rate">
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} max={50} step={0.5} value={d.vat.percent} aria-label="VAT rate"
                    onChange={e => { const v = Math.min(50, Math.max(0, Number(e.target.value) || 0)); update(x => ({ ...x, vat: { ...x.vat, percent: v } })); }}
                    className="w-20 h-9 px-2 rounded-lg border border-[#E6E2EE] text-sm text-right" />
                  <span className="text-sm text-[#6B6680]">%</span>
                </div>
              </Row>
              <Row label="Name"><TextField label="VAT name" value={d.vat.label} maxLength={20} align="right" onCommit={v => update(x => ({ ...x, vat: { ...x.vat, label: v || "VAT" } }))} /></Row>
            </>}
          </Group>

          <SignatureGroup d={d} update={update} />

          <Group title="Text">
            <Row label="Thank-you line" stack>
              <TextField label="Thank-you line" wide value={d.thanksText} maxLength={200} onCommit={v => update(x => ({ ...x, thanksText: v }))} />
            </Row>
            <Row label="Footer note" hint="Shown above your phone, email and website" stack>
              <TextArea label="Footer note" rows={2} maxLength={500} value={d.footerText} onCommit={v => update(x => ({ ...x, footerText: v }))} />
            </Row>
          </Group>
        </div>

        {/* ── Live preview ── */}
        <div className="lg:sticky lg:top-4 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <Segmented<"invoice" | "receipt"> label="Preview" value={show} onChange={setShow}
              options={[{ value: "invoice", label: "Invoice" }, { value: "receipt", label: "Money receipt" }]} />
            <span className="text-xs text-[#6B6680]">Sample program · {PAPER[d.paper].name}</span>
          </div>
          <div className="rounded-[24px] bg-[#ECE9F2] p-4 sm:p-6 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
            <div style={{ maxWidth: d.paper === "pos80" ? 340 : undefined, margin: "0 auto" }}>
              <ScaledDocument data={show === "invoice" ? sample.inv : sample.rec} design={d} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ColorPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = value;
  return (
    <label className="inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-[#F5F3FA] cursor-pointer">
      <input type="color" value={v} aria-label="Pick colour" onChange={e => onChange(e.target.value.toUpperCase())}
        className="w-7 h-7 rounded-full border-0 bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0" />
      <span className="font-mono text-xs text-[#4A4658]">{v.toUpperCase()}</span>
    </label>
  );
}

function SignatureGroup({ d, update }: { d: InvoiceDesign; update: (fn: (x: InvoiceDesign) => InvoiceDesign) => void }) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(f: File) {
    if (f.size > 1024 * 1024) { notify("Image must be under 1 MB.", { error: true }); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await apiFetch(`${API}/studio-invoices/design/signature`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notify(j.message || "Upload failed.", { error: true }); return; }
      update(x => ({ ...x, signature: { ...x.signature, imageUrl: j.url } }));
    } finally { setBusy(false); }
  }
  return (
    <Group title="Signature" note="Upload a signature or seal image, or type a name to show it in handwriting.">
      <Row label="Signature / seal image" hint="PNG with a clear background looks best. Under 1 MB.">
        <div className="flex items-center gap-2">
          {d.signature.imageUrl && <img src={d.signature.imageUrl} alt="" className="h-9 max-w-[90px] object-contain" />}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold inline-flex items-center gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}{d.signature.imageUrl ? "Change" : "Upload"}
          </button>
          {d.signature.imageUrl && <button type="button" aria-label="Remove image" onClick={() => update(x => ({ ...x, signature: { ...x.signature, imageUrl: null } }))} className="w-9 h-9 rounded-full hover:bg-[#FDECEF] text-[#C2304F] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>}
        </div>
      </Row>
      <Row label="Name"><TextField label="Signature name" value={d.signature.name} maxLength={80} placeholder="e.g. Md. Faisal" onCommit={v => update(x => ({ ...x, signature: { ...x.signature, name: v } }))} /></Row>
      <Row label="Title"><TextField label="Signature title" value={d.signature.title} maxLength={80} placeholder="e.g. Founder" onCommit={v => update(x => ({ ...x, signature: { ...x.signature, title: v } }))} /></Row>
      <Row label="Show name in handwriting" hint="Used when there is no image">
        <Switch label="Handwriting" on={d.signature.handwritten} onChange={v => update(x => ({ ...x, signature: { ...x.signature, handwritten: v } }))} />
      </Row>
    </Group>
  );
}
