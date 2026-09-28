import { describe, expect, it } from 'vitest'
import { buildCounterPrompt, buildOutreachPrompt } from '@/lib/draft-email'
import { draftEditUpdate } from '@/lib/draft-edits'
import { voiceProfileSchema } from '@/lib/voice-profile'
import type { Brand, Interview, Profile } from '@/lib/supabase/types'

const VOICE =
  'Laid-back and dry, a little self-deprecating. Talks about the ocean more than the sport. ' +
  'Short sentences, no hype, and would rather sound like a teammate than a pitch.'

const profile = {
  full_name: 'Alex Rivera',
  school: 'State',
  division: 'D1',
  sport: 'Water polo',
  instagram_followers: 450,
  tiktok_followers: null,
  other_followers: null,
} as Profile

const interview = (voice_profile: string | null) =>
  ({
    interests: ['open water swimming'],
    brands_used: ['Hydro Flask'],
    deal_preferences: { low: 'product_only', mid: 'product_plus_payment', high: 'payment_required' },
    voice_profile,
  }) as unknown as Interview

const brand = { name: 'Project Reef', domain: 'projectreef.com', description: 'Reef-safe sunscreen' } as Brand
const thread = [{ direction: 'inbound_pasted' as const, subject: null, content: 'We can do $75.' }]

describe('voice profile injection', () => {
  it('adds the profile to both prompts, after the shared guardrails', () => {
    for (const prompt of [
      buildOutreachPrompt({ profile, interview: interview(VOICE), brand, fitReason: 'fits' }),
      buildCounterPrompt({ profile, interview: interview(VOICE), brand, thread }),
    ]) {
      expect(prompt).toContain(VOICE)
      expect(prompt).toContain('the rules win')
      // Shared house rules are still there, and come first.
      expect(prompt.indexOf('Warm ≠ gushing')).toBeGreaterThan(-1)
      expect(prompt.indexOf('Warm ≠ gushing')).toBeLessThan(prompt.indexOf(VOICE))
    }
  })

  it('falls back to exactly the shared-voice prompt when the profile is null', () => {
    const withNull = buildOutreachPrompt({ profile, interview: interview(null), brand, fitReason: 'fits' })
    expect(withNull).not.toContain("This athlete's own voice")
    expect(withNull).toContain('Warm ≠ gushing')
    expect(buildCounterPrompt({ profile, interview: interview(null), brand, thread })).not.toContain(
      "This athlete's own voice",
    )
  })

  it('rejects a too-short or missing generated profile', () => {
    expect(voiceProfileSchema.safeParse({ voice_profile: 'Chill.' }).success).toBe(false)
    expect(voiceProfileSchema.safeParse({}).success).toBe(false)
    expect(voiceProfileSchema.safeParse({ voice_profile: VOICE }).success).toBe(true)
  })
})

describe('draftEditUpdate (edit capture)', () => {
  const generated = { subject: 'Reef-safe + water polo', content: 'Generated body', athlete_edited: false }

  it('first edit keeps the generated text and sets the flag', () => {
    expect(draftEditUpdate(generated, { subject: 'Reef-safe + water polo', content: 'My body' })).toEqual({
      subject: 'Reef-safe + water polo',
      content: 'My body',
      athlete_edited: true,
      original_subject: 'Reef-safe + water polo',
      original_content: 'Generated body',
    })
  })

  it('later edits never overwrite the preserved original', () => {
    const edited = { subject: 'Reef-safe + water polo', content: 'My body', athlete_edited: true }
    const update = draftEditUpdate(edited, { subject: 'New subject', content: 'My body v2' })
    expect(update).toEqual({ subject: 'New subject', content: 'My body v2', athlete_edited: true })
    expect(update).not.toHaveProperty('original_content')
  })

  it('does nothing when nothing changed', () => {
    expect(draftEditUpdate(generated, { subject: generated.subject, content: generated.content })).toBeNull()
  })
})
