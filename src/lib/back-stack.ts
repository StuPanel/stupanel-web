"use client";

/**
 * The phone's Back button closes what is open on top (a drawer, a pop-up, a full-screen photo)
 * instead of leaving the page. Each open layer adds one history step; Back removes it and closes
 * the layer. Closing a layer another way (✕, Cancel, Save) takes its step back out quietly.
 */
import { useEffect, useRef } from "react";

type Layer = { close: () => void };
const layers: Layer[] = [];
let quiet = 0;          // history.back() calls we made ourselves — their popstate is ignored
let listening = false;

function onPop() {
  if (quiet > 0) { quiet--; return; }
  const top = layers.pop();
  if (top) { top.close(); return; }
  // A step left behind by a layer that was open when the person went to another page
  // (e.g. tapping a link in the menu): skip it, so one Back press really goes back.
  if (window.history.state?.spLayer) window.history.back();
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", onPop);
}

/** Add a history step for a layer that just opened. Returns a function to call when it closed by itself. */
export function pushLayer(close: () => void): () => void {
  listen();
  const layer: Layer = { close };
  layers.push(layer);
  const href = window.location.href;
  // Keep the router's own state on the step, so going back/forward still works for it.
  window.history.pushState({ ...(window.history.state ?? {}), spLayer: layers.length }, "", href);
  return () => {
    const i = layers.indexOf(layer);
    if (i === -1) return;            // already closed by Back
    layers.splice(i, 1);
    // Only take our step back out if we are still on it (not after the layer opened another page).
    window.setTimeout(() => {
      if (window.location.href !== href || !window.history.state?.spLayer) return;
      quiet++;
      window.history.back();
    }, 0);
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
