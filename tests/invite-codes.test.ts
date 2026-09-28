import { describe, expect, it } from 'vitest'
import { checkInviteCode, isInviteRejection, normalizeInviteCode } from '@/lib/invite-codes'

describe('checkInviteCode', () => {
  it('accepts a live code with uses left or no cap', () => {
    expect(checkInviteCode({ max_uses: 5, uses: 4, revoked_at: null })).toBeNull()
    expect(checkInviteCode({ max_uses: null, uses: 999, revoked_at: null })).toBeNull()
  })

  it('rejects a missing or revoked code as invalid', () => {
    expect(checkInviteCode(null)).toBe('invalid')
    expect(checkInviteCode({ max_uses: null, uses: 0, revoked_at: '2026-09-01T00:00:00Z' })).toBe(
      'invalid',
    )
  })

  it('rejects a used-up code as exhausted', () => {
    expect(checkInviteCode({ max_uses: 3, uses: 3, revoked_at: null })).toBe('exhausted')
  })
})

describe('normalizeInviteCode / isInviteRejection', () => {
  it('uppercases and trims', () => {
    expect(normalizeInviteCode('  team2026\n')).toBe('TEAM2026')
  })

  it("recognizes GoTrue's trigger-failure error", () => {
    expect(isInviteRejection('Database error saving new user')).toBe(true)
    expect(isInviteRejection('Password should be at least 8 characters')).toBe(false)
  })
})
