import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import {
  SENTRY_DATA_COLLECTION,
  scrubAnalyticsProperties,
  scrubSentryEvent,
} from '@/lib/observability/scrub'

const VISA = 'f1_visa'
const REPLY = 'Hi Alex, we can offer $150 plus product for two posts.'
const DRAFT = 'Hey Project Reef team, I have been using your zinc stick...'

describe('Sentry data collection', () => {
  it('turns off every collector that could carry request bodies, AI prompts, or locals', () => {
    expect(SENTRY_DATA_COLLECTION).toMatchObject({
      httpBodies: [],
      cookies: false,
      httpHeaders: false,
      urlQueryParams: false,
      userInfo: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    })
  })
})

describe('scrubSentryEvent', () => {
  const event = (): ErrorEvent =>
    ({
      type: undefined,
      request: {
        url: 'https://app.test/deals/abc?token=secret',
        method: 'POST',
        data: JSON.stringify([REPLY]),
        cookies: { 'sb-access-token': 'jwt' },
        headers: { cookie: 'x', 'user-agent': 'ua' },
        query_string: 'token=secret',
      },
      user: { id: 'athlete-1', email: 'a@x.test', ip_address: '1.2.3.4' },
      extra: { draft: DRAFT },
      contexts: { runtime: { name: 'node' }, profile: { citizenship_status: VISA } },
      breadcrumbs: [
        { category: 'console', message: `draft: ${DRAFT}` },
        { category: 'ui.input', message: 'textarea' },
        { category: 'fetch', data: { url: '/deals/abc?x=1', method: 'POST', body: REPLY } },
        { category: 'navigation', data: { from: '/brands', to: '/deals/abc' } },
      ],
      exception: {
        values: [
          {
            type: 'Error',
            stacktrace: { frames: [{ function: 'saveBrandReply', vars: { trimmed: REPLY } }] },
          },
        ],
      },
    }) as unknown as ErrorEvent

  it('removes bodies, cookies, headers, query strings, extra, and non-runtime contexts', () => {
    const scrubbed = scrubSentryEvent(event())
    expect(scrubbed.request).toEqual({ url: 'https://app.test/deals/abc', method: 'POST' })
    expect(scrubbed.user).toEqual({ id: 'athlete-1' })
    expect(scrubbed.extra).toBeUndefined()
    expect(scrubbed.contexts).toEqual({ runtime: { name: 'node' } })
  })

  it('drops console/input breadcrumbs and non-allowlisted breadcrumb data', () => {
    const scrubbed = scrubSentryEvent(event())
    expect(scrubbed.breadcrumbs).toEqual([
      { category: 'fetch', data: { url: '/deals/abc', method: 'POST' } },
      { category: 'navigation', data: { from: '/brands', to: '/deals/abc' } },
    ])
  })

  it('strips stack-frame locals', () => {
    const frame = scrubSentryEvent(event()).exception!.values![0].stacktrace!.frames![0]
    expect(frame).toEqual({ function: 'saveBrandReply' })
  })

  it('leaves no trace of reply text, draft text, or visa status anywhere in the event', () => {
    const serialized = JSON.stringify(scrubSentryEvent(event()))
    expect(serialized).not.toContain(REPLY)
    expect(serialized).not.toContain('zinc stick')
    expect(serialized).not.toContain(VISA)
    expect(serialized).not.toContain('secret')
  })
})

describe('scrubAnalyticsProperties', () => {
  it('keeps ids, counts, enums, and booleans', () => {
    expect(
      scrubAnalyticsProperties({
        deal_id: '6bb23dba-ed69-4151-bff4-ba375924d8a7',
        matches_with_email: 2,
        to: 'reply_received',
        first_time: true,
      }),
    ).toEqual({
      deal_id: '6bb23dba-ed69-4151-bff4-ba375924d8a7',
      matches_with_email: 2,
      to: 'reply_received',
      first_time: true,
    })
  })

  it('drops free text, objects, and non-finite numbers even if a caller passes them', () => {
    expect(
      scrubAnalyticsProperties({
        reply: REPLY,
        body: DRAFT,
        nested: { citizenship_status: VISA },
        list: [VISA],
        n: Number.NaN,
      }),
    ).toEqual({})
  })
})

const capture = vi.fn()
vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function PostHog() {
    return { captureImmediate: capture }
  }),
}))

describe('track', () => {
  beforeEach(() => {
    vi.resetModules()
    capture.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is a no-op without POSTHOG_KEY', async () => {
    vi.stubEnv('POSTHOG_KEY', '')
    const { track } = await import('@/lib/analytics')
    await track('reply_pasted', 'athlete-1', { deal_id: 'deal-1' })
    expect(capture).not.toHaveBeenCalled()
  })

  it('sends the event with the athlete id and scrubbed properties when configured', async () => {
    vi.stubEnv('POSTHOG_KEY', 'phc_test')
    const { track } = await import('@/lib/analytics')
    await track('deal_status_changed', 'athlete-1', {
      deal_id: 'deal-1',
      from: 'sent',
      to: 'reply_received',
      // Not allowed by the type; proves the runtime scrub still catches it.
      ...({ reply: REPLY } as object),
    })
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'athlete-1',
      event: 'deal_status_changed',
      properties: { deal_id: 'deal-1', from: 'sent', to: 'reply_received' },
      disableGeoip: true,
    })
  })

  it('never throws when PostHog fails', async () => {
    vi.stubEnv('POSTHOG_KEY', 'phc_test')
    capture.mockRejectedValueOnce(new Error('network down'))
    const { track } = await import('@/lib/analytics')
    await expect(track('reply_pasted', 'athlete-1', { deal_id: 'deal-1' })).resolves.toBeUndefined()
  })
})
