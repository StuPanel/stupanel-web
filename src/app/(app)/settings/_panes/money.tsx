"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, Loader2, Paintbrush, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { apiFetch, API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";
import { SearchPill, matches } from "@/components/list-ui";
import { cn } from "@/lib/utils";
import { Group, NumberField, Row, TextArea, TextField, useSettings } from "../_ui";

// ─── Payment methods ──────────────────────────────────────────────────────────
export function PaymentPane() {
  const { data, patch } = useSettings();
  const f = (k: string, label: string, ph: string, opts: { mono?: boolean; type?: string } = {}) => (
    <Row id={k} label={label}>
      <TextField label={label} value={data[k] ?? ""} placeholder={ph} mono={opts.mono} type={opts.type} onCommit={v => patch({ [k]: v })} />
    </Row>
  );
  return (
    <>
      <Group title="Mobile banking" note="Leave a number empty to hide it.">
        {f("bkashNumber", "bKash", "01XXXXXXXXX", { type: "tel", mono: true })}
        {f("nagadNumber", "Nagad", "01XXXXXXXXX", { type: "tel", mono: true })}
        {f("rocketNumber", "Rocket", "01XXXXXXXXX", { type: "tel", mono: true })}
      </Group>
      <Group title="Bank transfer" note="These details print at the bottom of every quote and invoice so clients know how to pay you.">
        {f("bankName", "Bank name", "e.g. Dutch-Bangla Bank")}
        {f("bankBranch", "Branch", "Branch name")}
        {f("bankAccountName", "Account holder name", "Name on the account")}
        {f("bankAccountNumber", "Account number", "1234567890", { mono: true })}
        {f("bankRoutingNumber", "Routing number", "Optional", { mono: true })}
      </Group>
    </>
  );
}

// ─── Quotations ───────────────────────────────────────────────────────────────
const DEFAULT_TERMS = `1. 50% advance payment required to confirm booking.
2. Remaining balance due on the event day.
3. Edited photos delivered within 30 working days.
4. Videos delivered within 45 working days.
5. Cancellation with less than 7 days notice will forfeit the advance.
6. Studio is not responsible for circumstances beyond our control.
7. This quotation is valid until the date mentioned above.`;

export function QuotesPane() {
  const { data, patch } = useSettings();
  return (
    <>
      <Group title="Defaults" note="You can still change these on each quotation.">
        <Row id="defaultValidityDays" label="Quote valid for" hint="The quote expires after this many days">
          <NumberField label="Quote valid for" value={Number(data.defaultValidityDays ?? 7)} min={1} max={365} suffix="days"
            onCommit={v => patch({ defaultValidityDays: v })} />
        </Row>
        <Row id="defaultAdvancePercent" label="Advance payment" hint="What the client pays to confirm">
          <NumberField label="Advance payment" value={Number(data.defaultAdvancePercent ?? 50)} min={0} max={100} step={5} suffix="%"
            onCommit={v => patch({ defaultAdvancePercent: v })} />
        </Row>
      </Group>
      <Group title="Terms & conditions" note="Printed on every new quotation.">
        <Row id="defaultTerms" label="Terms & conditions" stack>
          <TextArea label="Terms and conditions" rows={9} mono value={data.defaultTerms ?? DEFAULT_TERMS}
            onCommit={v => patch({ defaultTerms: v })} />
        </Row>
      </Group>
    </>
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
export function InvoicesPane() {
  const { data, patch } = useSettings();
  const pfx = (data.invoicePrefix || "INV").trim();
  const start = Number(data.invoiceStartNumber ?? 1);
  const pad = (n: number) => String(n).padStart(3, "0");

  return (
    <>
      <Group title="Design">
        <Link id="set-invoiceDesign" href="/settings/invoice-design" className="flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-[#F7F5FB]">
          <span className="w-11 h-11 rounded-[14px] bg-[#FBF2FA] text-[#9E3A8C] flex items-center justify-center flex-shrink-0"><Paintbrush className="w-5 h-5" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[#17151F]">Invoice designer</span>
            <span className="block text-xs text-[#6B6680] mt-0.5">Template, colours, fonts, logo, signature, paper size, VAT — with a live preview</span>
          </span>
          <ChevronRight className="w-4 h-4 text-[#A29DB3]" />
        </Link>
      </Group>

      <Group title="Payment">
        <Row id="invoiceDueDays" label="Payment due" hint="Days after the program's last event day">
          <NumberField label="Payment due" value={Number(data.invoiceDueDays ?? 60)} min={1} max={365} suffix="days" onCommit={v => patch({ invoiceDueDays: v })} />
        </Row>
      </Group>

      <Group title="Numbering" note={<>A program&apos;s invoice uses the program number. Invoices made by hand (album, prints…): <span className="font-mono font-semibold text-[#17151F]">{pfx}-{pad(start)}, {pfx}-{pad(start + 1)}…</span></>}>
        <Row id="invoicePrefix" label="Prefix" hint="Letters before the number, like INV or SP">
          <TextField label="Invoice prefix" value={data.invoicePrefix ?? "INV"} maxLength={20} mono align="right" onCommit={v => patch({ invoicePrefix: v || "INV" })} />
        </Row>
        <Row id="invoiceStartNumber" label="Starting number">
          <NumberField label="Starting number" value={start} min={1} max={999999} onCommit={v => patch({ invoiceStartNumber: v })} />
        </Row>
      </Group>
    </>
  );
}

// ─── Tax ──────────────────────────────────────────────────────────────────────
export function TaxPane() {
  const { data, patch } = useSettings();
  const pct = Number(data.defaultTaxPercent ?? 0);
  const label = data.taxLabel || "Tax";
  const sub = 50000, tax = (sub * pct) / 100;
  return (
    <>
      <Group title="Tax" note={pct === 0 ? "No tax is added. Set a rate to add it to new quotes and invoices." : `${pct}% ${label} is added to the subtotal of new quotes and invoices.`}>
        <Row id="taxLabel" label="Tax name" hint="Shown on documents, like VAT or GST">
          <TextField label="Tax name" value={data.taxLabel ?? "VAT"} maxLength={20} align="right" onCommit={v => patch({ taxLabel: v })} />
        </Row>
        <Row id="defaultTaxPercent" label="Tax rate">
          <NumberField label="Tax rate" value={pct} min={0} max={30} step={0.5} suffix="%" onCommit={v => patch({ defaultTaxPercent: v })} />
        </Row>
      </Group>
      <Group title="Example">
        <div className="px-4 sm:px-5 py-4 space-y-2 text-sm tabular-nums">
          <div className="flex justify-between text-[#4A4658]"><span>Subtotal</span><span>৳ {sub.toLocaleString()}</span></div>
          {pct > 0 && <div className="flex justify-between text-[#4A4658]"><span>{label} ({pct}%)</span><span>+ ৳ {tax.toLocaleString()}</span></div>}
          <div className="flex justify-between font-bold text-[#17151F] border-t border-[#EEEBF4] pt-2"><span>Total</span><span>৳ {(sub + tax).toLocaleString()}</span></div>
        </div>
      </Group>
    </>
  );
}

// ─── Service catalog ──────────────────────────────────────────────────────────
const UNITS = ["service", "hour", "day", "piece", "album", "copy", "session", "package", "item", "GB"];
const CATEGORIES = ["Photography", "Cinematography", "Drone", "Editing", "Album", "Printing", "Other"];
type Item = { id: string; name: string; description?: string; category?: string; unit: string; defaultPrice: number; currency: string; isActive: boolean; sortOrder: number };
const EMPTY = { name: "", description: "", category: "", unit: "service", defaultPrice: 0, currency: "BDT", isActive: true, sortOrder: 0 };

export function CatalogPane() {
  const { data } = useSettings();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; form: typeof EMPTY } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const r = await apiFetch(`${API}/service-catalog?limit=200`);
      const d = await r.json();
      setItems(d.data ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    if (!editing.form.name.trim()) { setError("Please enter a name"); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(editing.id ? `${API}/service-catalog/${editing.id}` : `${API}/service-catalog`, {
        method: editing.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing.form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save"); return; }
      notify(editing.id ? "Service updated" : "Service added");
      setEditing(null); load();
    } catch { setError("Something went wrong"); }
    finally { setSaving(false); }
  }

  async function remove(it: Item) {
    if (!(await askConfirm({ title: `Remove "${it.name}"?`, message: "It won't be offered on new invoices. Old invoices don't change.", confirmLabel: "Remove", danger: true }))) return;
    const r = await apiFetch(`${API}/service-catalog/${it.id}`, { method: "DELETE" });
    if (r.ok) { notify("Service removed"); load(); } else notify("Couldn't remove", { error: true });
  }

  const shown = items.filter(i => matches(q, i.name, i.category, i.description));
  const set = (k: keyof typeof EMPTY, v: unknown) => setEditing(e => e && { ...e, form: { ...e.form, [k]: v } });
  const inputCls = "w-full h-11 px-4 rounded-[16px] bg-[#F5F3FA] text-sm text-[#17151F] placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40";

  return (
    <>
      <div className="flex gap-2 mb-4">
        <div className="flex-1"><SearchPill value={q} onChange={setQ} placeholder="Search services…" /></div>
        <button onClick={() => { setError(""); setEditing({ id: null, form: { ...EMPTY, currency: data.currency || "BDT" } }); }}
          className="h-11 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
          <Plus className="w-4 h-4" /> Add service
        </button>
      </div>

      <Group title="Services" note="Pick these when you add lines to an invoice — the price fills in by itself.">
        <div id="set-catalog-list" className="sp-set-row scroll-mt-28 divide-y divide-[#EEEBF4]">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>
          ) : shown.length === 0 ? (
            <div className="py-10 text-center px-4">
              <BookOpen className="sp-empty-icon" />
              <p className="text-sm font-semibold text-[#17151F]">{q ? `No services match "${q}"` : "No services yet"}</p>
              <p className="text-xs text-[#6B6680] mt-1">{q ? "Try another word." : "Add the services you sell most to invoice faster."}</p>
            </div>
          ) : shown.map(it => (
            <div key={it.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#17151F] truncate">{it.name}</p>
                <p className="text-xs text-[#6B6680] truncate">{[it.category, `per ${it.unit}`, it.description].filter(Boolean).join(" · ")}</p>
              </div>
              <p className="text-sm font-bold text-[#17151F] tabular-nums flex-shrink-0">{it.currency} {Number(it.defaultPrice).toLocaleString()}</p>
              <button aria-label={`Edit ${it.name}`} onClick={() => { setError(""); setEditing({ id: it.id, form: { name: it.name, description: it.description ?? "", category: it.category ?? "", unit: it.unit, defaultPrice: Number(it.defaultPrice), currency: it.currency, isActive: it.isActive, sortOrder: it.sortOrder } }); }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA] hover:text-[#5B3FD0]"><Pencil className="w-4 h-4" /></button>
              <button aria-label={`Remove ${it.name}`} onClick={() => remove(it)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#FDECEF] hover:text-[#C2304F]"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </Group>

      {editing && (
        <>
          <div className="sp-backdrop" onClick={() => setEditing(null)} />
          <aside className="sp-drawer flex flex-col" role="dialog" aria-modal="true" aria-label={editing.id ? "Edit service" : "New service"}>
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3 border-b border-[#EEEBF4]">
              <div>
                <p className="text-xs font-semibold text-[#6B6680]">Service catalog</p>
                <h2 className="text-lg font-bold text-[#17151F]">{editing.id ? "Edit service" : "New service"}</h2>
              </div>
              <button onClick={() => setEditing(null)} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && <p role="alert" className="text-sm text-[#C2304F] bg-[#FDECEF] rounded-[14px] px-4 py-2.5">{error}</p>}
              <label className="block"><span className="text-xs font-semibold text-[#4A4658]">Name</span>
                <input className={cn(inputCls, "mt-1.5")} value={editing.form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Wedding Photography" autoFocus /></label>
              <label className="block"><span className="text-xs font-semibold text-[#4A4658]">Description</span>
                <input className={cn(inputCls, "mt-1.5")} value={editing.form.description} onChange={e => set("description", e.target.value)} placeholder="Optional" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-semibold text-[#4A4658]">Category</span>
                  <input className={cn(inputCls, "mt-1.5")} list="catalog-cats" value={editing.form.category} onChange={e => set("category", e.target.value)} placeholder="Photography" />
                  <datalist id="catalog-cats">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist></label>
                <label className="block"><span className="text-xs font-semibold text-[#4A4658]">Per</span>
                  <select className={cn(inputCls, "mt-1.5")} value={editing.form.unit} onChange={e => set("unit", e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></label>
                <label className="block"><span className="text-xs font-semibold text-[#4A4658]">Price</span>
                  <input className={cn(inputCls, "mt-1.5 tabular-nums")} type="number" min={0} value={editing.form.defaultPrice} onChange={e => set("defaultPrice", Number(e.target.value))} /></label>
                <label className="block"><span className="text-xs font-semibold text-[#4A4658]">Currency</span>
                  <select className={cn(inputCls, "mt-1.5")} value={editing.form.currency} onChange={e => set("currency", e.target.value)}>
                    {["BDT", "USD", "INR", "GBP", "EUR", "AED"].map(c => <option key={c} value={c}>{c}</option>)}</select></label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#EEEBF4] flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold hover:bg-[#EEEBF4]">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing.id ? "Save" : "Add service"}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
