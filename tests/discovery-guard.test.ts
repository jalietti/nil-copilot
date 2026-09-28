import { describe, expect, it } from 'vitest'
import {
  DAILY_ATTEMPT_CEILING,
  DAILY_FOCUSED_ATTEMPT_CEILING,
  DAILY_FOCUSED_CAP,
  DAILY_RUN_CAP,
  STALE_RUN_MS,
  evaluateDiscoveryGuard,
  isRunInFlight,
  type GuardRun,
} from '@/lib/discovery-guard'

const now = new Date('2026-09-28T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const MIN = 60 * 1000
const HOUR = 60 * MIN

let n = 0
const run = (
  status: GuardRun['status'],
  createdAgoMs: number,
  kind: GuardRun['kind'] = 'regular',
): GuardRun => ({
  id: `run-${++n}`,
  status,
  created_at: ago(createdAgoMs),
  kind,
})

describe('evaluateDiscoveryGuard', () => {
  it('allows a first run', () => {
    expect(evaluateDiscoveryGuard([], now)).toEqual({ allowed: true, staleRunIds: [] })
  })

  it('allows when earlier runs today finished and the cap is not reached', () => {
    const runs = [run('completed', 2 * HOUR), run('failed', 1 * HOUR)]
    expect(evaluateDiscoveryGuard(runs, now)).toEqual({ allowed: true, staleRunIds: [] })
  })

  it.each(['queued', 'running'] as const)('rejects while a run is %s', (status) => {
    expect(evaluateDiscoveryGuard([run(status, 2 * MIN)], now)).toEqual({
      allowed: false,
      reason: 'in_progress',
    })
  })

  it(`rejects once ${DAILY_RUN_CAP} runs completed in the last 24h`, () => {
    const runs = [run('completed', 1 * HOUR), run('completed', 5 * HOUR), run('completed', 23 * HOUR)]
    expect(evaluateDiscoveryGuard(runs, now)).toEqual({ allowed: false, reason: 'daily_cap' })
  })

  it('does not count failed runs against the athlete', () => {
    const runs = [run('completed', 1 * HOUR), run('completed', 5 * HOUR), run('failed', 6 * HOUR)]
    expect(evaluateDiscoveryGuard(runs, now).allowed).toBe(true)
  })

  it(`stops retries after ${DAILY_ATTEMPT_CEILING} attempts in 24h even if they all failed`, () => {
    const runs = Array.from({ length: DAILY_ATTEMPT_CEILING }, (_, i) => run('failed', (i + 1) * HOUR))
    expect(evaluateDiscoveryGuard(runs, now)).toEqual({ allowed: false, reason: 'too_many_attempts' })
    expect(evaluateDiscoveryGuard(runs.slice(1), now).allowed).toBe(true)
  })

  it('does not count runs older than 24h toward the cap', () => {
    const runs = [run('completed', 1 * HOUR), run('completed', 5 * HOUR), run('completed', 25 * HOUR)]
    expect(evaluateDiscoveryGuard(runs, now).allowed).toBe(true)
  })

  it('does not let a stale running run block forever, and reports it for cleanup', () => {
    const stale = run('running', STALE_RUN_MS + MIN)
    expect(evaluateDiscoveryGuard([stale], now)).toEqual({
      allowed: true,
      staleRunIds: [stale.id],
    })
  })

  it('reports a stale run older than 24h for cleanup too', () => {
    const stale = run('queued', 3 * 24 * HOUR)
    expect(evaluateDiscoveryGuard([stale], now)).toEqual({
      allowed: true,
      staleRunIds: [stale.id],
    })
  })

  it('does not count a stale (dead) run toward the daily cap', () => {
    const runs = [run('completed', 2 * HOUR), run('completed', 3 * HOUR), run('running', 2 * HOUR)]
    expect(evaluateDiscoveryGuard(runs, now).allowed).toBe(true)
  })
})

describe('focused searches', () => {
  it(`have their own allowance of ${DAILY_FOCUSED_CAP} a day, separate from regular runs`, () => {
    const regularDone = [run('completed', 1 * HOUR), run('completed', 2 * HOUR), run('completed', 3 * HOUR)]
    expect(evaluateDiscoveryGuard(regularDone, now, 'regular')).toEqual({ allowed: false, reason: 'daily_cap' })
    expect(evaluateDiscoveryGuard(regularDone, now, 'focused').allowed).toBe(true)

    const focusedDone = [run('completed', 1 * HOUR, 'focused'), run('completed', 2 * HOUR, 'focused')]
    expect(evaluateDiscoveryGuard(focusedDone, now, 'focused')).toEqual({ allowed: false, reason: 'focused_cap' })
    expect(evaluateDiscoveryGuard(focusedDone, now, 'regular').allowed).toBe(true)
  })

  it('still allow only one run of either kind in flight', () => {
    expect(evaluateDiscoveryGuard([run('running', MIN)], now, 'focused')).toEqual({
      allowed: false,
      reason: 'in_progress',
    })
    expect(evaluateDiscoveryGuard([run('queued', MIN, 'focused')], now, 'regular')).toEqual({
      allowed: false,
      reason: 'in_progress',
    })
  })

  it('have their own failure ceiling', () => {
    const failed = Array.from({ length: DAILY_FOCUSED_ATTEMPT_CEILING }, (_, i) => run('failed', (i + 1) * HOUR, 'focused'))
    expect(evaluateDiscoveryGuard(failed, now, 'focused')).toEqual({ allowed: false, reason: 'too_many_attempts' })
    expect(evaluateDiscoveryGuard(failed, now, 'regular').allowed).toBe(true)
  })
})

describe('isRunInFlight', () => {
  it('is false for finished runs and true only within the stale window', () => {
    expect(isRunInFlight({ status: 'completed', created_at: ago(MIN) }, now)).toBe(false)
    expect(isRunInFlight({ status: 'running', created_at: ago(STALE_RUN_MS - MIN) }, now)).toBe(true)
    expect(isRunInFlight({ status: 'running', created_at: ago(STALE_RUN_MS) }, now)).toBe(false)
  })
})
