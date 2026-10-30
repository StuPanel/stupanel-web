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

/** wa.me link: keeps digits; local BD numbers (01XXXXXXXXX) get the 880 prefix. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11 && d.startsWith("01")) d = "88" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
