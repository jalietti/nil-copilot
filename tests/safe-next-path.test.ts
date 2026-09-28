import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/safe-next-path'

describe('safeNextPath', () => {
  it('keeps same-site paths', () => {
    expect(safeNextPath('/reset-password')).toBe('/reset-password')
    expect(safeNextPath('/deals/abc?x=1')).toBe('/deals/abc?x=1')
  })

  it('falls back to onboarding for missing or off-site targets', () => {
    for (const bad of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', 'reset-password']) {
      expect(safeNextPath(bad)).toBe('/onboarding')
    }
  })
})
