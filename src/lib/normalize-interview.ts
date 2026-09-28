import { createAnthropicClient, COPILOT_MAX_TOKENS, COPILOT_MODEL, responseText } from './anthropic'
import { normalizedTagsSchema, type InterviewInput } from './validators/interview'

// Turns the athlete's free-text interests/brands into lowercase category tags
// used to query and grow the brands cache. Falls back to raw interests as tags
// if the model output doesn't validate, so the interview never hard-fails.
export async function normalizeInterviewToTags(input: InterviewInput): Promise<string[]> {
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
            category_tags: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Lowercase, kebab-case brand-category tags, e.g. "sustainable-outdoor-gear", "trail-running", "climbing"',
            },
          },
          required: ['category_tags'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          'Normalize this student-athlete\'s interview answers into brand-category tags',
          'for matching them with brands they would genuinely want to work with.',
          'Return 3-10 lowercase kebab-case tags. Be specific ("sustainable-outdoor-gear",',
          'not "sports"). Base tags only on what they actually said.',
          '',
          `Interests: ${JSON.stringify(input.interests)}`,
          `Brands they genuinely use: ${JSON.stringify(input.brands_used)}`,
          `What matters to them in a partnership: ${JSON.stringify(input.what_matters)}`,
        ].join('\n'),
      },
    ],
  })

  const text = responseText(response, 'normalizeInterviewToTags')
  try {
    const parsed = normalizedTagsSchema.safeParse(JSON.parse(text))
    if (parsed.success) {
      return [...new Set(parsed.data.category_tags.map((t) => t.toLowerCase()))]
    }
  } catch {
    // fall through to fallback
  }
  return [...new Set(input.interests.map((i) => i.toLowerCase().replace(/\s+/g, '-')))]
}
