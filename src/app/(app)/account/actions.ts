'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { track } from '@/lib/analytics'
import { reportError } from '@/lib/observability/sentry'

// Permanently deletes the signed-in athlete. Removing the auth user cascades
// through profiles to every table holding their data (interview and voice
// profile, matches, deals, messages, discovery runs). Anonymous brand-level
// outcome facts have no link to the athlete and stay.
export async function deleteAccount(confirmation: string): Promise<{ error?: string }> {
  if (confirmation.trim() !== 'DELETE') return { error: 'Type DELETE to confirm' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await track('account_deleted', user.id, {})
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) {
    reportError(error, { action: 'deleteAccount' })
    return { error: 'Couldn’t delete your account just now — try again in a minute.' }
  }

  // The session belongs to a user that no longer exists; just clear cookies.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login?deleted=1')
}
