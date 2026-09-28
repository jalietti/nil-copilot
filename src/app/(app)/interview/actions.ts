'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { interviewSchema } from '@/lib/validators/interview'
import { normalizeInterviewToTags } from '@/lib/normalize-interview'
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

  let categoryTags: string[]
  try {
    categoryTags = await normalizeInterviewToTags(parsed.data)
  } catch (e) {
    reportError(e, { action: 'normalizeInterviewToTags' })
    // Claude unavailable — save with raw interests as tags rather than losing answers.
    categoryTags = parsed.data.interests.map((i) => i.toLowerCase().replace(/\s+/g, '-'))
  }

  const row = {
    interests: parsed.data.interests,
    brands_used: parsed.data.brands_used,
    category_tags: categoryTags,
    deal_preferences: parsed.data.deal_preferences,
    raw_answers: { what_matters: parsed.data.what_matters },
  }

  const { data: existing } = await supabase
    .from('interviews')
    .select('id')
    .eq('athlete_id', user.id)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('interviews').update(row).eq('id', existing.id)
    : await supabase.from('interviews').insert({ athlete_id: user.id, ...row })

  if (error) return { error: error.message }
  const athleteId = user.id
  after(() => track('interview_completed', athleteId, { first_time: !existing }))
  redirect('/brands')
}
