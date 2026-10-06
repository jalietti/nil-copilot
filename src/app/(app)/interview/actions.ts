'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { interviewSchema } from '@/lib/validators/interview'
import { fallbackTags, normalizeInterview } from '@/lib/normalize-interview'
import { generateVoiceProfile } from '@/lib/voice-profile'
import { withUsageContext } from '@/lib/usage'
import { checkDailyAllowance } from '@/lib/usage-guard'
import { track } from '@/lib/analytics'
import { reportError } from '@/lib/observability/sentry'

export interface InterviewActionResult {
  error?: string
}

export async function submitInterview(raw: unknown): Promise<InterviewActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = interviewSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your answers' }
  }

  // Checked before any call; the answers stay in the form, so nothing is lost.
  const blocked = await checkDailyAllowance('interview', user.id)
  if (blocked) return { error: blocked }

  // Independent Claude calls; either failing must not lose the answers.
  const [tagsResult, voiceResult] = await withUsageContext(
    { source: 'interview', athleteId: user.id },
    () => Promise.allSettled([normalizeInterview(parsed.data), generateVoiceProfile(parsed.data)]),
  )

  let categoryTags: string[]
  let suggestedValues: string[] = []
  if (tagsResult.status === 'fulfilled') {
    categoryTags = tagsResult.value.categoryTags
    suggestedValues = tagsResult.value.values
  } else {
    reportError(tagsResult.reason, { action: 'normalizeInterview' })
    // Claude unavailable — save with raw interests as tags rather than losing answers.
    categoryTags = fallbackTags(parsed.data)
  }

  let voiceProfile: string | null = null
  if (voiceResult.status === 'fulfilled') {
    voiceProfile = voiceResult.value
  } else {
    // Drafts fall back to the shared house voice.
    reportError(voiceResult.reason, { action: 'generateVoiceProfile' })
  }

  const row = {
    interests: parsed.data.interests,
    brands_used: parsed.data.brands_used,
    category_tags: categoryTags,
    deal_preferences: parsed.data.deal_preferences,
    raw_answers: { what_matters: parsed.data.what_matters },
    voice_profile: voiceProfile,
  }

  const { data: existing } = await supabase
    .from('interviews')
    .select('id, values_customized')
    .eq('athlete_id', user.id)
    .maybeSingle()

  // Values follow the interview until the athlete edits them on the Brands page.
  const values = existing?.values_customized ? {} : { values: suggestedValues }
  const { error } = existing
    ? await supabase.from('interviews').update({ ...row, ...values }).eq('id', existing.id)
    : await supabase.from('interviews').insert({ athlete_id: user.id, ...row, ...values })

  if (error) return { error: error.message }
  const athleteId = user.id
  after(() => track('interview_completed', athleteId, {
      first_time: !existing,
      voice_profile_generated: voiceProfile !== null,
    }))
  redirect('/brands')
}
