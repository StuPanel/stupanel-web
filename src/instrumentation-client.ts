/**
 * Sentry in the browser (Faisal 24-NOV-2026): crashes on any StuPanel page are reported. Off unless
 * NEXT_PUBLIC_SENTRY_DSN is set (Vercel). No replays, no tracing, no form values or cookies.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "production",
    tracesSampleRate: 0,
    // Noise from browser extensions, old tabs after a deploy and lost connections.
    ignoreErrors: ["ResizeObserver loop", "ChunkLoadError", "Loading chunk", "Failed to fetch", "NetworkError", "Load failed", "AbortError"],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
