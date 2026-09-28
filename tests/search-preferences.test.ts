import { describe, expect, it } from 'vitest'
import { discoveryTags } from '@/lib/discovery'
import { buildEvaluationPrompt, buildMentionsPrompt, focusSearchQuery } from '@/lib/discovery-research'
import { buildOutreachPrompt } from '@/lib/draft-email'
import { normalizedTagsSchema, searchPreferencesSchema } from '@/lib/validators/interview'
import type { Brand, Interview, Profile } from '@/lib/supabase/types'

describe('discoveryTags', () => {
  it('puts chosen industries first as kebab-case tags, then interest tags, deduped', () => {
    expect(discoveryTags(['Specialty Coffee', ' outdoor gear '], ['open-water-swimming', 'specialty-coffee'])).toEqual([
      'specialty-coffee',
      'outdoor-gear',
      'open-water-swimming',
    ])
  })
})

describe('values in discovery prompts (soft preference)', () => {
  const sources = [{ url: 'https://list.test', text: 'Brands: Ridgeline, Tidewater' }]
  const withValues = { interests: ['open water'], values: ['ocean conservation', 'women-owned'] }

  it('passes values to brand picking and fit judging, without making them a hard filter', () => {
    const mentions = buildMentionsPrompt(sources, withValues, 'swimwear')
    expect(mentions).toContain('"ocean conservation","women-owned"')
    expect(mentions).toContain("still include strong fits whose values aren't mentioned")
    const evaluation = buildEvaluationPrompt('https://ridgeline.test', 'page', withValues, 'swimwear')
    expect(evaluation).toContain('clearly conflicts with them is not a good fit')
    expect(evaluation).toContain('Missing evidence is not a conflict')
  })

  it('leaves the prompts as before when the athlete has no values', () => {
    const none = { interests: ['open water'], values: [] }
    expect(buildMentionsPrompt(sources, none, 'swimwear')).not.toContain('Values the athlete')
    expect(buildEvaluationPrompt('https://x.test', 'page', none, 'swimwear')).not.toContain('Values the athlete')
  })
})

describe('values in drafts', () => {
  it('gives the drafter what matters to the athlete and their values', () => {
    const prompt = buildOutreachPrompt({
      profile: { full_name: 'Maya', school: null, division: null, sport: null } as Profile,
      interview: {
        interests: ['open water'],
        brands_used: [],
        deal_preferences: { low: 'product_only', mid: 'product_only', high: 'payment_required' },
        raw_answers: { what_matters: 'Small brands that care about the ocean.' },
        values: ['ocean conservation'],
        voice_profile: null,
      } as unknown as Interview,
      brand: { name: 'Reef', domain: 'reef.test', description: null } as Brand,
      fitReason: 'fits',
    })
    expect(prompt).toContain('Small brands that care about the ocean.')
    expect(prompt).toContain('Values they want brands to share: ["ocean conservation"]')
  })
})

describe('validation', () => {
  it('accepts values and industries within limits and rejects over-long or too many', () => {
    expect(searchPreferencesSchema.safeParse({ values: ['sustainability'], target_industries: ['coffee'] }).success).toBe(true)
    expect(searchPreferencesSchema.safeParse({ values: ['x'.repeat(61)], target_industries: [] }).success).toBe(false)
    expect(
      searchPreferencesSchema.safeParse({ values: Array.from({ length: 9 }, (_, i) => `value ${i}`), target_industries: [] })
        .success,
    ).toBe(false)
  })

  it('reads values from normalization output, defaulting to none', () => {
    expect(normalizedTagsSchema.parse({ category_tags: ['a'] }).values).toEqual([])
    expect(normalizedTagsSchema.parse({ category_tags: ['a'], values: ['ocean conservation'] }).values).toEqual([
      'ocean conservation',
    ])
  })
})

describe('focusSearchQuery', () => {
  it("searches the athlete's own words for small independent brands", () => {
    expect(focusSearchQuery(' women-owned skincare ')).toBe('best small independent women-owned skincare brands')
    expect(focusSearchQuery('coffee brands from Oregon')).toBe('best small independent coffee brands from Oregon')
  })
})
