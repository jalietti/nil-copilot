import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  domainFromUrl,
  domainMatchesBrand,
  pageLinkDomains,
  parseBrandEval,
  parseBrandMentions,
  pickBrandDomain,
  planBrandCandidates,
  readablePageText,
  sourcePageUrls,
  tagsForRun,
} from '@/lib/discovery'

const listicle = readFileSync(join(__dirname, 'fixtures', 'listicle.md'), 'utf8')

const result = (url: string) => ({ title: 't', url, content: 'c', score: 0.5 })

describe('domainFromUrl', () => {
  it('normalizes to a bare lowercase domain', () => {
    expect(domainFromUrl('https://www.RidgelineGear.com/about')).toBe('ridgelinegear.com')
    expect(domainFromUrl('not a url')).toBeNull()
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

describe('sourcePageUrls', () => {
  it('reads the top text pages, one per domain, skipping social/video/marketplace', () => {
    const urls = sourcePageUrls(
      [
        result('https://www.youtube.com/watch?v=x'),
        result('https://www.irunfar.com/best-running-vests'),
        result('https://www.irunfar.com/another'),
        result('https://www.amazon.com/best-sellers'),
        result('https://www.reddit.com/r/trailrunning/vests'),
        result('https://treelinereview.test/vests'),
      ],
      2,
    )
    expect(urls).toEqual([
      'https://www.irunfar.com/best-running-vests',
      'https://www.reddit.com/r/trailrunning/vests',
    ])
  })
})

describe('pageLinkDomains / readablePageText', () => {
  it('collects direct link domains and decodes affiliate redirect targets', () => {
    const domains = pageLinkDomains(listicle)
    expect(domains).toEqual(
      expect.arrayContaining(['orangemud.com', 'backcountry.com', 'rei.com', 'nathansports.com', 'amazon.com']),
    )
  })

  it('strips link URLs and images so Claude reads text, not affiliate noise', () => {
    const text = readablePageText(listicle, 10_000)
    expect(text).toContain('Best overall: Orange Mud Endurance Pack')
    expect(text).not.toContain('tnu8.net')
    expect(text).not.toContain('vests.jpg')
    expect(readablePageText(listicle, 20)).toHaveLength(20)
  })
})

describe('domainMatchesBrand', () => {
  it.each([
    ['orangemud.com', 'Orange Mud'],
    ['nathansports.com', 'Nathan'],
    ['ultimatedirection.com', 'Ultimate Direction'],
    ['blackdiamondequipment.com', 'Black Diamond'],
    ['shop.ultraspire.com', 'UltrAspire'],
    ['salomon.com', 'Salomon'],
    ['on.com', 'On'],
    ['vivolife.co.uk', 'Vivo Life'],
    ['formnutrition.com.au', 'Form Nutrition'],
  ])('%s belongs to %s', (domain, name) => {
    expect(domainMatchesBrand(domain, name)).toBe(true)
  })

  it.each([
    ['backcountry.com', 'Orange Mud'],
    ['rei.com', 'Ultimate Direction'],
    ['runnersworld.com', 'Nathan'],
    ['salomon.com', 'On'],
    ['onrunning.com', 'On'],
    ['company.co.uk', 'Vivo Life'],
  ])('%s does not belong to %s', (domain, name) => {
    expect(domainMatchesBrand(domain, name)).toBe(false)
  })
})

describe('planBrandCandidates', () => {
  const mentions = [
    { name: 'Orange Mud', url_in_page: null },
    { name: 'Ultimate Direction', url_in_page: null },
    { name: 'Nathan', url_in_page: 'https://www.nathansports.com/vaporair' },
    { name: 'Orange Mud', url_in_page: null },
  ]

  it('resolves brands the page links to, and queues the rest for lookup, in order', () => {
    const plan = planBrandCandidates(mentions, {
      pageDomains: pageLinkDomains(listicle),
      knownDomains: [],
      limit: 3,
      maxLookups: 6,
    })
    expect(plan).toEqual({
      resolved: [
        { name: 'Orange Mud', domain: 'orangemud.com', url: 'https://orangemud.com' },
        { name: 'Nathan', domain: 'nathansports.com', url: 'https://nathansports.com' },
      ],
      needsLookup: ['Ultimate Direction'],
    })
  })

  it('skips brands already in the cache and respects the limit', () => {
    const plan = planBrandCandidates(mentions, {
      pageDomains: pageLinkDomains(listicle),
      knownDomains: ['orangemud.com'],
      limit: 1,
      maxLookups: 1,
    })
    expect(plan).toEqual({ resolved: [], needsLookup: ['Ultimate Direction'] })
  })

  it("ignores a claimed URL that isn't the brand's own site", () => {
    const plan = planBrandCandidates([{ name: 'Orange Mud', url_in_page: 'https://www.rei.com/x' }], {
      pageDomains: [],
      knownDomains: [],
      limit: 3,
      maxLookups: 6,
    })
    expect(plan).toEqual({ resolved: [], needsLookup: ['Orange Mud'] })
  })

  it('queues extra lookups beyond the limit (some will fail), capped by maxLookups', () => {
    const names = ['Vivo Life', 'Form Nutrition', 'Sunwarrior', 'Naturade', 'PlantFusion', 'Vega']
    const plan = planBrandCandidates(
      names.map((name) => ({ name, url_in_page: null })),
      { pageDomains: [], knownDomains: [], limit: 3, maxLookups: 5 },
    )
    expect(plan.needsLookup).toEqual(names.slice(0, 5))
  })

  it('stops once enough brands resolve directly from page links', () => {
    const plan = planBrandCandidates(
      [
        { name: 'Orange Mud', url_in_page: null },
        { name: 'Nathan', url_in_page: null },
        { name: 'Vega', url_in_page: null },
      ],
      { pageDomains: ['orangemud.com', 'nathansports.com'], knownDomains: [], limit: 2, maxLookups: 6 },
    )
    expect(plan).toEqual({
      resolved: [
        { name: 'Orange Mud', domain: 'orangemud.com', url: 'https://orangemud.com' },
        { name: 'Nathan', domain: 'nathansports.com', url: 'https://nathansports.com' },
      ],
      needsLookup: [],
    })
  })
})

describe('pickBrandDomain', () => {
  it('takes the first result that plausibly is the brand, skipping retailers', () => {
    const results = [
      result('https://www.rei.com/b/ultimate-direction'),
      result('https://www.amazon.com/stores/UltimateDirection'),
      result('https://ultimatedirection.com/'),
    ]
    expect(pickBrandDomain('Ultimate Direction', results)).toBe('ultimatedirection.com')
  })

  it('returns null rather than guessing', () => {
    expect(pickBrandDomain('Ultimate Direction', [result('https://www.runnersworld.com/x')])).toBeNull()
  })
})

describe('parseBrandMentions', () => {
  it('parses valid output and fails closed on garbage', () => {
    expect(parseBrandMentions(JSON.stringify({ brands: [{ name: 'Orange Mud', url_in_page: null }] }))).toEqual([
      { name: 'Orange Mud', url_in_page: null },
    ])
    expect(parseBrandMentions('not json')).toEqual([])
    expect(parseBrandMentions(JSON.stringify({ brands: 'x' }))).toEqual([])
  })
})

describe('tagsForRun', () => {
  const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  it('rotates through every tag across successive runs, wrapping around', () => {
    expect(tagsForRun(tags, 0, 3)).toEqual(['a', 'b', 'c'])
    expect(tagsForRun(tags, 1, 3)).toEqual(['d', 'e', 'f'])
    expect(tagsForRun(tags, 2, 3)).toEqual(['g', 'h', 'a'])
    expect(tagsForRun(tags, 3, 3)).toEqual(['b', 'c', 'd'])
  })

  it('uses all tags when there are no more than a run covers', () => {
    expect(tagsForRun(['a', 'b'], 5, 3)).toEqual(['a', 'b'])
  })
})
