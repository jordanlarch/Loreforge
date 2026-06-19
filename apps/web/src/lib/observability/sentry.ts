/**
 * Sentry wiring — enable when NEXT_PUBLIC_SENTRY_DSN is set.
 * Full @sentry/nextjs init ships in P1; P0 keeps a no-op stub for CI/build.
 */
export function initSentry() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  // import * as Sentry from "@sentry/nextjs" when DSN is configured
}
