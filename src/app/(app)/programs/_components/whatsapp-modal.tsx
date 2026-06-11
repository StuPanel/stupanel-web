"use client";

import { useState, useEffect } from "react";
import { X, Loader2, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import type { Booking } from "./types";

interface WaTemplate { id: string; name: string; category: string; body: string; }

export function WhatsAppModal({ booking, onClose }: {
  booking: Booking | null;
  onClose: () => void;
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
    fetch(`${API}/wa-templates`, { headers: { "Content-Type": "application/json" } })
      .then(r => r.json()).then(d => { setTemplates(Array.isArray(d) ? d : []); })
      .catch(() => {}).finally(() => setLoadingTpl(false));
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
    const num = phone.replace(/\D/g, "");
    const bd = num.startsWith("0") ? "88" + num : num.startsWith("880") ? num : num;
    window.open(`https://wa.me/${bd}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (!booking) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm">Send WhatsApp</p>
              <p className="text-xs text-slate-400 truncate">{booking.client?.firstName} {booking.client?.lastName ?? ""} · {booking.bookingNumber}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Phone Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-green-400" />
            </div>

            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button onClick={() => setMode("template")}
                className={cn("flex-1 py-2 text-xs font-semibold transition-all",
                  mode === "template" ? "bg-green-600 text-white" : "text-slate-500 hover:bg-slate-50")}>
                Use Template
              </button>
              <button onClick={() => setMode("custom")}
                className={cn("flex-1 py-2 text-xs font-semibold transition-all",
                  mode === "custom" ? "bg-green-600 text-white" : "text-slate-500 hover:bg-slate-50")}>
                Custom Message
              </button>
            </div>

            {mode === "template" ? (
              <>
                {loadingTpl ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-green-500" /></div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500">No templates yet</p>
                    <a href="/whatsapp" target="_blank" className="text-xs text-green-600 hover:underline mt-1 inline-block">Create templates →</a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => fillTemplate(t.id)}
                        className={cn("w-full text-left px-3.5 py-3 rounded-xl border transition-all text-sm",
                          selectedId === t.id ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-green-300 bg-white")}>
                        <span className="font-semibold text-slate-800 block">{t.name}</span>
                        <span className="text-xs text-slate-400 line-clamp-1 mt-0.5">{t.body.slice(0, 60)}…</span>
                      </button>
                    ))}
                  </div>
                )}

                {filling && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-green-500" /></div>}

                {preview && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">Preview</p>
                    <pre className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{preview}</pre>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">Your Message</p>
                <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={8}
                  placeholder="Type your WhatsApp message here..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-green-400 resize-y" />
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-3">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={sendWA}
              disabled={(mode === "template" && !preview) || (mode === "custom" && !customMsg.trim()) || !phone.trim()}
              className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all">
              <Send className="w-4 h-4" />Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
