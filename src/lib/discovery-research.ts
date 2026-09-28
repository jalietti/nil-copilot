import { createAnthropicClient, COPILOT_MAX_TOKENS, COPILOT_MODEL, responseText } from './anthropic'
import { tavilyExtractWithWww } from './tavily'
import { contactPageLinks, extractEmails } from './contact-email'
import { parseBrandEval, parseBrandMentions, type BrandEval, type BrandMention } from './discovery'

// The Claude-backed research steps of brand discovery. Shared by the Inngest
// job (src/inngest/functions/discover-brands.ts) and the offline quality
// check (scripts/discovery-eval.ts), so the check measures the real pipeline.
// Server-side only.

export const DISCOVERY_LIMITS = {
  SEARCH_TAGS_PER_RUN: 3,
  NEW_CANDIDATES_PER_TAG: 3,
  // Top search results read per tag for brand mentions (usually listicles).
  SOURCE_PAGES_PER_TAG: 2,
  SOURCE_PAGE_CHARS: 20_000,
  // "<brand> official website" searches allowed per tag to resolve mentions.
  LOOKUPS_PER_TAG: 6,
} as const

// A focused search researches one athlete-chosen direction, so it goes deeper
// on it than a regular run goes on each of its tags.
export const FOCUSED_LIMITS = {
  NEW_CANDIDATES: 5,
  SOURCE_PAGES: 3,
  LOOKUPS: 8,
} as const

// What discovery knows about the athlete when judging brands. Values are a
// soft preference: they steer which brands are picked and how fit is judged,
// but never rule out a strong match on the athlete's actual interests.
export interface AthleteSearchProfile {
  interests: string[]
  values: string[]
}

function valuesLines(values: string[], use: string): string[] {
  if (values.length === 0) return []
  return [`Values the athlete wants brands to share: ${JSON.stringify(values)} — ${use}`]
}

export function brandSearchQuery(tag: string): string {
  return `best small independent ${tag.replace(/-/g, ' ')} brands`
}

// The athlete's own words ("women-owned skincare") as a search.
export function focusSearchQuery(focus: string): string {
  const text = focus.trim()
  return /\bbrands?\b/i.test(text) ? `best small independent ${text}` : `best small independent ${text} brands`
}

export function brandLookupQuery(brandName: string): string {
  return `${brandName} official website`
}

export function buildMentionsPrompt(
  sources: { url: string; text: string }[],
  athlete: AthleteSearchProfile,
  tag: string,
): string {
  return [
    'These web pages came up when researching brands for a student-athlete. Most are',
    'articles or reviews; some may be a brand\'s own site. List the brands they mention',
    'that make and sell their own products in this category.',
    '',
    `Category: ${tag}`,
    `Athlete's stated interests: ${JSON.stringify(athlete.interests)}`,
    ...valuesLines(
      athlete.values,
      'when ordering, favor brands the pages show sharing them, but still include strong fits whose values aren\'t mentioned.',
    ),
    '',
    'Rules:',
    '- Only brands named in the pages below. Never add brands from memory.',
    '- Exclude retailers and marketplaces (REI, Backcountry, Amazon, etc.), publishers,',
    '  and review sites.',
    '- Order by fit with the athlete\'s interests; prefer smaller and independent brands',
    '  over giant household names when both fit.',
    '- At most 10 brands.',
    '',
    ...sources.flatMap((source) => [`--- page: ${source.url} ---`, source.text, '']),
  ].join('\n')
}

export async function extractBrandMentions(
  sources: { url: string; text: string }[],
  athlete: AthleteSearchProfile,
  tag: string,
): Promise<BrandMention[]> {
  const client = createAnthropicClient()
  const response = await client.messages.create({
    model: COPILOT_MODEL,
    max_tokens: COPILOT_MAX_TOKENS,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            brands: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'The brand name only, not a product name' },
                  url_in_page: {
                    type: ['string', 'null'],
                    description: "The brand's own website URL if it literally appears in the pages, else null",
                  },
                },
                required: ['name', 'url_in_page'],
                additionalProperties: false,
              },
            },
          },
          required: ['brands'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: buildMentionsPrompt(sources, athlete, tag),
      },
    ],
  })

  const text = responseText(response, 'extractBrandMentions')
  return parseBrandMentions(text)
}

export function buildEvaluationPrompt(
  url: string,
  content: string,
  athlete: AthleteSearchProfile,
  tag: string,
): string {
  return [
    'Evaluate whether this website belongs to a real brand that could be a',
    'genuine NIL partnership fit for a student-athlete.',
    '',
    `Athlete's stated interests: ${JSON.stringify(athlete.interests)}`,
    ...valuesLines(
      athlete.values,
      'weigh them in the fit: a brand that clearly conflicts with them is not a good fit, and if the page shows it shares them, say so in fit_reason. Missing evidence is not a conflict.',
    ),
    `Category being researched: ${tag}`,
    '',
    'Only report a contact email that literally appears in the content below.',
    `Website: ${url}`,
    '--- page content ---',
    content,
  ].join('\n')
}

export async function evaluateCandidate(
  url: string,
  athlete: AthleteSearchProfile,
  tag: string,
): Promise<{ evaluation: BrandEval; pageEmails: string[]; contactLinks: string[] } | null> {
  const pages = await tavilyExtractWithWww([url])
  const fullContent = pages[0]?.raw_content
  const content = fullContent?.slice(0, 12_000)
  if (!fullContent || !content) return null

  const client = createAnthropicClient()
  const response = await client.messages.create({
    model: COPILOT_MODEL,
    max_tokens: COPILOT_MAX_TOKENS,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            is_real_brand: {
              type: 'boolean',
              description: 'True only if this is an actual brand selling its own products',
            },
            name: { type: 'string' },
            description: { type: 'string' },
            categories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Lowercase kebab-case category tags for this brand',
            },
            contact_email: {
              type: ['string', 'null'],
              description: 'Partnership/general contact email found in the page content, else null. Never invent one.',
            },
            fit_reason: {
              type: 'string',
              description: 'One or two sentences on why this brand fits (or not) the athlete',
            },
            good_fit: { type: 'boolean' },
          },
          required: [
            'is_real_brand',
            'name',
            'description',
            'categories',
            'contact_email',
            'fit_reason',
            'good_fit',
          ],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: buildEvaluationPrompt(url, content, athlete, tag),
      },
    ],
  })

  const text = responseText(response, 'evaluateCandidate')
  const evaluation = parseBrandEval(text)
  // Footers (where emails usually live) can fall past the slice Claude sees.
  if (!evaluation) return null
  return {
    evaluation,
    pageEmails: extractEmails(fullContent),
    contactLinks: contactPageLinks(fullContent, new URL(url).hostname.replace(/^www\./, '')),
  }
}
