"use client";

/**
 * The agreement's text as a list of sections (title + text). Blue chips drop a field
 * (client name, total…) into the text where the cursor is; it fills in for each client.
 */
import { useRef } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";
import { FIELDS, type ContractSection } from "@/lib/contracts";

export function SectionsEditor({ sections, onChange, disabled }: { sections: ContractSection[]; onChange: (s: ContractSection[]) => void; disabled?: boolean }) {
  // which textarea had the cursor last, and where
  const focus = useRef<{ i: number; start: number; end: number } | null>(null);
  const areas = useRef<(HTMLTextAreaElement | null)[]>([]);

  const set = (i: number, p: Partial<ContractSection>) => onChange(sections.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const move = (i: number, by: number) => {
    const j = i + by; if (j < 0 || j >= sections.length) return;
    const next = [...sections]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  function insert(key: string) {
    const f = focus.current ?? (sections.length ? { i: sections.length - 1, start: sections[sections.length - 1].text.length, end: sections[sections.length - 1].text.length } : null);
    if (!f || !sections[f.i]) return;
    const t = sections[f.i].text, token = `{${key}}`;
    set(f.i, { text: t.slice(0, f.start) + token + t.slice(f.end) });
    const pos = f.start + token.length;
    focus.current = { i: f.i, start: pos, end: pos };
    requestAnimationFrame(() => { const el = areas.current[f.i]; if (el) { el.focus(); el.setSelectionRange(pos, pos); } });
  }

  return (
    <div>
      {!disabled && (
        <div className={cn("bg-white rounded-[16px] p-3 mb-3", CARD_SHADOW)}>
          <p className="text-[12.5px] text-[#6B6680] mb-2">Tap a field to add it where your cursor is. It fills in by itself for each client.</p>
          <div className="flex flex-wrap gap-1.5">
            {FIELDS.map(f => (
              <button key={f.key} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insert(f.key)}
                className="h-8 px-3 rounded-full bg-[#EEE8FD] hover:bg-[#E4DCFB] text-[#5B3FD0] text-[12.5px] font-semibold inline-flex items-center gap-1">
                <Plus className="w-3 h-3" />{f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={i} className={cn("bg-white rounded-[16px] p-3", CARD_SHADOW)}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-[#F1EFF6] text-[12px] font-bold text-[#4A4658] flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <input value={s.title} disabled={disabled} maxLength={120} onChange={e => set(i, { title: e.target.value })} placeholder="Section title" aria-label={`Title of section ${i + 1}`}
                className="flex-1 min-w-0 h-9 px-2.5 rounded-[10px] bg-[#F5F3FA] text-[14.5px] font-semibold text-[#17151F] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF] disabled:opacity-70" />
              {!disabled && (
                <>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move section ${i + 1} up`} className="w-8 h-8 rounded-full text-[#6B6680] hover:bg-[#F5F3FA] flex items-center justify-center disabled:opacity-25"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`Move section ${i + 1} down`} className="w-8 h-8 rounded-full text-[#6B6680] hover:bg-[#F5F3FA] flex items-center justify-center disabled:opacity-25"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => onChange(sections.filter((_, k) => k !== i))} aria-label={`Remove section ${i + 1}`} className="w-8 h-8 rounded-full text-[#C2304F] hover:bg-[#FDECEF] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                </>
              )}
            </div>
            <textarea ref={el => { areas.current[i] = el; }} value={s.text} disabled={disabled} maxLength={6000} rows={Math.min(12, Math.max(3, s.text.split("\n").length + Math.floor(s.text.length / 90)))}
              onChange={e => set(i, { text: e.target.value })} aria-label={`Text of section ${i + 1}`} placeholder="Write the terms here. One point per line."
              onSelect={e => { focus.current = { i, start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
              onFocus={e => { focus.current = { i, start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
              className="w-full px-3 py-2.5 rounded-[12px] bg-[#F5F3FA] text-[14px] leading-relaxed text-[#17151F] placeholder:text-[#A29DB3] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF] resize-y disabled:opacity-70" />
          </div>
        ))}
      </div>
      {!disabled && sections.length < 30 && (
        <button type="button" onClick={() => onChange([...sections, { title: "", text: "" }])}
          className="mt-3 h-9 px-3.5 rounded-full bg-white text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]">
          <Plus className="w-4 h-4" />Add section
        </button>
      )}
    </div>
  );
}
