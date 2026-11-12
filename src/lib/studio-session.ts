/**
 * One login, many studios. After login (or a switch) the API returns a session for one studio;
 * a person in several studios first gets a list to pick from.
 */
import { setAccessTokenCookie } from "@/lib/auth-cookie";
import { API_URL } from "@/lib/api";

export type StudioCard = {
  userId: string; companyId: string; name: string; logoUrl: string | null; role: string; isOwner: boolean;
};
export type StudioInvite = StudioCard & { invitedAt?: string; expiresAt?: string };

export type Session = {
  accessToken: string;
  user: { id: string; role: string; mustChangePassword?: boolean };
  company: { id: string; name: string; onboardingCompleted: boolean };
};
export type StudioChoice = { chooseStudio: true; ticket: string; studios: StudioCard[]; invites: StudioInvite[] };

export const isChoice = (d: unknown): d is StudioChoice => !!d && typeof d === "object" && "chooseStudio" in d;

/** Store the session (no page change). */
export function saveSession(d: Session) {
  localStorage.setItem("access_token", d.accessToken);
  localStorage.setItem("user_role", d.user.role);
  setAccessTokenCookie(d.accessToken);
}

/** Where this session starts: member panel for staff, otherwise the studio app. */
export function homeFor(d: Session, redirectTo?: string | null) {
  // An invite link the person came from always wins.
  if (redirectTo?.startsWith("/invite/")) return redirectTo;
  if (d.user.role === "staff") return "/member/dashboard";
  if (!d.company.onboardingCompleted) return "/onboarding";
  return redirectTo || "/dashboard";
}

/** Save and open (full page load, so every part of the app starts fresh for this studio). */
export function enterSession(d: Session, redirectTo?: string | null) {
  saveSession(d);
  window.location.href = homeFor(d, redirectTo);
}

/** POST without the stored token (login, ticket, invite links). */
export async function postPublic<T = unknown>(path: string, body?: unknown) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  const msg = (d as { message?: string | string[] }).message;
  return { ok: r.ok, data: d as T, error: Array.isArray(msg) ? msg[0] : msg || "Something went wrong. Please try again." };
}

export const roleLabel = (s: Pick<StudioCard, "role" | "isOwner">) =>
  s.isOwner ? "Owner" : s.role === "manager" ? "Manager" : s.role === "staff" ? "Team member" : s.role.charAt(0).toUpperCase() + s.role.slice(1);
