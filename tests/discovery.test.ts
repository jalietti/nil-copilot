import { describe, expect, it } from 'vitest'
import { candidateDomains, domainFromUrl, parseBrandEval } from '@/lib/discovery'

const result = (url: string) => ({ title: 't', url, content: 'c', score: 0.5 })

describe('domainFromUrl', () => {
  it('normalizes to a bare lowercase domain', () => {
    expect(domainFromUrl('https://www.RidgelineGear.com/about')).toBe('ridgelinegear.com')
    expect(domainFromUrl('not a url')).toBeNull()
  })
})

describe('candidateDomains', () => {
  it('dedupes, skips known domains and aggregators, and respects the limit', () => {
    const results = [
      result('https://www.reddit.com/r/backpacking/best-gear'),
      result('https://ridgelinegear.com/packs'),
      result('https://ridgelinegear.com/about'),
      result('https://alreadycached.com/'),
      result('https://www.amazon.com/dp/B01'),
      result('https://smallbrand.co/'),
      result('https://thirdbrand.io/'),
    ]
    const candidates = candidateDomains(results, ['alreadycached.com'], 2)
    expect(candidates).toEqual([
      { domain: 'ridgelinegear.com', url: 'https://ridgelinegear.com' },
      { domain: 'smallbrand.co', url: 'https://smallbrand.co' },
    ])
  })

  it('excludes aggregator subdomains via root-domain matching', () => {
    const candidates = candidateDomains([result('https://shop.amazon.com/x')], [], 5)
    expect(candidates).toEqual([])
  })
})

describe('parseBrandEval', () => {
  const valid = {
    is_real_brand: true,
    name: 'Ridgeline Gear',
    description: 'Small sustainable backpack maker',
    categories: ['sustainable-outdoor-gear', 'backpacking'],
    contact_email: 'hello@ridgelinegear.com',
    fit_reason: 'Matches stated interest in sustainable outdoor gear',
    good_fit: true,
  }

  it('accepts a valid evaluation', () => {
    expect(parseBrandEval(JSON.stringify(valid))).toEqual(valid)
  })

  it('accepts null contact email', () => {
    expect(parseBrandEval(JSON.stringify({ ...valid, contact_email: null }))?.contact_email).toBeNull()
  })

  it('rejects malformed JSON and invalid shapes without throwing', () => {
    expect(parseBrandEval('not json')).toBeNull()
    expect(parseBrandEval(JSON.stringify({ ...valid, contact_email: 'not-an-email' }))).toBeNull()
    expect(parseBrandEval(JSON.stringify({ name: 'x' }))).toBeNull()
  })
})
