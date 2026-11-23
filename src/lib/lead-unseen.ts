import { apiFetch, API_URL as API } from "@/lib/api";

/** Fired after the Leads page marks new leads as seen, so the menu count goes away at once. */
export const LEADS_SEEN_EVENT = "sp-leads-seen";

/** How many leads nobody at the studio has looked at yet. */
export async function loadLeadUnseen(): Promise<number | null> {
  try {
    const r = await apiFetch(`${API}/leads/unseen`);
    return r.ok ? ((await r.json()) as { count: number }).count : null;
  } catch { return null; }
}

/** Opening the Leads page: every new lead counts as seen. */
export async function markLeadsSeen() {
  try { await apiFetch(`${API}/leads/seen`, { method: "POST" }); } catch { /* next visit */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LEADS_SEEN_EVENT));
}
