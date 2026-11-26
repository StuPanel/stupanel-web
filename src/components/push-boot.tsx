"use client";
/**
 * In the app and the member panel: the install details an iPhone needs for notifications (Add to Home Screen),
 * and a quiet check that this device's notification address belongs to whoever is signed in now.
 */
import { useEffect } from "react";
import { pushRefresh } from "@/lib/push";
// Loaded here so the browser's install offer is caught on whatever page the person opens first.
import "@/components/install-app";

export function PushBoot() {
  useEffect(() => { const id = setTimeout(() => { void pushRefresh(); }, 4000); return () => clearTimeout(id); }, []);
  return (
    <>
      <link rel="manifest" href="/app.webmanifest" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="StuPanel" />
      <meta name="theme-color" content="#7D5CEF" />
    </>
  );
}
