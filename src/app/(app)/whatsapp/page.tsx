"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Trash2, X, Check, Loader2, MessageCircle,
  Copy, Tag, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function jsonH() { return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` }; }
function authH() { return { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` }; }

const CATEGORIES = [
  { key: "booking_confirmation", label: "Booking Confirmation", color: "bg-indigo-100 text-indigo-700" },
  { key: "payment_reminder",     label: "Payment Reminder",     color: "bg-orange-100 text-orange-700" },
  { key: "delivery_notification",label: "Delivery Notification",color: "bg-teal-100 text-teal-700" },
  { key: "event_reminder",       label: "Event Reminder",       color: "bg-violet-100 text-violet-700" },
  { key: "custom",               label: "Custom",               color: "bg-slate-100 text-slate-600" },
];
function catCfg(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[4];
}

const PLACEHOLDERS = [
  { key: "{{clientName}}",    label: "Client Name" },
  { key: "{{phone}}",         label: "Client Phone" },
  { key: "{{bookingNumber}}", label: "Booking Number" },
  { key: "{{eventName}}",     label: "Event Name" },
  { key: "{{eventDate}}",     label: "Event Date" },
  { key: "{{eventLocation}}", label: "Event Location" },
  { key: "{{package}}",       label: "Package Name" },
  { key: "{{totalAmount}}",   label: "Total Amount" },
  { key: "{{paidAmount}}",    label: "Paid Amount" },
  { key: "{{dueAmount}}",     label: "Due Amount" },
  { key: "{{currency}}",      label: "Currency" },
  { key: "{{companyName}}",   label: "Company Name" },
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
  const [phOpen, setPhOpen] = useState(false);

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
      const r = await fetch(url, {
        method, headers: jsonH(), body: JSON.stringify({ name: name.trim(), category, body: body.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to save."); return; }
      onSave(d);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Template Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Booking Confirmation BN" className="h-10 border-slate-200 text-sm" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Category</Label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 text-slate-700">
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Placeholder chips */}
      <div className="space-y-1.5">
        <button onClick={() => setPhOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          <Tag className="w-3.5 h-3.5" />Insert variable
          {phOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {phOpen && (
          <div className="flex flex-wrap gap-1.5 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            {PLACEHOLDERS.map(p => (
              <button key={p.key} onClick={() => insertPlaceholder(p.key)}
                className="h-6 px-2 rounded-full bg-white border border-indigo-200 text-[10px] font-mono text-indigo-700 hover:bg-indigo-100 transition-colors">
                {p.key}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body textarea */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Message Body</Label>
        <textarea
          id="wa-body"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          placeholder={`Assalamu Alaikum {{clientName}} bhai/apu,\n\nApnar booking confirm hoyeche! 🎉\n\nBooking: {{bookingNumber}}\nEvent: {{eventName}}\nDate: {{eventDate}}\nLocation: {{eventLocation}}\nPackage: {{package}}\n\nTotal: {{totalAmount}}\nPaid: {{paidAmount}}\nDue: {{dueAmount}}\n\nThank you for choosing {{companyName}}! 🙏`}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 resize-y font-mono leading-relaxed"
        />
        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          <Info className="w-3 h-3" />{body.length} characters · Variables will be auto-filled when sending
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-11 border-slate-200">Cancel</Button>
        <Button onClick={save} disabled={loading} className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {initial ? "Update Template" : "Save Template"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/wa-templates`, { headers: authH() });
      if (r.ok) setTemplates(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      await fetch(`${API}/wa-templates/${id}`, { method: "DELETE", headers: authH() });
      setTemplates(ts => ts.filter(t => t.id !== id));
    } finally { setDeleting(null); }
  }

  function copyBody(t: Template) {
    navigator.clipboard.writeText(t.body);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const visible = templates.filter(t => categoryFilter === "all" || t.category === categoryFilter);
  const grouped: Record<string, Template[]> = {};
  for (const t of visible) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />WhatsApp Templates
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{templates.length} templates · Send to clients from Programs page</p>
        </div>
        {!showForm && !editing && (
          <Button onClick={() => setShowForm(true)} className="h-9 bg-green-600 hover:bg-green-700 text-white gap-2 text-sm">
            <Plus className="w-4 h-4" />New Template
          </Button>
        )}
      </div>

      {/* How it works */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl">
        <MessageCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-green-800 space-y-1">
          <p className="font-semibold">How it works</p>
          <p>Create templates with variables like <code className="bg-green-100 px-1 rounded font-mono">{"{{clientName}}"}</code>. Then in Programs page, click the WhatsApp button on any booking — pick a template, it auto-fills the client's data, and opens WhatsApp with the message ready to send.</p>
        </div>
      </div>

      {/* Create/Edit form */}
      {(showForm || editing) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">{editing ? "Edit Template" : "New Template"}</h3>
          <TemplateForm
            initial={editing ?? undefined}
            onSave={onSaved}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </div>
      )}

      {/* Category filter */}
      {!loading && templates.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCategoryFilter("all")}
            className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
              categoryFilter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}>
            All · {templates.length}
          </button>
          {CATEGORIES.filter(c => templates.some(t => t.category === c.key)).map(c => (
            <button key={c.key} onClick={() => setCategoryFilter(c.key)}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                categoryFilter === c.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}>
              {c.label} · {templates.filter(t => t.category === c.key).length}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-500" /></div>}

      {/* Empty */}
      {!loading && templates.length === 0 && !showForm && (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <MessageCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">No templates yet</p>
          <p className="text-sm text-slate-400 mb-4">Create your first WhatsApp message template</p>
          <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700 text-white gap-2 text-sm">
            <Plus className="w-4 h-4" />Create First Template
          </Button>
        </div>
      )}

      {/* Templates grouped by category */}
      {!loading && Object.entries(grouped).map(([cat, items]) => {
        const cc = catCfg(cat);
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", cc.color)}>{cc.label}</span>
              <span className="text-xs text-slate-400">· {items.length}</span>
            </div>
            {items.map(t => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => copyBody(t)} title="Copy body"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      {copiedId === t.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setEditing(t); setShowForm(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del(t.id)} disabled={deleting === t.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      {deleting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {/* Body preview */}
                <pre className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 whitespace-pre-wrap font-sans leading-relaxed line-clamp-5 overflow-hidden">
                  {t.body}
                </pre>
                {/* Variable chips found in body */}
                {(() => {
                  const found = PLACEHOLDERS.filter(p => t.body.includes(p.key));
                  if (!found.length) return null;
                  return (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {found.map(p => (
                        <span key={p.key} className="h-5 px-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-[9px] font-mono text-indigo-500">
                          {p.key}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
