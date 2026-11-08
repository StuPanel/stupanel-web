/**
 * Backdrop = the scene behind the workspace (soft colour glow + frosted cards).
 * A per-person choice kept on this device. `plain` turns the glass off.
 */
export type BackdropKey = "violet" | "golden" | "mehendi" | "lagoon" | "plain";

export const BACKDROPS: { key: BackdropKey; name: string; sub: string; base: string; a: string; b: string }[] = [
  { key: "violet", name: "StuPanel Violet", sub: "Our violet with a rosy glow", base: "#F4F1FB", a: "#B9A5FB", b: "#FFC2B3" },
  { key: "golden", name: "Golden Hour", sub: "Warm like an evening shoot", base: "#FBF6EE", a: "#F8C77A", b: "#F3A0B0" },
  { key: "mehendi", name: "Mehendi", sub: "Fresh green and marigold", base: "#F3F7EF", a: "#9CCB8F", b: "#F6D36B" },
  { key: "lagoon", name: "Lagoon", sub: "Calm teal and blue", base: "#EEF5F7", a: "#86CFC7", b: "#9DB9E8" },
  { key: "plain", name: "Plain", sub: "Simple, no glass", base: "#F5F3FA", a: "#F5F3FA", b: "#F5F3FA" },
];

export const BACKDROP_KEY = "sp_backdrop";

export function getBackdrop(): BackdropKey {
  try {
    const v = localStorage.getItem(BACKDROP_KEY) as BackdropKey | null;
    if (v && BACKDROPS.some(b => b.key === v)) return v;
  } catch { /* storage blocked */ }
  return "violet";
}

export function setBackdrop(key: BackdropKey) {
  try { localStorage.setItem(BACKDROP_KEY, key); } catch { /* storage blocked */ }
  document.documentElement.dataset.backdrop = key;
}

/** Runs before the page paints (in <head>), so there's no flash of the wrong backdrop. */
export const BACKDROP_BOOT = `try{var b=localStorage.getItem("${BACKDROP_KEY}");if(b)document.documentElement.dataset.backdrop=b}catch(e){}`;
