import { setAccessTokenCookie, clearAccessTokenCookie } from "./auth-cookie";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

const BASE = API_URL;

/** Fired when the API refuses a change because the studio's plan has ended (view-only mode). */
export const READ_ONLY_EVENT = "stupanel:read-only";

function notifyIfReadOnly(res: Response) {
  res.clone().json()
    .then((b) => { if (b?.message === "SUBSCRIPTION_READ_ONLY") window.dispatchEvent(new Event(READ_ONLY_EVENT)); })
    .catch(() => {});
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("access_token") ?? "";

  const res = await fetch(input, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });

  if (res.status === 403) notifyIfReadOnly(res);
  if (res.status !== 401) return res;

  // Many requests can hit 401 at the same moment; refresh only once and share it.
  const accessToken = await refreshOnce(token);
  if (accessToken === OFFLINE) return res; // network blip — stay logged in, the next call retries
  if (!accessToken) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    clearAccessTokenCookie();
    window.location.href = "/login";
    return res;
  }
  return fetch(input, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers },
  });
}

/** Refresh couldn't reach the server (offline / request cut) — not a reason to log out. */
const OFFLINE = "__offline__";
let refreshing: Promise<string | null> | null = null;

/**
 * The refresh token works only once. With StuPanel open in two tabs, both
 * tabs used to refresh with the same token: one won, the other got 401 and
 * logged everyone out. Now tabs take turns (Web Locks), and a tab that finds
 * a newer token already saved by another tab just uses it.
 */
async function doRefresh(staleToken: string): Promise<string | null> {
  const latest = localStorage.getItem("access_token");
  if (latest && latest !== staleToken) return latest; // another tab already refreshed
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800 * attempt));
    try {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
      if (refreshRes.status >= 500) continue; // server hiccup — try again
      if (!refreshRes.ok) {
        const after = localStorage.getItem("access_token");
        return after && after !== staleToken ? after : null;
      }
      const { accessToken } = await refreshRes.json();
      if (!accessToken) return null;
      localStorage.setItem("access_token", accessToken);
      setAccessTokenCookie(accessToken);
      return accessToken as string;
    } catch {
      // network error — try again
    }
  }
  return OFFLINE;
}

function refreshOnce(staleToken: string): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
        return locks
          ? await locks.request("stupanel-token-refresh", () => doRefresh(staleToken))
          : await doRefresh(staleToken);
      } finally {
        // allow a new refresh later (after this one settles)
        setTimeout(() => { refreshing = null; }, 0);
      }
    })();
  }
  return refreshing;
}
