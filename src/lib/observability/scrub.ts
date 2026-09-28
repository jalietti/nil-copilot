import type { BrowserOptions, ErrorEvent } from '@sentry/nextjs'

// What may leave this app for Sentry and PostHog. Athletes put their
// citizenship/visa status, pasted brand replies, and draft emails into this
// system; none of it may reach either service. Rather than trust SDK defaults
// (Sentry v11 collects request bodies, AI prompts/outputs, and stack-frame
// locals by default), everything is turned off and events are scrubbed again
// before sending.

// Passed to Sentry.init on client and server.
export const SENTRY_DATA_COLLECTION: NonNullable<BrowserOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
}

const SAFE_CONTEXTS = new Set(['runtime', 'os', 'browser', 'device', 'app', 'culture', 'trace', 'nextjs'])
const SAFE_BREADCRUMB_DATA = new Set(['url', 'method', 'status_code', 'from', 'to'])

function stripQuery(url: string | undefined): string | undefined {
  return url?.split(/[?#]/)[0]
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = { url: stripQuery(event.request.url), method: event.request.method }
  }
  event.user = event.user?.id ? { id: String(event.user.id) } : undefined
  delete event.extra

  if (event.contexts) {
    for (const key of Object.keys(event.contexts)) {
      if (!SAFE_CONTEXTS.has(key)) delete event.contexts[key]
    }
  }

  event.breadcrumbs = event.breadcrumbs
    ?.filter((crumb) => crumb.category !== 'console' && crumb.category !== 'ui.input')
    .map((crumb) => ({
      ...crumb,
      data: crumb.data
        ? Object.fromEntries(
            Object.entries(crumb.data)
              .filter(([key]) => SAFE_BREADCRUMB_DATA.has(key))
              .map(([key, value]) => [key, typeof value === 'string' ? stripQuery(value) : value]),
          )
        : undefined,
    }))

  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars
  }
  return event
}

// PostHog properties: ids, counts, enums, and booleans only. Anything else —
// including any free-text string — is dropped.
const SAFE_STRING = /^[A-Za-z0-9_:-]{1,64}$/

export function scrubAnalyticsProperties(
  props: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'boolean') safe[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value
    else if (typeof value === 'string' && SAFE_STRING.test(value)) safe[key] = value
  }
  return safe
}
