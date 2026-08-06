import { z } from 'zod'
import type { TavilySearchResult } from './tavily'

// Pure logic for the discovery pipeline — separated from the Inngest function
// so it can be unit-tested with fixtures. The production path is always live
// research; fixtures exist only in tests.

// Aggregators/marketplaces/media that show up in search results but are never
// the brand itself.
const EXCLUDED_DOMAINS = new Set([
  'amazon.com',
  'reddit.com',
  'wikipedia.org',
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'pinterest.com',
  'etsy.com',
  'ebay.com',
  'walmart.com',
  'target.com',
  'medium.com',
  'linkedin.com',
  'nytimes.com',
  'outdoorgearlab.com',
  'rei.com',
  'gearjunkie.com',
  'wirecutter.com',
])

export function domainFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

export function candidateDomains(
  results: TavilySearchResult[],
  knownDomains: Iterable<string>,
  limit: number,
): { domain: string; url: string }[] {
  const known = new Set([...knownDomains].map((d) => d.toLowerCase()))
  const seen = new Set<string>()
  const candidates: { domain: string; url: string }[] = []

  for (const result of results) {
    if (candidates.length >= limit) break
    const domain = domainFromUrl(result.url)
    if (!domain || seen.has(domain) || known.has(domain)) continue
    const rootDomain = domain.split('.').slice(-2).join('.')
    if (EXCLUDED_DOMAINS.has(domain) || EXCLUDED_DOMAINS.has(rootDomain)) continue
    seen.add(domain)
    candidates.push({ domain, url: `https://${domain}` })
  }
  return candidates
}

// Shape Claude must return when evaluating a candidate brand site.
export const brandEvalSchema = z.object({
  is_real_brand: z.boolean(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000),
  categories: z.array(z.string().trim().min(1).max(50)).max(10),
  contact_email: z.string().trim().email().nullable(),
  fit_reason: z.string().trim().max(1000),
  good_fit: z.boolean(),
})

export type BrandEval = z.infer<typeof brandEvalSchema>

export function parseBrandEval(text: string): BrandEval | null {
  try {
    const parsed = brandEvalSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
