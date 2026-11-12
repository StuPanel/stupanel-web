"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, MessageCircle, Send } from "lucide-react";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import type { Booking } from "./types";
import { waNumber } from "@/lib/phone";
import { DUE_CATEGORY } from "@/lib/due-reminder";

interface WaTemplate { id: string; name: string; category: string; body: string; }

export function WhatsAppModal({ booking, onClose, preferCategory }: {
  booking: Pick<Booking, "id" | "bookingNumber"> & { client?: { firstName?: string; lastName?: string | null; phone?: string | null } | null } | null;
  onClose: () => void;
  /** Pick the first template of this category straight away (e.g. "payment_reminder"). */
  preferCategory?: string;
}) {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState("");
  const [phone, setPhone] = useState("");
  const [filling, setFilling] = useState(false);
  const [customMsg, setCustomMsg] = useState("");
  const [mode, setMode] = useState<"template" | "custom">("template");

  useEffect(() => {
    if (!booking) return;
    setPhone(booking.client?.phone ?? "");
    apiFetch(`${API}/wa-templates`)
      .then(r => r.json()).then(d => {
        // The due reminder is per client (Payments → Due), not for one program.
        const list: WaTemplate[] = (Array.isArray(d) ? d : []).filter((t: WaTemplate) => t.category !== DUE_CATEGORY);
        setTemplates(list);
        const pick = preferCategory && list.find(t => t.category === preferCategory);
        if (pick) fillTemplate(pick.id);
      })
      .catch(() => {}).finally(() => setLoadingTpl(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  async function fillTemplate(id: string) {
    if (!booking || !id) return;
    setFilling(true); setSelectedId(id);
    try {
      const r = await apiFetch(`${API}/wa-templates/fill`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id, bookingId: booking.id }),
      });
      if (r.ok) { const d = await r.json(); setPreview(d.filled); if (d.phone) setPhone(d.phone); }
    } finally { setFilling(false); }
  }

  function sendWA() {
    const msg = mode === "template" ? preview : customMsg;
    if (!msg.trim()) return;
    window.open(`https://wa.me/${waNumber(phone) ?? ""}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (!booking) return null;

  const name = `${booking.client?.firstName ?? ""} ${booking.client?.lastName ?? ""}`.trim();
  const canSend = ((mode === "template" && !!preview.trim()) || (mode === "custom" && !!customMsg.trim())) && !!phone.trim();

  return (
    <FormDrawer open onClose={onClose} onTop icon={MessageCircle} color="green" title="Send WhatsApp" sub={[name, booking.bookingNumber].filter(Boolean).join(" · ")}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
          <button type="button" onClick={sendWA} disabled={!canSend}
            className="flex-1 h-11 rounded-full bg-[#1F8A5B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45">
            <Send className="w-4 h-4" />Open WhatsApp
          </button>
        </>
      }>
      <FormGroup>
        <Field label="Phone number">{id => <input id={id} value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="Phone number" className={inputCls} />}</Field>
      </FormGroup>

      <div role="radiogroup" aria-label="Message" className="grid grid-cols-2 p-1 rounded-full bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)] mb-4">
        {([["template", "Use a template"], ["custom", "Write my own"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
            className={cn("h-9 rounded-full text-[13px] font-semibold transition-colors", mode === k ? "bg-[#16141D] text-white" : "text-[#4A4658]")}>{l}</button>
        ))}
      </div>

      {mode === "template" ? (
        <>
          {loadingTpl ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="sp-skel h-[60px] rounded-[16px]" />)}</div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-[20px] p-5 text-center shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
              <p className="text-[14px] font-semibold text-[#17151F]">No templates yet</p>
              <a href="/settings?pane=whatsapp" target="_blank" className="text-[13px] font-semibold text-[#5B3FD0] hover:underline mt-1 inline-block">Make templates in Settings</a>
            </div>
          ) : (
            <div className="space-y-2 mb-4" role="radiogroup" aria-label="Template">
              {templates.map(t => {
                const on = selectedId === t.id;
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => fillTemplate(t.id)}
                    className={cn("w-full text-left px-4 py-3 rounded-[16px] bg-white transition-shadow flex items-center gap-3",
                      on ? "ring-2 ring-[#1F8A5B]" : "shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:shadow-[0_4px_14px_rgba(22,18,40,.08)]")}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-[#17151F]">{t.name}</span>
                      <span className="block text-[12.5px] text-[#6B6680] truncate mt-0.5">{t.body.replace(/\s+/g, " ").slice(0, 90)}</span>
                    </span>
                    {on && <span className="w-5 h-5 rounded-full bg-[#1F8A5B] flex items-center justify-center flex-shrink-0">{filling ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {preview && (
            <div>
              <p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Message <span className="font-normal text-[#6B6680]">— you can change it before sending</span></p>
              <textarea value={preview} onChange={e => setPreview(e.target.value)} rows={8} aria-label="Message"
                className="w-full rounded-[18px] rounded-tl-[6px] bg-[#F0FAF4] px-4 py-3 text-[14px] text-[#17151F] leading-relaxed border border-transparent outline-none focus:border-[#1F8A5B] resize-y" />
            </div>
          )}
        </>
      ) : (
        <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={9} aria-label="Your message" placeholder="Type your message"
          className="w-full rounded-[18px] rounded-tl-[6px] bg-white px-4 py-3 text-[14px] text-[#17151F] leading-relaxed border border-transparent outline-none focus:border-[#1F8A5B] resize-y shadow-[0_1px_2px_rgba(22,18,40,.06)]" />
      )}
    </FormDrawer>
  );
}
