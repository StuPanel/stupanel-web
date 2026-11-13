"use client";

/**
 * Settings → Security → "Sign out after inactivity".
 * 0 (the default) = never. Otherwise: when nobody has used StuPanel on this device for that many
 * minutes, the next look at the app signs them out. The last-used time is shared by all tabs.
 */
import { useEffect } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";

const KEY = "sp-last-active";
const read = () => { try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; } };
const write = (t: number) => { try { localStorage.setItem(KEY, String(t)); } catch { /* private mode */ } };

async function signOut() {
  try { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); } catch { /* still sign out here */ }
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem(KEY);
  } catch { /* nothing to clear */ }
  document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
  window.location.href = "/login?reason=idle";
}

/** `minutes`: the studio's setting when the page already has it; left out = ask the server. */
export function IdleSignOut({ minutes }: { minutes?: number | null }) {
  useEffect(() => {
    if (minutes === null) return; // not loaded yet
    let limit = 0;
    let stopped = false;
    let lastWrite = 0;

    /** Too long since the last use → sign out. Returns true when it did. */
    const expired = () => {
      if (!limit || stopped) return false;
      const last = read();
      if (last && Date.now() - last > limit * 60_000) { stopped = true; signOut(); return true; }
      return false;
    };
    const used = () => {
      if (stopped || expired()) return;
      const now = Date.now();
      if (now - lastWrite > 15_000) { lastWrite = now; write(now); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") used(); };

    const start = (m: number) => {
      if (stopped) return;
      limit = Number.isFinite(m) && m > 0 ? m : 0;
      if (!expired()) { lastWrite = Date.now(); write(lastWrite); }
    };
    if (typeof minutes === "number") start(minutes);
    else apiFetch(`${API}/auth/me`).then(r => (r.ok ? r.json() : null)).then(d => start(Number(d?.company?.sessionTimeoutMinutes) || 0)).catch(() => {});

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach(e => window.addEventListener(e, used, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(expired, 30_000);
    return () => {
      stopped = true;
      events.forEach(e => window.removeEventListener(e, used, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [minutes]);
  return null;
}
