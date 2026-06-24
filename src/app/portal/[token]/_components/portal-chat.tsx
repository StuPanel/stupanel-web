"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, Loader2, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-BD", { weekday: "short" });
  return `${String(d.getDate()).padStart(2,"0")}-${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()]}`;
}

interface DMMessage {
  id: string; content: string; createdAt: string; readAt: string | null;
  senderClientId: string | null;
}

export function PortalChat({ token, brand, companyName }: { token: string; brand: string; companyName: string }) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const res = await fetch(`${API}/public/portal/${token}/messages`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } finally {
      if (withSpinner) {
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
      }
    }
  }, [token]);

  useEffect(() => {
    load(true);
    pollRef.current = setInterval(() => load(false), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`${API}/public/portal/${token}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text.trim() }),
      });
      setText("");
      textareaRef.current?.focus();
      await load(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally { setSending(false); }
  }

  const groupedMessages: { date: string; msgs: DMMessage[] }[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) last.msgs.push(msg);
    else groupedMessages.push({ date: dateKey, msgs: [msg] });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-[60vh] overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-slate-50/50">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: brand }} /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No messages yet</p>
            <p className="text-xs text-slate-300 mt-1">Send {companyName} a message anytime</p>
          </div>
        ) : (
          groupedMessages.map(({ date, msgs }) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-medium text-slate-400 px-2">{date}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {msgs.map(msg => {
                const isMe = msg.senderClientId !== null;
                return (
                  <div key={msg.id} className={cn("flex animate-in fade-in slide-in-from-bottom-1 duration-200", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] sm:max-w-sm flex flex-col", isMe ? "items-end" : "items-start")}>
                      <div
                        className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                          isMe ? "text-white rounded-br-sm" : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm")}
                        style={isMe ? { backgroundColor: brand } : {}}>
                        {msg.content}
                      </div>
                      <div className={cn("flex items-center gap-1 mt-1 text-[10px]", isMe ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-slate-400">{fmtTime(msg.createdAt)}</span>
                        {isMe && (
                          msg.readAt
                            ? <CheckCheck className="w-3 h-3" style={{ color: brand }} />
                            : <Check className="w-3 h-3 text-slate-300" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t border-slate-100 bg-white flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Message ${companyName}…`}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 text-sm resize-none focus:outline-none max-h-24 overflow-y-auto leading-relaxed"
            style={{ minHeight: "42px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            style={{ backgroundColor: brand }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
