import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CompensationAsk, ProductValueTier } from '@/lib/deal-preferences'
import { InterviewForm } from './interview-form'

export default async function InterviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: interview } = await supabase
    .from('interviews')
    .select('interests, brands_used, deal_preferences, raw_answers')
    .eq('athlete_id', user.id)
    .maybeSingle()

  const prefs = (interview?.deal_preferences ?? {}) as Partial<
    Record<ProductValueTier, CompensationAsk>
  > & { notes?: string }

  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold">Your interview</h1>
      <p className="mb-6 text-sm text-neutral-600">
        This is how the copilot learns which brands actually fit you — and what to ask for on your
        behalf. You can update it anytime.
      </p>
      <InterviewForm
        initial={
          interview
            ? {
                interests: interview.interests,
                brands_used: interview.brands_used,
                what_matters:
                  ((interview.raw_answers as Record<string, unknown> | null)
                    ?.what_matters as string) ?? '',
                deal_preferences: prefs,
              }
            : undefined
        }
      />
    </main>
  )
}
