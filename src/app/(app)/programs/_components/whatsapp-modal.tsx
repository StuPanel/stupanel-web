"use client";

import { useState, useEffect } from "react";
import { X, Loader2, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import type { Booking } from "./types";
import { waNumber } from "@/lib/phone";

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
        const list: WaTemplate[] = Array.isArray(d) ? d : [];
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

  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="sp-drawer pointer-events-auto sm:max-w-md flex flex-col">
          <div className="px-5 py-4 border-b border-[#E4E0EC] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#E7F5EE] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-[#1F8A5B]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#17151F] text-sm">Send WhatsApp</p>
              <p className="text-xs text-[#8A8599] truncate">{booking.client?.firstName} {booking.client?.lastName ?? ""} · {booking.bookingNumber}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1EFF6]">
              <X className="w-4 h-4 text-[#6B6680]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#4A4658]">Phone Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full h-10 px-3 rounded-lg border border-[#E4E0EC] text-sm focus:outline-none focus:border-green-400" />
            </div>

            <div className="flex rounded-lg border border-[#E4E0EC] overflow-hidden">
              <button onClick={() => setMode("template")}
                className={cn("flex-1 py-2 text-xs font-semibold transition-all",
                  mode === "template" ? "bg-[#1F8A5B] text-white" : "text-[#6B6680] hover:bg-[#F7F5FB]")}>
                Use Template
              </button>
              <button onClick={() => setMode("custom")}
                className={cn("flex-1 py-2 text-xs font-semibold transition-all",
                  mode === "custom" ? "bg-[#1F8A5B] text-white" : "text-[#6B6680] hover:bg-[#F7F5FB]")}>
                Custom Message
              </button>
            </div>

            {mode === "template" ? (
              <>
                {loadingTpl ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#1F8A5B]" /></div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-6 bg-[#F7F5FB] rounded-xl">
                    <p className="text-sm text-[#6B6680]">No templates yet</p>
                    <a href="/whatsapp" target="_blank" className="text-xs text-[#1F8A5B] hover:underline mt-1 inline-block">Create templates →</a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => fillTemplate(t.id)}
                        className={cn("w-full text-left px-3.5 py-3 rounded-xl border transition-all text-sm",
                          selectedId === t.id ? "border-green-400 bg-[#F0FAF4]" : "border-[#E4E0EC] hover:border-green-300 bg-white")}>
                        <span className="font-semibold text-[#17151F] block">{t.name}</span>
                        <span className="text-xs text-[#8A8599] line-clamp-1 mt-0.5">{t.body.slice(0, 60)}…</span>
                      </button>
                    ))}
                  </div>
                )}

                {filling && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-[#1F8A5B]" /></div>}

                {preview && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-[#6B6680]">Preview</p>
                    <pre className="bg-[#F0FAF4] border border-[#E7F5EE] rounded-xl px-4 py-3 text-xs text-[#33303F] whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{preview}</pre>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#4A4658]">Your Message</p>
                <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={8}
                  placeholder="Type your WhatsApp message here..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E0EC] text-sm focus:outline-none focus:border-green-400 resize-y" />
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-[#F1EFF6] flex gap-3">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-[#E4E0EC] text-sm font-medium text-[#4A4658] hover:bg-[#F7F5FB]">Cancel</button>
            <button onClick={sendWA}
              disabled={(mode === "template" && !preview) || (mode === "custom" && !customMsg.trim()) || !phone.trim()}
              className="flex-1 h-11 rounded-xl bg-[#1F8A5B] hover:bg-[#1F8A5B] disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all">
              <Send className="w-4 h-4" />Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
