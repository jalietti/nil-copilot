import { z } from 'zod'

const TERMS_REQUIRED = 'Agree to the Terms and Privacy Policy to continue'

export const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  inviteCode: z.string().trim().min(1, 'An invite code is required').max(64),
  // Checked on the server too: the checkbox alone is only a UI hint.
  acceptedTerms: z.literal(true, { error: TERMS_REQUIRED }),
})
