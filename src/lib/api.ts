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

  try {
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!refreshRes.ok) throw new Error();
    const { accessToken } = await refreshRes.json();
    localStorage.setItem("access_token", accessToken);
    setAccessTokenCookie(accessToken);

    return fetch(input, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers },
    });
  } catch {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    clearAccessTokenCookie();
    window.location.href = "/login";
    return res;
  }
}
