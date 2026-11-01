/**
 * StuPanel Admin (platform staff) — sign-in state and API calls.
 *
 * - Access token (15 min) lives in sessionStorage "admin_token" (same slot the old
 *   admin pages read), with "admin_auth" = "platform".
 * - The refresh token is an httpOnly cookie set by the API (never visible to JS).
 * - installAdminFetchShim() lets every existing /admin page work with a platform
 *   token: it adds the "x-admin-auth" header and refreshes the token on 401.
 */
import { API_URL } from "./api";

export const ADMIN_HOST = "admin.stupanel.com";

export interface PlatformUser {
  id: string; email: string; name: string; phone?: string | null; avatarUrl?: string | null;
  isOwner: boolean; status: string;
  role?: { key: string; name: string };
  permissions: string[];
  twoFactorOn: boolean; hasPassword: boolean; googleLinked: boolean; backupCodesLeft: number;
  lastLoginAt?: string | null; accessEndsAt?: string | null; createdAt?: string;
}

const ss = () => (typeof window === "undefined" ? null : window.sessionStorage);

export function isAdminHost() {
  return typeof window !== "undefined" && window.location.hostname === ADMIN_HOST;
}
/** Where the sign-in page lives (admin host: /login, app host: /platform/login). */
export const loginPath = () => (isAdminHost() ? "/login" : "/platform/login");

export function isPlatformMode() { return ss()?.getItem("admin_auth") === "platform"; }
export function getPlatformUser(): PlatformUser | null {
  try { return JSON.parse(ss()?.getItem("platform_user") || "null"); } catch { return null; }
}

export function savePlatformSession(accessToken: string, user?: PlatformUser) {
  const s = ss(); if (!s) return;
  s.setItem("admin_token", accessToken);
  s.setItem("admin_auth", "platform");
  if (user) {
    s.setItem("platform_user", JSON.stringify(user));
    localStorage.setItem("admin_name", user.name);
  }
}

export function clearPlatformSession() {
  const s = ss(); if (!s) return;
  s.removeItem("admin_token"); s.removeItem("admin_auth"); s.removeItem("platform_user");
}

export function can(user: PlatformUser | null, perm: string) {
  if (!user) return false;
  return user.permissions.includes("*") || user.permissions.includes(perm);
}

let refreshing: Promise<boolean> | null = null;

/** Uses the httpOnly cookie to get a fresh access token. True if still signed in. */
export function refreshPlatform(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const r = await nativeFetch(`${API_URL}/platform/auth/refresh`, { method: "POST", credentials: "include" });
      if (!r.ok) return false;
      const d = await r.json();
      savePlatformSession(d.accessToken, d.user);
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

const nativeFetch: typeof fetch = (...a) => (window as any).__nativeFetch ? (window as any).__nativeFetch(...a) : fetch(...a);

/** Public calls (sign-in steps). Returns parsed JSON or throws Error(message). */
export async function platformPost<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await nativeFetch(`${API_URL}/platform${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return readJson<T>(r);
}

async function readJson<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (d as any)?.message;
    throw Object.assign(new Error(Array.isArray(m) ? m[0] : (m || "Something went wrong. Try again.")), { status: r.status });
  }
  return d as T;
}

/** Signed-in calls to /v1/platform/*. Refreshes once on 401. */
export async function pfetch<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const go = () => nativeFetch(`${API_URL}/platform${path}`, {
    ...init,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    headers: {
      ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${ss()?.getItem("admin_token") ?? ""}`,
      ...init.headers,
    },
  });
  let r = await go();
  if (r.status === 401 && await refreshPlatform()) r = await go();
  if (r.status === 401) { clearPlatformSession(); window.location.href = loginPath(); }
  return readJson<T>(r);
}

export async function platformLogout() {
  try { await platformPost("/auth/logout"); } catch { /* ignore */ }
  clearPlatformSession();
  window.location.href = loginPath();
}

/**
 * Patch window.fetch so the old /admin pages send the platform token correctly
 * and survive the 15-minute token expiry. Safe to call more than once.
 */
export function installAdminFetchShim() {
  const w = window as any;
  if (w.__nativeFetch) return;
  const original: typeof fetch = window.fetch.bind(window);
  w.__nativeFetch = original;
  const adminBase = `${API_URL}/admin`;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isPlatformMode() || !url.startsWith(adminBase)) return original(input, init);
    const send = () => {
      const h = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      h.set("x-admin-auth", "platform");
      h.set("Authorization", `Bearer ${ss()?.getItem("admin_token") ?? ""}`);
      return original(input, { ...init, headers: h });
    };
    let r = await send();
    if (r.status === 401 && await refreshPlatform()) r = await send();
    return r;
  };
}
