/**
 * What a manager can open. The owner ticks areas for each manager on the Team page;
 * the API enforces the same areas (stupanel-api src/modules/auth/permissions.ts).
 */
export const AREAS = [
  { key: "programs", label: "Programs", hint: "Programs, calendar, checklist, delivery" },
  { key: "clients", label: "Clients", hint: "Clients and referrals" },
  { key: "payments", label: "Money", hint: "Payments, invoices, quotes, expenses" },
  { key: "team", label: "Team & pay", hint: "Team, rates, team pay, salary" },
  { key: "reports", label: "Dashboard & reports", hint: "Home dashboard, profit, reports" },
  { key: "packages", label: "Packages", hint: "Packages and service list" },
  { key: "equipment", label: "Equipment", hint: "Equipment list" },
  { key: "chat", label: "Chat & WhatsApp", hint: "Team chat, messages, WhatsApp templates" },
] as const;
export type AreaKey = (typeof AREAS)[number]["key"];

const ROUTE_AREA: Record<string, AreaKey | "any" | "owner"> = {
  "/dashboard": "reports", "/reports": "reports",
  "/programs": "programs", "/calendar": "programs", "/checklist": "programs", "/delivery": "programs",
  "/clients": "clients", "/referrals": "clients",
  "/payments": "payments", "/invoices": "payments", "/quotes": "payments", "/expenses": "payments",
  "/team": "team", "/salary": "team",
  "/packages": "packages", "/equipment": "equipment",
  "/chat": "chat", "/whatsapp": "chat",
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
  for (const h of ["/dashboard", "/programs", "/clients", "/payments", "/team", "/calendar", "/packages", "/equipment", "/chat"]) {
    if (canOpen(user, h)) return h;
  }
  return "/account";
}
