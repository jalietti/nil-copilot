import { describe, expect, it } from 'vitest'
import {
  askFor,
  followerTier,
  productValueTier,
  totalFollowers,
  type DealPreferences,
} from '@/lib/deal-preferences'

describe('totalFollowers', () => {
  it('sums platforms and treats null/missing as zero', () => {
    expect(totalFollowers({ instagram: 340, tiktok: null })).toBe(340)
    expect(totalFollowers({})).toBe(0)
    expect(totalFollowers({ instagram: 100, tiktok: 200, other: 50 })).toBe(350)
  })
})

describe('followerTier boundaries', () => {
  it.each([
    [0, 'nano'],
    [999, 'nano'],
    [1_000, 'micro'],
    [9_999, 'micro'],
    [10_000, 'mid'],
    [99_999, 'mid'],
    [100_000, 'large'],
  ] as const)('%d followers → %s', (total, tier) => {
    expect(followerTier(total)).toBe(tier)
  })
})

describe('productValueTier boundaries', () => {
  it.each([
    [0, 'low'],
    [99, 'low'],
    [100, 'mid'],
    [500, 'mid'],
    [501, 'high'],
  ] as const)('$%d product → %s tier', (usd, tier) => {
    expect(productValueTier(usd)).toBe(tier)
  })
})

describe('askFor', () => {
  const prefs: DealPreferences = {
    low: 'product_only',
    mid: 'product_plus_payment',
    high: 'payment_required',
  }

  it('returns the athlete-stated ask for each tier', () => {
    expect(askFor(prefs, 'low')).toBe('product_only')
    expect(askFor(prefs, 'mid')).toBe('product_plus_payment')
    expect(askFor(prefs, 'high')).toBe('payment_required')
  })
})
