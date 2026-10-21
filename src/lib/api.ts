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
  const accessToken = await refreshOnce();
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

let refreshing: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
        if (!refreshRes.ok) return null;
        const { accessToken } = await refreshRes.json();
        if (!accessToken) return null;
        localStorage.setItem("access_token", accessToken);
        setAccessTokenCookie(accessToken);
        return accessToken as string;
      } catch {
        return null;
      } finally {
        // allow a new refresh later (after this one settles)
        setTimeout(() => { refreshing = null; }, 0);
      }
    })();
  }
  return refreshing;
}
