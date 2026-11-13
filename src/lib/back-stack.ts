"use client";

/**
 * The phone's Back button closes what is open on top (a drawer, a pop-up, a full-screen photo)
 * instead of leaving the page. Each open layer adds one history step; Back removes it and closes
 * the layer.
 *
 * A layer closed another way (✕, Cancel, Save, a link) leaves its step behind — going back by
 * ourselves could cancel a page change a link has just started. Such left-over steps look exactly
 * like the page, so Back skips them: one press always does one visible thing.
 */
import { useEffect, useRef } from "react";

type Layer = { close: () => void; token: number };
const layers: Layer[] = [];
let nextToken = 1;
/** We are on a left-over step (it looks like the page under it). */
let onLeftOver = false;
/** Going down through left-over steps after a Back press; remembers where the press started. */
let skipping: { fromLeftOver: boolean } | null = null;
let ours = false;
let listening = false;

const stepToken = (): number | undefined => window.history.state?.spLayer;

function onPop() {
  const landedOnLeftOver = !!stepToken() && !layers.some(l => l.token === stepToken());
  if (skipping) {
    if (landedOnLeftOver) { window.history.back(); return; }
    const again = skipping.fromLeftOver;
    skipping = null; onLeftOver = false;
    if (again) window.history.back();
    return;
  }
  const top = layers.pop();
  if (top) { top.close(); onLeftOver = landedOnLeftOver; return; }
  if (landedOnLeftOver) { skipping = { fromLeftOver: onLeftOver }; window.history.back(); return; }
  // Left a left-over step for the page it looked like: go one more, so the press does something.
  if (onLeftOver) { onLeftOver = false; window.history.back(); return; }
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", onPop);
  // Any other new step (opening a page) means we are no longer on a left-over step.
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    if (!ours) onLeftOver = false;
    return push(...args);
  };
}

/** Add a history step for a layer that just opened. Returns a function to call when it closed by itself. */
export function pushLayer(close: () => void): () => void {
  listen();
  const layer: Layer = { close, token: nextToken++ };
  layers.push(layer);
  ours = true;
  // Keep the router's own state on the step, so going back/forward still works for it.
  window.history.pushState({ ...(window.history.state ?? {}), spLayer: layer.token }, "", window.location.href);
  ours = false;
  onLeftOver = false;
  return () => {
    const i = layers.indexOf(layer);
    if (i === -1) return; // closed by Back
    layers.splice(i, 1);
    if (stepToken() === layer.token) onLeftOver = true;
  };
}

/** Back closes this (while `open`). */
export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    if (!open) return;
    const done = pushLayer(() => closeRef.current());
    return done;
  }, [open]);
}
