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
  'backcountry.com',
  'moosejaw.com',
  'zappos.com',
  'dickssportinggoods.com',
  'runningwarehouse.com',
  'zoominfo.com',
  'rocketreach.co',
  'crunchbase.com',
  'yahoo.com',
  'google.com',
])

export function domainFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

// Second-level suffixes where the registrable domain has three labels
// (vivolife.co.uk, not co.uk).
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'org.nz',
  'co.za', 'com.br', 'com.mx', 'co.jp', 'co.kr', 'com.sg', 'com.hk', 'co.in', 'co.il', 'com.tr',
])

function rootDomain(domain: string): string {
  const labels = domain.split('.')
  const lastTwo = labels.slice(-2).join('.')
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
}

function isExcluded(domain: string): boolean {
  return EXCLUDED_DOMAINS.has(domain) || EXCLUDED_DOMAINS.has(rootDomain(domain))
}

// Search results for "best small X brands" are mostly listicles and reviews,
// not brands. Discovery reads the top pages, has Claude list the brands they
// mention, and resolves each to its own site — see planBrandCandidates.

// Pages worth reading for brand mentions: anything but social/video/
// marketplace pages, which don't read as text.
const UNREADABLE_SOURCES = new Set([
  'youtube.com', 'instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com',
  'pinterest.com', 'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com',
  'linkedin.com', 'zoominfo.com', 'rocketreach.co', 'yahoo.com',
])

export function sourcePageUrls(results: TavilySearchResult[], limit: number): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const result of results) {
    const domain = domainFromUrl(result.url)
    if (!domain || seen.has(domain) || UNREADABLE_SOURCES.has(rootDomain(domain))) continue
    seen.add(domain)
    urls.push(result.url)
    if (urls.length >= limit) break
  }
  return urls
}

// Every domain a markdown page links to, including the real destination
// hidden in affiliate redirects (?u=https%3A%2F%2Fbrand.com%2F...).
export function pageLinkDomains(markdown: string): string[] {
  const domains = new Set<string>()
  for (const match of markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = match[1]
    const direct = domainFromUrl(url)
    if (direct) domains.add(direct)
    for (const param of url.matchAll(/[?&](?:u|url|murl|dest|destination)=([^&]+)/gi)) {
      try {
        const target = domainFromUrl(decodeURIComponent(param[1]))
        if (target) domains.add(target)
      } catch {
        // malformed encoding — ignore
      }
    }
  }
  return [...domains]
}

// Page text for Claude, without link URLs (they're mostly affiliate noise and
// several times longer than the text they wrap).
export function readablePageText(markdown: string, maxChars: number): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, maxChars)
}

const NAME_STOPWORDS = new Set(['the', 'and', 'co', 'company', 'inc', 'llc', 'ltd', 'brand', 'brands'])

function nameTokens(name: string): string[] {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t && !NAME_STOPWORDS.has(t))
}

// Whether a domain plausibly belongs to a brand name ("Orange Mud" ->
// orangemud.com, "Black Diamond" -> blackdiamondequipment.com). Guards against
// accepting a retailer or an unrelated search hit as the brand's site.
export function domainMatchesBrand(domain: string, name: string): boolean {
  const label = rootDomain(domain.toLowerCase()).split('.')[0].replace(/[^a-z0-9]/g, '')
  const tokens = nameTokens(name)
  if (!label || tokens.length === 0) return false
  const joined = tokens.join('')
  // Very short names ("On") must match exactly, or "salomon" would count.
  if (joined.length < 4) return label === joined
  if (label.includes(joined)) return true
  if (label.length >= 4 && joined.includes(label)) return true
  return tokens[0].length >= 5 && label.startsWith(tokens[0])
}

export const brandMentionsSchema = z.object({
  brands: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        url_in_page: z.string().trim().max(500).nullable(),
      }),
    )
    .max(20),
})

export type BrandMention = z.infer<typeof brandMentionsSchema>['brands'][number]

export function parseBrandMentions(text: string): BrandMention[] {
  try {
    const parsed = brandMentionsSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data.brands : []
  } catch {
    return []
  }
}

export interface BrandCandidate {
  name: string
  domain: string
  url: string
}

// Turns Claude's brand mentions into candidates, most relevant first. A
// mention resolves directly when the page itself links to a domain matching
// the brand name; otherwise it needs a lookup (one search, verified with
// domainMatchesBrand). Known brands and excluded domains are skipped. More
// lookups than `limit` are queued, since some won't resolve or will turn out
// to be cached brands; the caller stops once it has `limit` candidates.
export function planBrandCandidates(
  mentions: BrandMention[],
  opts: { pageDomains: string[]; knownDomains: Iterable<string>; limit: number; maxLookups: number },
): { resolved: BrandCandidate[]; needsLookup: string[] } {
  const known = new Set([...opts.knownDomains].map((d) => d.toLowerCase()))
  const seenNames = new Set<string>()
  const seenDomains = new Set<string>()
  const resolved: BrandCandidate[] = []
  const needsLookup: string[] = []

  for (const mention of mentions) {
    if (resolved.length >= opts.limit) break
    if (resolved.length + needsLookup.length >= opts.limit && needsLookup.length >= opts.maxLookups) break
    const key = nameTokens(mention.name).join('')
    if (!key || seenNames.has(key)) continue
    seenNames.add(key)

    const claimed = mention.url_in_page ? domainFromUrl(mention.url_in_page) : null
    const domain = [claimed, ...opts.pageDomains].find(
      (d): d is string => !!d && domainMatchesBrand(d, mention.name) && !isExcluded(d),
    )
    if (domain) {
      if (known.has(domain) || seenDomains.has(domain)) continue
      seenDomains.add(domain)
      resolved.push({ name: mention.name, domain, url: `https://${domain}` })
    } else if (needsLookup.length < opts.maxLookups) {
      needsLookup.push(mention.name)
    }
  }
  return { resolved, needsLookup }
}

// The brand's own site from an "<name> official site" search, or null when no
// result plausibly belongs to it — never a guess.
export function pickBrandDomain(name: string, results: TavilySearchResult[]): string | null {
  for (const result of results) {
    const domain = domainFromUrl(result.url)
    if (domain && !isExcluded(domain) && domainMatchesBrand(domain, name)) return domain
  }
  return null
}

// Which interest tags a run researches: successive runs rotate through all of
// the athlete's tags instead of repeating the first few (whose brands are
// already in the cache after one run).
export function tagsForRun(tags: string[], priorRuns: number, perRun: number): string[] {
  if (tags.length <= perRun) return tags
  const start = (priorRuns * perRun) % tags.length
  return Array.from({ length: perRun }, (_, i) => tags[(start + i) % tags.length])
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
