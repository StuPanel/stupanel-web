"use client";

import { MessageSquareText as HeaderIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/apple";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Trash2, Check, Loader2, MessageCircle, Copy, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Chips, EmptyState, Tile, type TileColor } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";
import { askConfirm } from "@/components/feedback";
import { API_URL as API } from "@/lib/api";
import { EditableSelect } from "@/components/ui/editable-select";


const CATEGORIES: { key: string; label: string; color: string; tile: TileColor }[] = [
  { key: "booking_confirmation", label: "Booking confirmation", color: "bg-[#EEE8FD] text-[#5B3FD0]", tile: "deep" },
  { key: "payment_reminder",     label: "Payment reminder",     color: "bg-[#FFF3E0] text-[#9A5B00]", tile: "orchid" },
  { key: "delivery_notification",label: "Delivery",             color: "bg-[#E3F2F1] text-[#126B66]", tile: "teal" },
  { key: "event_reminder",       label: "Event reminder",       color: "bg-[#E8F0FA] text-[#1F5C99]", tile: "blue" },
  { key: "custom",               label: "Custom",               color: "bg-[#F1EFF6] text-[#4A4658]", tile: "green" },
];
function catCfg(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? { key, label: key, color: CATEGORIES[4].color };
}

const PLACEHOLDERS = [
  { key: "{{clientName}}",    label: "Client name" },
  { key: "{{phone}}",         label: "Client phone" },
  { key: "{{bookingNumber}}", label: "Program number" },
  { key: "{{eventName}}",     label: "Program name" },
  { key: "{{eventDate}}",     label: "Date" },
  { key: "{{eventLocation}}", label: "Place" },
  { key: "{{package}}",       label: "Package" },
  { key: "{{totalAmount}}",   label: "Total" },
  { key: "{{paidAmount}}",    label: "Paid" },
  { key: "{{dueAmount}}",     label: "Due" },
  { key: "{{currency}}",      label: "Currency" },
  { key: "{{companyName}}",   label: "Studio name" },
];

interface Template {
  id: string; name: string; category: string; body: string; isActive: boolean;
}

// ─── Template Form ─────────────────────────────────────────────────────────────
function TemplateForm({ initial, onSave, onCancel }: {
  initial?: Template; onSave: (t: Template) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "custom");
  const [body, setBody] = useState(initial?.body ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function insertPlaceholder(ph: string) {
    const ta = document.getElementById("wa-body") as HTMLTextAreaElement;
    if (!ta) { setBody(b => b + ph); return; }
    const s = ta.selectionStart; const e = ta.selectionEnd;
    const next = body.slice(0, s) + ph + body.slice(e);
    setBody(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + ph.length, s + ph.length); }, 0);
  }

  async function save() {
    if (!name.trim()) { setError("Template name is required."); return; }
    if (!body.trim()) { setError("Message body is required."); return; }
    setError(""); setLoading(true);
    try {
      const url = initial ? `${API}/wa-templates/${initial.id}` : `${API}/wa-templates`;
      const method = initial ? "PATCH" : "POST";
      const r = await apiFetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), category, body: body.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to save."); return; }
      onSave(d);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">Template name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Booking confirmed" className={inputCls} />
        </label>
        <div>
          <span className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">Kind</span>
          <EditableSelect value={category} onChange={setCategory} options={CATEGORIES.map(c => ({ value: c.key, label: c.label }))} className="h-11" />
        </div>
      </div>

      <div>
        <span className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">Message</span>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PLACEHOLDERS.map(p => (
            <button key={p.key} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insertPlaceholder(p.key)}
              className="h-8 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1">
              <Plus className="w-3 h-3" />{p.label}
            </button>
          ))}
        </div>
        <textarea id="wa-body" value={body} onChange={e => setBody(e.target.value)} rows={8} aria-label="Message"
          placeholder={"Hi {{clientName}},\n\nYour booking is confirmed.\nDate: {{eventDate}}\nTotal: {{totalAmount}}\n\nThank you — {{companyName}}"}
          className="w-full px-3.5 py-3 rounded-[14px] bg-[#F5F3FA] text-[14px] text-[#17151F] placeholder:text-[#A29DB3] border border-transparent outline-none focus:bg-white focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/12 resize-y leading-relaxed" />
        <p className="text-[12.5px] text-[#6B6680] mt-1.5">{body.length} characters · the fields fill in by themselves when you send</p>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 sm:flex-none h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
        <button type="button" onClick={save} disabled={loading} className="flex-1 sm:flex-none h-11 px-6 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{initial ? "Save changes" : "Save template"}
        </button>
      </div>
    </div>
  );
}

/** The message as a chat bubble, with the fill-in fields shown as soft violet labels. */
function Bubble({ body }: { body: string }) {
  const parts = body.split(/(\{\{\w+\}\})/g);
  return (
    <div className={cn("rounded-[18px] rounded-tl-[6px] bg-[#F0FAF4] px-4 py-3 text-[13.5px] text-[#17151F] leading-relaxed whitespace-pre-wrap max-h-[176px] overflow-hidden",
      (body.split("\n").length > 7 || body.length > 260) && "[mask-image:linear-gradient(to_bottom,#000_70%,transparent)]")}>
      {parts.map((p, i) => {
        const ph = PLACEHOLDERS.find(x => x.key === p);
        return ph ? <span key={i} className="inline-block px-1.5 rounded-md bg-[#EEE8FD] text-[#5B3FD0] font-semibold text-[12.5px]">{ph.label}</span> : <span key={i}>{p}</span>;
      })}
    </div>
  );
}

// ─── Templates manager (Settings → WhatsApp Templates, or the /whatsapp page for managers) ───
export function WhatsAppTemplates({ embedded = false }: { embedded?: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/wa-templates`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) setTemplates(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seedDefaults() {
    setSeeding(true);
    try {
      await apiFetch(`${API}/wa-templates/seed-defaults`, { method: "POST" });
      await load();
    } finally { setSeeding(false); }
  }

  function onSaved(t: Template) {
    setTemplates(ts => {
      const idx = ts.findIndex(x => x.id === t.id);
      if (idx >= 0) { const n = [...ts]; n[idx] = t; return n; }
      return [t, ...ts];
    });
    setShowForm(false); setEditing(null);
  }

  async function del(id: string) {
    setDeleting(id);
    try {
      await apiFetch(`${API}/wa-templates/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      setTemplates(ts => ts.filter(t => t.id !== id));
    } finally { setDeleting(null); }
  }

  function copyBody(t: Template) {
    navigator.clipboard.writeText(t.body);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const visible = templates.filter(t => categoryFilter === "all" || t.category === categoryFilter);

  async function askDelete(t: Template) {
    if (await askConfirm({ title: `Delete "${t.name}"?`, message: "This message template will be removed.", confirmLabel: "Delete", danger: true })) void del(t.id);
  }
  const newBtn = (
    <button type="button" onClick={() => setShowForm(true)} className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center gap-1.5 flex-shrink-0">
      <Plus className="w-4 h-4" />New template
    </button>
  );
  const editingNow = showForm || !!editing;

  return (
    <div className="space-y-5">
      {embedded ? (
        !editingNow && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-[#4A4658]">{templates.length} template{templates.length === 1 ? "" : "s"}</p>
            {newBtn}
          </div>
        )
      ) : (
        <PageHeader icon={HeaderIcon} color="green" title="WhatsApp Templates" sub={<>{templates.length} templates · send from any program</>}>
          {!editingNow && newBtn}
        </PageHeader>
      )}

      {!editingNow && (
        <div className={cn("bg-white rounded-[20px] p-4 flex items-start gap-3", CARD_SHADOW)}>
          <Tile icon={MessageCircle} color="green" size={36} />
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[#17151F]">How it works</p>
            <p className="text-[13px] text-[#6B6680] mt-0.5 leading-relaxed">Write a message once with fields like <span className="inline-block px-1.5 rounded-md bg-[#EEE8FD] text-[#5B3FD0] font-semibold text-[12.5px]">Client name</span>. In a program, tap WhatsApp, pick the template — the client&apos;s details fill in and WhatsApp opens with the message ready.</p>
          </div>
        </div>
      )}

      {editingNow && (
        <div className={cn("bg-white rounded-[20px] p-4 sm:p-5", CARD_SHADOW)}>
          <h3 className="text-[17px] font-extrabold tracking-[-0.01em] text-[#17151F] mb-4">{editing ? "Edit template" : "New template"}</h3>
          <TemplateForm initial={editing ?? undefined} onSave={onSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </div>
      )}

      {!loading && templates.length > 0 && !editingNow && (
        <Chips label="Filter by kind" value={categoryFilter} onChange={setCategoryFilter} options={[
          { value: "all", label: "All", count: templates.length },
          ...CATEGORIES.filter(c => templates.some(t => t.category === c.key)).map(c => ({ value: c.key, label: c.label, count: templates.filter(t => t.category === c.key).length })),
        ]} />
      )}

      {loading && <div className="grid lg:grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="sp-skel h-[170px] rounded-[20px]" />)}</div>}

      {!loading && templates.length === 0 && !showForm && (
        <EmptyState icon={MessageCircle} title="No templates yet" text="Start with our ready messages, or write your own."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={seedDefaults} disabled={seeding} className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Use ready templates
              </button>
              <button type="button" onClick={() => setShowForm(true)} className="h-10 px-4 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[#17151F] text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Write my own</button>
            </div>
          } />
      )}

      {!loading && !editingNow && visible.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-3">
          {visible.map(t => {
            const cc = catCfg(t.category);
            return (
              <article key={t.id} className={cn("bg-white rounded-[20px] p-4 flex flex-col", CARD_SHADOW)}>
                <div className="flex items-center gap-3 mb-3">
                  <Tile icon={MessageCircle} color={"tile" in cc ? cc.tile : "green"} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-[#17151F] truncate">{t.name}</p>
                    <span className={cn("inline-flex mt-0.5 h-5 px-2 rounded-full text-[11.5px] font-bold items-center", cc.color)}>{cc.label}</span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button type="button" onClick={() => copyBody(t)} aria-label={`Copy ${t.name}`} title="Copy"
                      className="w-9 h-9 flex items-center justify-center rounded-full text-[#6B6680] hover:bg-[#F1EFF6] hover:text-[#17151F]">
                      {copiedId === t.id ? <Check className="w-4 h-4 text-[#1F8A5B]" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => { setEditing(t); setShowForm(false); }} aria-label={`Edit ${t.name}`} title="Edit"
                      className="w-9 h-9 flex items-center justify-center rounded-full text-[#6B6680] hover:bg-[#EEE8FD] hover:text-[#5B3FD0]"><Edit2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => askDelete(t)} disabled={deleting === t.id} aria-label={`Delete ${t.name}`} title="Delete"
                      className="w-9 h-9 flex items-center justify-center rounded-full text-[#6B6680] hover:bg-[#FDECEF] hover:text-[#C2304F]">
                      {deleting === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Bubble body={t.body} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
