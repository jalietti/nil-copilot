import type { DiscoveryRunKind, DiscoveryRunStatus } from './supabase/types'

// Server-side limits on starting a discovery run. Each run spends real Tavily +
// Anthropic budget, so these are enforced against the database in the server
// action — never trusted to client state.

export const DAILY_RUN_CAP = 3
// Failed runs are on us, so they don't use up the athlete's daily runs — but
// a run that fails every time mustn't mean unlimited free retries (each one
// still spends API credits), so all attempts together are capped too.
export const DAILY_ATTEMPT_CEILING = 6
// Focused one-off searches have their own allowance on top of regular runs.
export const DAILY_FOCUSED_CAP = 2
export const DAILY_FOCUSED_ATTEMPT_CEILING = 4
// A queued/running run older than this is treated as dead (the job crashed or
// was dropped) so it can't lock the athlete out forever. A healthy run finishes
// in a few minutes even with Inngest retries.
export const STALE_RUN_MS = 30 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface GuardRun {
  id: string
  status: DiscoveryRunStatus
  created_at: string
  kind: DiscoveryRunKind
}

export type DiscoveryBlockReason = 'in_progress' | 'daily_cap' | 'focused_cap' | 'too_many_attempts'

export type DiscoveryGuardResult =
  | { allowed: true; staleRunIds: string[] }
  | { allowed: false; reason: DiscoveryBlockReason }

export const DISCOVERY_BLOCK_MESSAGES: Record<DiscoveryBlockReason, string> = {
  in_progress: 'A run is already in progress — give it a few minutes.',
  daily_cap: `You've used your ${DAILY_RUN_CAP} runs for today — try again tomorrow.`,
  focused_cap: `You've used your ${DAILY_FOCUSED_CAP} focused searches for today — try again tomorrow.`,
  too_many_attempts:
    'Discovery has hit problems a few times today (they didn’t count against your runs). We’ve been alerted — please try again tomorrow.',
}

export function isRunInFlight(run: Pick<GuardRun, 'status' | 'created_at'>, now: Date): boolean {
  if (run.status !== 'queued' && run.status !== 'running') return false
  return now.getTime() - new Date(run.created_at).getTime() < STALE_RUN_MS
}

const LIMITS: Record<DiscoveryRunKind, { cap: number; ceiling: number; capReason: DiscoveryBlockReason }> = {
  regular: { cap: DAILY_RUN_CAP, ceiling: DAILY_ATTEMPT_CEILING, capReason: 'daily_cap' },
  focused: { cap: DAILY_FOCUSED_CAP, ceiling: DAILY_FOCUSED_ATTEMPT_CEILING, capReason: 'focused_cap' },
}

// `runs` must include every queued/running run (any age) plus every run
// created in the last 24 hours. Only one run of either kind may be in flight;
// the daily allowances are counted per kind.
export function evaluateDiscoveryGuard(
  runs: GuardRun[],
  now: Date,
  kind: DiscoveryRunKind = 'regular',
): DiscoveryGuardResult {
  if (runs.some((run) => isRunInFlight(run, now))) {
    return { allowed: false, reason: 'in_progress' }
  }

  const { cap, ceiling, capReason } = LIMITS[kind]
  const since = now.getTime() - DAY_MS
  const today = runs.filter(
    (run) => run.kind === kind && new Date(run.created_at).getTime() >= since,
  )
  if (today.length >= ceiling) return { allowed: false, reason: 'too_many_attempts' }
  // Runs that failed, or died and went stale, don't count against the athlete.
  const counted = today.filter(
    (run) => run.status === 'completed' || isRunInFlight(run, now),
  ).length
  if (counted >= cap) return { allowed: false, reason: capReason }

  const staleRunIds = runs
    .filter((run) => run.status === 'queued' || run.status === 'running')
    .map((run) => run.id)
  return { allowed: true, staleRunIds }
}

export function dailyWindowStart(now: Date): string {
  return new Date(now.getTime() - DAY_MS).toISOString()
}
