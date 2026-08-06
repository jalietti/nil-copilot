import { describe, expect, it } from 'vitest'
import { onboardingSchema } from '@/lib/validators/onboarding'

const valid = {
  full_name: 'Alex Rivera',
  school: 'Example State',
  sport: 'Track & Field',
  division: 'D2',
  instagram_followers: 340,
  tiktok_followers: null,
  other_followers: null,
  citizenship_status: 'us_citizen' as const,
}

describe('onboardingSchema', () => {
  it('accepts a complete valid payload', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true)
  })

  it('requires citizenship status — it cannot be skipped', () => {
    const { citizenship_status: _dropped, ...rest } = valid
    expect(onboardingSchema.safeParse(rest).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, citizenship_status: 'unknown' }).success).toBe(false)
  })

  it('rejects blank required fields after trimming', () => {
    expect(onboardingSchema.safeParse({ ...valid, full_name: '   ' }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, school: '' }).success).toBe(false)
  })

  it('rejects negative or fractional follower counts but allows null', () => {
    expect(onboardingSchema.safeParse({ ...valid, instagram_followers: -1 }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, instagram_followers: 1.5 }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, instagram_followers: null }).success).toBe(true)
  })
})
