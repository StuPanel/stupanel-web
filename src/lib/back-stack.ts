"use client";

/**
 * The phone's Back button closes what is open on top (a drawer, a pop-up, a full-screen photo)
 * instead of leaving the page. Each open layer adds one history step; Back removes it and closes
 * the layer. A step left by a layer closed another way (✕, Cancel, Save) is skipped by Back.
 */
import { useEffect, useRef } from "react";

type Layer = { close: () => void };
const layers: Layer[] = [];
let listening = false;

function onPop() {
  const top = layers.pop();
  if (top) { top.close(); return; }
  // A step left behind by a layer that was closed another way: skip it, so one Back press really goes back.
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
  // Keep the router's own state on the step, so going back/forward still works for it.
  window.history.pushState({ ...(window.history.state ?? {}), spLayer: layers.length }, "", window.location.href);
  return () => {
    // Closed another way (✕, Cancel, a link): just forget it. Its history step stays behind and
    // is skipped when Back reaches it (see onPop). Going back here ourselves could cancel a page
    // change that a link inside the layer has just started.
    const i = layers.indexOf(layer);
    if (i !== -1) layers.splice(i, 1);
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
