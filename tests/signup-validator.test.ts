import { describe, expect, it } from 'vitest'
import { signupSchema } from '@/lib/validators/signup'

const valid = {
  email: 'alex@example.test',
  password: 'long-enough-pw',
  inviteCode: 'localdev1',
  acceptedTerms: true,
}

describe('signupSchema', () => {
  it('accepts a complete signup that agreed to the terms', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
  })

  it.each([false, undefined, 'true', 1])('rejects a signup whose acceptedTerms is %s', (acceptedTerms) => {
    const result = signupSchema.safeParse({ ...valid, acceptedTerms })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Agree to the Terms and Privacy Policy to continue')
  })

  it('still requires an invite code', () => {
    expect(signupSchema.safeParse({ ...valid, inviteCode: ' ' }).success).toBe(false)
  })
})
