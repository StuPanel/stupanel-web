"use client";

/**
 * Payments → Due → Edit message: the studio's own wording for the payment reminder.
 * Tap a field to put it where the cursor is; the preview shows the message for this client.
 * Saved as a WhatsApp template of kind "due_reminder" (also in Settings → WhatsApp templates).
 */
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { DEFAULT_DUE_TEMPLATE, DUE_CATEGORY, DUE_FIELDS } from "@/lib/due-reminder";

export type DueTemplate = { id: string; body: string } | null;

/** *bold* and _italic_ the way WhatsApp shows them. */
export function WaText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i}>{p.slice(1, -1)}</strong>
          : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em>
          : <span key={i}>{p}</span>)}
    </>
  );
}

export function DueTemplateEditor({ template, clientName, preview, onSaved, onClose }: {
  template: DueTemplate; clientName: string;
  /** The message for this client with the given wording. */
  preview: (body: string) => string;
  onSaved: (t: DueTemplate) => void; onClose: () => void;
}) {
  const [body, setBody] = useState(template?.body ?? DEFAULT_DUE_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  function insert(key: string) {
    const ta = area.current;
    if (!ta) { setBody(b => b + key); return; }
    const s = ta.selectionStart, e = ta.selectionEnd;
    setBody(body.slice(0, s) + key + body.slice(e));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + key.length, s + key.length); }, 0);
  }

  async function save() {
    if (!body.trim()) { notify("Write the message first", { error: true }); return; }
    setBusy(true);
    try {
      const r = template
        ? await apiFetch(`${API}/wa-templates/${template.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body.trim() }) })
        : await apiFetch(`${API}/wa-templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Due reminder", category: DUE_CATEGORY, body: body.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save", { error: true }); return; }
      notify("Reminder message saved");
      onSaved({ id: d.id, body: d.body });
      onClose();
    } finally { setBusy(false); }
  }

  return createPortal(
    <>
      <div className="sp-backdrop z-[60]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="due-tpl-title" className="sp-drawer z-[70] sm:max-w-[620px] flex flex-col bg-[#F7F6FA]">
        <div className="px-5 pt-5 pb-3 flex items-start gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 id="due-tpl-title" className="text-[19px] font-extrabold tracking-[-0.01em] text-[#17151F]">Reminder message</h2>
            <p className="text-[13px] text-[#6B6680]">Your wording for every client. The fields fill in by themselves.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#6B6680] flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          <div>
            <p className="text-[13px] font-semibold text-[#4A4658] mb-2">Tap to add a field</p>
            <div className="flex flex-wrap gap-1.5">
              {DUE_FIELDS.map(f => (
                <button key={f.key} type="button" title={f.hint} onMouseDown={e => e.preventDefault()} onClick={() => insert(f.key)}
                  className="h-8 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1">
                  <Plus className="w-3 h-3" />{f.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">Message</span>
            <textarea ref={area} value={body} onChange={e => setBody(e.target.value)} rows={13} aria-label="Message"
              className="w-full px-3.5 py-3 rounded-[14px] bg-white text-[14px] text-[#17151F] border border-[#E3DFEC] outline-none focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/12 resize-y leading-relaxed font-mono" />
            <span className="block text-[12px] text-[#6B6680] mt-1">*text* = <b>bold</b> · _text_ = <i>italic</i> in WhatsApp</span>
          </label>

          <div>
            <p className="text-[13px] font-semibold text-[#4A4658] mb-2">Preview for {clientName}</p>
            <div className="rounded-[18px] rounded-tl-[6px] bg-[#E7F7EC] px-4 py-3 text-[13.5px] text-[#17151F] leading-relaxed whitespace-pre-wrap break-words shadow-[0_1px_2px_rgba(22,18,40,.06)]">
              <WaText text={preview(body)} />
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[#EEEBF4] bg-white flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={() => setBody(DEFAULT_DUE_TEMPLATE)} disabled={body === DEFAULT_DUE_TEMPLATE}
            className="h-10 px-3.5 rounded-full text-[13px] font-semibold text-[#4A4658] hover:bg-[#F5F3FA] inline-flex items-center gap-1.5 disabled:opacity-40">
            <RotateCcw className="w-3.5 h-3.5" />Default
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[13.5px] font-semibold text-[#17151F]">Cancel</button>
          <button type="button" onClick={save} disabled={busy}
            className="h-10 px-5 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
