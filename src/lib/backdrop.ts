/**
 * Backdrop = the scene behind the workspace (soft colour glow + frosted cards).
 * One choice for the whole studio (studio settings → appearance.backdrop), so the team's panel
 * looks like the studio app. It is also kept on the device so the first paint is already right.
 * `plain` turns the glass off.
 */
export type BackdropKey = "violet" | "golden" | "mehendi" | "lagoon" | "plain";

export const BACKDROPS: { key: BackdropKey; name: string; sub: string; base: string; a: string; b: string }[] = [
  { key: "golden", name: "Golden Hour", sub: "Warm like an evening shoot — the default", base: "#FBF6EE", a: "#F8C77A", b: "#F3A0B0" },
  { key: "violet", name: "StuPanel Violet", sub: "Our violet with a rosy glow", base: "#F4F1FB", a: "#B9A5FB", b: "#FFC2B3" },
  { key: "mehendi", name: "Mehendi", sub: "Fresh green and marigold", base: "#F3F7EF", a: "#9CCB8F", b: "#F6D36B" },
  { key: "lagoon", name: "Lagoon", sub: "Calm teal and blue", base: "#EEF5F7", a: "#86CFC7", b: "#9DB9E8" },
  { key: "plain", name: "Plain", sub: "Simple, no glass", base: "#F5F3FA", a: "#F5F3FA", b: "#F5F3FA" },
];

export const BACKDROP_KEY = "sp_backdrop";

const isKey = (v: unknown): v is BackdropKey => BACKDROPS.some(b => b.key === v);

/** What is saved on this device, if anything. */
export function getLocalBackdrop(): BackdropKey | null {
  try {
    const v = localStorage.getItem(BACKDROP_KEY);
    if (isKey(v)) return v;
  } catch { /* storage blocked */ }
  return null;
}

/** The look when nobody has chosen one: the login pages, a new studio, a new device. */
export const DEFAULT_BACKDROP: BackdropKey = "golden";

export function getBackdrop(): BackdropKey {
  return getLocalBackdrop() ?? DEFAULT_BACKDROP;
}

/**
 * Put this device on the studio's backdrop. Give it the studio settings (GET /companies/settings).
 * Returns the studio's choice, or null when the studio has not chosen one.
 */
export function applyStudioBackdrop(settings: { appearance?: { backdrop?: unknown } } | null | undefined): BackdropKey | null {
  const k = settings?.appearance?.backdrop;
  if (!isKey(k)) return null;
  if (getLocalBackdrop() !== k || document.documentElement.dataset.backdrop !== k) setBackdrop(k);
  return k;
}

export function setBackdrop(key: BackdropKey) {
  try { localStorage.setItem(BACKDROP_KEY, key); } catch { /* storage blocked */ }
  document.documentElement.dataset.backdrop = key;
}

/** Runs before the page paints (in <head>), so there's no flash of the wrong backdrop. */
export const BACKDROP_BOOT = `try{var b=localStorage.getItem("${BACKDROP_KEY}");if(b)document.documentElement.dataset.backdrop=b}catch(e){}`;
