"use client";
/**
 * Phone notifications on this device (Web Push). The browser gives an address; the server keeps it and sends
 * short notices there (a new enquiry, a message, new work), even when StuPanel is closed.
 */
import { apiFetch, API_URL as API } from "@/lib/api";

export type PushState =
  | "unsupported"   // this browser can't do it
  | "ios-install"   // iPhone / iPad: works only after "Add to Home Screen"
  | "blocked"       // the person said no in the browser; only they can change it in the browser's settings
  | "off" | "on";

const SW = "/push-sw.js";

const isIos = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const standalone = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SW)) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !standalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await registration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub && Notification.permission === "granted" ? "on" : "off";
}

const b64 = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/** Switch on: ask the browser, then tell the server this device's address. Call it from a tap. */
export async function pushOn(): Promise<{ ok: boolean; state: PushState; error?: string }> {
  if (!pushSupported()) return { ok: false, state: await pushState() };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, state: perm === "denied" ? "blocked" : "off" };
  try {
    const res = await apiFetch(`${API}/push`);
    if (!res.ok) return { ok: false, state: "off", error: "Couldn't reach StuPanel. Try again." };
    const { key } = (await res.json()) as { key: string };
    const reg = await navigator.serviceWorker.register(SW, { scope: "/" });
    await navigator.serviceWorker.ready;
    const old = await reg.pushManager.getSubscription();
    const sub = old ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    const save = await apiFetch(`${API}/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    if (!save.ok) { await sub.unsubscribe().catch(() => undefined); return { ok: false, state: "off", error: "Couldn't switch notifications on. Try again." }; }
    return { ok: true, state: "on" };
  } catch {
    return { ok: false, state: await pushState(), error: "This browser couldn't switch notifications on." };
  }
}

/** Switch off on this device. */
export async function pushOff(): Promise<PushState> {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await apiFetch(`${API}/push/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } catch { /* already off */ }
  return pushState();
}

/** A notice to my own devices, to see that it works. */
export async function pushTest(): Promise<number> {
  const r = await apiFetch(`${API}/push/test`, { method: "POST" });
  return r.ok ? ((await r.json()) as { sent: number }).sent : 0;
}

/**
 * On sign-in on a device that already has notifications on: make sure the address belongs to whoever is signed in
 * now (a shared phone) and is still known to the server. Quiet; never asks for permission.
 */
export async function pushRefresh() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const reg = await registration();
    // Pick up a newer notification script (its icon, where a tap opens) without waiting a day.
    void reg?.update().catch(() => undefined);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await apiFetch(`${API}/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  } catch { /* next time */ }
}

/** On sign-out: this device stops getting this person's notices. */
export async function pushForget() {
  try {
    if (!pushSupported()) return;
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) {
      await apiFetch(`${API}/push/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    }
  } catch { /* nothing to forget */ }
}
