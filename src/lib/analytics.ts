import { PostHog } from 'posthog-node'
import type { DealStatus } from './supabase/types'
import { scrubAnalyticsProperties } from './observability/scrub'
import { reportError } from './observability/sentry'

// Pilot funnel events. Server-side only (no PostHog browser SDK, so no
// autocapture or session replay that could pick up form contents). The
// distinct id is the athlete's uuid. Properties are ids, counts, enums, and
// booleans — enforced by these types and again by scrubAnalyticsProperties.
export interface AnalyticsEvents {
  interview_completed: { first_time: boolean; voice_profile_generated: boolean }
  discovery_run_started: { run_id: string; kind: 'regular' | 'focused' }
  discovery_run_completed: {
    run_id: string
    kind: 'regular' | 'focused'
    brands_found: number
    matches_created: number
    matches_with_email: number
  }
  match_dismissed: { match_id: string; brand_id: string }
  contact_email_added: { match_id: string; brand_id: string }
  search_preferences_updated: { values_count: number; industries_count: number }
  outreach_draft_generated: { deal_id: string; brand_id: string; voice_profile: boolean }
  follow_up_draft_generated: { deal_id: string; voice_profile: boolean }
  draft_regenerated: { deal_id: string; kind: 'outreach' | 'counter' | 'follow_up' }
  mailto_clicked: { deal_id: string; kind: 'outreach' | 'counter' | 'follow_up' }
  reply_pasted: { deal_id: string }
  counter_draft_generated: { deal_id: string; voice_profile: boolean }
  account_deleted: Record<string, never>
  deal_status_changed: { deal_id: string; from: DealStatus | 'none'; to: DealStatus }
}

let client: PostHog | null | undefined

function getClient(): PostHog | null {
  if (client === undefined) {
    const key = process.env.POSTHOG_KEY
    client = key
      ? new PostHog(key, {
          host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
          flushAt: 1,
          flushInterval: 0,
          disableGeoip: true,
        })
      : null
  }
  return client
}

// No-op without POSTHOG_KEY. Never throws — analytics must not break the app.
export async function track<E extends keyof AnalyticsEvents>(
  event: E,
  athleteId: string,
  properties: AnalyticsEvents[E],
): Promise<void> {
  const posthog = getClient()
  if (!posthog) return
  try {
    await posthog.captureImmediate({
      distinctId: athleteId,
      event,
      properties: scrubAnalyticsProperties(properties as unknown as Record<string, unknown>),
      disableGeoip: true,
    })
  } catch (error) {
    reportError(error, { area: 'analytics', event })
  }
}
