import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthShell } from '@/components/auth-shell'
import { ResetPasswordForm } from './reset-password-form'

// Reached from the reset email via /auth/callback, which signs the athlete in
// with the recovery link before sending them here.
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AuthShell title="Choose a new password">
      <ResetPasswordForm />
    </AuthShell>
  )
}
