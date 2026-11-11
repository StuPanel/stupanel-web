"use client";

/**
 * All notifications, full page. Same list and read/dismissed state as the bell panel
 * (see lib/notifications): filter by kind, All / Unread, open marks it read, dismiss, WhatsApp.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell as HeaderIcon, CheckCheck, ChevronRight, MessageCircle, RefreshCw, X } from "lucide-react";
import { CARD_SHADOW, PageHeader, Tile } from "@/components/ui/apple";
import { cn } from "@/lib/utils";
import { dayGroup, metaOf, notifHref, timeAgo, TYPE_META, useNotifications, type Notif } from "@/lib/notifications";
import { WhatsAppModal } from "../programs/_components/whatsapp-modal";

const KIND_ORDER = ["review", "photos", "music", "lead", "backup", "upcoming", "overdue", "payment", "stuck", "new"];

export default function NotificationsPage() {
  const router = useRouter();
  const { items, unread, isRead, loading, refresh, markRead, dismiss, dismissedCount } = useNotifications();
  const [kind, setKind] = useState("all");
  const [show, setShow] = useState<"all" | "unread">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [waFor, setWaFor] = useState<Notif | null>(null);

  const base = show === "unread" ? unread : items;
  const visible = base.filter(n => kind === "all" || n.type === kind);
  const order = { high: 0, medium: 1, low: 2 } as const;
  const groups = useMemo(() => (["Today", "Yesterday", "Earlier"] as const)
    .map(g => ({ g, rows: visible.filter(n => dayGroup(n.createdAt) === g).sort((a, b) => order[a.priority] - order[b.priority] || +new Date(b.createdAt) - +new Date(a.createdAt)) }))
    .filter(x => x.rows.length), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = KIND_ORDER.filter(k => base.some(n => n.type === k));
  const important = items.filter(n => n.priority === "high").length;

  async function reload() { setRefreshing(true); await refresh(); setRefreshing(false); }

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader icon={HeaderIcon} color="red" title="Notifications"
        sub={<>{important > 0 && <span className="font-semibold text-[#C2304F]">{important} important · </span>}{unread.length} unread · {items.length} active{dismissedCount ? ` · ${dismissedCount} cleared` : ""}</>}>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button onClick={() => markRead(unread.map(n => n.id))}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white text-xs font-semibold text-[#5B3FD0] shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]">
              <CheckCheck className="w-3.5 h-3.5" />Mark all read
            </button>
          )}
          {visible.length > 0 && (
            <button onClick={() => dismiss(visible.map(n => n.id))}
              className="h-9 px-3.5 rounded-full bg-white text-xs font-semibold text-[#17151F] shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]">Clear all</button>
          )}
          <button onClick={reload} disabled={refreshing} aria-label="Refresh"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-[#4A4658] shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]">
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Show" className="flex p-1 rounded-full bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)]">
          {(["all", "unread"] as const).map(t => (
            <button key={t} role="tab" aria-selected={show === t} onClick={() => setShow(t)}
              className={cn("h-8 px-4 rounded-full text-[13px] font-semibold", show === t ? "bg-[#16141D] text-white" : "text-[#4A4658]")}>
              {t === "all" ? `All (${items.length})` : `Unread (${unread.length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {kinds.length > 1 && (
            <button onClick={() => setKind("all")}
              className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold", kind === "all" ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-white text-[#4A4658] shadow-[0_1px_2px_rgba(22,18,40,.06)]")}>Every kind</button>
          )}
          {kinds.length > 1 && kinds.map(k => (
            <button key={k} onClick={() => setKind(k)}
              className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap", kind === k ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-white text-[#4A4658] shadow-[0_1px_2px_rgba(22,18,40,.06)]")}>
              {TYPE_META[k]?.label ?? k} · {base.filter(n => n.type === k).length}
            </button>
          ))}
        </div>
      </div>

      {loading && !items.length ? (
        <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-[20px] bg-white/70 animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className={cn("text-center py-20 bg-white rounded-[20px]", CARD_SHADOW)}>
          <div className="w-14 h-14 rounded-full bg-[#E7F5EE] flex items-center justify-center mx-auto mb-3"><CheckCheck className="w-7 h-7 text-[#1F8A5B]" /></div>
          <p className="font-semibold text-[#17151F]">{show === "unread" ? "No unread notifications" : "All caught up"}</p>
          <p className="text-sm text-[#6B6680] mt-1">New things that need you will show here.</p>
        </div>
      ) : groups.map(({ g, rows }) => (
        <section key={g}>
          <p className="px-1 mb-2 text-[12px] font-bold tracking-[0.06em] uppercase text-[#9893A8]">{g}</p>
          <ul className={cn("bg-white rounded-[20px] divide-y divide-[#F0EDF5] overflow-hidden", CARD_SHADOW)}>
            {rows.map(n => {
              const m = metaOf(n.type);
              const unreadRow = !isRead(n.id);
              return (
                <li key={n.id} className={cn("group flex items-start gap-3 p-4", unreadRow && "bg-[#FAF8FF]")}>
                  <Tile icon={m.icon} color={m.color} size={40} className="flex-shrink-0" />
                  <button type="button" onClick={() => { markRead([n.id]); router.push(notifHref(n)); }} className="flex-1 min-w-0 text-left">
                    <span className="flex items-center gap-2">
                      {unreadRow && <span aria-label="Unread" className="w-2 h-2 rounded-full bg-[#7D5CEF] flex-shrink-0" />}
                      <span className={cn("text-[15px] truncate", unreadRow ? "font-bold text-[#17151F]" : "font-semibold text-[#2B2836]")}>{n.title}</span>
                      {n.priority === "high" && <span className="flex-shrink-0 text-[11px] font-bold text-[#C2304F] bg-[#FDECEF] px-1.5 py-0.5 rounded-full">Important</span>}
                    </span>
                    <span className="block text-[13px] text-[#6B6680] mt-0.5 leading-relaxed">{n.body}</span>
                    <span className="block text-[12px] text-[#9893A8] mt-1">{m.label} · {timeAgo(n.createdAt)}{n.bookingNumber ? ` · ${n.bookingNumber}` : ""}</span>
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(n.type === "payment" || n.type === "upcoming") && n.client?.phone && (
                      <button onClick={() => { markRead([n.id]); setWaFor(n); }} aria-label={`WhatsApp ${n.client.firstName}`}
                        className="h-8 px-3 rounded-full bg-[#1F8A5B] hover:bg-[#19744C] text-xs font-semibold text-white inline-flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    )}
                    <button onClick={() => { markRead([n.id]); router.push(notifHref(n)); }} aria-label={`Open ${n.title}`}
                      className="hidden sm:inline-flex h-8 px-3 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-xs font-semibold text-[#17151F] items-center gap-0.5">
                      Open<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => dismiss([n.id])} aria-label={`Dismiss ${n.title}`} title="Dismiss"
                      className="w-8 h-8 rounded-full text-[#6B6680] hover:bg-[#F5F3FA] hover:text-[#17151F] flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <WhatsAppModal preferCategory={waFor?.type === "upcoming" ? "event_reminder" : "payment_reminder"} onClose={() => setWaFor(null)}
        booking={waFor ? { id: waFor.bookingId ?? "", bookingNumber: waFor.bookingNumber ?? "", client: waFor.client } : null} />
    </div>
  );
}
