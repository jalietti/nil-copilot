// Discovery quality check: runs the live discovery pipeline (the same helpers
// the Inngest job uses) for sample athlete profiles, without touching the
// database, and reports how many real, well-fitting brands with a usable
// contact email each interest tag yields. Use it to measure a discovery
// change before and after, instead of guessing.
//
// Spends real Tavily + Anthropic credits (roughly what one athlete's
// discovery run costs per tag). Needs TAVILY_API_KEY and ANTHROPIC_API_KEY
// (read from .env.local when present).
//
//   npm run eval:discovery                       # 1 tag per profile
//   npm run eval:discovery -- --tags 3           # up to 3 tags per profile
//   npm run eval:discovery -- --only climber --out report.json
//   npm run eval:discovery -- --contacts scripts/contact-eval-domains.json
//     (email finding only, on a fixed domain list: no Claude calls, and
//     before/after comparisons aren't skewed by varying search results)

import { readFileSync, writeFileSync } from 'node:fs'
import { resolveMx } from 'node:dns/promises'
import { parseArgs } from 'node:util'
import {
  tavilyExtract,
  tavilyExtractContactPages,
  tavilyExtractWithWww,
  tavilySearch,
} from '@/lib/tavily'
import {
  pageLinkDomains,
  pickBrandDomain,
  planBrandCandidates,
  readablePageText,
  sourcePageUrls,
  discoveryTags,
  tagsForRun,
  type BrandCandidate,
} from '@/lib/discovery'
import {
  DISCOVERY_LIMITS,
  brandLookupQuery,
  brandSearchQuery,
  evaluateCandidate,
  extractBrandMentions,
} from '@/lib/discovery-research'
import { contactPageLinks, extractEmails, findContactEmail } from '@/lib/contact-email'

interface Profile {
  id: string
  interests: string[]
  category_tags: string[]
  values?: string[]
  target_industries?: string[]
}

interface BrandResult {
  domain: string
  real: boolean
  goodFit: boolean
  email: string | null
}

interface TagResult {
  profile: string
  tag: string
  sourcePages: number
  mentions: number
  candidates: number
  brands: BrandResult[]
}

const calls = { tavilySearch: 0, tavilyExtract: 0, claude: 0 }

const athleteOf = (profile: Profile) => ({ interests: profile.interests, values: profile.values ?? [] })

async function researchTag(profile: Profile, tag: string, seen: Set<string>): Promise<TagResult> {
  const L = DISCOVERY_LIMITS
  calls.tavilySearch++
  const results = await tavilySearch(brandSearchQuery(tag))
  const urls = sourcePageUrls(results, L.SOURCE_PAGES_PER_TAG)
  calls.tavilyExtract++
  const pages = urls.length > 0 ? await tavilyExtract(urls) : []
  const sources = pages.map((page) => ({
    url: page.url,
    text: readablePageText(page.raw_content, L.SOURCE_PAGE_CHARS),
    linkDomains: pageLinkDomains(page.raw_content),
  }))

  const result: TagResult = {
    profile: profile.id,
    tag,
    sourcePages: sources.length,
    mentions: 0,
    candidates: 0,
    brands: [],
  }
  if (sources.length === 0) return result

  calls.claude++
  const mentions = await extractBrandMentions(sources, athleteOf(profile), tag)
  result.mentions = mentions.length

  const plan = planBrandCandidates(mentions, {
    pageDomains: sources.flatMap((s) => s.linkDomains),
    knownDomains: seen,
    limit: L.NEW_CANDIDATES_PER_TAG,
    maxLookups: L.LOOKUPS_PER_TAG,
  })
  const candidates: BrandCandidate[] = plan.resolved.slice(0, L.NEW_CANDIDATES_PER_TAG)
  for (const name of plan.needsLookup) {
    if (candidates.length >= L.NEW_CANDIDATES_PER_TAG) break
    calls.tavilySearch++
    const domain = pickBrandDomain(name, await tavilySearch(brandLookupQuery(name), { maxResults: 5 }))
    if (!domain || seen.has(domain) || candidates.some((c) => c.domain === domain)) continue
    candidates.push({ name, domain, url: `https://${domain}` })
  }
  result.candidates = candidates.length

  for (const candidate of candidates) {
    seen.add(candidate.domain)
    calls.tavilyExtract++
    calls.claude++
    const evaluated = await evaluateCandidate(candidate.url, athleteOf(profile), tag)
    if (!evaluated?.evaluation.is_real_brand) {
      result.brands.push({ domain: candidate.domain, real: false, goodFit: false, email: null })
      continue
    }
    const contact = await findContactEmail(
      candidate.domain,
      [evaluated.evaluation.contact_email, ...evaluated.pageEmails],
      { fetchContactPages: tavilyExtractContactPages, resolveMx },
      evaluated.contactLinks,
    )
    if (contact.fetchedPages) calls.tavilyExtract++
    result.brands.push({
      domain: candidate.domain,
      real: true,
      goodFit: evaluated.evaluation.good_fit,
      email: contact.email,
    })
  }
  return result
}

function summarize(rows: TagResult[]) {
  const count = (f: (b: BrandResult) => boolean) => rows.flatMap((r) => r.brands).filter(f).length
  const matches = count((b) => b.real && b.goodFit)
  const withEmail = count((b) => b.real && b.goodFit && !!b.email)
  return {
    tags: rows.length,
    tagsWithZeroMatches: rows.filter((r) => !r.brands.some((b) => b.real && b.goodFit)).length,
    candidates: rows.reduce((n, r) => n + r.candidates, 0),
    realBrands: count((b) => b.real),
    matches,
    matchesWithEmail: withEmail,
    matchesPerTag: rows.length ? +(matches / rows.length).toFixed(2) : 0,
    emailRate: matches ? +(withEmail / matches).toFixed(2) : 0,
  }
}

// Contact-email finding alone, as discovery does it after a brand is judged
// real: homepage emails first, then the brand's contact/about pages.
async function evaluateContacts(file: string) {
  const { domains } = JSON.parse(readFileSync(file, 'utf8')) as { domains: string[] }
  let found = 0
  for (const domain of domains) {
    calls.tavilyExtract++
    const home = (await tavilyExtractWithWww([`https://${domain}`]))[0]?.raw_content ?? ''
    const contact = await findContactEmail(
      domain,
      extractEmails(home),
      { fetchContactPages: tavilyExtractContactPages, resolveMx },
      contactPageLinks(home, domain),
    )
    if (contact.fetchedPages) calls.tavilyExtract++
    if (contact.email) found++
    console.log(`${domain.padEnd(32)} ${home ? 'home ok ' : 'home ✗  '} ${contact.email ?? '—'}`)
  }
  console.log(`\nEmail found for ${found}/${domains.length} (${Math.round((found / domains.length) * 100)}%)`)
  console.log('External calls', calls)
}

async function main() {
  const { values } = parseArgs({
    options: {
      profiles: { type: 'string', default: 'scripts/discovery-eval-profiles.json' },
      tags: { type: 'string', default: '1' },
      only: { type: 'string' },
      out: { type: 'string' },
      contacts: { type: 'string' },
    },
  })
  for (const key of ['TAVILY_API_KEY', 'ANTHROPIC_API_KEY']) {
    if (!process.env[key]) throw new Error(`${key} is not set (put it in .env.local)`)
  }
  if (values.contacts) return evaluateContacts(values.contacts)

  const { profiles } = JSON.parse(readFileSync(values.profiles!, 'utf8')) as { profiles: Profile[] }
  const tagsPerProfile = Math.max(1, Number(values.tags))
  const selected = profiles.filter((p) => !values.only || p.id === values.only)
  const rows: TagResult[] = []

  for (const profile of selected) {
    const seen = new Set<string>()
    for (const tag of tagsForRun(
      discoveryTags(profile.target_industries ?? [], profile.category_tags),
      0,
      tagsPerProfile,
    )) {
      process.stdout.write(`${profile.id} / ${tag} … `)
      try {
        const row = await researchTag(profile, tag, seen)
        rows.push(row)
        const good = row.brands.filter((b) => b.real && b.goodFit)
        console.log(
          `${row.sourcePages} pages, ${row.mentions} mentioned, ${row.candidates} candidates, ` +
            `${row.brands.filter((b) => b.real).length} real, ${good.length} fit, ` +
            `${good.filter((b) => b.email).length} with email`,
        )
        for (const b of row.brands) {
          const label = !b.real ? 'not a brand' : b.goodFit ? 'fit' : 'poor fit'
          console.log(`    ${b.domain.padEnd(32)} ${label.padEnd(12)} ${b.email ?? '—'}`)
        }
      } catch (error) {
        console.log(`failed: ${error instanceof Error ? error.message : error}`)
      }
    }
  }

  const summary = summarize(rows)
  console.log('\nSummary', summary)
  console.log('External calls', calls)
  if (values.out) {
    writeFileSync(values.out, JSON.stringify({ summary, calls, rows }, null, 2))
    console.log(`Wrote ${values.out}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
