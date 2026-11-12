/**
 * Client portal data: the shapes the API sends, small helpers, and the "what you need to do"
 * list. Everything is grouped by program so a client with many programs sees each one on its own.
 */
import { currencySymbol } from "@/lib/format";
import type { ClientGalleryCard } from "@/lib/photos";
import type { ClientMusic } from "@/lib/music";
import type { PortalDriveFile } from "./portal-files";

export const sym = (cur = "BDT") => currencySymbol(cur);
export const num = (n: number | string | null | undefined) => Number(n || 0).toLocaleString();
export const money = (n: number | string | null | undefined, cur?: string) => `${sym(cur)}${num(n)}`;

export interface R2File {
  id: string; fileName: string; mimeType: string;
  fileSize: number; viewUrl: string | null; downloadUrl: string | null; folderName?: string | null;
}
export interface ManualLink { id: string; title: string; url: string | null }
export interface BookingDelivery {
  fullyPaid: boolean; dueAmount: number;
  r2Files: R2File[]; driveFiles?: PortalDriveFile[];
  links: ManualLink[]; driveFolderUrl: string | null; driveFolderLocked?: boolean; note: string | null;
  /** Locked (money due): what is waiting, by top folder. */
  preview?: { name: string; count: number; bytes: number; videos: number; photos: number }[];
}
export type Studio = { name: string; phone?: string; bkashNumber?: string | null; nagadNumber?: string | null };
export type PortalDay = { name: string; date: string | null; location: string | null };
export type PortalBooking = {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; eventEndDate?: string | null; status: string; deliveryStatus?: string;
  grandTotal: number; paidAmount: number; currency: string;
  eventLocation?: string; deliveryLink?: string;
  days?: PortalDay[];
  delivery?: BookingDelivery | null;
};
export type PortalQuote = {
  id: string; quoteNumber: string; status: string;
  grandTotal: number; currency: string; validUntil?: string;
  publicToken: string; createdAt: string;
};
export type PortalInvoice = {
  id: string; invoiceNumber: string; status: string;
  grandTotal: number; paidAmount: number; balanceDue: number;
  currency: string; issueDate: string; dueDate?: string; publicToken: string; bookingId?: string | null;
};
export type PortalPayment = {
  id: string; amount: number; currency: string;
  paymentMethod?: string; paymentDate: string;
  referenceNumber?: string; notes?: string; bookingId?: string | null;
};
export interface PortalContract {
  id: string; contractNumber: string; title: string; status: string; publicToken: string;
  sentAt?: string | null; signedAt?: string | null; signerName?: string | null; bookingId?: string | null;
  booking?: { eventName?: string | null; eventDate?: string | null } | null;
}
export interface PortalData {
  client: { firstName: string; lastName?: string; email?: string; phone?: string; avatarUrl?: string };
  company: {
    name: string; email?: string; phone?: string; address?: string;
    city?: string; logoUrl?: string; primaryColor?: string; currency: string;
    portalWelcomeMessage?: string; bkashNumber?: string | null; nagadNumber?: string | null;
    portalShowQuotes?: boolean; portalShowInvoices?: boolean;
    portalShowPayments?: boolean; portalShowMessages?: boolean;
  };
  bookings: PortalBooking[];
  quotes: PortalQuote[];
  invoices: PortalInvoice[];
  payments: PortalPayment[];
  /** Agreements the studio sent (never drafts). */
  contracts?: PortalContract[];
}

export const studioOf = (d: PortalData): Studio => ({
  name: d.company.name, phone: d.company.phone, bkashNumber: d.company.bkashNumber, nagadNumber: d.company.nagadNumber,
});
export const programName = (b: PortalBooking) => b.eventName || b.bookingNumber;
export const dueOf = (b: PortalBooking) => Math.max(0, Number(b.grandTotal) - Number(b.paidAmount));

// ─── Where a program is ──────────────────────────────────────────────────────

/** Fallback when the API did not send deliveryStatus. */
export function deliveryStatus(b: PortalBooking): string {
  if (b.deliveryStatus) return b.deliveryStatus;
  const s = b.status;
  if (["cancelled", "refunded"].includes(s)) return "cancelled";
  if (["completed", "delivered"].includes(s)) return "delivered";
  if (s === "ready_for_delivery" || b.delivery) return "ready";
  if (s === "editing") return "editing";
  if (s === "in_progress") return "shooting";
  if (["confirmed", "advance_received"].includes(s)) return "booked";
  return "not_started";
}

const today = () => new Date().toISOString().slice(0, 10);
const lastDay = (b: PortalBooking) => (b.eventEndDate ?? b.eventDate ?? "").slice(0, 10);
const firstDay = (b: PortalBooking) => (b.eventDate ?? "").slice(0, 10);

/** Booked → Event → Editing → Ready. Returns the step the program is on (0–3), or -1 if cancelled. */
export const STEPS = ["Booked", "Event day", "Editing", "Files ready"] as const;
export function stepOf(b: PortalBooking): number {
  const ds = deliveryStatus(b);
  if (ds === "cancelled") return -1;
  if (ds === "ready" || ds === "delivered") return 3;
  if (ds === "editing") return 2;
  const end = lastDay(b);
  if (end && end < today()) return 2;
  if (ds === "shooting" || (firstDay(b) && firstDay(b) <= today())) return 1;
  return 0;
}
/** Still to come (or today) vs. done. Programs without a date count as upcoming. */
export function isUpcoming(b: PortalBooking) {
  const end = lastDay(b);
  if (deliveryStatus(b) === "cancelled") return false;
  return !end || end >= today();
}

export const STATUS_CHIP: Record<string, { label: string; color: string }> = {
  not_started: { label: "Booked", color: "bg-[#EEE8FD] text-[#5B3FD0]" },
  booked: { label: "Booked", color: "bg-[#EEE8FD] text-[#5B3FD0]" },
  shooting: { label: "Event day", color: "bg-[#EEE8FD] text-[#5B3FD0]" },
  in_progress: { label: "In progress", color: "bg-[#EEE8FD] text-[#5B3FD0]" },
  editing: { label: "Editing", color: "bg-[#FFF3E0] text-[#9A5B00]" },
  ready: { label: "Files ready", color: "bg-[#7D5CEF] text-white" },
  delivered: { label: "Delivered", color: "bg-[#E6F4EC] text-[#1F8A5B]" },
  cancelled: { label: "Cancelled", color: "bg-[#FDECEF] text-[#C2304F]" },
};
export const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-[#F1EFF6] text-[#4A4658]" },
  sent: { label: "Waiting for you", color: "bg-[#FFF3E0] text-[#9A5B00]" },
  viewed: { label: "Waiting for you", color: "bg-[#FFF3E0] text-[#9A5B00]" },
  accepted: { label: "Accepted", color: "bg-[#E7F5EE] text-[#1F8A5B]" },
  rejected: { label: "Declined", color: "bg-[#FDECEF] text-[#C2304F]" },
  expired: { label: "Expired", color: "bg-[#F1EFF6] text-[#8A8599]" },
  converted: { label: "Booked", color: "bg-[#E7F5EE] text-[#1F8A5B]" },
};
export const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Due", color: "bg-[#FDECEF] text-[#C2304F]" },
  sent: { label: "Due", color: "bg-[#FDECEF] text-[#C2304F]" },
  viewed: { label: "Due", color: "bg-[#FDECEF] text-[#C2304F]" },
  paid: { label: "Paid", color: "bg-[#E7F5EE] text-[#1F8A5B]" },
  partially_paid: { label: "Partly paid", color: "bg-[#FFF3E0] text-[#9A5B00]" },
  overdue: { label: "Overdue", color: "bg-[#FDECEF] text-[#C2304F]" },
  void: { label: "Cancelled", color: "bg-[#F1EFF6] text-[#8A8599]" },
};

export const quoteOpen = (q: PortalQuote) =>
  ["sent", "viewed"].includes(q.status) && !(q.validUntil && q.validUntil.slice(0, 10) < today());

// ─── What the client needs to do ─────────────────────────────────────────────

export type TodoKind = "sign" | "photos" | "music" | "pay" | "quote";
export type Todo = {
  key: string; kind: TodoKind; title: string; sub: string;
  /** Open this program (and this part of it), or go to a link. */
  bookingId?: string; part?: "photos" | "music" | "money"; galleryId?: string; href?: string;
  /** Or a whole view (several quotes → Money). */
  view?: "money";
  soon?: boolean;
};

export function todosOf(d: PortalData, photos: ClientGalleryCard[], music: ClientMusic[]): Todo[] {
  const out: Todo[] = [];
  const name = new Map(d.bookings.map(b => [b.id, programName(b)]));
  for (const c of d.contracts ?? []) {
    if (c.status === "signed") continue;
    out.push({ key: `c${c.id}`, kind: "sign", title: "Sign your agreement", sub: c.booking?.eventName || c.title, href: `/c/${c.publicToken}`, bookingId: c.bookingId ?? undefined });
  }
  for (const g of photos) {
    if (g.status !== "open") continue;
    const left = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;
    out.push({
      key: `p${g.id}`, kind: "photos", title: g.picked ? "Finish choosing your album photos" : "Choose your album photos",
      sub: [name.get(g.bookingId) ?? g.program, left !== null && left >= 0 ? (left === 0 ? "last day today" : `${left} day${left > 1 ? "s" : ""} left`) : null].filter(Boolean).join(" · "),
      bookingId: g.bookingId, part: "photos", galleryId: g.id, soon: left !== null && left <= 2,
    });
  }
  for (const m of music) {
    if (m.status !== "open") continue;
    out.push({
      key: `m${m.bookingId}`, kind: "music", title: m.counts.total ? "Finish choosing your songs" : "Choose your songs",
      sub: name.get(m.bookingId) ?? m.program, bookingId: m.bookingId, part: "music",
    });
  }
  const quotes = d.quotes.filter(quoteOpen);
  if (quotes.length === 1) {
    const q = quotes[0];
    out.push({ key: `q${q.id}`, kind: "quote", title: "Look at your quote", sub: `${q.quoteNumber} · ${money(q.grandTotal, q.currency)}`, href: `/q/${q.publicToken}` });
  } else if (quotes.length > 1) {
    out.push({ key: "quotes", kind: "quote", title: `Look at your ${quotes.length} quotes`, sub: quotes.map(q => q.quoteNumber).slice(0, 3).join(", ") + (quotes.length > 3 ? "…" : ""), view: "money" });
  }
  for (const b of d.bookings) {
    const due = dueOf(b);
    if (due <= 0 || deliveryStatus(b) === "cancelled") continue;
    // Files are waiting behind the payment → the most useful reminder.
    if (b.delivery && !b.delivery.fullyPaid) {
      out.push({ key: `f${b.id}`, kind: "pay", title: `Pay ${money(due, b.currency)} to get your files`, sub: programName(b), bookingId: b.id, part: "money", soon: true });
    }
  }
  const order: Record<TodoKind, number> = { sign: 0, pay: 1, photos: 2, music: 3, quote: 4 };
  return out.sort((a, b) => Number(!!b.soon) - Number(!!a.soon) || order[a.kind] - order[b.kind]);
}

/** Things to do for one program (shown as a small badge on its card). */
export const todosFor = (todos: Todo[], bookingId: string) => todos.filter(t => t.bookingId === bookingId);
