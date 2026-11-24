/** Sentry on the server side of the web app (Vercel functions). Off unless NEXT_PUBLIC_SENTRY_DSN is set. */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.VERCEL_ENV || "production", tracesSampleRate: 0 });
}

export const onRequestError = Sentry.captureRequestError;
