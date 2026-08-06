import { describe, expect, it } from 'vitest'
import { getVisaGuidance } from '@/lib/visa-guidance'

describe('getVisaGuidance', () => {
  it('gives real guidance, not silence, for every visa-affected status', () => {
    for (const status of ['f1_visa', 'other_visa', 'prefer_not_to_say'] as const) {
      const guidance = getVisaGuidance(status)
      expect(guidance).not.toBeNull()
      expect(guidance!.headline.length).toBeGreaterThan(0)
      expect(guidance!.points.length).toBeGreaterThan(0)
      expect(guidance!.disclaimer).toContain('not legal or immigration advice')
      expect(guidance!.disclaimer).toMatch(/DSO|international student office/)
    }
  })

  it('points F-1 students at their DSO before any deal', () => {
    const guidance = getVisaGuidance('f1_visa')!
    expect(guidance.points.join(' ')).toMatch(/DSO|immigration attorney/)
  })

  it('returns null for statuses with no immigration restriction', () => {
    expect(getVisaGuidance('us_citizen')).toBeNull()
    expect(getVisaGuidance('permanent_resident')).toBeNull()
  })
})
