import { describe, expect, it } from 'vitest'
import { FOLLOW_UP_AFTER_MS, needsFollowUp, nextDealStatus, type FollowUpDeal } from '@/lib/deal-follow-up'
import { buildFollowUpPrompt } from '@/lib/draft-email'
import type { Brand, Interview, Profile } from '@/lib/supabase/types'

const now = new Date('2026-09-28T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

const sentDeal = (overrides: Partial<FollowUpDeal> = {}): FollowUpDeal => ({
  status: 'sent',
  sent_at: ago(6 * DAY),
  updated_at: ago(6 * DAY),
  messages: [{ direction: 'outbound_draft', created_at: ago(6 * DAY) }],
  ...overrides,
})

describe('needsFollowUp (5 days, no inbound)', () => {
  it('prompts for a deal sent 5+ days ago with no pasted reply', () => {
    expect(needsFollowUp(sentDeal(), now)).toBe(true)
    expect(needsFollowUp(sentDeal({ sent_at: ago(FOLLOW_UP_AFTER_MS) }), now)).toBe(true)
  })

  it('waits until ~5 days have passed', () => {
    expect(needsFollowUp(sentDeal({ sent_at: ago(4 * DAY) }), now)).toBe(false)
  })

  it('never prompts once a reply has been pasted', () => {
    const deal = sentDeal({
      messages: [
        { direction: 'outbound_draft', created_at: ago(9 * DAY) },
        { direction: 'inbound_pasted', created_at: ago(8 * DAY) },
      ],
    })
    expect(needsFollowUp(deal, now)).toBe(false)
  })

  it.each(['draft', 'reply_received', 'negotiating', 'agreed', 'closed', 'dead'] as const)(
    'only applies to sent deals (not %s)',
    (status) => {
      expect(needsFollowUp(sentDeal({ status }), now)).toBe(false)
    },
  )

  it('restarts the clock when a follow-up is drafted or sent', () => {
    const drafted = sentDeal({
      messages: [
        { direction: 'outbound_draft', created_at: ago(8 * DAY) },
        { direction: 'outbound_draft', created_at: ago(1 * DAY) },
      ],
    })
    expect(needsFollowUp(drafted, now)).toBe(false)
    expect(needsFollowUp(sentDeal({ sent_at: ago(1 * DAY) }), now)).toBe(false)
  })

  it('falls back to updated_at for deals sent before sent_at existed', () => {
    expect(needsFollowUp(sentDeal({ sent_at: null, updated_at: ago(7 * DAY) }), now)).toBe(true)
    expect(needsFollowUp(sentDeal({ sent_at: null, updated_at: ago(2 * DAY) }), now)).toBe(false)
  })
})

describe('prompt branches -> deal state', () => {
  it('"They replied": pasting the reply moves sent -> reply_received, then counter -> negotiating', () => {
    const replied = nextDealStatus('sent', 'reply_pasted')
    expect(replied).toBe('reply_received')
    expect(nextDealStatus(replied, 'counter_drafted')).toBe('negotiating')
  })

  it('"Not yet": drafting a follow-up keeps the deal sent; sending it keeps it sent', () => {
    expect(nextDealStatus('sent', 'follow_up_drafted')).toBe('sent')
    expect(nextDealStatus('sent', 'marked_sent')).toBe('sent')
  })

  it('"I\'m done with this one": moves the deal to dead', () => {
    expect(nextDealStatus('sent', 'dead')).toBe('dead')
  })

  it('first send moves draft -> sent; marking sent never regresses a later status', () => {
    expect(nextDealStatus('draft', 'marked_sent')).toBe('sent')
    expect(nextDealStatus('negotiating', 'marked_sent')).toBe('negotiating')
  })
})

describe('buildFollowUpPrompt', () => {
  it('is a short nudge in the athlete voice, grounded in what was already sent', () => {
    const prompt = buildFollowUpPrompt({
      profile: { full_name: 'Alex', school: null, division: null, sport: null } as Profile,
      interview: {
        interests: ['open water'],
        brands_used: [],
        deal_preferences: { low: 'product_only', mid: 'product_only', high: 'payment_required' },
        voice_profile: 'Dry, low-key, ocean-first.',
      } as unknown as Interview,
      brand: { name: 'OSS', domain: 'oss.test' } as Brand,
      thread: [{ direction: 'outbound_draft', subject: 'Water polo + open water', content: 'Original pitch' }],
    })
    expect(prompt).toContain('50-90 words')
    expect(prompt).toContain('Dry, low-key, ocean-first.')
    expect(prompt).toContain('Original pitch')
    expect(prompt).toContain('Warm ≠ gushing')
  })
})
