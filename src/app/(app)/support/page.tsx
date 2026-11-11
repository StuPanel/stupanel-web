"use client";

import { LifeBuoy as HeaderIcon } from "lucide-react";
import { PageHeader, StatCard as AStat } from "@/components/ui/apple";

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
import { ListSkeleton, SearchPill, matches } from "@/components/list-ui";


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
  open:        { label: "Open",        color: "bg-[#D88A12]/15 text-[#B36B00] border-[#E9A63A]/30",   icon: Clock },
  in_progress: { label: "In Progress", color: "bg-[#2F6FB3]/15 text-[#1F5C99] border-[#6C9BD0]/30",     icon: MessageCircle },
  resolved:    { label: "Resolved",    color: "bg-[#1F8A5B]/15 text-[#1F8A5B] border-[#4FB884]/30", icon: CheckCircle },
  closed:      { label: "Closed",      color: "bg-[#E4E0EC] text-[#6B6680] border-[#B5B0C4]",         icon: X },
};

const priorityColor: Record<string, string> = {
  low:    "text-[#6B6680]",
  medium: "text-[#D88A12]",
  high:   "text-[#D88A12]",
  urgent: "text-[#C2304F]",
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
  const [q, setQ] = useState("");
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
    try {
      const q = new URLSearchParams({ page: String(p), ...(st && { status: st }) });
      const [ticketRes, statsRes] = await Promise.all([
        apiFetch(`${API}/support/tickets?${q}`),
        apiFetch(`${API}/support/stats`),
      ]);
      const d = await ticketRes.json();
      setTickets(d.items ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);
      setPage(p);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
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
      <div className="space-y-5">
        <button onClick={() => setView("list")}
          className="flex items-center gap-2 text-[#6B6680] hover:text-[#17151F] text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to tickets
        </button>

        <PageHeader icon={HeaderIcon} color="teal" title="New Support Ticket" sub="Our team usually replies within a few hours" />

        <form onSubmit={createTicket} className="bg-white rounded-[20px] p-6 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#33303F]">Subject *</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Invoice not generating correctly" required
              className="h-10 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#33303F]">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#33303F]">Priority</label>
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
            <label className="text-sm font-medium text-[#33303F]">Message *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={5} required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>

          {createErr && (
            <p className="text-xs text-[#C2304F] bg-[#FEF5F7] border border-[#FDECEF] px-3 py-2 rounded-lg">{createErr}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={creating || !subject.trim() || !content.trim()}
              className="gap-2 bg-[#7D5CEF] hover:bg-[#5B3FD0]">
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
      <div className="space-y-4">
        <button onClick={() => { setView("list"); setSelected(null); loadTickets(); }}
          className="flex items-center gap-2 text-[#6B6680] hover:text-[#17151F] text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to tickets
        </button>

        {/* Ticket header */}
        <div className="bg-white rounded-[20px] p-5 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs text-[#6B6680] font-mono">{selected.ticketNumber}</span>
                <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.color)}>
                  <StatusIcon className="w-3 h-3" />{cfg.label}
                </span>
                <span className={cn("text-xs font-semibold capitalize", priorityColor[selected.priority])}>
                  {selected.priority} priority
                </span>
              </div>
              <h2 className="font-bold text-[#17151F] text-lg leading-snug">{selected.subject}</h2>
              <p className="text-xs text-[#6B6680] mt-1">
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
                      ? "bg-[#7D5CEF] text-white rounded-br-sm"
                      : "bg-white border border-[#E4E0EC] text-[#17151F] rounded-bl-sm"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold", isStudio ? "text-indigo-200" : "text-[#7D5CEF]")}>
                        {isStudio ? "You" : "StuPanel Support"}
                      </span>
                      <span className={cn("text-xs", isStudio ? "text-indigo-300" : "text-[#6B6680]")}>
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
                <div className="flex-1 h-px bg-[#E4E0EC]" />
                <span className="text-xs text-[#6B6680] flex items-center gap-1">
                  <X className="w-3 h-3" />Ticket closed
                </span>
                <div className="flex-1 h-px bg-[#E4E0EC]" />
              </div>
            )}
          </div>
        )}

        {/* Reply box */}
        {!isClosed && (
          <div className="bg-white rounded-[20px] p-4 shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] space-y-3">
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
              placeholder="Write your reply... (Ctrl+Enter to send)"
              rows={3}
              className="w-full rounded-md border border-[#E4E0EC] bg-[#F7F5FB] px-3 py-2 text-sm placeholder:text-[#6B6680] focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#6B6680]">Ctrl+Enter to send</span>
              <Button onClick={sendReply} disabled={replying || !reply.trim()}
                size="sm" className="bg-[#7D5CEF] hover:bg-[#5B3FD0] gap-2">
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
    <div className="space-y-5">
      <PageHeader icon={HeaderIcon} color="teal" title="Support" sub="Get help from the StuPanel team">
        <Button onClick={() => setView("new")} className="bg-[#7D5CEF] hover:bg-[#5B3FD0] gap-2">
          <Plus className="w-4 h-4" />New Ticket
        </Button>
      </PageHeader>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AStat label="Open" value={String(stats.open ?? 0)} icon={Inbox} color="red" />
          <AStat label="In progress" value={String(stats.inProgress ?? 0)} icon={Clock} color="blue" />
          <AStat label="Resolved" value={String(stats.resolved ?? 0)} icon={CheckCircle} color="green" />
          <AStat label="Total" value={String(stats.total ?? 0)} icon={HeaderIcon} color="teal" />
        </div>
      )}

      {/* Status filter tabs */}
      <div role="tablist" aria-label="Filter by status" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none]">
        {[
          { v: "",            l: "All" },
          { v: "open",        l: "Open" },
          { v: "in_progress", l: "In Progress" },
          { v: "resolved",    l: "Resolved" },
          { v: "closed",      l: "Closed" },
        ].map(f => (
          <button key={f.v}
            onClick={() => { setStatusFilter(f.v); loadTickets(1, f.v); }}
            role="tab" aria-selected={statusFilter === f.v}
            className={cn(
              "h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors flex-shrink-0",
              statusFilter === f.v
                ? "bg-[#16141D] text-white"
                : "bg-white text-[#4A4658] hover:text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)]"
            )}>
            {f.l}
          </button>
        ))}
      </div>

      <SearchPill value={q} onChange={setQ} placeholder="Search tickets…" />

      {/* Ticket list */}
      {loading ? (
        <ListSkeleton />
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
          <Inbox className="w-10 h-10 text-[#B5B0C4] mb-3" />
          <p className="font-semibold text-[#4A4658]">No tickets yet</p>
          <p className="text-sm text-[#6B6680] mt-1 mb-4">Submit a ticket and our team will help you</p>
          <Button onClick={() => setView("new")} size="sm" className="bg-[#7D5CEF] hover:bg-[#5B3FD0] gap-2">
            <Plus className="w-3.5 h-3.5" />Create First Ticket
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] divide-y divide-[#F1EFF6]">
          {tickets.filter(t => matches(q, t.subject, t.ticketNumber, t.category)).length === 0 && (
            <p className="text-center text-sm text-[#6B6680] py-10">No tickets match &ldquo;{q}&rdquo;</p>
          )}
          {tickets.filter(t => matches(q, t.subject, t.ticketNumber, t.category)).map(ticket => {
            const cfg = statusConfig[ticket.status] ?? statusConfig.open;
            const StatusIcon = cfg.icon;
            const lastMsg = ticket.messages?.[0];
            const hasUnread = lastMsg?.senderType === "admin";

            return (
              <button key={ticket.id} onClick={() => openTicket(ticket)}
                className="w-full text-left px-5 py-4 hover:bg-[#F7F5FB] transition-colors group">
                <div className="flex items-start gap-4">
                  {/* Status dot */}
                  <div className={cn("mt-1 w-2 h-2 rounded-full flex-shrink-0",
                    hasUnread ? "bg-[#7D5CEF]" :
                    ticket.status === "open" ? "bg-[#E9A63A]" :
                    ticket.status === "in_progress" ? "bg-[#6C9BD0]" :
                    ticket.status === "resolved" ? "bg-[#4FB884]" : "bg-[#B5B0C4]"
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("font-semibold text-sm truncate",
                          hasUnread ? "text-[#17151F]" : "text-[#33303F]")}>
                          {ticket.subject}
                        </span>
                        {hasUnread && (
                          <span className="flex-shrink-0 text-xs bg-[#EEE8FD] text-[#7D5CEF] px-1.5 py-0.5 rounded-full font-bold">
                            NEW REPLY
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#6B6680] whitespace-nowrap flex-shrink-0">
                        {fmtShort(ticket.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.color)}>
                        <StatusIcon className="w-2.5 h-2.5" />{cfg.label}
                      </span>
                      <span className="text-xs text-[#6B6680] font-mono">{ticket.ticketNumber}</span>
                      <span className={cn("text-xs font-medium capitalize", priorityColor[ticket.priority])}>
                        {ticket.priority}
                      </span>
                      <span className="text-xs text-[#6B6680]">
                        {ticket._count?.messages ?? 0} {ticket._count?.messages === 1 ? "message" : "messages"}
                      </span>
                    </div>

                    {lastMsg && (
                      <p className="text-xs text-[#6B6680] mt-1.5 truncate">
                        <span className={cn("font-medium", lastMsg.senderType === "admin" ? "text-[#7D5CEF]" : "text-[#6B6680]")}>
                          {lastMsg.senderType === "admin" ? "Support: " : "You: "}
                        </span>
                        {lastMsg.content}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#B5B0C4] group-hover:text-[#6B6680] flex-shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6B6680]">Page {page} of {pages} ({total} total)</p>
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
