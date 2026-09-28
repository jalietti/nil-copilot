import { describe, expect, it } from 'vitest'
import { dealVisaReminder, getVisaGuidance } from '@/lib/visa-guidance'

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

describe('dealVisaReminder', () => {
  it('reminds F-1 and other-visa athletes once a deal is live, with the disclaimer', () => {
    for (const status of ['f1_visa', 'other_visa'] as const) {
      for (const deal of ['reply_received', 'negotiating', 'agreed'] as const) {
        const reminder = dealVisaReminder(status, deal)
        expect(reminder?.message).toMatch(/DSO/)
        expect(reminder?.disclaimer).toMatch(/not legal or immigration advice/)
      }
    }
  })

  it('stays quiet before anything is on the table, after it ends, and for other statuses', () => {
    expect(dealVisaReminder('f1_visa', 'draft')).toBeNull()
    expect(dealVisaReminder('f1_visa', 'sent')).toBeNull()
    expect(dealVisaReminder('f1_visa', 'dead')).toBeNull()
    for (const status of ['us_citizen', 'permanent_resident', 'prefer_not_to_say'] as const) {
      expect(dealVisaReminder(status, 'negotiating')).toBeNull()
    }
    expect(dealVisaReminder(null, 'negotiating')).toBeNull()
  })
})
