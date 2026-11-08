"use client";

/**
 * One behaviour for every drawer / sheet in the app (anything with .sp-drawer and its .sp-backdrop):
 *  - Esc closes the top one.
 *  - Closing plays a short animation (slide away + fade) instead of vanishing.
 *  - On phones the drawer is a bottom sheet: drag its top down to close.
 *  - The page behind doesn't scroll while one is open.
 * Every drawer already closes when its backdrop is clicked, so we close by clicking the backdrop.
 */
import { useEffect } from "react";

const CLOSE_MS = 230;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => window.matchMedia("(max-width: 639px)").matches;

function z(el: Element) {
  const v = parseInt(getComputedStyle(el).zIndex, 10);
  return isNaN(v) ? 0 : v;
}

/** The backdrop on top (highest z-index, then last in the page). */
function topBackdrop(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(".sp-backdrop:not(.sp-closing)")];
  let best: HTMLElement | null = null;
  for (const b of all) if (!best || z(b) >= z(best)) best = b;
  return best;
}

/** The drawer that belongs to a backdrop: next to it, or inside it. */
function drawerOf(backdrop: HTMLElement): HTMLElement | null {
  const inside = backdrop.querySelector<HTMLElement>(".sp-drawer");
  if (inside) return inside;
  let n = backdrop.nextElementSibling;
  while (n && !n.classList.contains("sp-backdrop")) {
    if (n.classList.contains("sp-drawer")) return n as HTMLElement;
    const d = n.querySelector<HTMLElement>(".sp-drawer");
    if (d) return d;
    n = n.nextElementSibling;
  }
  return null;
}

function backdropOf(drawer: HTMLElement): HTMLElement | null {
  const outer = drawer.closest<HTMLElement>(".sp-backdrop");
  if (outer) return outer;
  let n: Element | null = drawer;
  while (n && n !== document.body) {
    let p = n.previousElementSibling;
    while (p) {
      if (p.classList.contains("sp-backdrop")) return p as HTMLElement;
      p = p.previousElementSibling;
    }
    n = n.parentElement;
  }
  return topBackdrop();
}

/** Play the closing animation, then let the drawer's own handler close it. */
function closeAnimated(backdrop: HTMLElement) {
  const drawer = drawerOf(backdrop);
  if (reduced()) { backdrop.click(); return; }
  backdrop.classList.add("sp-closing");
  drawer?.classList.add("sp-closing");
  window.setTimeout(() => {
    backdrop.click();
    // Some drawers refuse to close (e.g. while saving) — bring them back if still here.
    window.setTimeout(() => {
      if (!backdrop.isConnected) return;
      backdrop.classList.remove("sp-closing");
      drawer?.classList.remove("sp-closing");
      drawer?.style.removeProperty("--sp-drag");
    }, 150);
  }, CLOSE_MS);
}

export function SheetBehavior() {
  useEffect(() => {
    // Esc closes the drawer on top (not while a menu/select inside it handles Esc)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const b = topBackdrop();
      if (!b) return;
      e.preventDefault();
      closeAnimated(b);
    };

    // Tapping the dimmed area: animate first, then close.
    const onClick = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      const t = e.target as HTMLElement | null;
      if (!t || !t.classList?.contains("sp-backdrop") || t.classList.contains("sp-closing")) return;
      e.stopPropagation();
      e.preventDefault();
      closeAnimated(t);
    };

    // Phones: drag the sheet down by its top area to close.
    let drag: { el: HTMLElement; y0: number; t0: number; dy: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (!isPhone() || e.touches.length !== 1) return;
      const t = e.target as HTMLElement;
      const el = t.closest<HTMLElement>(".sp-drawer");
      if (!el || el.classList.contains("sp-closing")) return;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      const top = el.getBoundingClientRect().top;
      const y = e.touches[0].clientY;
      // the grab zone: top 56px of the sheet (handle + header), and only when nothing inside is scrolled
      if (y - top > 56) return;
      drag = { el, y0: y, t0: Date.now(), dy: 0 };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!drag) return;
      const dy = Math.max(0, e.touches[0].clientY - drag.y0);
      drag.dy = dy;
      if (dy > 4) {
        drag.el.classList.add("sp-dragging");
        drag.el.style.transform = `translateY(${dy}px)`;
        if (e.cancelable) e.preventDefault();
      }
    };
    const onTouchEnd = () => {
      if (!drag) return;
      const { el, dy, t0 } = drag;
      drag = null;
      const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.6;
      if (dy > 120 || fast) {
        const b = backdropOf(el);
        el.style.setProperty("--sp-drag", `${dy}px`);
        el.classList.remove("sp-dragging");
        el.style.transform = "";
        if (b) closeAnimated(b);
        return;
      }
      // snap back
      el.style.transition = "transform .25s cubic-bezier(.22,1,.36,1)";
      el.style.transform = "";
      window.setTimeout(() => { el.classList.remove("sp-dragging"); el.style.transition = ""; }, 260);
    };

    // Lock page scroll while any drawer is open
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.documentElement.classList.toggle("sp-locked", !!document.querySelector(".sp-drawer"));
      });
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick, true);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      mo.disconnect(); cancelAnimationFrame(raf);
      document.documentElement.classList.remove("sp-locked");
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);
  return null;
}
