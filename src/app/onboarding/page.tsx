import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: interview }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'onboarding_completed_at, full_name, school, sport, division, instagram_followers, tiktok_followers, other_followers, citizenship_status',
      )
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('interviews')
      .select('interests, brands_used, deal_preferences, raw_answers')
      .eq('athlete_id', user.id)
      .maybeSingle(),
  ])

  if (profile?.onboarding_completed_at && interview) redirect('/dashboard')

  const initialStep = profile?.onboarding_completed_at && !interview ? 3 : 1

  const prefs = (interview?.deal_preferences ?? {}) as Partial<
    Record<'low' | 'mid' | 'high', 'product_only' | 'discount_plus_product' | 'product_plus_payment' | 'payment_required'>
  > & { notes?: string }

  return (
    <OnboardingWizard
      userId={user.id}
      initialStep={initialStep}
      profileInitial={profile ?? undefined}
      interviewInitial={
        interview
          ? {
              interests: interview.interests,
              brands_used: interview.brands_used,
              what_matters:
                ((interview.raw_answers as Record<string, unknown> | null)?.what_matters as string) ??
                '',
              deal_preferences: prefs,
            }
          : undefined
      }
    />
  )
}
