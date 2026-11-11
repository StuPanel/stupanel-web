"use client";

/**
 * Bell in the top bar → a panel with the studio's notifications.
 * All / Unread, grouped by day, click to open (marks it read), × to dismiss,
 * Mark all read, Clear all, and "See all" for the full page.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { Bell, CheckCheck, ChevronRight, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/ui/apple";
import { dayGroup, metaOf, notifHref, timeAgo, useNotifications, type Notif } from "@/lib/notifications";
import { WhatsAppModal } from "@/app/(app)/programs/_components/whatsapp-modal";

export function NotificationBell() {
  const router = useRouter();
  const { items, unread, isRead, loading, markRead, dismiss, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [waFor, setWaFor] = useState<Notif | null>(null);

  const list = tab === "unread" ? unread : items;
  // Important first inside each day, then newest
  const order = { high: 0, medium: 1, low: 2 } as const;
  const groups = (["Today", "Yesterday", "Earlier"] as const)
    .map(g => ({ g, rows: list.filter(n => dayGroup(n.createdAt) === g).sort((a, b) => order[a.priority] - order[b.priority] || +new Date(b.createdAt) - +new Date(a.createdAt)) }))
    .filter(x => x.rows.length);
  const count = unread.length;

  function openOne(n: Notif) {
    markRead([n.id]);
    setOpen(false);
    router.push(notifHref(n));
  }

  return (
    <>
      <Popover.Root open={open} onOpenChange={o => { setOpen(o); if (o) refresh(); }}>
        <Popover.Trigger asChild>
          <button aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
            className={cn("relative w-10 h-10 rounded-xl bg-white border flex items-center justify-center transition-colors",
              open ? "border-violet-300 text-violet-700" : "border-slate-200 text-slate-600 hover:text-violet-700 hover:border-violet-200")}>
            <Bell className="w-[18px] h-[18px]" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C2304F] text-white text-[10.5px] font-bold flex items-center justify-center ring-2 ring-white tabular-nums">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={10} collisionPadding={12}
            className="z-[60] w-[min(400px,calc(100vw-24px))] max-h-[min(620px,calc(100dvh-96px))] flex flex-col rounded-[22px] bg-white/95 backdrop-blur-xl ring-1 ring-black/5 shadow-[0_24px_60px_-18px_rgba(22,18,40,.35)] outline-none sp-pop-in">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <p className="flex-1 text-[17px] font-extrabold tracking-[-0.01em] text-[#17151F]">Notifications</p>
                {count > 0 && (
                  <button type="button" onClick={() => markRead(unread.map(n => n.id))}
                    className="h-8 px-3 rounded-full text-[12.5px] font-semibold text-[#5B3FD0] hover:bg-[#F3EFFE] inline-flex items-center gap-1.5">
                    <CheckCheck className="w-3.5 h-3.5" />Mark all read
                  </button>
                )}
              </div>
              <div role="tablist" aria-label="Show" className="mt-3 grid grid-cols-2 p-1 rounded-full bg-[#F3F1F8]">
                {(["all", "unread"] as const).map(t => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={cn("h-8 rounded-full text-[13px] font-semibold transition-colors",
                      tab === t ? "bg-white text-[#17151F] shadow-[0_1px_3px_rgba(22,18,40,.12)]" : "text-[#6B6680] hover:text-[#17151F]")}>
                    {t === "all" ? `All (${items.length})` : `Unread (${count})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
              {loading && !items.length ? (
                <div className="space-y-2 p-2">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-[#F5F3FA] animate-pulse" />)}</div>
              ) : groups.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#E7F5EE] flex items-center justify-center"><CheckCheck className="w-6 h-6 text-[#1F8A5B]" /></div>
                  <p className="mt-3 text-[15px] font-semibold text-[#17151F]">{tab === "unread" ? "No unread notifications" : "All caught up"}</p>
                  <p className="mt-1 text-[13px] text-[#6B6680]">New things that need you will show here.</p>
                </div>
              ) : groups.map(({ g, rows }) => (
                <section key={g} className="mb-1">
                  <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.06em] uppercase text-[#9893A8]">{g}</p>
                  <ul>
                    {rows.map(n => {
                      const m = metaOf(n.type);
                      const unreadRow = !isRead(n.id);
                      return (
                        <li key={n.id} className="group relative">
                          <button type="button" onClick={() => openOne(n)}
                            className={cn("w-full flex items-start gap-3 p-3 pr-10 rounded-2xl text-left transition-colors",
                              unreadRow ? "bg-[#F7F4FE] hover:bg-[#F0EBFD]" : "hover:bg-[#F7F5FB]")}>
                            <Tile icon={m.icon} color={m.color} size={36} className="flex-shrink-0 mt-0.5" />
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className={cn("text-[14px] truncate", unreadRow ? "font-bold text-[#17151F]" : "font-semibold text-[#2B2836]")}>{n.title}</span>
                                {n.priority === "high" && <span className="flex-shrink-0 text-[10.5px] font-bold text-[#C2304F] bg-[#FDECEF] px-1.5 py-0.5 rounded-full">Important</span>}
                              </span>
                              <span className="block text-[12.5px] text-[#6B6680] leading-snug mt-0.5 line-clamp-2">{n.body}</span>
                              <span className="block text-[11.5px] text-[#9893A8] mt-1">{m.label} · {timeAgo(n.createdAt)}</span>
                            </span>
                            {unreadRow && <span aria-label="Unread" className="absolute right-4 top-4 w-2 h-2 rounded-full bg-[#7D5CEF] group-hover:opacity-0 transition-opacity" />}
                          </button>
                          <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                            <button type="button" onClick={() => dismiss([n.id])} aria-label={`Dismiss ${n.title}`} title="Dismiss"
                              className="w-7 h-7 rounded-full bg-white shadow-[0_1px_3px_rgba(22,18,40,.15)] text-[#6B6680] hover:text-[#17151F] flex items-center justify-center">
                              <X className="w-3.5 h-3.5" />
                            </button>
                            {(n.type === "payment" || n.type === "upcoming") && n.client?.phone && (
                              <button type="button" onClick={() => { markRead([n.id]); setWaFor(n); setOpen(false); }} aria-label={`WhatsApp ${n.client.firstName}`} title="WhatsApp"
                                className="w-7 h-7 rounded-full bg-[#1F8A5B] text-white flex items-center justify-center shadow-[0_1px_3px_rgba(22,18,40,.15)]">
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-[#EEEBF4]">
              <p className="hidden sm:block flex-1 text-[11.5px] text-[#9893A8]">Click to open · hover to dismiss</p>
              {items.length > 0 && (
                <button type="button" onClick={() => dismiss(items.map(n => n.id))}
                  className="h-8 px-3 rounded-full text-[12.5px] font-semibold text-[#6B6680] hover:bg-[#F5F3FA]">Clear all</button>
              )}
              <button type="button" onClick={() => { setOpen(false); router.push("/notifications"); }}
                className="ml-auto sm:ml-0 h-8 pl-3 pr-2 rounded-full bg-[#17151F] text-white text-[12.5px] font-semibold inline-flex items-center gap-0.5">
                See all<ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <WhatsAppModal preferCategory={waFor?.type === "upcoming" ? "event_reminder" : "payment_reminder"} onClose={() => setWaFor(null)}
        booking={waFor ? { id: waFor.bookingId ?? "", bookingNumber: waFor.bookingNumber ?? "", client: waFor.client } : null} />
    </>
  );
}
