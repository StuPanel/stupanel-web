"use client";

/**
 * Studio notifications (GET /dashboard/notifications) — shared by the bell panel and the Notifications page.
 * Read / dismissed are kept on this device (localStorage), by notification id.
 */
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Bell, CalendarDays, FileSignature, Clock, DollarSign, Film, Images, Music2, PhoneCall, Plus, ShieldAlert,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import type { TileColor } from "@/components/ui/apple";

export interface Notif {
  id: string; type: string; priority: "high" | "medium" | "low";
  title: string; body: string; bookingId?: string; bookingNumber?: string; leadId?: string; galleryId?: string; contractId?: string; createdAt: string;
  client?: { firstName: string; lastName?: string | null; phone?: string | null };
}

export const TYPE_META: Record<string, { icon: typeof Bell; color: TileColor; label: string }> = {
  upcoming: { icon: CalendarDays, color: "blue", label: "Upcoming" },
  overdue: { icon: AlertTriangle, color: "red", label: "Overdue" },
  stuck: { icon: Clock, color: "ink", label: "Stuck" },
  payment: { icon: DollarSign, color: "orchid", label: "Payment due" },
  new: { icon: Plus, color: "green", label: "New program" },
  review: { icon: Film, color: "violet", label: "To review" },
  music: { icon: Music2, color: "orchid", label: "Music" },
  photos: { icon: Images, color: "red", label: "Photos" },
  contract: { icon: FileSignature, color: "green", label: "Contract" },
  lead: { icon: PhoneCall, color: "deep", label: "Follow-up" },
  backup: { icon: ShieldAlert, color: "red", label: "Backup" },
};
export const metaOf = (type: string) => TYPE_META[type] ?? { icon: Bell, color: "violet" as TileColor, label: "Notice" };

/** Where a notification opens. */
export function notifHref(n: Notif) {
  return n.contractId ? `/contracts/${n.contractId}` : n.galleryId ? `/photo-selection/${n.galleryId}` : n.leadId ? `/leads?open=${n.leadId}` : n.bookingId ? `/programs?view=${n.bookingId}` : "/notifications";
}

/** "Now", "5m", "3h", "2d", "11 Nov". */
export function timeAgo(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.round((now - t) / 1000);
  if (s < 0) {
    // follow-ups and events set in the future
    const d = Math.ceil(-s / 86400);
    return d <= 1 ? "Today" : `In ${d}d`;
  }
  if (s < 60) return "Now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Today / Yesterday / Earlier (by the device's day). */
export function dayGroup(iso: string, now = new Date()) {
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return "Today";
  if (d.getTime() >= start - 86400000) return "Yesterday";
  return "Earlier";
}

const READ_KEY = "notif_seen";
const DISMISSED_KEY = "notif_dismissed";
const EVENT = "notif-seen-updated";
const load = (k: string) => { try { return new Set<string>(JSON.parse(localStorage.getItem(k) ?? "[]")); } catch { return new Set<string>(); } };
const save = (k: string, s: Set<string>) => { try { localStorage.setItem(k, JSON.stringify([...s].slice(-300))); } catch { /* private mode */ } };

/**
 * Live list with read / dismissed state. Polls every 2 minutes while the tab is visible,
 * and every copy (bell, page) stays in step through a window event.
 */
export function useNotifications() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const sync = useCallback(() => { setRead(load(READ_KEY)); setDismissed(load(DISMISSED_KEY)); }, []);
  const refresh = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/dashboard/notifications`);
      if (r.ok) { const d = await r.json(); setItems(Array.isArray(d?.items) ? d.items : []); }
    } catch { /* keep the last list */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) { setLoading(false); return; }
    sync(); refresh();
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT, sync);
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 120000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener(EVENT, sync); clearInterval(t); };
  }, [refresh, sync]);

  const change = (k: string, ids: string[]) => {
    const s = load(k); ids.forEach(id => s.add(id)); save(k, s);
    window.dispatchEvent(new Event(EVENT));
  };
  const markRead = useCallback((ids: string[]) => change(READ_KEY, ids), []);
  const dismiss = useCallback((ids: string[]) => { change(DISMISSED_KEY, ids); change(READ_KEY, ids); }, []);

  const active = items.filter(n => !dismissed.has(n.id));
  const unread = active.filter(n => !read.has(n.id));
  return { items: active, unread, isRead: (id: string) => read.has(id), loading, refresh, markRead, dismiss, dismissedCount: items.length - active.length };
}
