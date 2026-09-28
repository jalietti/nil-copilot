import * as Sentry from '@sentry/nextjs'
import { initSentry } from '@/lib/observability/sentry'

export function register() {
  initSentry()
}

// Uncaught errors from server components, route handlers, and server actions.
export const onRequestError = Sentry.captureRequestError
