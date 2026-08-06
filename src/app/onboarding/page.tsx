import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarding_completed_at) redirect('/dashboard')

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-2xl font-semibold">Tell us about you</h1>
      <p className="mb-6 text-sm text-neutral-600">
        This shapes which brands we research for you and how deals get drafted.
      </p>
      <OnboardingForm userId={user.id} />
    </main>
  )
}
