import { describe, expect, it } from 'vitest'
import { relativeTime } from '@/lib/relative-time'

const now = new Date('2026-10-05T18:00:00')

describe('relativeTime', () => {
  it('says "today" for the same calendar day, regardless of time', () => {
    expect(relativeTime(new Date('2026-10-05T01:00:00'), now)).toBe('today')
  })

  it('says "yesterday" for the previous calendar day', () => {
    expect(relativeTime(new Date('2026-10-04T23:59:00'), now)).toBe('yesterday')
  })

  it('counts days ago from 2 through 30', () => {
    expect(relativeTime(new Date('2026-10-03T12:00:00'), now)).toBe('2 days ago')
    expect(relativeTime(new Date('2026-09-05T12:00:00'), now)).toBe('30 days ago')
  })

  it('falls back to a short month+day beyond 30 days', () => {
    expect(relativeTime(new Date('2026-09-04T12:00:00'), now)).toBe('Sep 4')
  })

  it('includes the year when the date is not in the current year', () => {
    expect(relativeTime(new Date('2025-08-12T12:00:00'), now)).toBe('Aug 12, 2025')
  })

  it('accepts an ISO string', () => {
    expect(relativeTime('2026-10-05T01:00:00', now)).toBe('today')
  })
})
