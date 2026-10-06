import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile-form'
import { InterviewForm } from '../interview/interview-form'
import { PageHeader, cardClass } from '@/components/ui'
import { DeleteAccount } from './delete-account'
import type { ProductValueTier, CompensationAsk } from '@/lib/deal-preferences'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: interview }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'full_name, school, sport, division, instagram_followers, tiktok_followers, other_followers, citizenship_status',
      )
      .eq('id', user.id)
      .single(),
    supabase
      .from('interviews')
      .select('interests, brands_used, deal_preferences, raw_answers')
      .eq('athlete_id', user.id)
      .maybeSingle(),
  ])

  const prefs = (interview?.deal_preferences ?? {}) as Partial<
    Record<ProductValueTier, CompensationAsk>
  > & { notes?: string }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Profile & account" description={`Signed in as ${user.email}`} />

      <section className={`flex flex-col gap-6 p-6 sm:p-8 ${cardClass}`}>
        <div className="flex flex-col gap-1">
          <h2 className="eyebrow">Your profile</h2>
          <p className="text-[15px] text-muted">
            Keep follower counts current. They shape what your copilot asks brands for.
          </p>
        </div>
        {profile && <ProfileForm userId={user.id} mode="edit" initial={profile} />}
      </section>

      <section id="interview" className={`flex flex-col gap-6 p-6 sm:p-8 scroll-mt-8 ${cardClass}`}>
        <div className="flex flex-col gap-1">
          <h2 className="eyebrow">Your interview</h2>
          <p className="text-[15px] text-muted">
            This is how the copilot learns which brands actually fit you — and what to ask for on
            your behalf. You can update it anytime.
          </p>
        </div>
        <InterviewForm
          submitLabel="Save and find brands"
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
      </section>

      <section className={`flex flex-col gap-3 p-6 text-sm text-ink sm:p-8 ${cardClass}`}>
        <h2 className="eyebrow">What NIL Copilot stores about you</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Your profile: name, school, sport, follower counts, and citizenship/visa status</li>
          <li>Your interview answers and the voice profile made from them</li>
          <li>Your brand matches, deals, drafted emails, and brand replies you pasted in</li>
        </ul>
        <p className="text-muted">
          Other athletes never see any of it. Nothing is sent to a brand unless you send it
          yourself.
        </p>
      </section>

      <DeleteAccount />
    </div>
  )
}
