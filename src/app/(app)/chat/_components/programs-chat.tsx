"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  MessageCircle, Send, Camera, Loader2, Search, ChevronLeft,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API, WS_URL } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  inquiry: "bg-slate-400", quote_sent: "bg-blue-400", confirmed: "bg-indigo-500",
  advance_received: "bg-violet-500", in_progress: "bg-amber-500", editing: "bg-orange-500",
  ready_for_delivery: "bg-cyan-500", delivered: "bg-teal-500", completed: "bg-emerald-500",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-BD", { weekday: "short" });
  return `${String(d.getDate()).padStart(2,"0")}-${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()]}`;
}

interface BookingChat {
  id: string; bookingNumber: string; eventName?: string; status: string;
  client: { firstName: string; lastName?: string };
  lastMessage?: { content: string; user: { firstName: string }; createdAt: string };
  unreadCount: number;
}

interface Message {
  id: string; content: string; createdAt: string; readBy: string[]; bookingId?: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl?: string; isOwner: boolean; memberRoles: string[] };
}

export function ProgramsChat() {
  const [bookings, setBookings] = useState<BookingChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selBooking, setSelBooking] = useState<BookingChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [myId, setMyId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setMyId(payload.sub);
    } catch {}

    fetch(`${API}/chat/bookings`, { headers: { "Content-Type": "application/json" } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setBookings(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));

    const sock = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ["websocket"],
    });
    sock.on("connect", () => setConnected(true));
    sock.on("disconnect", () => setConnected(false));
    setSocket(sock);
    return () => { sock.disconnect(); };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("history", (msgs: Message[]) => {
      setMessages(msgs);
      setHasMore(msgs.length >= 40);
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
    });

    socket.on("new_message", (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      setBookings(prev => prev.map(b =>
        b.id === msg.bookingId ? { ...b, lastMessage: { content: msg.content, user: msg.user, createdAt: msg.createdAt }, unreadCount: 0 } : b
      ));
    });

    socket.on("more_messages", (msgs: Message[]) => {
      setMessages(prev => [...msgs, ...prev]);
      setHasMore(msgs.length >= 40);
    });

    socket.on("typing", (data: { firstName: string; isTyping: boolean }) => {
      setTypingUsers(prev =>
        data.isTyping ? [...new Set([...prev, data.firstName])] : prev.filter(n => n !== data.firstName)
      );
    });

    return () => {
      socket.off("history");
      socket.off("new_message");
      socket.off("more_messages");
      socket.off("typing");
    };
  }, [socket]);

  function selectBooking(booking: BookingChat) {
    if (selBooking) socket?.emit("leave_booking", { bookingId: selBooking.id });
    setSelBooking(booking);
    setMessages([]);
    setTypingUsers([]);
    setMsgLoading(true);
    setMobileShowChat(true);
    socket?.emit("join_booking", { bookingId: booking.id });
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, unreadCount: 0 } : b));
  }

  function sendMessage() {
    if (!text.trim() || !selBooking || !socket || sending) return;
    setSending(true);
    socket.emit("send_message", { bookingId: selBooking.id, content: text.trim() });
    setText("");
    textareaRef.current?.focus();
    setTimeout(() => setSending(false), 300);
  }

  function handleTyping() {
    if (!selBooking || !socket) return;
    socket.emit("typing", { bookingId: selBooking.id, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { bookingId: selBooking.id, isTyping: false });
    }, 1500);
  }

  function loadMore() {
    if (!selBooking || !socket || messages.length === 0) return;
    socket.emit("load_more", { bookingId: selBooking.id, before: messages[0].createdAt });
  }

  const filtered = bookings.filter(b =>
    b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
    (b.eventName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    b.client.firstName.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = bookings.reduce((s, b) => s + b.unreadCount, 0);

  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) last.msgs.push(msg);
    else groupedMessages.push({ date: dateKey, msgs: [msg] });
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left sidebar — booking list */}
      <div className={cn(
        "w-full md:w-80 flex-shrink-0 border-r border-slate-100 flex flex-col",
        mobileShowChat ? "hidden md:flex" : "flex"
      )}>
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900">Programs</h2>
              {totalUnread > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-500" : "bg-slate-300")} title={connected ? "Connected" : "Connecting…"} />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search programs…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-slate-50" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No programs found</p>
            </div>
          ) : filtered.map(b => {
            const isActive = selBooking?.id === b.id;
            const sc = STATUS_COLOR[b.status] ?? "bg-slate-400";
            return (
              <button key={b.id} onClick={() => selectBooking(b)}
                className={cn("w-full flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left",
                  isActive && "bg-indigo-50 border-indigo-100")}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold bg-indigo-500")}>
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white", sc)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn("text-sm font-semibold truncate", isActive ? "text-indigo-700" : "text-slate-900")}>
                      {b.eventName || b.bookingNumber}
                    </p>
                    {b.lastMessage && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtTime(b.lastMessage.createdAt)}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{b.client.firstName} · {b.bookingNumber}</p>
                  {b.lastMessage ? (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      <span className="font-medium text-slate-500">{b.lastMessage.user.firstName}:</span> {b.lastMessage.content}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300 mt-0.5 italic">No messages yet</p>
                  )}
                </div>
                {b.unreadCount > 0 && (
                  <span className="flex-shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center mt-1">
                    {b.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — chat window */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        !mobileShowChat ? "hidden md:flex" : "flex"
      )}>
        {!selBooking ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="font-semibold text-slate-700">Select a program</p>
              <p className="text-sm text-slate-400 mt-1">to start chatting with your team</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
              <button onClick={() => setMobileShowChat(false)} className="md:hidden w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
                <Camera className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{selBooking.eventName || selBooking.bookingNumber}</p>
                <p className="text-xs text-slate-400">{selBooking.bookingNumber} · {selBooking.client.firstName}</p>
              </div>
              {typingUsers.length > 0 && (
                <div className="text-xs text-indigo-500 font-medium flex items-center gap-1 flex-shrink-0">
                  <span className="flex gap-0.5">
                    {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </span>
                  {typingUsers.join(", ")} typing
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-slate-50/50">
              {hasMore && (
                <div className="flex justify-center">
                  <button onClick={loadMore} className="text-xs text-indigo-500 hover:text-indigo-700 bg-white border border-slate-200 px-4 py-1.5 rounded-full font-medium shadow-sm hover:shadow transition-all">
                    Load older messages
                  </button>
                </div>
              )}

              {msgLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No messages yet</p>
                  <p className="text-xs text-slate-300 mt-1">Send the first message to your team</p>
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
                      const isMe = msg.user.id === myId;
                      const initials = msg.user.firstName[0]?.toUpperCase();
                      return (
                        <div key={msg.id} className={cn("flex items-end gap-2 group animate-in fade-in slide-in-from-bottom-1 duration-200", isMe ? "flex-row-reverse" : "flex-row")}>
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mb-0.5",
                            isMe ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-600")}>
                            {msg.user.avatarUrl
                              ? <img src={msg.user.avatarUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                              : initials}
                          </div>

                          <div className={cn("max-w-xs sm:max-w-sm lg:max-w-md", isMe ? "items-end" : "items-start", "flex flex-col")}>
                            {!isMe && (
                              <p className="text-[10px] text-slate-400 font-medium mb-1 ml-1">
                                {msg.user.firstName} {msg.user.lastName}
                                {msg.user.isOwner && <span className="ml-1 text-indigo-500">· Owner</span>}
                              </p>
                            )}
                            <div className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                              isMe ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm")}>
                              {msg.content}
                            </div>
                            <div className={cn("flex items-center gap-1 mt-1 text-[10px]", isMe ? "flex-row-reverse" : "flex-row")}>
                              <span className="text-slate-400">{fmtTime(msg.createdAt)}</span>
                              {isMe && (
                                <CheckCheck className={cn("w-3 h-3", msg.readBy.length > 1 ? "text-indigo-500" : "text-slate-300")} />
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
                    onChange={e => { setText(e.target.value); handleTyping(); }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                    }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-indigo-400 max-h-28 overflow-y-auto leading-relaxed"
                    style={{ minHeight: "42px" }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || !connected || sending}
                  className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all shadow-sm hover:shadow">
                  <Send className="w-4 h-4 text-white" />
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
