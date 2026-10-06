import { describe, expect, it } from 'vitest'
import {
  DAILY_CALL_CAPS,
  DAILY_DRAFT_CAP,
  DAILY_INTERVIEW_CAP,
  USAGE_CAP_MESSAGES,
  isOverDailyCap,
} from '@/lib/usage-guard'

describe('isOverDailyCap', () => {
  it('allows drafting until the daily draft cap is reached', () => {
    expect(isOverDailyCap('draft', 0)).toBe(false)
    expect(isOverDailyCap('draft', DAILY_DRAFT_CAP - 1)).toBe(false)
  })

  it('blocks drafting once the daily draft cap is reached', () => {
    expect(isOverDailyCap('draft', DAILY_DRAFT_CAP)).toBe(true)
    expect(isOverDailyCap('draft', DAILY_DRAFT_CAP + 5)).toBe(true)
  })

  it('counts interview submissions as two Claude calls each', () => {
    expect(DAILY_CALL_CAPS.interview).toBe(DAILY_INTERVIEW_CAP * 2)
    expect(isOverDailyCap('interview', DAILY_INTERVIEW_CAP * 2 - 2)).toBe(false)
    expect(isOverDailyCap('interview', DAILY_INTERVIEW_CAP * 2)).toBe(true)
  })

  it('names the limit in each message so the athlete knows what happened', () => {
    expect(USAGE_CAP_MESSAGES.draft).toContain(String(DAILY_DRAFT_CAP))
    expect(USAGE_CAP_MESSAGES.interview).toContain('tomorrow')
  })
})
