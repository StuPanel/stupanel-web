/**
 * The dashboard remembers what it showed last time, on this device (Faisal 28-NOV-2026: it took ~3 seconds to fill).
 * Opening it shows those numbers at once and swaps in fresh ones a moment later.
 * Kept per signed-in device session, so another person signing in here never sees them; signing out clears it.
 */
const PREFIX = "sp_dash_v1:";

function sessionKey(): string | null {
  try {
    const t = localStorage.getItem("access_token");
    if (!t) return null;
    const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; companyId?: string; sid?: string };
    return p.sub && p.companyId ? `${PREFIX}${p.companyId}:${p.sub}:${p.sid ?? ""}` : null;
  } catch { return null; }
}

type Saved = Record<string, unknown>;

export function dashRead<T>(part: string): T | null {
  const k = sessionKey();
  if (!k) return null;
  try {
    // Anything kept for an earlier session or another studio goes away.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && key !== k) localStorage.removeItem(key);
    }
    const all = JSON.parse(localStorage.getItem(k) || "{}") as Saved;
    return (all[part] as T) ?? null;
  } catch { return null; }
}

export function dashWrite(part: string, value: unknown) {
  const k = sessionKey();
  if (!k) return;
  try {
    const all = JSON.parse(localStorage.getItem(k) || "{}") as Saved;
    all[part] = value;
    localStorage.setItem(k, JSON.stringify(all));
  } catch { /* full or blocked: the dashboard just loads as before */ }
}

/** Signing out: nothing of the dashboard stays on the device. */
export function dashForget() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch { /* nothing kept */ }
}
