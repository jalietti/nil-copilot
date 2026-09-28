import * as Sentry from '@sentry/nextjs'
import { SENTRY_DATA_COLLECTION, scrubSentryEvent } from './scrub'

// Shared Sentry setup for client, server, and edge. Errors only — no tracing,
// no replay. Without NEXT_PUBLIC_SENTRY_DSN (local dev, tests) nothing is
// initialized and every Sentry call is a no-op.
export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: () => null,
  })
}

// For errors the app catches and turns into a friendly message — those never
// reach Next's onRequestError, so they'd otherwise be invisible. Tags must be
// ids or enums, never user content.
export function reportError(error: unknown, tags: Record<string, string>): void {
  Sentry.captureException(error, { tags })
}
