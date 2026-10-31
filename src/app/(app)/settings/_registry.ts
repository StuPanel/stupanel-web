/**
 * Every Settings pane and every setting in it, in one list.
 * The sidebar, the mobile list and search all read from here, so a new
 * setting only needs a line here plus a <Row id="…"> in its pane.
 * `keywords` can hold other words people may type (including Bangla).
 */
import {
  Building2, Palette, Globe, CreditCard, FileText, Receipt, Percent, BookOpen,
  CalendarDays, Monitor, Bell, Shield, HardDrive, Sparkles, Layers, UserCog, PackageCheck,
} from "lucide-react";

export type PaneId =
  | "general" | "branding" | "online"
  | "payment" | "quotes" | "invoices" | "tax" | "catalog"
  | "features" | "worktypes" | "team" | "delivery"
  | "bookings" | "portal" | "notifications"
  | "security" | "integrations";

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
      { id: "general", title: "General", sub: "Studio name, contact, currency and time zone", icon: Building2, color: C.blue, keywords: "studio profile স্টুডিও" },
      { id: "branding", title: "Branding", sub: "Your logo on quotes, invoices, emails and client pages", icon: Palette, color: C.violet, keywords: "logo লোগো" },
      { id: "online", title: "Social & Links", sub: "Website and social profiles shown to clients", icon: Globe, color: C.teal, keywords: "facebook website" },
    ],
  },
  {
    title: "Money",
    panes: [
      { id: "payment", title: "Payment Methods", sub: "How clients pay you — shown on quotes and invoices", icon: CreditCard, color: C.green, keywords: "bank bkash nagad" },
      { id: "quotes", title: "Quotations", sub: "Filled in for every new quotation", icon: FileText, color: C.deep, keywords: "quote কোটেশন" },
      { id: "invoices", title: "Invoices", sub: "Numbering, due date and how invoices look", icon: Receipt, color: C.orchid, keywords: "invoice ইনভয়েস বিল" },
      { id: "tax", title: "Tax", sub: "Tax added to quotes and invoices", icon: Percent, color: C.red, keywords: "vat ভ্যাট" },
      { id: "catalog", title: "Service Catalog", sub: "Ready-made services for quick invoice lines", icon: BookOpen, color: C.teal, keywords: "services price" },
    ],
  },
  {
    title: "Work",
    panes: [
      { id: "features", title: "Features", sub: "Turn studio features on or off", icon: Sparkles, color: C.violet, keywords: "photo selection music album face ফিচার" },
      { id: "worktypes", title: "Work Types & Shifts", sub: "Kinds of work you do and the shifts of an event", icon: Layers, color: C.orchid, keywords: "wedding corporate shift holud biye শিফট" },
      { id: "bookings", title: "Programs", sub: "Defaults and rules for programs", icon: CalendarDays, color: C.deep, keywords: "booking event প্রোগ্রাম বুকিং" },
      { id: "team", title: "Team & Pay", sub: "How your team is paid", icon: UserCog, color: C.blue, keywords: "salary freelancer payment rate price studio prices টিম বেতন দাম" },
      { id: "delivery", title: "Delivery", sub: "When clients can get their photos and videos", icon: PackageCheck, color: C.teal, keywords: "lock due drive ডেলিভারি" },
      { id: "portal", title: "Client Portal", sub: "What clients see in their portal", icon: Monitor, color: C.blue, keywords: "client portal পোর্টাল" },
      { id: "notifications", title: "Notifications", sub: "Which emails go to you and to clients", icon: Bell, color: C.red, keywords: "email alert নোটিফিকেশন payment reminder রিমাইন্ডার" },
    ],
  },
  {
    title: "Account",
    panes: [
      { id: "security", title: "Security", sub: "Sign-in safety for your team", icon: Shield, color: C.ink, keywords: "password পাসওয়ার্ড" },
      { id: "integrations", title: "Google Drive", sub: "Connect Drive to deliver photos and videos", icon: HardDrive, color: C.green, keywords: "integrations drive google ড্রাইভ" },
    ],
  },
];

export const PANES: Pane[] = GROUPS.flatMap(g => g.panes);
export const paneById = (id: string) => PANES.find(p => p.id === id);

export const ENTRIES: Entry[] = [
  // General
  { id: "name", pane: "general", section: "Studio", label: "Studio name", keywords: "company business নাম" },
  { id: "phone", pane: "general", section: "Studio", label: "Phone", keywords: "mobile contact number ফোন নম্বর" },
  { id: "website", pane: "general", section: "Studio", label: "Website", keywords: "url site ওয়েবসাইট" },
  { id: "address", pane: "general", section: "Location", label: "Address", keywords: "location ঠিকানা" },
  { id: "city", pane: "general", section: "Location", label: "City", keywords: "শহর" },
  { id: "state", pane: "general", section: "Location", label: "State / Division", keywords: "region division বিভাগ" },
  { id: "country", pane: "general", section: "Location", label: "Country", keywords: "দেশ" },
  { id: "currency", pane: "general", section: "Region", label: "Currency", keywords: "taka bdt usd money টাকা" },
  { id: "timezone", pane: "general", section: "Region", label: "Time zone", keywords: "time clock সময়" },
  { id: "language", pane: "general", section: "Language", label: "App language", keywords: "bangla bengali english বাংলা ভাষা" },

  // Features
  { id: "f-photoSelection", pane: "features", section: "Client features", label: "Photo selection", keywords: "pick favourite album select ছবি বাছাই" },
  { id: "f-musicSelection", pane: "features", section: "Client features", label: "Music selection", keywords: "song youtube গান" },
  { id: "f-albumTracking", pane: "features", section: "Studio features", label: "Album tracking", keywords: "print album অ্যালবাম" },
  { id: "f-faceRecognition", pane: "features", section: "Coming soon", label: "Face recognition", keywords: "selfie guest face" },

  // Work types & shifts
  { id: "workTypes", pane: "worktypes", section: "Work types", label: "Work types", keywords: "wedding corporate school product video ধরন" },
  { id: "shiftTemplates", pane: "worktypes", section: "Shift templates", label: "Shift templates", keywords: "holud biye reception walima ashirbad bou bhat হলুদ বিয়ে" },

  // Team
  { id: "teamPay", pane: "team", section: "Pay", label: "Pay team by", keywords: "per shift per program rate salary" },
  { id: "studio-rates", pane: "team", section: "Studio prices", label: "Studio prices for each kind of work", keywords: "rate price photographer cinematographer drone editor setup gear দাম রেট" },

  // Delivery
  { id: "d-lockWhenDue", pane: "delivery", section: "Payment", label: "Lock delivery while money is due", keywords: "due lock unpaid বকেয়া" },
  { id: "d-managerCanUnlock", pane: "delivery", section: "Payment", label: "Managers can unlock", keywords: "manager unlock" },

  // Branding
  { id: "logo", pane: "branding", section: "Logo", label: "Studio logo", keywords: "image upload picture লোগো" },
  { id: "logo-preview", pane: "branding", section: "Preview", label: "Where your logo appears", keywords: "preview" },

  // Online
  { id: "facebookUrl", pane: "online", section: "Social profiles", label: "Facebook", keywords: "fb ফেসবুক" },
  { id: "instagramUrl", pane: "online", section: "Social profiles", label: "Instagram", keywords: "insta" },
  { id: "youtubeUrl", pane: "online", section: "Social profiles", label: "YouTube", keywords: "video ইউটিউব" },
  { id: "tiktokUrl", pane: "online", section: "Social profiles", label: "TikTok" },
  { id: "otherLinks", pane: "online", section: "Other links", label: "Other links", keywords: "portfolio link" },

  // Payment
  { id: "bankName", pane: "payment", section: "Bank transfer", label: "Bank name", keywords: "ব্যাংক" },
  { id: "bankBranch", pane: "payment", section: "Bank transfer", label: "Branch", keywords: "শাখা" },
  { id: "bankAccountName", pane: "payment", section: "Bank transfer", label: "Account holder name" },
  { id: "bankAccountNumber", pane: "payment", section: "Bank transfer", label: "Account number", keywords: "a/c একাউন্ট" },
  { id: "bankRoutingNumber", pane: "payment", section: "Bank transfer", label: "Routing number" },
  { id: "bkashNumber", pane: "payment", section: "Mobile banking", label: "bKash", keywords: "bikash বিকাশ mobile banking" },
  { id: "nagadNumber", pane: "payment", section: "Mobile banking", label: "Nagad", keywords: "নগদ mobile banking" },
  { id: "rocketNumber", pane: "payment", section: "Mobile banking", label: "Rocket", keywords: "রকেট mobile banking" },

  // Quotes
  { id: "defaultValidityDays", pane: "quotes", section: "Defaults", label: "Quote valid for", keywords: "validity expire days মেয়াদ" },
  { id: "defaultAdvancePercent", pane: "quotes", section: "Defaults", label: "Advance payment", keywords: "advance percent অগ্রিম" },
  { id: "defaultTerms", pane: "quotes", section: "Terms", label: "Terms & conditions", keywords: "terms policy শর্ত" },

  // Invoices
  { id: "invoicePrefix", pane: "invoices", section: "Numbering", label: "Invoice prefix", keywords: "number INV" },
  { id: "invoiceStartNumber", pane: "invoices", section: "Numbering", label: "Starting number", keywords: "number serial" },
  { id: "invoiceDueDays", pane: "invoices", section: "Payment", label: "Payment due in", keywords: "due days deadline" },
  { id: "invoiceShowPayment", pane: "invoices", section: "Payment", label: "Show payment details", keywords: "bank bkash on invoice" },
  { id: "invoiceHeaderStyle", pane: "invoices", section: "Look", label: "Header style", keywords: "design color dark light" },
  { id: "invoiceShowLogo", pane: "invoices", section: "Look", label: "Show logo", keywords: "logo" },
  { id: "invoiceShowSignature", pane: "invoices", section: "Look", label: "Thank-you note", keywords: "signature" },
  { id: "invoiceSignatureText", pane: "invoices", section: "Look", label: "Thank-you text", keywords: "signature" },
  { id: "invoiceFooter", pane: "invoices", section: "Look", label: "Footer text", keywords: "footer bottom" },

  // Tax
  { id: "taxLabel", pane: "tax", section: "Tax", label: "Tax name", keywords: "vat gst label ভ্যাট" },
  { id: "defaultTaxPercent", pane: "tax", section: "Tax", label: "Tax rate", keywords: "percent vat ভ্যাট" },

  // Catalog
  { id: "catalog-list", pane: "catalog", section: "Services", label: "Services list", keywords: "add service price package সার্ভিস" },

  // Bookings / programs
  { id: "defaultBookingStatus", pane: "bookings", section: "New programs", label: "Starting status", keywords: "inquiry confirmed status স্ট্যাটাস" },
  { id: "bookingReminderDays", pane: "bookings", section: "New programs", label: "Reminder before event", keywords: "remind alert days রিমাইন্ডার" },
  { id: "defaultCancellationPolicy", pane: "bookings", section: "Cancellation", label: "Cancellation policy", keywords: "cancel refund বাতিল" },
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
  { id: "er-team", pane: "notifications", section: "Program reminders", label: "Remind the team", keywords: "event program reminder tomorrow team staff রিমাইন্ডার টিম" },
  { id: "er-client", pane: "notifications", section: "Program reminders", label: "Remind the client", keywords: "event program reminder tomorrow client রিমাইন্ডার" },
  { id: "er-days", pane: "notifications", section: "Program reminders", label: "How early (days before)", keywords: "event reminder days" },
  { id: "pr-enabled", pane: "notifications", section: "Payment reminders", label: "Remind clients about due payments", keywords: "payment reminder due baki বকেয়া রিমাইন্ডার টাকা" },
  { id: "pr-daysBefore", pane: "notifications", section: "Payment reminders", label: "Reminder before the program", keywords: "payment reminder days" },
  { id: "pr-afterEveryDays", pane: "notifications", section: "Payment reminders", label: "Reminder after the program, every", keywords: "payment reminder days" },
  { id: "pr-maxAfter", pane: "notifications", section: "Payment reminders", label: "Reminders after the program", keywords: "payment reminder times" },
  { id: "n-sendBookingConfirmation", pane: "notifications", section: "Emails to clients", label: "Program confirmation", keywords: "booking client email" },
  { id: "n-sendQuoteEmail", pane: "notifications", section: "Emails to clients", label: "Quotation sent", keywords: "client email" },
  { id: "n-sendInvoiceEmail", pane: "notifications", section: "Emails to clients", label: "Invoice sent", keywords: "client email" },
  { id: "n-sendPaymentReceipt", pane: "notifications", section: "Emails to clients", label: "Payment receipt", keywords: "client email money রসিদ" },
  { id: "n-sendDeliveryReady", pane: "notifications", section: "Emails to clients", label: "Delivery ready", keywords: "client email photos" },

  // Security
  { id: "resetEmail", pane: "security", section: "Sign-in", label: "Password reset email", keywords: "forgot password পাসওয়ার্ড" },
  { id: "sessionTimeoutMinutes", pane: "security", section: "Sign-in", label: "Sign out after inactivity", keywords: "session timeout sign off লগআউট" },
  { id: "twoFactor", pane: "security", section: "Coming soon", label: "Two-step sign-in (2FA)", keywords: "otp 2fa" },
  { id: "loginActivity", pane: "security", section: "Coming soon", label: "Sign-in activity", keywords: "login history device" },

  // Integrations
  { id: "drive-accounts", pane: "integrations", section: "Accounts", label: "Google Drive accounts", keywords: "connect gmail storage delivery" },
  { id: "drive-add", pane: "integrations", section: "Accounts", label: "Add Google Drive account", keywords: "connect" },
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
