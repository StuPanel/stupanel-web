"use client";

/**
 * The studio's side menu: one list used by the desktop sidebar, the phone menu panel,
 * the phone bottom bar and Settings → Menu.
 *
 * StuPanel's order is below. A studio owner can hide items, change the order inside a group,
 * change the order of the groups and pick the 3 middle phone buttons (Settings → Menu).
 * That choice is saved in the studio settings (`menu`) and is the same for everyone in the studio.
 */
import { useEffect, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Users, Camera, CreditCard, Package, ImageIcon, BarChart3,
  MessageCircle, FileText, Wrench, Wallet, Landmark, Handshake, Receipt, Target, Music2, Images,
  ScanFace, FileSignature, UserCog,
} from "lucide-react";
import type { TileColor } from "@/components/ui/apple";
import { API_URL as API, apiFetch } from "@/lib/api";

export type MenuItem = { id: string; name: string; href: string; icon: React.ElementType; color: TileColor; phoneName?: string };
export type MenuGroup = { id: string; title: string; items: MenuItem[] };

const I = (id: string, name: string, href: string, icon: React.ElementType, color: TileColor, phoneName?: string): MenuItem =>
  ({ id, name, href, icon, color, phoneName });

/** StuPanel's order. The first group has no title. */
export const DEFAULT_MENU: MenuGroup[] = [
  { id: "top", title: "", items: [
    I("dashboard", "Dashboard", "/dashboard", LayoutDashboard, "violet", "Home"),
    I("programs", "Programs", "/programs", Camera, "deep"),
    I("calendar", "Calendar", "/calendar", CalendarDays, "red"),
    I("clients", "Clients", "/clients", Users, "blue"),
    I("chat", "Chat", "/chat", MessageCircle, "green"),
  ] },
  { id: "bookings", title: "Bookings", items: [
    I("leads", "Leads", "/leads", Target, "violet"),
    I("quotes", "Quotes", "/quotes", FileText, "deep"),
    I("contracts", "Contracts", "/contracts", FileSignature, "ink"),
    I("packages", "Packages", "/packages", Package, "violet"),
    I("referrals", "Referrals", "/referrals", Handshake, "teal"),
  ] },
  { id: "delivery", title: "Delivery & gallery", items: [
    I("delivery", "Delivery", "/delivery", ImageIcon, "teal"),
    I("photo-selection", "Photo Selection", "/photo-selection", Images, "red", "Selection"),
    I("face-search", "AI Face Search", "/face-search", ScanFace, "violet", "Face Search"),
    I("music", "Music Library", "/music", Music2, "orchid", "Music"),
  ] },
  { id: "money", title: "Money", items: [
    I("invoices", "Invoices", "/invoices", Receipt, "orchid"),
    I("payments", "Payments", "/payments", CreditCard, "green", "Money"),
    I("accounts", "Accounts", "/accounts", Landmark, "blue"),
    I("reports", "Reports", "/reports", BarChart3, "blue"),
  ] },
  { id: "team", title: "Team & gear", items: [
    I("team", "Team", "/team", UserCog, "blue"),
    I("team-pay", "Team pay", "/team-pay", Wallet, "green"),
    I("equipment", "Equipment", "/equipment", Wrench, "ink"),
  ] },
];

export const ALL_ITEMS = DEFAULT_MENU.flatMap(g => g.items);
/** Always in the menu (Settings sits at the bottom of the sidebar and is never hidden). */
export const ALWAYS = ["dashboard"];
export const DEFAULT_PHONE = ["programs", "calendar", "payments"];

export type MenuChoice = { groups: { id: string; items: string[] }[]; hidden: string[]; phone: string[] };
export type Features = { photoSelection?: boolean; musicSelection?: boolean };
export const EMPTY_CHOICE: MenuChoice = { groups: [], hidden: [], phone: [] };

/**
 * StuPanel's menu with the studio's choice put on top. Items StuPanel adds later appear in their usual group;
 * unknown ids are skipped. Hidden items are kept here with `hidden: true` (Settings → Menu shows them).
 */
export type ArrangedItem = MenuItem & { hidden: boolean };
export type ArrangedGroup = Omit<MenuGroup, "items"> & { items: ArrangedItem[] };
export function arrange(choice: MenuChoice | null | undefined): ArrangedGroup[] {
  const c = choice ?? EMPTY_CHOICE;
  const hidden = new Set((c.hidden ?? []).filter(id => !ALWAYS.includes(id)));
  const groupOrder = [...(c.groups ?? []).map(g => g.id).filter(id => DEFAULT_MENU.some(d => d.id === id)), ...DEFAULT_MENU.map(d => d.id)]
    .filter((id, i, a) => a.indexOf(id) === i);
  return groupOrder.map(gid => {
    const def = DEFAULT_MENU.find(d => d.id === gid)!;
    const saved = (c.groups ?? []).find(g => g.id === gid)?.items ?? [];
    const ids = [...saved.filter(id => def.items.some(i => i.id === id)), ...def.items.map(i => i.id)].filter((id, i, a) => a.indexOf(id) === i);
    return { ...def, items: ids.map(id => ({ ...def.items.find(i => i.id === id)!, hidden: hidden.has(id) })) };
  });
}

/** The 3 middle phone buttons (Home and More are always there). */
export function phoneItems(choice: MenuChoice | null | undefined): MenuItem[] {
  const ids = (choice?.phone?.length === 3 ? choice.phone : DEFAULT_PHONE);
  return ids.map(id => ALL_ITEMS.find(i => i.id === id)).filter((x): x is MenuItem => !!x && x.id !== "dashboard");
}

/** Pages a studio switched off in their own settings leave the menu by themselves. */
export function switchedOff(href: string, f: Features | null | undefined) {
  return (href === "/photo-selection" && f?.photoSelection === false) || (href === "/music" && f?.musicSelection === false);
}

// ── Loaded once per session, updated at once when Settings saves ──────────────
type Loaded = { features: Features | null; menu: MenuChoice | null };
let cache: Loaded | null = null;
let loading: Promise<void> | null = null;
export const MENU_EVENT = "sp:menu";

/** Settings calls this after saving features or the menu, so the sidebar and phone bar change at once. */
export function announceMenu(next: Partial<Loaded>) {
  cache = { features: cache?.features ?? null, menu: cache?.menu ?? null, ...next };
  window.dispatchEvent(new CustomEvent(MENU_EVENT));
}

export function useStudioMenu(): Loaded {
  const [state, setState] = useState<Loaded>(cache ?? { features: null, menu: null });
  useEffect(() => {
    let alive = true;
    const sync = () => { if (alive && cache) setState(cache); };
    if (!cache && !loading && typeof window !== "undefined" && localStorage.getItem("access_token")) {
      loading = apiFetch(`${API}/companies/settings`).then(r => (r.ok ? r.json() : null))
        .then(d => { if (d) cache = { features: d.features ?? null, menu: d.menu ?? null }; })
        .catch(() => {}).finally(() => { loading = null; window.dispatchEvent(new CustomEvent(MENU_EVENT)); });
    }
    window.addEventListener(MENU_EVENT, sync);
    sync();
    return () => { alive = false; window.removeEventListener(MENU_EVENT, sync); };
  }, []);
  return state;
}

/** Forget the loaded menu (another studio was opened). */
export function resetStudioMenu() { cache = null; }
