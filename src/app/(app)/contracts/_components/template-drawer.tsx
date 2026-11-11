"use client";

/** Write or change one of the studio's own contract templates. */
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import type { ContractSection, ContractTemplate } from "@/lib/contracts";
import { SectionsEditor } from "./sections-editor";

const CATEGORIES = ["Wedding", "Shoot", "Corporate", "General"];

export function TemplateDrawer({ template, startFrom, onClose, onSaved }: {
  /** Edit this one… */ template?: ContractTemplate | null;
  /** …or start a new one from this wording */ startFrom?: ContractTemplate | null;
  onClose: () => void; onSaved: () => void;
}) {
  const base = template ?? startFrom;
  const [name, setName] = useState(template?.name ?? (startFrom ? `${startFrom.name} (my copy)` : ""));
  const [description, setDescription] = useState(base?.description ?? "");
  const [category, setCategory] = useState(base?.category ?? "General");
  const [sections, setSections] = useState<ContractSection[]>(base?.sections.map(s => ({ ...s })) ?? [{ title: "", text: "" }]);
  const [saving, setSaving] = useState(false);

  const missing = !name.trim() ? "Give the template a name" : !sections.some(s => s.text.trim()) ? "Write at least one section" : "";

  async function save() {
    if (missing) return;
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/contracts/templates${template ? `/${template.id}` : ""}`, {
        method: template ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, category, sections }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save", { error: true }); return; }
      notify(template ? "Template saved" : "Template added");
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <FormDrawer open onClose={onClose} icon={FileText} color="ink" title={template ? "Edit template" : "New template"} sub="Your own wording, ready for every new contract"
      footer={
        <>
          <p className={`flex-1 self-center text-[13px] ${missing ? "text-[#6B6680]" : "text-[#1F8A5B] font-semibold"}`}>{missing || "Ready to save"}</p>
          <button type="button" onClick={save} disabled={!!missing || saving} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save template
          </button>
        </>
      }>
      <FormGroup>
        <Field label="Template name" required>{id => <input id={id} value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="e.g. Wedding agreement" className={inputCls} />}</Field>
        <Field label="Short note" hint="Shown under the name when you pick a template.">{id => <input id={id} value={description} maxLength={200} onChange={e => setDescription(e.target.value)} placeholder="When to use it" className={inputCls} />}</Field>
        <Field label="Kind">{id => (
          <select id={id} value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
            {[...new Set([...CATEGORIES, category])].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}</Field>
      </FormGroup>
      <h3 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Contract text</h3>
      <p className="px-1 mb-3 text-[12.5px] text-[#6B6680]">The studio, client, event days and price are added at the top by themselves — write only the terms.</p>
      <SectionsEditor sections={sections} onChange={setSections} />
    </FormDrawer>
  );
}
