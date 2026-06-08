"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, MessageCircle, ChevronLeft, ChevronRight, Send,
  CheckCircle, Clock, AlertTriangle, X, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const statusColors: Record<string, string> = {
  open:        "bg-amber-500/20 text-amber-400 border-amber-600/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-600/30",
  resolved:    "bg-emerald-500/20 text-emerald-400 border-emerald-600/30",
  closed:      "bg-slate-500/20 text-slate-400 border-slate-600/30",
};

const priorityColors: Record<string, string> = {
  low:    "text-slate-400",
  medium: "text-amber-400",
  high:   "text-orange-400",
  urgent: "text-red-400",
};

export default function AdminSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const load = useCallback(async (p = 1, st = status) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), ...(st && { status: st }) });
    const res = await fetch(`${API}/admin/support?${q}`, { headers: authH() });
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    const d = await res.json();
    setTickets(d.items ?? []);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
    setPage(p);
    setLoading(false);
  }, [router, status]);

  useEffect(() => { load(); }, []);

  async function openTicket(ticket: any) {
    setSelected(ticket);
    setDetailLoading(true);
    const res = await fetch(`${API}/admin/support/${ticket.id}`, { headers: authH() });
    setTicketDetail(await res.json());
    setDetailLoading(false);
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setReplying(true);
    await fetch(`${API}/admin/support/${selected.id}/reply`, {
      method: "POST", headers: authH(),
      body: JSON.stringify({ content: reply.trim() }),
    });
    setReply("");
    const res = await fetch(`${API}/admin/support/${selected.id}`, { headers: authH() });
    setTicketDetail(await res.json());
    setReplying(false);
    load(page);
  }

  async function closeTicket(id: string) {
    await fetch(`${API}/admin/support/${id}/close`, { method: "PATCH", headers: authH() });
    setSelected(null);
    setTicketDetail(null);
    load(page);
  }

  // Ticket detail view
  if (selected) {
    return (
      <div className="p-6 md:p-8 space-y-4 max-w-3xl">
        <button onClick={() => { setSelected(null); setTicketDetail(null); }}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to tickets
        </button>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-500 font-mono">{selected.ticketNumber}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", statusColors[selected.status] ?? "")}>
                  {selected.status.replace("_", " ")}
                </span>
                <span className={cn("text-xs font-semibold capitalize", priorityColors[selected.priority] ?? "")}>
                  {selected.priority}
                </span>
              </div>
              <h2 className="font-bold text-white text-lg">{selected.subject}</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {ticketDetail?.company?.name ?? selected.companyName} · {fmtDate(selected.createdAt)}
              </p>
            </div>
            {selected.status !== "closed" && (
              <Button size="sm" variant="outline" onClick={() => closeTicket(selected.id)}
                className="border-slate-600 text-slate-300 hover:bg-red-900/20 hover:text-red-400 shrink-0 gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />Close Ticket
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        {detailLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : (
          <div className="space-y-3">
            {(ticketDetail?.messages ?? []).map((msg: any) => (
              <div key={msg.id} className={cn("flex", msg.senderType === "admin" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-xl px-4 py-3",
                  msg.senderType === "admin"
                    ? "bg-indigo-600/30 border border-indigo-600/40"
                    : "bg-slate-800 border border-slate-700"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs font-semibold", msg.senderType === "admin" ? "text-indigo-300" : "text-slate-300")}>
                      {msg.senderType === "admin" ? "Admin" : "Studio"}
                    </span>
                    <span className="text-xs text-slate-500">{fmtDate(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply box */}
        {selected.status !== "closed" && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none placeholder:text-slate-600" />
            <div className="flex justify-end">
              <Button onClick={sendReply} disabled={replying || !reply.trim()} size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {replying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Reply
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} total tickets</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["", "open", "in_progress", "resolved", "closed"].map(st => (
          <button key={st} onClick={() => { setStatus(st); load(1, st); }}
            className={cn("text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors capitalize",
              status === st
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"
            )}>
            {st || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <MessageCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500">No support tickets</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700/50">
          {tickets.map(ticket => (
            <button key={ticket.id} onClick={() => openTicket(ticket)}
              className="w-full text-left px-4 py-4 hover:bg-slate-700/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500 font-mono">{ticket.ticketNumber}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", statusColors[ticket.status] ?? "")}>
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span className={cn("text-xs font-semibold capitalize", priorityColors[ticket.priority] ?? "")}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="font-medium text-white truncate">{ticket.subject}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{ticket.companyName} · {fmtDate(ticket.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-slate-500">{ticket._count?.messages ?? 0} msg</span>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />Prev
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => load(page + 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">
              Next<ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
