"use client";

/**
 * The "…" menu panel of a list row, drawn on top of the page (not inside the row's card),
 * so a card with rounded, clipped corners never cuts it off. Opens below the button, or above
 * it when there is no room below (e.g. the last row on a phone). Closes on outside tap,
 * scroll, resize or Esc.
 */
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function FloatMenu({ anchor, open, onClose, width = 176, children }: {
  /** The "…" button (or its wrapper). */
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean; onClose: () => void; width?: number;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const a = anchor.current?.getBoundingClientRect();
    if (!a) return;
    const h = panel.current?.offsetHeight ?? 160;
    const gap = 6, edge = 8;
    const below = a.bottom + gap + h <= window.innerHeight - edge;
    const top = below ? a.bottom + gap : Math.max(edge, a.top - gap - h);
    const left = Math.min(window.innerWidth - width - edge, Math.max(edge, a.right - width));
    setPos({ top, left });
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const gone = () => onClose();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", gone, true);
    window.addEventListener("resize", gone);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", gone, true);
      window.removeEventListener("resize", gone);
    };
  }, [open, onClose, anchor]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={panel} role="menu" onClick={e => e.stopPropagation()}
      style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? "visible" : "hidden" }}
      className="z-[70] bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] p-1 sp-pop-in">
      {children}
    </div>,
    document.body,
  );
}
