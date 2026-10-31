"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { MessageCircle, Send, Loader2, Check, CheckCheck, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

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
  senderUserId: string | null;
}

export default function MemberChatPage() {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    try { setMyId(JSON.parse(atob(token.split(".")[1])).sub); } catch {}
  }, []);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const res = await apiFetch(`${API}/member/admin-chat`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } finally {
      if (withSpinner) {
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
      }
    }
  }, []);

  useEffect(() => {
    load(true);
    pollRef.current = setInterval(() => load(false), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`${API}/member/admin-chat`, {
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
    <div className="h-[calc(100dvh-10.5rem)] lg:h-[calc(100vh-3.5rem)] flex flex-col bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#EEEBF4] bg-white flex-shrink-0">
        <div className="w-10 h-10 rounded-[12px] bg-[#126B66] flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#17151F] text-[15px]">Studio</p>
          <p className="text-xs text-[#6B6680]">Message the studio owner</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-[#F5F3FA]">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <span className="w-14 h-14 rounded-full bg-[#EEE8FD] flex items-center justify-center mx-auto mb-3"><MessageCircle className="w-6 h-6 text-[#5B3FD0]" /></span>
            <p className="text-base font-bold text-[#17151F]">No messages yet</p>
            <p className="text-sm text-[#6B6680] mt-1">Ask the studio anything about your work.</p>
          </div>
        ) : (
          groupedMessages.map(({ date, msgs }) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-[#E4E0EC]" />
                <span className="text-xs font-semibold text-[#6B6680] px-2">{date}</span>
                <div className="flex-1 h-px bg-[#E4E0EC]" />
              </div>

              {msgs.map(msg => {
                const isMe = msg.senderUserId === myId;
                return (
                  <div key={msg.id} className={cn("flex animate-in fade-in slide-in-from-bottom-1 duration-200", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-xs sm:max-w-sm lg:max-w-md flex flex-col", isMe ? "items-end" : "items-start")}>
                      <div className={cn("px-3.5 py-2 rounded-[18px] text-[15px] leading-relaxed break-words",
                        isMe ? "bg-[#7D5CEF] text-white rounded-br-md" : "bg-white text-[#17151F] rounded-bl-md shadow-[0_1px_2px_rgba(22,18,40,.06)]")}>
                        {msg.content}
                      </div>
                      <div className={cn("flex items-center gap-1 mt-1 text-xs", isMe ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-[#A29DB3]">{fmtTime(msg.createdAt)}</span>
                        {isMe && (
                          msg.readAt
                            ? <CheckCheck className="w-3 h-3 text-[#7D5CEF]" />
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

      <div className="px-3 py-3 border-t border-[#EEEBF4] bg-white flex-shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Write a message…" aria-label="Message"
              rows={1}
              className="w-full px-4 py-2.5 rounded-[22px] bg-[#F5F3FA] text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-[#7D5CEF]/40 max-h-28 overflow-y-auto leading-relaxed"
              style={{ minHeight: "42px" }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            className="w-11 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all shadow-sm hover:shadow">
            {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
