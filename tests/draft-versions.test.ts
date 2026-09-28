import { describe, expect, it } from 'vitest'
import { draftKind } from '@/lib/draft-kind'
import { regeneratedDraftUpdate } from '@/lib/draft-edits'
import { buildCounterPrompt, buildFollowUpPrompt, buildOutreachPrompt } from '@/lib/draft-email'
import type { Brand, Interview, Profile } from '@/lib/supabase/types'

describe('draftKind', () => {
  it('is outreach first, a follow-up after an unanswered draft, a counter once they replied', () => {
    expect(draftKind([])).toBe('outreach')
    expect(draftKind([{ direction: 'outbound_draft' }])).toBe('follow_up')
    expect(draftKind([{ direction: 'outbound_draft' }, { direction: 'inbound_pasted' }])).toBe('counter')
  })
})

describe('regeneratedDraftUpdate', () => {
  const now = new Date('2026-09-29T12:00:00Z')

  it('replaces the draft and keeps the replaced version, edits included', () => {
    const current = {
      subject: 'Edited subject',
      content: 'Edited body',
      athlete_edited: true,
      original_subject: 'Generated subject',
      original_content: 'Generated body',
      previous_versions: [{ content: 'even older' }],
    }
    expect(regeneratedDraftUpdate(current, { subject: 'New', content: 'New body' }, now)).toEqual({
      subject: 'New',
      content: 'New body',
      athlete_edited: false,
      original_subject: null,
      original_content: null,
      previous_versions: [
        { content: 'even older' },
        {
          subject: 'Edited subject',
          content: 'Edited body',
          athlete_edited: true,
          original_subject: 'Generated subject',
          original_content: 'Generated body',
          replaced_at: now.toISOString(),
        },
      ],
    })
  })
})

describe('alternative-version prompts', () => {
  const base = {
    profile: { full_name: 'Maya', school: null, division: null, sport: null } as Profile,
    interview: {
      interests: ['open water'],
      brands_used: [],
      deal_preferences: { low: 'product_only', mid: 'product_only', high: 'payment_required' },
      voice_profile: null,
    } as unknown as Interview,
    brand: { name: 'Reef', domain: 'reef.test', description: null } as Brand,
  }
  const previousDraft = { subject: 'Old subject', body: 'The old opening line.' }
  const thread = [{ direction: 'outbound_draft' as const, subject: 's', content: 'first email' }]

  it('shows the current draft and asks for a different take, for every draft kind', () => {
    for (const prompt of [
      buildOutreachPrompt({ ...base, fitReason: 'fits', previousDraft }),
      buildCounterPrompt({ ...base, thread, previousDraft }),
      buildFollowUpPrompt({ ...base, thread, previousDraft }),
    ]) {
      expect(prompt).toContain('genuinely different take')
      expect(prompt).toContain('The old opening line.')
      expect(prompt).toContain('Warm ≠ gushing')
    }
  })

  it('is absent for a normal first draft', () => {
    expect(buildOutreachPrompt({ ...base, fitReason: 'fits' })).not.toContain('genuinely different take')
  })
})
