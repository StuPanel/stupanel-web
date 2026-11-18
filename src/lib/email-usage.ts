/**
 * Email counts (Super admin → Emails, and the studio's Settings → Notifications).
 * Every email StuPanel sends is counted once per person it went to. A new kind of email shows up
 * by itself; add a friendly name below when one appears (until then its code name is tidied up).
 */
export type EmailWho = "client" | "member" | "studio" | "guest" | "system";
export type EmailCounts = Record<EmailWho, number> & { total: number; failed: number; blocked: number };
export type EmailBar = EmailCounts & { key: string; label: string };
export type EmailKindRow = { kind: string; who: EmailWho; sent: number; failed: number; blocked: number };
export type EmailMonth = { limit: number | null; limitFrom: "studio" | "plan" | "none"; used: number; left: number | null; since: string };

export const WHO: { id: EmailWho; label: string; short: string; color: string }[] = [
  { id: "client", label: "To clients", short: "Clients", color: "#7D5CEF" },
  { id: "member", label: "To team members", short: "Team", color: "#1E9E8F" },
  { id: "studio", label: "To the studio", short: "Studio", color: "#E0A030" },
  { id: "guest", label: "To event guests", short: "Guests", color: "#D9488A" },
  { id: "system", label: "StuPanel account emails", short: "Account", color: "#8A8599" },
];
export const whoOf = (id: string) => WHO.find(w => w.id === id) ?? WHO[0];

const KINDS: Record<string, string> = {
  quote: "Quotation",
  invoice: "Invoice",
  invoice_reminder: "Invoice reminder",
  payment_receipt: "Payment receipt",
  payment_reminder: "Payment reminder",
  booking_confirmed: "Booking confirmed",
  agreement: "Agreement to sign",
  agreement_reminder: "Agreement reminder",
  delivery_ready: "Photos & videos ready",
  event_reminder: "Program reminder",
  team_event_reminder: "Team program reminder",
  photo_selection: "Photo selection",
  album_design: "Album to design",
  music_selection: "Music selection",
  guest_photos: "Face Search photos",
  client_update: "Update to client",
  team_update: "Update to team",
  studio_update: "Notice to the studio",
  team_invite: "Team invite",
  verification: "Verify email",
  password_reset: "Password reset",
  studio_data: "Studio data",
  face_credits: "Face Search credits",
  plan_payment: "Plan payment",
  system: "StuPanel notice",
  other: "Other",
};
export const kindLabel = (k: string) => KINDS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/[_-]+/g, " ");

export const n = (v: number) => v.toLocaleString("en-US");

/** "1,240 of 2,000" and how full it is. */
export function limitText(m: EmailMonth) {
  if (m.limit === null) return { text: `${n(m.used)} this month`, pct: 0, over: false, near: false };
  const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
  return { text: `${n(m.used)} of ${n(m.limit)}`, pct, over: m.used >= m.limit, near: pct >= 80 };
}
