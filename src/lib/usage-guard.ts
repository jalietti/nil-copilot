import { createAdminClient } from './supabase/admin'
import { reportError } from './observability/sentry'
import { dailyWindowStart } from './discovery-guard'

// Per-athlete daily limits on the Claude calls an athlete can trigger on
// demand. Every draft and interview submission spends real Anthropic budget,
// so the cap is counted from the owner-only api_usage table (0011) on the
// server — never trusted to client state. Discovery has its own limits in
// discovery-guard.ts.

export type CappedSource = 'draft' | 'interview'

export const DAILY_DRAFT_CAP = 30
export const DAILY_INTERVIEW_CAP = 5
// Each interview submission makes two calls (tags + voice profile).
const INTERVIEW_CALLS_PER_SUBMISSION = 2

export const DAILY_CALL_CAPS: Record<CappedSource, number> = {
  draft: DAILY_DRAFT_CAP,
  interview: DAILY_INTERVIEW_CAP * INTERVIEW_CALLS_PER_SUBMISSION,
}

export const USAGE_CAP_MESSAGES: Record<CappedSource, string> = {
  draft: `You've written ${DAILY_DRAFT_CAP} drafts today — that's the daily limit. Try again tomorrow.`,
  interview: 'You’ve updated your interview a lot today — try again tomorrow.',
}

const CHECK_FAILED = 'Couldn’t check your usage just now — try again in a minute.'

export function isOverDailyCap(source: CappedSource, callsToday: number): boolean {
  return callsToday >= DAILY_CALL_CAPS[source]
}

// Returns a message for the athlete if they're out of calls for today, or null
// if they may go ahead. Fails closed: if the count can't be read, no call is
// made, so an outage can't turn into unlimited spend.
export async function checkDailyAllowance(
  source: CappedSource,
  athleteId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const { count, error } = await createAdminClient()
    .from('api_usage')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', athleteId)
    .eq('source', source)
    .eq('provider', 'anthropic')
    .gte('created_at', dailyWindowStart(now))
  if (error || count === null) {
    reportError(error ?? new Error('api_usage count missing'), { area: 'usage-guard', source })
    return CHECK_FAILED
  }
  return isOverDailyCap(source, count) ? USAGE_CAP_MESSAGES[source] : null
}
