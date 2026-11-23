/**
 * How a gallery cover sits in its frame (Face Search, Photo Selection): the point to keep in view, in %,
 * and a zoom of 1–3. Saved by the studio in the cover picker's "Adjust" step.
 */
import type { CSSProperties } from "react";

export type CoverFocus = { x: number; y: number; z: number };

/** The <img> part: which part of the photo stays in the frame. */
export function coverPos(f: CoverFocus | null | undefined, fallback = "50% 50%"): CSSProperties {
  return { objectFit: "cover", objectPosition: f ? `${f.x}% ${f.y}%` : fallback };
}

/** The wrapper part: the zoom, grown from the focus point (a wrapper, so the photo's own animation still runs). */
export function coverZoom(f: CoverFocus | null | undefined): CSSProperties {
  return f && f.z > 1 ? { transform: `scale(${f.z})`, transformOrigin: `${f.x}% ${f.y}%` } : {};
}
