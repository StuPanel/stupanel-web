/**
 * Every Settings pane and every setting in it, in one list.
 * The sidebar, the mobile list and search all read from here, so a new
 * setting only needs a line here plus a <Row id="…"> in its pane.
 * `keywords` can hold other words people may type (including Bangla).
 */
import {
  Building2, Palette, Globe, CreditCard, FileText, Receipt, Percent, BookOpen,
  CalendarDays, Hash, Monitor, Bell, Shield, HardDrive, Sparkles, Layers, UserCog, PackageCheck, CircleUserRound, MessageSquareText, SwatchBook,
} from "lucide-react";

export type PaneId =
  | "general" | "branding" | "online"
  | "payment" | "quotes" | "invoices" | "numbering" | "tax" | "catalog"
  | "features" | "worktypes" | "team" | "delivery"
  | "bookings" | "portal" | "notifications" | "whatsapp"
  | "profile" | "appearance" | "security" | "integrations";

export type Pane = { id: PaneId; title: string; sub: string; icon: React.ElementType; color: string; keywords?: string };
export type Entry = { id: string; pane: PaneId; section: string; label: string; keywords?: string };

// Tile colours come from the design-system tokens only.
const C = {
  violet: "#7D5CEF", deep: "#5B3FD0", ink: "#16141D", teal: "#126B66",
  blue: "#1F5C99", orchid: "#9E3A8C", green: "#1F8A5B", red: "#C2304F", lavender: "#B29DF8",
};

export const GROUPS: { title: string; panes: Pane[] }[] = [
  {
    title: "Studio",
    panes: [
      { id: "general", title: "General", sub: "Studio name, contact, currency and time zone", icon: Building2, color: C.blue, keywords: "studio profile" },
      { id: "branding", title: "Branding", sub: "Your logo on quotes, invoices, emails and client pages", icon: Palette, color: C.violet, keywords: "logo" },
      { id: "online", title: "Social & Links", sub: "Website and social profiles shown to clients", icon: Globe, color: C.teal, keywords: "facebook website" },
    ],
  },
  {
    title: "Money",
    panes: [
      { id: "payment", title: "Payment Methods", sub: "How clients pay you — shown on quotes and invoices", icon: CreditCard, color: C.green, keywords: "bank bkash nagad" },
      { id: "quotes", title: "Quotations", sub: "Filled in for every new quotation", icon: FileText, color: C.deep, keywords: "quote" },
      { id: "invoices", title: "Invoices", sub: "Invoice designer and due date", icon: Receipt, color: C.orchid, keywords: "invoice" },
      { id: "numbering", title: "Numbering", sub: "Codes and numbers for programs, invoices, quotes, receipts and agreements", icon: Hash, color: C.ink, keywords: "number prefix code serial id PRG INV QT RCT AGR" },
      { id: "tax", title: "Tax", sub: "Tax added to programs, quotes and invoices", icon: Percent, color: C.red, keywords: "vat" },
      { id: "catalog", title: "Service Catalog", sub: "Ready-made services for quick invoice lines", icon: BookOpen, color: C.teal, keywords: "services price" },
    ],
  },
  {
    title: "Work",
    panes: [
      { id: "features", title: "Features", sub: "Turn studio features on or off", icon: Sparkles, color: C.violet, keywords: "photo selection music album face" },
      { id: "worktypes", title: "Program Types", sub: "Kinds of programs and the parts (days) each one has", icon: Layers, color: C.orchid, keywords: "wedding corporate shift holud biye" },
      { id: "bookings", title: "Programs", sub: "Shifts, rules and cancellation policy for programs", icon: CalendarDays, color: C.deep, keywords: "booking event shift time" },
      { id: "team", title: "Team & Pay", sub: "How your team is paid", icon: UserCog, color: C.blue, keywords: "salary freelancer payment rate price studio prices" },
      { id: "delivery", title: "Delivery", sub: "When clients can get their photos and videos", icon: PackageCheck, color: C.teal, keywords: "lock due drive" },
      { id: "portal", title: "Client Portal", sub: "What clients see in their portal", icon: Monitor, color: C.blue, keywords: "client portal" },
      { id: "notifications", title: "Notifications", sub: "Which emails go to you and to clients", icon: Bell, color: C.red, keywords: "email alert payment reminder" },
      { id: "whatsapp", title: "WhatsApp Templates", sub: "Ready messages you send to clients from a program", icon: MessageSquareText, color: C.green, keywords: "whatsapp message template sms" },
    ],
  },
  {
    title: "Account",
    panes: [
      { id: "profile", title: "My Profile", sub: "Your name, phone, sign-in and password", icon: CircleUserRound, color: C.deep, keywords: "account me name password phone" },
      { id: "appearance", title: "Appearance", sub: "Backdrop and glass look — the same for your whole studio", icon: SwatchBook, color: C.violet, keywords: "theme backdrop background colour color glass look team member panel" },
      { id: "security", title: "Security", sub: "Sign-in safety for your team", icon: Shield, color: C.ink, keywords: "password" },
      { id: "integrations", title: "Google Drive", sub: "Connect Drive for deliveries and raw files", icon: HardDrive, color: C.green, keywords: "integrations drive google raw" },
    ],
  },
];

export const PANES: Pane[] = GROUPS.flatMap(g => g.panes);
export const paneById = (id: string) => PANES.find(p => p.id === id);

export const ENTRIES: Entry[] = [
  // General
  { id: "name", pane: "general", section: "Studio", label: "Studio name", keywords: "company business" },
  { id: "phone", pane: "general", section: "Studio", label: "Phone", keywords: "mobile contact number" },
  { id: "website", pane: "general", section: "Studio", label: "Website", keywords: "url site" },
  { id: "address", pane: "general", section: "Location", label: "Address", keywords: "location" },
  { id: "city", pane: "general", section: "Location", label: "City", keywords: "town" },
  { id: "state", pane: "general", section: "Location", label: "State / Division", keywords: "region division" },
  { id: "country", pane: "general", section: "Location", label: "Country", keywords: "nation" },
  { id: "currency", pane: "general", section: "Region", label: "Currency", keywords: "taka bdt usd money" },
  { id: "timezone", pane: "general", section: "Region", label: "Time zone", keywords: "time clock" },
  { id: "language", pane: "general", section: "Language", label: "App language", keywords: "bangla bengali english" },

  // Features
  { id: "f-photoSelection", pane: "features", section: "Client features", label: "Photo selection", keywords: "pick favourite album select" },
  { id: "f-musicSelection", pane: "features", section: "Client features", label: "Music selection", keywords: "song youtube" },
  { id: "f-albumTracking", pane: "features", section: "Studio features", label: "Album tracking", keywords: "print album" },
  { id: "f-faceRecognition", pane: "features", section: "Coming soon", label: "Face recognition", keywords: "selfie guest face" },


  // Work types & shifts
  { id: "workTypes", pane: "worktypes", section: "Program types", label: "Program types and their parts", keywords: "work type wedding corporate school birthday parts days holud biye reception shift template" },

  // Team
  { id: "teamPay", pane: "team", section: "Pay", label: "Pay team by", keywords: "per shift per program rate salary" },
  { id: "studio-rates", pane: "team", section: "Studio prices", label: "Studio prices for each kind of work", keywords: "rate price photographer cinematographer drone editor setup gear" },

  // Delivery
  { id: "d-lockWhenDue", pane: "delivery", section: "Payment", label: "Lock delivery while money is due", keywords: "due lock unpaid" },
  { id: "d-managerCanUnlock", pane: "delivery", section: "Payment", label: "Managers can unlock", keywords: "manager unlock" },

  // Branding
  { id: "logo", pane: "branding", section: "Logo", label: "Studio logo", keywords: "image upload picture" },
  { id: "logo-preview", pane: "branding", section: "Preview", label: "Where your logo appears", keywords: "preview" },

  // Online
  { id: "facebookUrl", pane: "online", section: "Social profiles", label: "Facebook", keywords: "fb" },
  { id: "instagramUrl", pane: "online", section: "Social profiles", label: "Instagram", keywords: "insta" },
  { id: "youtubeUrl", pane: "online", section: "Social profiles", label: "YouTube", keywords: "video" },
  { id: "tiktokUrl", pane: "online", section: "Social profiles", label: "TikTok" },
  { id: "otherLinks", pane: "online", section: "Other links", label: "Other links", keywords: "portfolio link" },

  // Payment
  { id: "bankName", pane: "payment", section: "Bank transfer", label: "Bank name", keywords: "bank" },
  { id: "bankBranch", pane: "payment", section: "Bank transfer", label: "Branch", keywords: "bank branch" },
  { id: "bankAccountName", pane: "payment", section: "Bank transfer", label: "Account holder name" },
  { id: "bankAccountNumber", pane: "payment", section: "Bank transfer", label: "Account number", keywords: "a/c" },
  { id: "bankRoutingNumber", pane: "payment", section: "Bank transfer", label: "Routing number" },
  { id: "bkashNumber", pane: "payment", section: "Mobile banking", label: "bKash", keywords: "bikash mobile banking" },
  { id: "nagadNumber", pane: "payment", section: "Mobile banking", label: "Nagad", keywords: "mobile banking" },
  { id: "rocketNumber", pane: "payment", section: "Mobile banking", label: "Rocket", keywords: "mobile banking" },

  // Quotes
  { id: "defaultValidityDays", pane: "quotes", section: "Defaults", label: "Quote valid for", keywords: "validity expire days" },
  { id: "defaultAdvancePercent", pane: "quotes", section: "Defaults", label: "Advance payment", keywords: "advance percent" },
  { id: "defaultTerms", pane: "quotes", section: "Terms", label: "Terms & conditions", keywords: "terms policy" },

  // Invoices
  { id: "invoiceDesign", pane: "invoices", section: "Design", label: "Invoice designer", keywords: "template design colour color font logo signature paper size a4 a5 pos vat look" },
  { id: "invoiceDueDays", pane: "invoices", section: "Payment", label: "Payment due", keywords: "due days deadline last event" },
  { id: "num-program", pane: "numbering", section: "Programs and invoices", label: "Program code", keywords: "number PRG id" },
  { id: "invoicePrefix", pane: "numbering", section: "Programs and invoices", label: "Invoice code", keywords: "number INV prefix" },
  { id: "num-program-start", pane: "numbering", section: "Programs and invoices", label: "Program and invoice starting number", keywords: "number serial start" },
  { id: "num-quote", pane: "numbering", section: "Quotations", label: "Quote code", keywords: "number QT" },
  { id: "num-receipt", pane: "numbering", section: "Money receipts", label: "Receipt code", keywords: "number RCT MR" },
  { id: "num-agreement", pane: "numbering", section: "Agreements", label: "Agreement code", keywords: "number AGR contract" },

  // Tax
  { id: "taxOn", pane: "tax", section: "Tax", label: "Add tax", keywords: "vat gst on off" },
  { id: "taxLabel", pane: "tax", section: "Tax", label: "Tax name", keywords: "vat gst label" },
  { id: "defaultTaxPercent", pane: "tax", section: "Tax", label: "Tax rate", keywords: "percent vat" },

  // Catalog
  { id: "catalog-list", pane: "catalog", section: "Services", label: "Services list", keywords: "add service price package" },

  // Bookings / programs
  { id: "defaultCancellationPolicy", pane: "bookings", section: "Cancellation", label: "Cancellation policy", keywords: "cancel refund" },
  { id: "shifts", pane: "bookings", section: "Shifts", label: "Shifts and their time", keywords: "shift time day evening night full day morning start end" },
  { id: "b-warnDoubleBooking", pane: "bookings", section: "Rules", label: "Warn about double booking", keywords: "same day clash conflict" },
  { id: "b-askBeforeConfirm", pane: "bookings", section: "Rules", label: "Ask before confirming", keywords: "confirm check" },

  // Portal
  { id: "portalWelcomeMessage", pane: "portal", section: "Welcome", label: "Welcome message", keywords: "greeting" },
  { id: "portalShowQuotes", pane: "portal", section: "Tabs clients see", label: "Quotes tab" },
  { id: "portalShowInvoices", pane: "portal", section: "Tabs clients see", label: "Invoices tab" },
  { id: "portalShowPayments", pane: "portal", section: "Tabs clients see", label: "Payments tab" },
  { id: "portalShowMessages", pane: "portal", section: "Tabs clients see", label: "Messages tab", keywords: "chat" },

  // Notifications
  { id: "n-onNewBooking", pane: "notifications", section: "Emails to you", label: "New program created", keywords: "booking" },
  { id: "n-onBookingConfirmed", pane: "notifications", section: "Emails to you", label: "Program confirmed", keywords: "booking" },
  { id: "n-onBookingCancelled", pane: "notifications", section: "Emails to you", label: "Program cancelled", keywords: "booking" },
  { id: "n-onPaymentReceived", pane: "notifications", section: "Emails to you", label: "Payment received", keywords: "money" },
  { id: "n-onInvoicePaid", pane: "notifications", section: "Emails to you", label: "Invoice fully paid" },
  { id: "n-onNewClient", pane: "notifications", section: "Emails to you", label: "New client added" },
  { id: "n-onDeliveryUploaded", pane: "notifications", section: "Emails to you", label: "Delivery files uploaded" },
  { id: "er-team", pane: "notifications", section: "Program reminders", label: "Remind the team", keywords: "event program reminder tomorrow team staff" },
  { id: "er-client", pane: "notifications", section: "Program reminders", label: "Remind the client", keywords: "event program reminder tomorrow client" },
  { id: "er-days", pane: "notifications", section: "Program reminders", label: "How early (days before)", keywords: "event reminder days remind alert before" },
  { id: "pr-enabled", pane: "notifications", section: "Payment reminders", label: "Remind clients about due payments", keywords: "payment reminder due baki" },
  { id: "pr-daysBefore", pane: "notifications", section: "Payment reminders", label: "Reminder before the program", keywords: "payment reminder days" },
  { id: "pr-afterEveryDays", pane: "notifications", section: "Payment reminders", label: "Reminder after the program, every", keywords: "payment reminder days" },
  { id: "pr-maxAfter", pane: "notifications", section: "Payment reminders", label: "Reminders after the program", keywords: "payment reminder times" },
  { id: "n-sendBookingConfirmation", pane: "notifications", section: "Emails to clients", label: "Program confirmation", keywords: "booking client email" },
  { id: "n-sendQuoteEmail", pane: "notifications", section: "Emails to clients", label: "Quotation sent", keywords: "client email" },
  { id: "n-sendInvoiceEmail", pane: "notifications", section: "Emails to clients", label: "Invoice sent", keywords: "client email" },
  { id: "n-sendPaymentReceipt", pane: "notifications", section: "Emails to clients", label: "Payment receipt", keywords: "client email money" },
  { id: "n-sendDeliveryReady", pane: "notifications", section: "Emails to clients", label: "Delivery ready", keywords: "client email photos" },
  { id: "n-onAssigned", pane: "notifications", section: "Emails to your team", label: "Added to a program", keywords: "team member email assign schedule" },
  { id: "n-onEditorAssigned", pane: "notifications", section: "Emails to your team", label: "New editing work", keywords: "team editor email assign deadline" },

  // My profile
  { id: "profile-info", pane: "profile", section: "Personal info", label: "Name and phone", keywords: "first last name mobile" },
  { id: "profile-password", pane: "profile", section: "Password", label: "Change password", keywords: "password" },

  // Security
  { id: "resetEmail", pane: "security", section: "Sign-in", label: "Password reset email", keywords: "forgot password" },
  { id: "sessionTimeoutMinutes", pane: "security", section: "Sign-in", label: "Sign out after inactivity", keywords: "session timeout sign off" },
  { id: "twoFactor", pane: "security", section: "Coming soon", label: "Two-step sign-in (2FA)", keywords: "otp 2fa" },
  { id: "loginActivity", pane: "security", section: "Coming soon", label: "Sign-in activity", keywords: "login history device" },

  // Integrations
  { id: "drive-accounts", pane: "integrations", section: "Accounts", label: "Google Drive accounts", keywords: "connect gmail storage delivery" },
  { id: "drive-add", pane: "integrations", section: "Accounts", label: "Add Google Drive account", keywords: "connect" },
  { id: "raw-drive", pane: "integrations", section: "Raw files", label: "Raw files account", keywords: "raw camera backup" },
];

/** Case-insensitive; every word typed must appear somewhere in the entry. Best matches first. */
export function searchSettings(q: string) {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { entry: Entry; pane: Pane; score: number }[] = [];
  const all: { entry: Entry; pane: Pane }[] = [
    // Each pane is also a result (e.g. "invoice" → the Invoices pane).
    ...PANES.map(p => ({ entry: { id: "", pane: p.id, section: "", label: p.title, keywords: `${p.sub} ${p.keywords ?? ""}` }, pane: p })),
    ...ENTRIES.map(e => ({ entry: e, pane: paneById(e.pane)! })),
  ];
  for (const { entry, pane } of all) {
    const label = entry.label.toLowerCase();
    const hay = `${label} ${entry.section} ${pane.title} ${entry.keywords ?? ""}`.toLowerCase();
    if (!words.every(w => hay.includes(w))) continue;
    let score = 0;
    for (const w of words) {
      if (label.startsWith(w)) score += 4;
      else if (label.includes(w)) score += 2;
      else score += 1;
    }
    if (!entry.id) score += 1; // pane itself slightly ahead of ties
    scored.push({ entry, pane, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 12);
}
