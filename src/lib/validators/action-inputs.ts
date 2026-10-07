import { z } from 'zod'

// Runtime checks for server action arguments. TypeScript types don't survive
// the network: anyone can call a server action with any JSON, so ids, enums and
// text are checked here before they reach Supabase. RLS still decides whose
// rows can be touched — this only rejects malformed input up front.

const recordIdSchema = z.uuid()

export function isRecordId(value: unknown): value is string {
  return recordIdSchema.safeParse(value).success
}

export const dealOutcomeSchema = z.enum(['agreed', 'closed', 'dead'])

export const draftKindSchema = z.enum(['outreach', 'counter', 'follow_up'])

const DRAFT_TOO_LONG = 'That draft is too long'

// Not trimmed: the athlete's edit is stored exactly as typed.
export const draftEditSchema = z.object({
  subject: z.string().max(200, DRAFT_TOO_LONG),
  content: z
    .string()
    .max(8000, DRAFT_TOO_LONG)
    .refine((content) => content.trim().length > 0, 'The email body is empty'),
})

export const brandReplySchema = z
  .string()
  .trim()
  .min(1, 'Paste the brand’s reply first')
  .max(20_000, 'That reply is too long')

// Syntax and MX checks happen afterwards (contact-email.ts); this only makes
// sure it's a sane-length string first. 320 is the RFC 5321 address limit.
export const contactEmailInputSchema = z.string().trim().toLowerCase().max(320)
