import { resolveMx } from 'node:dns/promises'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  tavilySearch,
  tavilyExtract,
  tavilyExtractContactPages,
  tavilyExtractWithWww,
} from '@/lib/tavily'
import {
  pageLinkDomains,
  pickBrandDomain,
  planBrandCandidates,
  readablePageText,
  sourcePageUrls,
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
import {
  contactPageLinks,
  extractEmails,
  findContactEmail,
  needsContactLookup,
  type ContactLookupDeps,
} from '@/lib/contact-email'
import { track } from '@/lib/analytics'
import * as Sentry from '@sentry/nextjs'

const {
  SEARCH_TAGS_PER_RUN,
  NEW_CANDIDATES_PER_TAG,
  SOURCE_PAGES_PER_TAG,
  SOURCE_PAGE_CHARS,
  LOOKUPS_PER_TAG,
} = DISCOVERY_LIMITS
// Cached brands without an email whose contact pages are re-checked per run.
const CACHED_CONTACT_RECHECKS_PER_RUN = 3

const contactDeps: ContactLookupDeps = {
  fetchContactPages: tavilyExtractContactPages,
  resolveMx,
}

// Live brand discovery: search the web for brands matching the athlete's real
// interests, evaluate fit with Claude, and grow the shared cache. Runs as an
// Inngest function because a full run (searches + page reads + evals) far
// exceeds a serverless request window. Every external call is a retryable step.
export const discoverBrands = inngest.createFunction(
  {
    id: 'discover-brands',
    retries: 2,
    triggers: [{ event: 'app/discover-brands.requested' }],
    // After all retries are exhausted: record the failure on the run (so the
    // athlete isn't left looking at "Researching…") and report it.
    onFailure: async ({ event, error }) => {
      const { runId } = event.data.event.data as { runId: string }
      await createAdminClient()
        .from('discovery_runs')
        .update({ status: 'failed', error: 'Job failed', finished_at: new Date().toISOString() })
        .eq('id', runId)
      Sentry.captureException(error, { tags: { inngest_function: 'discover-brands' } })
      await Sentry.flush(2000)
    },
  },
  async ({ event, step }) => {
    const { athleteId, runId } = event.data as { athleteId: string; runId: string }
    const supabase = createAdminClient()

    const interview = await step.run('load-interview', async () => {
      await supabase
        .from('discovery_runs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', runId)
      const { data } = await supabase
        .from('interviews')
        .select('interests, brands_used, category_tags, deal_preferences')
        .eq('athlete_id', athleteId)
        .maybeSingle()
      if (!data) throw new Error(`No interview found for athlete ${athleteId}`)
      const { count } = await supabase
        .from('discovery_runs')
        .select('id', { count: 'exact', head: true })
        .eq('athlete_id', athleteId)
        .eq('status', 'completed')
      return { ...data, priorRuns: count ?? 0 }
    })

    // 1. Cache first: match existing verified brands by category overlap.
    const cached = await step.run('match-from-cache', async () => {
      const { data: cached } = await supabase
        .from('brands')
        .select('id, domain, contact_email, contact_checked_at')
        .overlaps('categories', interview.category_tags)
        .not('verified_at', 'is', null)
        .limit(20)
      if (!cached || cached.length === 0) return []
      const { error } = await supabase.from('brand_matches').upsert(
        cached.map((b) => ({
          athlete_id: athleteId,
          brand_id: b.id,
          fit_reason: 'Matched from the brand cache by your interest categories.',
        })),
        { onConflict: 'athlete_id,brand_id', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
      return cached
    })
    const cachedMatchIds = cached.map((b) => b.id)

    // Cached matches with no email are unactionable; look again, but not for
    // brands whose pages were checked recently.
    const due = cached
      .filter((b) => needsContactLookup(b, new Date()))
      .slice(0, CACHED_CONTACT_RECHECKS_PER_RUN)
    for (const brand of due) {
      await step.run(`recheck-contact-${brand.domain}`, async () => {
        // The homepage's own emails and the contact pages it links to.
        const home = (await tavilyExtractWithWww([`https://${brand.domain}`]))[0]?.raw_content ?? ''
        const { email } = await findContactEmail(
          brand.domain,
          extractEmails(home),
          contactDeps,
          contactPageLinks(home, brand.domain),
        )
        await supabase
          .from('brands')
          .update({ contact_email: email, contact_checked_at: new Date().toISOString() })
          .eq('id', brand.id)
      })
    }

    // 2. Live research per category tag.
    const tags = tagsForRun(interview.category_tags, interview.priorRuns, SEARCH_TAGS_PER_RUN)
    let brandsFound = 0
    const matchedBrandIds = [...cachedMatchIds]

    for (const tag of tags) {
      const results = await step.run(`search-${tag}`, () =>
        tavilySearch(brandSearchQuery(tag)),
      )

      // Read the top pages and have Claude list the brands they mention —
      // the result domains themselves are mostly media, not brands.
      const sources = await step.run(`sources-${tag}`, async () => {
        const urls = sourcePageUrls(results, SOURCE_PAGES_PER_TAG)
        const pages = urls.length > 0 ? await tavilyExtract(urls) : []
        return pages.map((page) => ({
          url: page.url,
          text: readablePageText(page.raw_content, SOURCE_PAGE_CHARS),
          linkDomains: pageLinkDomains(page.raw_content),
        }))
      })
      if (sources.length === 0) continue

      const mentions = await step.run(`mentions-${tag}`, () =>
        extractBrandMentions(sources, interview.interests, tag),
      )

      const plan = await step.run(`plan-${tag}`, async () => {
        const { data: known } = await supabase.from('brands').select('domain')
        return planBrandCandidates(mentions, {
          pageDomains: sources.flatMap((source) => source.linkDomains),
          knownDomains: (known ?? []).map((b) => b.domain),
          limit: NEW_CANDIDATES_PER_TAG,
          maxLookups: LOOKUPS_PER_TAG,
        })
      })

      // Brands without a link in the page: one search each, accepted only if
      // a result's domain plausibly matches the brand name and it isn't
      // already cached. Stops as soon as the tag has enough candidates.
      const candidates: BrandCandidate[] = plan.resolved.slice(0, NEW_CANDIDATES_PER_TAG)
      for (const name of plan.needsLookup) {
        if (candidates.length >= NEW_CANDIDATES_PER_TAG) break
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const domain = await step.run(`lookup-${tag}-${slug}`, async () => {
          const found = pickBrandDomain(
            name,
            await tavilySearch(brandLookupQuery(name), { maxResults: 5 }),
          )
          if (!found) return null
          const { data: known } = await supabase
            .from('brands')
            .select('id')
            .eq('domain', found)
            .maybeSingle()
          return known ? null : found
        })
        if (!domain || candidates.some((c) => c.domain === domain)) continue
        candidates.push({ name, domain, url: `https://${domain}` })
      }

      for (const candidate of candidates) {
        const evaluated = await step.run(`evaluate-${candidate.domain}`, () =>
          evaluateCandidate(candidate.url, interview.interests, tag),
        )
        if (!evaluated || !evaluated.evaluation.is_real_brand) continue
        const { evaluation } = evaluated

        // Validated (syntax + MX) or null; /contact and /about only if the
        // homepage had nothing usable.
        const contact = await step.run(`contact-${candidate.domain}`, () =>
          findContactEmail(
            candidate.domain,
            [evaluation.contact_email, ...evaluated.pageEmails],
            contactDeps,
            evaluated.contactLinks,
          ),
        )

        const stored = await step.run(`store-${candidate.domain}`, async () => {
          const { data: brand, error } = await supabase
            .from('brands')
            .upsert(
              {
                domain: candidate.domain,
                name: evaluation.name,
                description: evaluation.description,
                categories: evaluation.categories,
                contact_email: contact.email,
                contact_checked_at: new Date().toISOString(),
                source_urls: [candidate.url],
                discovered_via: `tavily:${tag}`,
                verified_at: new Date().toISOString(),
              },
              { onConflict: 'domain' },
            )
            .select('id')
            .single()
          if (error) throw new Error(error.message)

          if (evaluation.good_fit) {
            const { error: matchError } = await supabase.from('brand_matches').upsert(
              {
                athlete_id: athleteId,
                brand_id: brand.id,
                fit_reason: evaluation.fit_reason,
              },
              { onConflict: 'athlete_id,brand_id', ignoreDuplicates: true },
            )
            if (matchError) throw new Error(matchError.message)
          }
          return { brandId: brand.id, matched: evaluation.good_fit }
        })

        brandsFound += 1
        if (stored.matched) matchedBrandIds.push(stored.brandId)
      }
    }

    const matchesCreated = matchedBrandIds.length
    await step.run('finish-run', async () => {
      await supabase
        .from('discovery_runs')
        .update({
          status: 'completed',
          brands_found: brandsFound,
          matches_created: matchesCreated,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId)

      // A match is only actionable if there's somewhere to send the outreach.
      const { count } = await supabase
        .from('brands')
        .select('id', { count: 'exact', head: true })
        .in('id', matchedBrandIds)
        .not('contact_email', 'is', null)
      await track('discovery_run_completed', athleteId, {
        run_id: runId,
        brands_found: brandsFound,
        matches_created: matchesCreated,
        matches_with_email: count ?? 0,
      })
    })

    return { brandsFound, matchesCreated }
  },
)
