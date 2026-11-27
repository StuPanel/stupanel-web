"use client";
/**
 * StuPanel Live from a computer (Faisal 27-NOV-2026): Chrome / Edge watch a folder on the laptop and send every new
 * JPEG to the event's Face Search gallery, like the phone app does. Photos reach the folder by a tethered camera
 * (Sony Imaging Edge, Canon EOS Utility, Nikon NX Tether…), a card copied in, or Lightroom exports.
 *
 * Same server calls as the phone app (/live/:id/start, session, complete, sync), with this computer's own id, so it
 * shows in the gallery's Live tab as a device the studio can stop, and the gallery's Live rules apply (who may send,
 * the photo limit, check before guests see them).
 *
 * The sender lives here, outside React: it keeps running while the person moves between tabs of StuPanel.
 * Files go straight from the folder to Google (our server only opens the upload), two at a time.
 */
import { apiFetch, API_URL as API } from "@/lib/api";

type DirHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
  queryPermission?(o: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "read" }): Promise<PermissionState>;
};

export type SenderState = {
  status: "idle" | "running" | "paused" | "stopped";
  folder: string | null;
  sent: number;
  waiting: number;
  failed: number;
  /** The newest sent files, newest first */
  recent: { name: string; at: number }[];
  error: string | null;
  /** Last time the folder was looked at */
  checkedAt: number | null;
};

const POLL_MS = 3000;
const SYNC_EVERY = 5;
const PARALLEL = 2;
const MAX_SEEN = 20000;
const isPhoto = (n: string) => /\.(jpe?g)$/i.test(n) && !n.startsWith(".") && !n.startsWith("._");

export function computerLiveSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window && !window.matchMedia("(pointer: coarse)").matches;
}

function deviceId() {
  const k = "sp_live_pc_id";
  try {
    let id = localStorage.getItem(k);
    if (!id) { id = `pc-${crypto.randomUUID()}`; localStorage.setItem(k, id); }
    return id;
  } catch { return `pc-${Math.random().toString(36).slice(2, 12)}`; }
}
function deviceName() {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "computer";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : "Browser";
  return `Computer · ${br} on ${os}`;
}

class Sender {
  state: SenderState = { status: "idle", folder: null, sent: 0, waiting: 0, failed: 0, recent: [], error: null, checkedAt: null };
  private listeners = new Set<(s: SenderState) => void>();
  private dir: DirHandle | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seen = new Set<string>();
  /** Files seen once: sent only when their size is the same on the next look (the camera finished writing). */
  private settling = new Map<string, number>();
  private queue: { key: string; file: File }[] = [];
  /** Files being sent right now (not in the queue any more, not yet seen). */
  private inflight = new Set<string>();
  private busy = 0;
  private sinceSync = 0;
  private wake: { release(): Promise<void> } | null = null;
  private readonly dev = typeof window === "undefined" ? "" : deviceId();

  constructor(private galleryId: string) {}

  subscribe(fn: (s: SenderState) => void) { this.listeners.add(fn); fn(this.state); return () => { this.listeners.delete(fn); }; }
  private set(p: Partial<SenderState>) { this.state = { ...this.state, ...p }; this.listeners.forEach(f => f(this.state)); }

  private seenKey() { return `sp_live_pc_seen:${this.galleryId}:${this.dir?.name ?? ""}`; }
  private loadSeen() {
    try { this.seen = new Set(JSON.parse(localStorage.getItem(this.seenKey()) || "[]")); } catch { this.seen = new Set(); }
  }
  private saveSeen() {
    try { localStorage.setItem(this.seenKey(), JSON.stringify([...this.seen].slice(-MAX_SEEN))); } catch { /* the list is a convenience */ }
  }

  private headers(json = true): Record<string, string> {
    return { ...(json ? { "Content-Type": "application/json" } : {}), "x-live-device": this.dev };
  }

  /** Pick the folder (needs a click). */
  async choose(): Promise<boolean> {
    try {
      const h = await (window as unknown as { showDirectoryPicker(o?: object): Promise<DirHandle> }).showDirectoryPicker({ id: "stupanel-live", mode: "read" });
      this.dir = h;
      this.loadSeen();
      this.set({ folder: h.name, error: null, status: this.state.status === "running" ? "running" : "idle" });
      return true;
    } catch { return false; }
  }

  /** Start sending. `old`: also the photos already in the folder. */
  async start(old: boolean) {
    if (!this.dir) return;
    if (this.dir.queryPermission && (await this.dir.queryPermission({ mode: "read" })) !== "granted") {
      if ((await this.dir.requestPermission?.({ mode: "read" })) !== "granted") { this.set({ error: "The browser did not allow reading the folder." }); return; }
    }
    const r = await apiFetch(`${API}/live/${this.galleryId}/start`, { method: "POST", headers: this.headers(), body: JSON.stringify({ deviceId: this.dev, deviceName: deviceName(), appVersion: "web" }) }).catch(() => null);
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      this.set({ error: (j as { message?: string } | null)?.message ?? "Could not start. Check the internet and try again." });
      return;
    }
    if (!old) {
      // Everything in the folder now counts as already there: only new photos go.
      for (const f of await this.list()) this.seen.add(f.key);
      this.saveSeen();
    }
    this.set({ status: "running", error: null });
    void this.keepAwake();
    this.tick();
  }

  pause() { this.stopTimer(); this.set({ status: "paused" }); void this.wake?.release().catch(() => undefined); this.wake = null; }
  resume() { if (!this.dir) return; this.set({ status: "running", error: null }); void this.keepAwake(); this.tick(); }

  async stop() {
    this.stopTimer();
    this.queue = [];
    void this.wake?.release().catch(() => undefined); this.wake = null;
    await this.sync();
    await apiFetch(`${API}/live/${this.galleryId}/stop`, { method: "POST", headers: this.headers() }).catch(() => null);
    this.set({ status: "stopped", waiting: 0 });
  }

  /** The screen stays on while sending (a sleeping laptop stops sending). */
  private async keepAwake() {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
      if (wl && !this.wake) this.wake = await wl.request("screen");
    } catch { /* not allowed here: the person keeps the laptop awake */ }
  }

  private stopTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }

  /** JPEGs in the folder and two levels of sub-folders. */
  private async list(): Promise<{ key: string; file: File }[]> {
    const out: { key: string; file: File }[] = [];
    const walk = async (d: DirHandle, depth: number, path: string) => {
      for await (const h of d.values()) {
        if (h.kind === "file" && isPhoto(h.name)) {
          const file = await (h as FileSystemFileHandle).getFile().catch(() => null);
          if (file) out.push({ key: `${path}${h.name}|${file.size}|${file.lastModified}`, file });
        } else if (h.kind === "directory" && depth < 2 && !h.name.startsWith(".")) {
          await walk(h as DirHandle, depth + 1, `${path}${h.name}/`);
        }
      }
    };
    if (this.dir) await walk(this.dir, 0, "");
    return out;
  }

  private tick() {
    this.stopTimer();
    if (this.state.status !== "running") return;
    void (async () => {
      try {
        const now = Date.now();
        const queued = new Set(this.queue.map(q => q.key));
        for (const f of await this.list()) {
          if (this.seen.has(f.key) || queued.has(f.key) || this.inflight.has(f.key)) continue;
          // Wait until the file stops changing (a camera or Lightroom may still be writing it).
          if (now - f.file.lastModified < 2000) continue;
          const first = this.settling.get(f.key);
          if (first === undefined) { this.settling.set(f.key, now); continue; }
          this.settling.delete(f.key);
          this.queue.push(f);
        }
        this.set({ waiting: this.queue.length + this.busy, checkedAt: Date.now() });
        this.pump();
      } catch {
        this.set({ error: "The folder could not be read. Choose it again." });
        this.pause();
        return;
      }
      this.timer = setTimeout(() => this.tick(), POLL_MS);
    })();
  }

  private pump() {
    while (this.busy < PARALLEL && this.queue.length && this.state.status === "running") {
      const job = this.queue.shift()!;
      this.busy++;
      this.inflight.add(job.key);
      void this.send(job).finally(() => {
        this.busy--;
        this.inflight.delete(job.key);
        this.set({ waiting: this.queue.length + this.busy });
        if (!this.queue.length && !this.busy && this.sinceSync) void this.sync();
        this.pump();
      });
    }
  }

  private async send(job: { key: string; file: File }) {
    const f = job.file;
    try {
      const s = await apiFetch(`${API}/live/${this.galleryId}/session`, { method: "POST", headers: this.headers(), body: JSON.stringify({ fileName: f.name, mimeType: "image/jpeg", size: f.size, folder: "Live" }) });
      if (!s.ok) {
        const j = (await s.json().catch(() => null)) as { message?: string } | null;
        if (s.status === 403) { this.set({ error: j?.message ?? "This computer may not send to this event." }); this.pause(); this.queue.unshift(job); return; }
        throw new Error("session");
      }
      const { uploadUrl } = (await s.json()) as { uploadUrl: string };
      const put = await fetch(uploadUrl, { method: "PUT", body: f, headers: { "Content-Type": "image/jpeg" } });
      if (!put.ok) throw new Error("upload");
      const { id } = (await put.json()) as { id: string };
      const c = await apiFetch(`${API}/live/${this.galleryId}/complete`, { method: "POST", headers: this.headers(), body: JSON.stringify({ fileId: id }) });
      if (!c.ok) throw new Error("complete");
      this.seen.add(job.key); this.saveSeen();
      this.sinceSync++;
      this.set({ sent: this.state.sent + 1, recent: [{ name: f.name, at: Date.now() }, ...this.state.recent].slice(0, 6), error: null });
      if (this.sinceSync >= SYNC_EVERY) void this.sync();
    } catch {
      // No internet or a hiccup: it goes again on a later look (the folder still has it).
      this.set({ failed: this.state.failed + 1, error: navigator.onLine ? "A photo could not be sent; it will be tried again." : "No internet. Photos wait and go when it is back." });
    }
  }

  /** The gallery adds what arrived and starts reading faces. */
  private async sync() {
    this.sinceSync = 0;
    await apiFetch(`${API}/live/${this.galleryId}/sync`, { method: "POST", headers: this.headers() }).catch(() => null);
  }
}

const senders = new Map<string, Sender>();
export function computerSender(galleryId: string) {
  let s = senders.get(galleryId);
  if (!s) { s = new Sender(galleryId); senders.set(galleryId, s); }
  return s;
}
/** A gallery whose computer sender is running (to warn before the page is closed). */
export const anySending = () => [...senders.values()].some(s => s.state.status === "running");
