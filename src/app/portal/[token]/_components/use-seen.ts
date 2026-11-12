"use client";

/**
 * Which photos the client has already looked at, and where they stopped — so a big gallery
 * shows "Seen 320 of 800" and offers "Continue where you left off" next time.
 * Kept on this device (browser storage); a photo the client marked counts as seen anyway.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type LastSpot = { a: string; p: string };
type Stored = { s?: string[]; l?: LastSpot | null };

const key = (galleryId: string) => `sp-seen:${galleryId}`;

function read(galleryId: string): Stored {
  try { return JSON.parse(localStorage.getItem(key(galleryId)) || "{}") as Stored; } catch { return {}; }
}

export function useSeen(galleryId: string | undefined) {
  const seen = useRef<Set<string>>(new Set());
  const last = useRef<LastSpot | null>(null);
  /** Bumps when the seen set grows, so counts recompute. */
  const [version, setVersion] = useState(0);
  /** Where they stopped last time (read once when the gallery opens). */
  const [resume, setResume] = useState<LastSpot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!galleryId) return;
    const d = read(galleryId);
    seen.current = new Set(Array.isArray(d.s) ? d.s : []);
    last.current = d.l && d.l.a && d.l.p ? d.l : null;
    setResume(last.current);
    setVersion(v => v + 1);
  }, [galleryId]);

  const persist = useCallback(() => {
    if (!galleryId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { localStorage.setItem(key(galleryId), JSON.stringify({ s: [...seen.current], l: last.current })); } catch { /* storage off — fine */ }
    }, 500);
  }, [galleryId]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const markSeen = useCallback((ids: string[]) => {
    let added = false;
    for (const id of ids) if (!seen.current.has(id)) { seen.current.add(id); added = true; }
    if (added) { setVersion(v => v + 1); persist(); }
  }, [persist]);

  const setLast = useCallback((spot: LastSpot) => {
    if (last.current?.a === spot.a && last.current?.p === spot.p) return;
    last.current = spot;
    persist();
  }, [persist]);

  const isSeen = useCallback((id: string) => seen.current.has(id), []);

  return { isSeen, version, resume, clearResume: () => setResume(null), markSeen, setLast };
}
