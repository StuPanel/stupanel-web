import { waNumber } from "@/lib/phone";

/**
 * Client-portal device pass. After the client enters the access code once,
 * the API returns a signed session that we keep on this device so they are
 * not asked again. Storage can be unavailable (private mode) — then they
 * simply enter the code each visit.
 */
const key = (token: string) => `sp_portal_session:${token}`;

export function getPortalSession(token: string): string | null {
  try { return localStorage.getItem(key(token)); } catch { return null; }
}

export function setPortalSession(token: string, session: string) {
  try { localStorage.setItem(key(token), session); } catch { /* ignore */ }
}

export function clearPortalSession(token: string) {
  try { localStorage.removeItem(key(token)); } catch { /* ignore */ }
}

/** Headers for public portal API calls. */
export function portalHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  const s = getPortalSession(token);
  return { ...(extra ?? {}), ...(s ? { "X-Portal-Session": s } : {}) };
}

/** Download links are plain navigations, so the pass goes in the query. */
export function withPortalSession(token: string, url: string): string {
  const s = getPortalSession(token);
  if (!s) return url;
  return `${url}${url.includes("?") ? "&" : "?"}s=${encodeURIComponent(s)}`;
}

/** wa.me link; a locally written number gets the studio's country code (see lib/phone). */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const d = waNumber(phone);
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
