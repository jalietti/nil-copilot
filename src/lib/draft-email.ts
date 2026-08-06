import { z } from 'zod'
import { createAnthropicClient, COPILOT_MODEL } from './anthropic'
import {
  COMPENSATION_ASK_LABELS,
  followerTier,
  totalFollowers,
  type DealPreferences,
} from './deal-preferences'
import type { Brand, Interview, Message, Profile } from './supabase/types'

export const emailDraftSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
})

export type EmailDraft = z.infer<typeof emailDraftSchema>

const EMAIL_OUTPUT_CONFIG = {
  format: {
    type: 'json_schema' as const,
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        body: {
          type: 'string',
          description: 'Plain-text email body with real line breaks. No placeholders like [Name].',
        },
      },
      required: ['subject', 'body'],
      additionalProperties: false,
    },
  },
}

function athleteContext(profile: Profile, interview: Interview): string {
  const followers = totalFollowers({
    instagram: profile.instagram_followers,
    tiktok: profile.tiktok_followers,
    other: profile.other_followers,
  })
  const prefs = interview.deal_preferences as unknown as DealPreferences
  return [
    `Name: ${profile.full_name}`,
    `School: ${profile.school ?? 'not stated'} (${profile.division ?? 'division not stated'})`,
    `Sport: ${profile.sport ?? 'not stated'}`,
    `Total followers across platforms: ${followers} (${followerTier(followers)} tier)`,
    `Genuine interests: ${JSON.stringify(interview.interests)}`,
    `Brands they actually use: ${JSON.stringify(interview.brands_used)}`,
    `Compensation preferences by product value tier: ` +
      `low="${COMPENSATION_ASK_LABELS[prefs.low] ?? prefs.low}", ` +
      `mid="${COMPENSATION_ASK_LABELS[prefs.mid] ?? prefs.mid}", ` +
      `high="${COMPENSATION_ASK_LABELS[prefs.high] ?? prefs.high}"` +
      (prefs.notes ? `, notes="${prefs.notes}"` : ''),
  ].join('\n')
}

async function draft(prompt: string): Promise<EmailDraft> {
  const client = createAnthropicClient()
  const response = await client.messages.create({
    model: COPILOT_MODEL,
    max_tokens: 2048,
    output_config: EMAIL_OUTPUT_CONFIG,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content.find((block) => block.type === 'text')?.text ?? ''
  const parsed = emailDraftSchema.safeParse(JSON.parse(text))
  if (!parsed.success) throw new Error('Draft did not match the expected shape')
  return parsed.data
}

// First-touch outreach. The copilot only drafts — the athlete edits and sends
// it themselves via mailto.
export async function draftOutreachEmail(args: {
  profile: Profile
  interview: Interview
  brand: Brand
  fitReason: string
}): Promise<EmailDraft> {
  return draft(
    [
      'Draft a first-touch NIL partnership outreach email from a student-athlete to a brand.',
      'The athlete will review, edit, and send it themselves from their own email account —',
      'write in their first-person voice, ready to send as-is.',
      '',
      'Guidelines:',
      '- Short (under 180 words), warm, specific, zero corporate-speak.',
      '- Lead with genuine connection to the brand (they actually use or love this stuff).',
      '- Be honest about audience size; frame it as authentic reach, not big numbers.',
      '- Suggest an open-ended partnership conversation; do NOT quote prices in a first email.',
      '- No placeholders, no invented facts, no emoji.',
      '',
      '## Athlete',
      athleteContext(args.profile, args.interview),
      '',
      '## Brand',
      `Name: ${args.brand.name}`,
      `Website: ${args.brand.domain}`,
      `Description: ${args.brand.description ?? 'n/a'}`,
      `Why this brand fits this athlete: ${args.fitReason}`,
    ].join('\n'),
  )
}

// Counter/negotiation reply, grounded in the athlete's stated per-tier
// preferences. Drafted only after the athlete pastes in the brand's reply.
export async function draftCounterEmail(args: {
  profile: Profile
  interview: Interview
  brand: Brand
  thread: Pick<Message, 'direction' | 'subject' | 'content'>[]
}): Promise<EmailDraft> {
  const threadText = args.thread
    .map((message) => {
      const who = message.direction === 'outbound_draft' ? 'ATHLETE' : 'BRAND'
      return `--- ${who}${message.subject ? ` (subject: ${message.subject})` : ''} ---\n${message.content}`
    })
    .join('\n\n')

  return draft(
    [
      "Draft the student-athlete's reply in an ongoing NIL negotiation with a brand.",
      'The athlete pasted in the brand\'s latest reply; write the response they would send',
      'from their own email account. First-person, ready to send.',
      '',
      'Guidelines:',
      '- Anchor the ask to the athlete\'s stated compensation preferences below and the',
      '  apparent value of the product involved. Modest following = modest, honest asks.',
      '- Be collaborative, not adversarial; keep the relationship warm either way.',
      '- Be concrete about what the athlete would deliver (posts they would make anyway).',
      '- If the brand\'s offer already meets the athlete\'s stated preference, accept',
      '  gracefully instead of pushing for more.',
      '- No placeholders, no invented facts, no emoji.',
      '',
      '## Athlete',
      athleteContext(args.profile, args.interview),
      '',
      '## Brand',
      `Name: ${args.brand.name} (${args.brand.domain})`,
      '',
      '## Thread so far (oldest first)',
      threadText,
    ].join('\n'),
  )
}
