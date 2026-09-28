import { createAnthropicClient, COPILOT_MAX_TOKENS, COPILOT_MODEL, responseText } from './anthropic'
import { tavilyExtractWithWww } from './tavily'
import { extractEmails } from './contact-email'
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

export function brandSearchQuery(tag: string): string {
  return `best small independent ${tag.replace(/-/g, ' ')} brands`
}

export function brandLookupQuery(brandName: string): string {
  return `${brandName} official website`
}

export async function extractBrandMentions(
  sources: { url: string; text: string }[],
  interests: string[],
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
        content: [
          'These web pages came up when researching brands for a student-athlete. Most are',
          'articles or reviews; some may be a brand\'s own site. List the brands they mention',
          'that make and sell their own products in this category.',
          '',
          `Category: ${tag}`,
          `Athlete's stated interests: ${JSON.stringify(interests)}`,
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
        ].join('\n'),
      },
    ],
  })

  const text = responseText(response, 'extractBrandMentions')
  return parseBrandMentions(text)
}

export async function evaluateCandidate(
  url: string,
  interests: string[],
  tag: string,
): Promise<{ evaluation: BrandEval; pageEmails: string[] } | null> {
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
        content: [
          'Evaluate whether this website belongs to a real brand that could be a',
          'genuine NIL partnership fit for a student-athlete.',
          '',
          `Athlete's stated interests: ${JSON.stringify(interests)}`,
          `Category being researched: ${tag}`,
          '',
          'Only report a contact email that literally appears in the content below.',
          `Website: ${url}`,
          '--- page content ---',
          content,
        ].join('\n'),
      },
    ],
  })

  const text = responseText(response, 'evaluateCandidate')
  const evaluation = parseBrandEval(text)
  // Footers (where emails usually live) can fall past the slice Claude sees.
  return evaluation ? { evaluation, pageEmails: extractEmails(fullContent) } : null
}
