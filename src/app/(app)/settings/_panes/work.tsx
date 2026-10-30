"use client";

import { ProgramRulesGroup } from "./studio-setup";
import { Group, NumberField, Row, Select, Switch, TextArea, useSettings } from "../_ui";

// ─── Programs (booking defaults) ─────────────────────────────────────────────
const STATUSES = [
  { value: "inquiry", label: "Inquiry" },
  { value: "quote_sent", label: "Quote sent" },
  { value: "confirmed", label: "Confirmed" },
  { value: "advance_received", label: "Advance received" },
];

export function BookingsPane() {
  const { data, patch } = useSettings();
  return (
    <>
      <Group title="New programs">
        <Row id="defaultBookingStatus" label="Starting status" hint="Used when you don't pick a status yourself">
          <Select label="Starting status" value={data.defaultBookingStatus ?? "inquiry"} options={STATUSES}
            onChange={v => patch({ defaultBookingStatus: v })} />
        </Row>
        <Row id="bookingReminderDays" label="Reminder before event" hint="Program reminder emails go this many days before each program day (turn them on in Notifications)">
          <NumberField label="Reminder before event" value={Number(data.bookingReminderDays ?? 3)} min={1} max={90} suffix="days"
            onCommit={v => patch({ bookingReminderDays: v })} />
        </Row>
      </Group>
      <ProgramRulesGroup />
      <Group title="Cancellation" note="Added to every new program. Clients can read it in their portal.">
        <Row id="defaultCancellationPolicy" label="Cancellation policy" stack>
          <TextArea label="Cancellation policy" rows={4} value={data.defaultCancellationPolicy ?? ""}
            placeholder={"e.g.\n1. Cancelling within 7 days of the event keeps the advance.\n2. One free date change with 14 days notice."}
            onCommit={v => patch({ defaultCancellationPolicy: v })} />
        </Row>
      </Group>
    </>
  );
}

// ─── Client portal ────────────────────────────────────────────────────────────
const PORTAL_TABS = [
  { key: "portalShowQuotes", label: "Quotes", hint: "Quotations you sent them" },
  { key: "portalShowInvoices", label: "Invoices", hint: "Their invoices, to view and download" },
  { key: "portalShowPayments", label: "Payments", hint: "Everything they have paid" },
  { key: "portalShowMessages", label: "Messages", hint: "Chat with your studio" },
];

export function PortalPane() {
  const { data, patch } = useSettings();
  return (
    <>
      <Group title="Welcome" note="Shown at the top of the portal. Leave empty for the standard greeting.">
        <Row id="portalWelcomeMessage" label="Welcome message" stack>
          <TextArea label="Welcome message" rows={3} maxLength={300} value={data.portalWelcomeMessage ?? ""}
            placeholder={`Welcome to ${data.name ?? "our studio"}! Here you'll find your programs, invoices and photos.`}
            onCommit={v => patch({ portalWelcomeMessage: v })} />
        </Row>
      </Group>
      <Group title="Tabs clients see" note="Changes apply to every client's portal right away.">
        <Row label="Programs" hint="Always shown"><Switch label="Programs" on onChange={() => {}} disabled /></Row>
        {PORTAL_TABS.map(t => (
          <Row key={t.key} id={t.key} label={t.label} hint={t.hint}>
            <Switch label={t.label} on={data[t.key] ?? true} onChange={v => patch({ [t.key]: v })} />
          </Row>
        ))}
      </Group>
    </>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────
type Prefs = { studio: Record<string, boolean>; client: Record<string, boolean> };
const DEF: Prefs = {
  studio: { onNewBooking: true, onBookingConfirmed: true, onBookingCancelled: true, onPaymentReceived: true, onInvoicePaid: true, onNewClient: false, onDeliveryUploaded: false },
  client: { sendBookingConfirmation: true, sendInvoiceEmail: true, sendPaymentReceipt: true, sendDeliveryReady: true, sendQuoteEmail: true },
};
const STUDIO_ROWS = [
  { key: "onNewBooking", label: "New program created" },
  { key: "onBookingConfirmed", label: "Program confirmed" },
  { key: "onBookingCancelled", label: "Program cancelled" },
  { key: "onPaymentReceived", label: "Payment received" },
  { key: "onInvoicePaid", label: "Invoice fully paid" },
  { key: "onNewClient", label: "New client added" },
  { key: "onDeliveryUploaded", label: "Delivery files uploaded" },
];
const CLIENT_ROWS = [
  { key: "sendBookingConfirmation", label: "Program confirmation", hint: "When their program is confirmed" },
  { key: "sendQuoteEmail", label: "Quotation sent", hint: "When you share a quote" },
  { key: "sendInvoiceEmail", label: "Invoice sent", hint: "When you issue an invoice" },
  { key: "sendPaymentReceipt", label: "Payment receipt", hint: "After each payment" },
  { key: "sendDeliveryReady", label: "Delivery ready", hint: "When photos and videos are ready" },
];

export function NotificationsPane() {
  const { data, patch } = useSettings();
  const raw = data.notificationPrefs ?? {};
  const prefs: Prefs = { studio: { ...DEF.studio, ...(raw.studio ?? {}) }, client: { ...DEF.client, ...(raw.client ?? {}) } };
  const toggle = (who: "studio" | "client", key: string, v: boolean) =>
    patch({ notificationPrefs: { ...prefs, [who]: { ...prefs[who], [key]: v } } });

  return (
    <>
      <Group title="Emails to you" note={`Sent to ${data.email ?? "your studio email"}.`}>
        {STUDIO_ROWS.map(r => (
          <Row key={r.key} id={`n-${r.key}`} label={r.label}>
            <Switch label={r.label} on={prefs.studio[r.key]} onChange={v => toggle("studio", r.key, v)} />
          </Row>
        ))}
      </Group>
      <EventRemindersGroup />
      <PaymentRemindersGroup />
      <Group title="Emails to clients" note="Sent automatically to the client's email address, if they have one.">
        {CLIENT_ROWS.map(r => (
          <Row key={r.key} id={`n-${r.key}`} label={r.label} hint={r.hint}>
            <Switch label={r.label} on={prefs.client[r.key]} onChange={v => toggle("client", r.key, v)} />
          </Row>
        ))}
      </Group>
    </>
  );
}

// ─── Payment reminders (companies.settings → paymentReminders) ────────────────
function PaymentRemindersGroup() {
  const { studio, patchStudio } = useSettings();
  if (!studio?.paymentReminders) return null;
  const r = studio.paymentReminders;
  const set = (p: Partial<typeof r>) => patchStudio("paymentReminders", { ...r, ...p });
  const plan = !r.enabled
    ? "Off — no reminder emails go to clients. You can still send a WhatsApp reminder from the Notifications page."
    : `If money is still due, the client gets an email ${r.daysBefore} day${r.daysBefore > 1 ? "s" : ""} before the program`
      + (r.maxAfter > 0 ? `, then every ${r.afterEveryDays} day${r.afterEveryDays > 1 ? "s" : ""} after it (up to ${r.maxAfter} time${r.maxAfter > 1 ? "s" : ""}).` : ".")
      + " Sent at 10 AM, only to clients who have an email address.";
  return (
    <Group title="Payment reminders" note={plan}>
      <Row id="pr-enabled" label="Remind clients about due payments" hint="Automatic email when a program still has money due">
        <Switch label="Remind clients about due payments" on={r.enabled} onChange={v => set({ enabled: v })} />
      </Row>
      <Row id="pr-daysBefore" label="Before the program" disabled={!r.enabled}>
        <fieldset disabled={!r.enabled} className="contents"><NumberField label="Days before the program" value={r.daysBefore} min={1} max={30} suffix="days" onCommit={v => set({ daysBefore: v })} /></fieldset>
      </Row>
      <Row id="pr-afterEveryDays" label="After the program, every" disabled={!r.enabled || r.maxAfter === 0}>
        <fieldset disabled={!r.enabled || r.maxAfter === 0} className="contents"><NumberField label="Days between reminders after the program" value={r.afterEveryDays} min={1} max={30} suffix="days" onCommit={v => set({ afterEveryDays: v })} /></fieldset>
      </Row>
      <Row id="pr-maxAfter" label="Reminders after the program" hint="0 = none" disabled={!r.enabled}>
        <fieldset disabled={!r.enabled} className="contents"><NumberField label="Reminders after the program" value={r.maxAfter} min={0} max={5} suffix="times" onCommit={v => set({ maxAfter: v })} /></fieldset>
      </Row>
    </Group>
  );
}

// ─── Program reminders (companies.settings → eventReminders; days = bookingReminderDays) ──
function EventRemindersGroup() {
  const { data, patch, studio, patchStudio } = useSettings();
  if (!studio?.eventReminders) return null;
  const e = studio.eventReminders;
  const days = Number(data.bookingReminderDays ?? 3);
  const when = days === 1 ? "the day before" : `${days} days before`;
  const on = e.team || e.client;
  const note = !on
    ? "Off — no program reminder emails are sent."
    : `Sent at 10 AM, ${when} each program day, to ${[e.team && "the team members working that day", e.client && "the client"].filter(Boolean).join(" and ")}. Only people with a real email address get it.`;
  return (
    <Group title="Program reminders" note={note}>
      <Row id="er-team" label="Remind the team" hint="Each member gets their date, place, work and the client's phone">
        <Switch label="Remind the team" on={e.team} onChange={v => patchStudio("eventReminders", { ...e, team: v })} />
      </Row>
      <Row id="er-client" label="Remind the client" hint="The client gets the date and place of their program">
        <Switch label="Remind the client" on={e.client} onChange={v => patchStudio("eventReminders", { ...e, client: v })} />
      </Row>
      <Row id="er-days" label="How early" disabled={!on}>
        <fieldset disabled={!on} className="contents"><NumberField label="Days before the program" value={days} min={1} max={90} suffix={days === 1 ? "day" : "days"}
          onCommit={v => patch({ bookingReminderDays: v })} /></fieldset>
      </Row>
    </Group>
  );
}
