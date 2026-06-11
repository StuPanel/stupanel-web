"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Plus, MessageCircle, Send, ArrowLeft,
  CheckCircle, Clock, AlertTriangle, X, ChevronRight,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";


function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtShort(d: string) {
  const now = Date.now();
  const diff = now - new Date(d).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open:        { label: "Open",        color: "bg-amber-500/15 text-amber-600 border-amber-400/30",   icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-500/15 text-blue-600 border-blue-400/30",     icon: MessageCircle },
  resolved:    { label: "Resolved",    color: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30", icon: CheckCircle },
  closed:      { label: "Closed",      color: "bg-slate-200 text-slate-500 border-slate-300",         icon: X },
};

const priorityColor: Record<string, string> = {
  low:    "text-slate-400",
  medium: "text-amber-500",
  high:   "text-orange-500",
  urgent: "text-red-500",
};

const CATEGORIES = [
  { value: "general",   label: "General Question" },
  { value: "billing",   label: "Billing / Payment" },
  { value: "technical", label: "Technical Issue" },
  { value: "feature",   label: "Feature Request" },
  { value: "bug",       label: "Bug Report" },
];

export default function SupportPage() {
  const [view, setView] = useState<"list" | "detail" | "new">("list");
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // Detail view
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const loadTickets = useCallback(async (p = 1, st = statusFilter) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), ...(st && { status: st }) });
    const [ticketRes, statsRes] = await Promise.all([
      fetch(`${API}/support/tickets?${q}`, { headers: { "Content-Type": "application/json" } }),
      fetch(`${API}/support/stats`, { headers: { "Content-Type": "application/json" } }),
    ]);
    const d = await ticketRes.json();
    setTickets(d.items ?? []);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
    setPage(p);
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadTickets(); }, []);

  async function openTicket(ticket: any) {
    setSelected(ticket);
    setDetailLoading(true);
    setView("detail");
    const res = await apiFetch(`${API}/support/tickets/${ticket.id}`, { headers: { "Content-Type": "application/json" } });
    const d = await res.json();
    setMessages(d.messages ?? []);
    setDetailLoading(false);
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setReplying(true);
    await apiFetch(`${API}/support/tickets/${selected.id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply.trim() }),
    });
    const res = await apiFetch(`${API}/support/tickets/${selected.id}`, { headers: { "Content-Type": "application/json" } });
    const d = await res.json();
    setMessages(d.messages ?? []);
    setReply("");
    setReplying(false);
    loadTickets();
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(""); setCreating(true);
    const res = await apiFetch(`${API}/support/tickets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), content: content.trim(), priority, category }),
    });
    const d = await res.json();
    if (!res.ok) { setCreateErr(d.message ?? "Failed to create ticket"); setCreating(false); return; }
    setSubject(""); setContent(""); setPriority("medium"); setCategory("general");
    setCreating(false);
    await loadTickets();
    // Open the new ticket
    openTicket(d);
  }

  // ── NEW TICKET VIEW ────────────────────────────────────────────────────────
  if (view === "new") {
    return (
      <div className="p-6 md:p-8 max-w-2xl space-y-5">
        <button onClick={() => setView("list")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to tickets
        </button>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Support Ticket</h1>
          <p className="text-sm text-slate-500 mt-0.5">Our team typically replies within a few hours</p>
        </div>

        <form onSubmit={createTicket} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Subject *</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Invoice not generating correctly" required
              className="h-10 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Message *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={5} required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>

          {createErr && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{createErr}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={creating || !subject.trim() || !content.trim()}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Ticket
            </Button>
            <Button type="button" variant="outline" onClick={() => setView("list")}>Cancel</Button>
          </div>
        </form>
      </div>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const cfg = statusConfig[selected.status] ?? statusConfig.open;
    const StatusIcon = cfg.icon;
    const isClosed = selected.status === "closed";

    return (
      <div className="p-6 md:p-8 max-w-2xl space-y-4">
        <button onClick={() => { setView("list"); setSelected(null); loadTickets(); }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to tickets
        </button>

        {/* Ticket header */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs text-slate-400 font-mono">{selected.ticketNumber}</span>
                <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.color)}>
                  <StatusIcon className="w-3 h-3" />{cfg.label}
                </span>
                <span className={cn("text-xs font-semibold capitalize", priorityColor[selected.priority])}>
                  {selected.priority} priority
                </span>
              </div>
              <h2 className="font-bold text-slate-900 text-lg leading-snug">{selected.subject}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Opened {fmtDate(selected.createdAt)} · {CATEGORIES.find(c => c.value === selected.category)?.label ?? selected.category}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {detailLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: any) => {
              const isStudio = msg.senderType === "studio";
              return (
                <div key={msg.id} className={cn("flex", isStudio ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 space-y-1",
                    isStudio
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold", isStudio ? "text-indigo-200" : "text-indigo-600")}>
                        {isStudio ? "You" : "StuPanel Support"}
                      </span>
                      <span className={cn("text-xs", isStudio ? "text-indigo-300" : "text-slate-400")}>
                        {fmtShort(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            })}

            {isClosed && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <X className="w-3 h-3" />Ticket closed
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            )}
          </div>
        )}

        {/* Reply box */}
        {!isClosed && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
              placeholder="Write your reply... (Ctrl+Enter to send)"
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Ctrl+Enter to send</span>
              <Button onClick={sendReply} disabled={replying || !reply.trim()}
                size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                {replying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Reply
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support</h1>
          <p className="text-sm text-slate-500 mt-0.5">Get help from the StuPanel team</p>
        </div>
        <Button onClick={() => setView("new")} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" />New Ticket
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Open",        value: stats.open,       color: "text-amber-600",   bg: "bg-amber-50   border-amber-200" },
            { label: "In Progress", value: stats.inProgress, color: "text-blue-600",    bg: "bg-blue-50    border-blue-200" },
            { label: "Resolved",    value: stats.resolved,   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
            { label: "Total",       value: stats.total,      color: "text-slate-700",   bg: "bg-white      border-slate-200" },
          ].map(s => (
            <div key={s.label} className={cn("rounded-xl border p-4 text-center", s.bg)}>
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { v: "",            l: "All" },
          { v: "open",        l: "Open" },
          { v: "in_progress", l: "In Progress" },
          { v: "resolved",    l: "Resolved" },
          { v: "closed",      l: "Closed" },
        ].map(f => (
          <button key={f.v}
            onClick={() => { setStatusFilter(f.v); loadTickets(1, f.v); }}
            className={cn(
              "text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors",
              statusFilter === f.v
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl">
          <Inbox className="w-10 h-10 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-600">No tickets yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Submit a ticket and our team will help you</p>
          <Button onClick={() => setView("new")} size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-3.5 h-3.5" />Create First Ticket
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {tickets.map(ticket => {
            const cfg = statusConfig[ticket.status] ?? statusConfig.open;
            const StatusIcon = cfg.icon;
            const lastMsg = ticket.messages?.[0];
            const hasUnread = lastMsg?.senderType === "admin";

            return (
              <button key={ticket.id} onClick={() => openTicket(ticket)}
                className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors group">
                <div className="flex items-start gap-4">
                  {/* Status dot */}
                  <div className={cn("mt-1 w-2 h-2 rounded-full flex-shrink-0",
                    hasUnread ? "bg-indigo-500" :
                    ticket.status === "open" ? "bg-amber-400" :
                    ticket.status === "in_progress" ? "bg-blue-400" :
                    ticket.status === "resolved" ? "bg-emerald-400" : "bg-slate-300"
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("font-semibold text-sm truncate",
                          hasUnread ? "text-slate-900" : "text-slate-700")}>
                          {ticket.subject}
                        </span>
                        {hasUnread && (
                          <span className="flex-shrink-0 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
                            NEW REPLY
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                        {fmtShort(ticket.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.color)}>
                        <StatusIcon className="w-2.5 h-2.5" />{cfg.label}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{ticket.ticketNumber}</span>
                      <span className={cn("text-xs font-medium capitalize", priorityColor[ticket.priority])}>
                        {ticket.priority}
                      </span>
                      <span className="text-xs text-slate-400">
                        {ticket._count?.messages ?? 0} {ticket._count?.messages === 1 ? "message" : "messages"}
                      </span>
                    </div>

                    {lastMsg && (
                      <p className="text-xs text-slate-400 mt-1.5 truncate">
                        <span className={cn("font-medium", lastMsg.senderType === "admin" ? "text-indigo-500" : "text-slate-500")}>
                          {lastMsg.senderType === "admin" ? "Support: " : "You: "}
                        </span>
                        {lastMsg.content}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Page {page} of {pages} ({total} total)</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1}
              onClick={() => loadTickets(page - 1)} className="h-8">Prev</Button>
            <Button size="sm" variant="outline" disabled={page >= pages}
              onClick={() => loadTickets(page + 1)} className="h-8">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
