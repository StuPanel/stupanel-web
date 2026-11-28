/**
 * What a manager can open. The owner ticks each feature for each manager on the Team page;
 * the API enforces the same areas (stupanel-api src/modules/auth/permissions.ts).
 */
export const FEATURE_GROUPS = ["Programs", "Clients", "Money", "Team", "Studio"] as const;

/** Every feature the owner can tick for a manager, one by one (Faisal 25-NOV-2026). Same keys as the API. */
export const AREAS = [
  { key: "programs", group: "Programs", label: "Programs", hint: "Add and edit programs, checklist, raw files, editing" },
  { key: "calendar", group: "Programs", label: "Calendar", hint: "See programs on the calendar" },
  { key: "delivery", group: "Programs", label: "Delivery", hint: "Deliver files to clients" },
  { key: "music", group: "Programs", label: "Music", hint: "Songs for the videos" },
  { key: "photo-selection", group: "Programs", label: "Photo selection", hint: "Client picks photos for the album" },
  { key: "face-search", group: "Programs", label: "Face search", hint: "Guests find their photos" },
  { key: "contracts", group: "Programs", label: "Contracts", hint: "Make and send contracts" },
  { key: "clients", group: "Clients", label: "Clients", hint: "Client list, profiles, client portal" },
  { key: "leads", group: "Clients", label: "Leads", hint: "Enquiries that are not programs yet" },
  { key: "referrals", group: "Clients", label: "Referrals", hint: "Who brings you work" },
  { key: "payments", group: "Money", label: "Payments", hint: "Take payments and refunds" },
  { key: "invoices", group: "Money", label: "Invoices", hint: "Make and send invoices" },
  { key: "quotes", group: "Money", label: "Quotes", hint: "Price offers for clients" },
  { key: "accounts", group: "Money", label: "Accounts & expenses", hint: "Cash and bank, balances, expenses, transfers" },
  { key: "team", group: "Team", label: "Team", hint: "Team list, rates, profiles" },
  { key: "team-pay", group: "Team", label: "Team pay", hint: "Pay the team for programs" },
  { key: "salary", group: "Team", label: "Salary", hint: "Monthly salaries" },
  { key: "expense-claims", group: "Team", label: "Expense claims", hint: "Costs the team asks back" },
  { key: "dashboard", group: "Studio", label: "Dashboard", hint: "Home page with today's numbers" },
  { key: "reports", group: "Studio", label: "Reports", hint: "Income, profit, top clients" },
  { key: "packages", group: "Studio", label: "Packages", hint: "Packages and add-ons" },
  { key: "equipment", group: "Studio", label: "Equipment", hint: "Equipment list" },
  { key: "chat", group: "Studio", label: "Chat", hint: "Team chat and messages" },
  { key: "whatsapp", group: "Studio", label: "WhatsApp templates", hint: "Ready messages for WhatsApp" },
  { key: "website", group: "Studio", label: "Website", hint: "Studio website: pages, packages, photos, publish" },
] as const;
export type AreaKey = (typeof AREAS)[number]["key"];
export const ALL_AREAS: AreaKey[] = AREAS.map(a => a.key);

const ROUTE_AREA: Record<string, AreaKey | "any" | "owner"> = {
  "/dashboard": "dashboard", "/reports": "reports",
  "/programs": "programs", "/calendar": "calendar", "/checklist": "programs", "/delivery": "delivery",
  "/music": "music", "/photo-selection": "photo-selection", "/album-studio": "photo-selection", "/face-search": "face-search", "/contracts": "contracts",
  "/clients": "clients", "/leads": "leads", "/referrals": "referrals",
  "/payments": "payments", "/invoices": "invoices", "/quotes": "quotes", "/expenses": "accounts", "/accounts": "accounts",
  "/team": "team", "/salary": "salary", "/team-pay": "team-pay",
  "/packages": "packages", "/equipment": "equipment",
  "/chat": "chat", "/whatsapp": "whatsapp",
  "/website": "website",
  "/notifications": "any", "/support": "any", "/account": "any",
  "/settings": "owner", "/billing": "owner",
};

type Who = { role?: string; permissions?: string[] } | null | undefined;

export function canOpen(user: Who, href: string): boolean {
  if (!user || user.role !== "manager") return true;
  const base = "/" + (href.split("?")[0].split("/")[1] ?? "");
  const need = ROUTE_AREA[base];
  if (need === undefined || need === "any") return true;
  if (need === "owner") return false;
  return (user.permissions ?? []).includes(need);
}

/** Where a manager lands: the first page they can open. */
export function homeFor(user: Who): string {
  for (const h of ["/dashboard", "/programs", "/calendar", "/clients", "/leads", "/payments", "/invoices", "/quotes", "/accounts", "/team", "/team-pay", "/salary", "/delivery", "/music", "/photo-selection", "/face-search", "/contracts", "/referrals", "/reports", "/packages", "/equipment", "/chat", "/whatsapp", "/website"]) {
    if (canOpen(user, h)) return h;
  }
  return "/account";
}
