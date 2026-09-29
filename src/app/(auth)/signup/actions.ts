'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  INVITE_CODE_MESSAGES,
  checkInviteCode,
  isInviteRejection,
  normalizeInviteCode,
} from '@/lib/invite-codes'

const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  inviteCode: z.string().trim().min(1, 'An invite code is required').max(64),
})

export async function signUpWithInvite(raw: unknown): Promise<{ error?: string }> {
  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' }
  const code = normalizeInviteCode(parsed.data.inviteCode)

  const { data: row } = await createAdminClient()
    .from('invite_codes')
    .select('max_uses, uses, revoked_at')
    .eq('code', code)
    .maybeSingle()
  const problem = checkInviteCode(row)
  if (problem) return { error: INVITE_CODE_MESSAGES[problem] }

  const origin = (await headers()).get('origin') ?? ''
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // Checked and consumed by the auth.users trigger — the actual gate.
      data: { invite_code: code },
    },
  })
  if (error) {
    return { error: isInviteRejection(error.message) ? INVITE_CODE_MESSAGES.invalid : error.message }
  }
  // With email confirmation turned off in Supabase (the pilot's setting) the
  // athlete is signed in right away; with it on, they get a confirmation
  // email and the page says so.
  if (data.session) redirect('/onboarding')
  return {}
}
