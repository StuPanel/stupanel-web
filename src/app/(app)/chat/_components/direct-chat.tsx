"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";
import {
  MessageCircle, Send, Loader2, Search, ChevronLeft, CheckCheck, Check, UserCircle2,
} from "lucide-react";
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

interface Contact {
  key: string; name: string; avatarUrl?: string | null; sub?: string | null;
  lastMessage: string | null; lastMessageAt: string | null; unreadCount: number;
}

interface DMMessage {
  id: string; content: string; createdAt: string; readAt: string | null;
  senderUserId: string | null; senderClientId: string | null;
}

export function DirectChat({ kind }: { kind: "team" | "clients" }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadContacts = useCallback(async (q?: string) => {
    const url = kind === "team"
      ? `${API}/direct-messages/team`
      : `${API}/direct-messages/clients${q?.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`;
    const res = await apiFetch(url);
    const data = await res.json();
    setContacts(Array.isArray(data) ? data : []);
  }, [kind]);

  useEffect(() => {
    setLoadingContacts(true);
    loadContacts().finally(() => setLoadingContacts(false));
  }, [loadContacts]);

  useEffect(() => {
    if (kind !== "clients") return;
    const t = setTimeout(() => loadContacts(search), 300);
    return () => clearTimeout(t);
  }, [search, kind, loadContacts]);

  const loadThread = useCallback(async (contact: Contact, withSpinner = false) => {
    if (withSpinner) setMsgLoading(true);
    const param = kind === "team" ? `withUserId=${contact.key}` : `withClientId=${contact.key}`;
    const res = await apiFetch(`${API}/direct-messages/thread?${param}`);
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
    if (withSpinner) {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
    }
    setContacts(prev => prev.map(c => c.key === contact.key ? { ...c, unreadCount: 0 } : c));
  }, [kind]);

  function selectContact(c: Contact) {
    setSelected(c);
    setMobileShowChat(true);
    loadThread(c, true);
  }

  // Poll the open thread + contact list every few seconds for a "live" feel.
  useEffect(() => {
    if (!selected) return;
    pollRef.current = setInterval(() => {
      loadThread(selected);
      loadContacts(kind === "clients" ? search : undefined);
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, kind]);

  async function sendMessage() {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    const body = kind === "team" ? { withUserId: selected.key, content: text.trim() } : { withClientId: selected.key, content: text.trim() };
    try {
      await apiFetch(`${API}/direct-messages/send`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setText("");
      textareaRef.current?.focus();
      await loadThread(selected);
      await loadContacts(kind === "clients" ? search : undefined);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally { setSending(false); }
  }

  const totalUnread = contacts.reduce((s, c) => s + c.unreadCount, 0);

  const groupedMessages: { date: string; msgs: DMMessage[] }[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) last.msgs.push(msg);
    else groupedMessages.push({ date: dateKey, msgs: [msg] });
  }

  const isOutgoing = (msg: DMMessage) => kind === "team" ? msg.senderUserId !== selected?.key : msg.senderClientId === null;
  const emptyLabel = kind === "team" ? "team member" : "client";

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left sidebar — contact list */}
      <div className={cn(
        "w-full md:w-80 flex-shrink-0 border-r border-slate-100 flex flex-col",
        mobileShowChat ? "hidden md:flex" : "flex"
      )}>
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-slate-900 capitalize">{kind}</h2>
            {totalUnread > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={kind === "team" ? "Search team member…" : "Search any client to message…"}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-slate-50" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
          ) : contacts.filter(c => kind === "team" ? c.name.toLowerCase().includes(search.toLowerCase()) : true).length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                {kind === "clients" && search.trim() ? "No matching client" : `No ${emptyLabel}s yet`}
              </p>
            </div>
          ) : contacts
            .filter(c => kind === "team" ? c.name.toLowerCase().includes(search.toLowerCase()) : true)
            .map(c => {
              const isActive = selected?.key === c.key;
              return (
                <button key={c.key} onClick={() => selectContact(c)}
                  className={cn("w-full flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left",
                    isActive && "bg-indigo-50 border-indigo-100")}>
                  <div className="relative flex-shrink-0 mt-0.5">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold",
                      kind === "team" ? "bg-violet-500" : "bg-emerald-500")}>
                      {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : (c.name[0]?.toUpperCase() ?? "?")}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn("text-sm font-semibold truncate", isActive ? "text-indigo-700" : "text-slate-900")}>{c.name || "Unnamed"}</p>
                      {c.lastMessageAt && <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtTime(c.lastMessageAt)}</span>}
                    </div>
                    {c.sub && <p className="text-xs text-slate-400 truncate mt-0.5 capitalize">{c.sub}</p>}
                    {c.lastMessage ? (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{c.lastMessage}</p>
                    ) : (
                      <p className="text-xs text-slate-300 mt-0.5 italic">No messages yet — say hi!</p>
                    )}
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="flex-shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center mt-1">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Right — chat window */}
      <div className={cn("flex-1 flex flex-col min-w-0", !mobileShowChat ? "hidden md:flex" : "flex")}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <UserCircle2 className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="font-semibold text-slate-700">Select a {emptyLabel}</p>
              <p className="text-sm text-slate-400 mt-1">to start a direct conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
              <button onClick={() => setMobileShowChat(false)} className="md:hidden w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold",
                kind === "team" ? "bg-violet-500" : "bg-emerald-500")}>
                {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : (selected.name[0]?.toUpperCase() ?? "?")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{selected.name || "Unnamed"}</p>
                {selected.sub && <p className="text-xs text-slate-400 capitalize">{selected.sub}</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-slate-50/50">
              {msgLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No messages yet</p>
                  <p className="text-xs text-slate-300 mt-1">Send the first message to {selected.name}</p>
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
                      const isMe = isOutgoing(msg);
                      return (
                        <div key={msg.id} className={cn("flex animate-in fade-in slide-in-from-bottom-1 duration-200", isMe ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-xs sm:max-w-sm lg:max-w-md flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                              isMe ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm")}>
                              {msg.content}
                            </div>
                            <div className={cn("flex items-center gap-1 mt-1 text-[10px]", isMe ? "flex-row-reverse" : "flex-row")}>
                              <span className="text-slate-400">{fmtTime(msg.createdAt)}</span>
                              {isMe && (
                                msg.readAt
                                  ? <CheckCheck className="w-3 h-3 text-indigo-500" />
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

            <div className="px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-indigo-400 max-h-28 overflow-y-auto leading-relaxed"
                    style={{ minHeight: "42px" }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all shadow-sm hover:shadow">
                  {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-300 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
