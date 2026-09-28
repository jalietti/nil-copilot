import { z } from 'zod'
import { createAnthropicClient, COPILOT_MAX_TOKENS, COPILOT_MODEL, responseText } from './anthropic'
import type { InterviewInput } from './validators/interview'

// A short description of how this athlete comes across — register, energy,
// what they care about — generated from their own interview answers and
// injected into drafts so each athlete sounds like themselves. Returns null
// rather than throwing: drafts fall back to the shared house voice.

export const voiceProfileSchema = z.object({
  voice_profile: z.string().trim().min(80).max(1200),
})

export async function generateVoiceProfile(input: InterviewInput): Promise<string | null> {
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
            voice_profile: {
              type: 'string',
              description: '60-100 words (never more than 100), plain prose, no lists',
            },
          },
          required: ['voice_profile'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          "Write a short voice profile (60-100 words, hard limit 100) for a student-athlete, based only on",
          'their interview answers below. It will guide an assistant that drafts NIL',
          'partnership emails in their first-person voice.',
          '',
          'Describe: how they seem to talk (register, formality, energy level), what they',
          'genuinely care about, and what would make an email sound like them rather than',
          'a template. Use their own wording as evidence. Do not invent biography, stats,',
          'or facts that are not in the answers. Write it to the drafter in second person',
          '("They write..." is fine too), plain prose.',
          '',
          `Interests: ${JSON.stringify(input.interests)}`,
          `Brands they genuinely use: ${JSON.stringify(input.brands_used)}`,
          `What matters to them in a partnership (their words): ${JSON.stringify(input.what_matters)}`,
          `Anything else they said about compensation: ${JSON.stringify(input.deal_preferences.notes ?? '')}`,
        ].join('\n'),
      },
    ],
  })

  const text = responseText(response, 'generateVoiceProfile')
  try {
    const parsed = voiceProfileSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data.voice_profile : null
  } catch {
    return null
  }
}
