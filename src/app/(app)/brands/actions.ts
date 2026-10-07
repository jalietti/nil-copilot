'use server'

import { resolveMx } from 'node:dns/promises'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { track } from '@/lib/analytics'
import { reportError } from '@/lib/observability/sentry'
import { hasValidMx, isUsableAthleteEmail } from '@/lib/contact-email'
import { searchPreferencesSchema } from '@/lib/validators/interview'
import { contactEmailInputSchema, isRecordId } from '@/lib/validators/action-inputs'
import { saveFailed } from '@/lib/action-errors'
import { z } from 'zod'
import type { DiscoveryRunKind } from '@/lib/supabase/types'
import {
  DISCOVERY_BLOCK_MESSAGES,
  dailyWindowStart,
  evaluateDiscoveryGuard,
  type DiscoveryBlockReason,
} from '@/lib/discovery-guard'

export type StartDiscoveryResult =
  | { ok: true }
  | { ok: false; reason: DiscoveryBlockReason | 'error'; message: string }

export async function startDiscovery(): Promise<StartDiscoveryResult> {
  return startRun('regular', null)
}

const focusSchema = z
  .string()
  .trim()
  .min(3, 'Describe what to search for (at least 3 characters)')
  .max(100, 'Keep it under 100 characters')

// A one-off search in a direction the athlete names ("women-owned skincare"),
// with its own daily allowance on top of regular runs.
export async function startFocusedSearch(rawFocus: string): Promise<StartDiscoveryResult> {
  const parsed = focusSchema.safeParse(rawFocus)
  if (!parsed.success) {
    return { ok: false, reason: 'error', message: parsed.error.issues[0]?.message ?? 'Check your search' }
  }
  return startRun('focused', parsed.data)
}

async function startRun(kind: DiscoveryRunKind, focus: string | null): Promise<StartDiscoveryResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: interview } = await supabase
    .from('interviews')
    .select('id')
    .eq('athlete_id', user.id)
    .maybeSingle()
  if (!interview) redirect('/interview')

  const now = new Date()
  const { data: runs, error: runsError } = await supabase
    .from('discovery_runs')
    .select('id, status, created_at, kind')
    .eq('athlete_id', user.id)
    .or(`status.in.(queued,running),created_at.gte.${dailyWindowStart(now)}`)
  if (runsError) return { ok: false, reason: 'error', message: saveFailed(runsError, 'startDiscovery') }

  const guard = evaluateDiscoveryGuard(runs ?? [], now, kind)
  if (!guard.allowed) {
    return { ok: false, reason: guard.reason, message: DISCOVERY_BLOCK_MESSAGES[guard.reason] }
  }

  // Athletes can't update runs (only the job can), so the service role retires
  // dead runs — otherwise the one-in-flight index would block the insert.
  if (guard.staleRunIds.length > 0) {
    await createAdminClient()
      .from('discovery_runs')
      .update({ status: 'failed', error: 'Timed out', finished_at: now.toISOString() })
      .in('id', guard.staleRunIds)
      .in('status', ['queued', 'running'])
  }

  const { data: run, error } = await supabase
    .from('discovery_runs')
    .insert({ athlete_id: user.id, kind, focus })
    .select('id')
    .single()
  if (error) {
    // Unique violation on the one-in-flight index: a concurrent request won.
    if (error.code === '23505') {
      return { ok: false, reason: 'in_progress', message: DISCOVERY_BLOCK_MESSAGES.in_progress }
    }
    return { ok: false, reason: 'error', message: saveFailed(error, 'startDiscovery') }
  }

  try {
    await inngest.send({
      name: 'app/discover-brands.requested',
      data: { athleteId: user.id, runId: run.id },
    })
  } catch (e) {
    reportError(e, { action: 'startDiscovery', kind })
    // Never leave a queued row behind for a job that was never enqueued.
    await createAdminClient()
      .from('discovery_runs')
      .update({ status: 'failed', error: 'Could not enqueue', finished_at: now.toISOString() })
      .eq('id', run.id)
    return { ok: false, reason: 'error', message: 'Could not start discovery — try again' }
  }

  after(() => track('discovery_run_started', user.id, { run_id: run.id, kind }))
  revalidatePath('/brands')
  return { ok: true }
}

const MATCH_NOT_FOUND = 'Match not found'

export async function dismissMatch(matchId: string): Promise<void> {
  if (!isRecordId(matchId)) return
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: match } = await supabase
    .from('brand_matches')
    .update({ status: 'dismissed' })
    .eq('id', matchId)
    .select('brand_id')
    .maybeSingle()
  if (match) {
    after(() => track('match_dismissed', user.id, { match_id: matchId, brand_id: match.brand_id }))
  }
  revalidatePath('/brands')
}

export async function startDeal(matchId: string): Promise<{ error?: string }> {
  if (!isRecordId(matchId)) return { error: MATCH_NOT_FOUND }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: match } = await supabase
    .from('brand_matches')
    .select('brand_id')
    .eq('id', matchId)
    .single()
  if (!match) return { error: MATCH_NOT_FOUND }

  const { data: existing } = await supabase
    .from('deals')
    .select('id')
    .eq('athlete_id', user.id)
    .eq('brand_id', match.brand_id)
    .maybeSingle()

  let dealId = existing?.id
  if (!dealId) {
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({ athlete_id: user.id, brand_id: match.brand_id })
      .select('id')
      .single()
    if (error) return { error: saveFailed(error, 'startDeal') }
    dealId = deal.id
    await supabase.from('brand_matches').update({ status: 'drafting' }).eq('id', matchId)
    const newDealId = deal.id
    after(() =>
      track('deal_status_changed', user.id, { deal_id: newDealId, from: 'none', to: 'draft' }),
    )
  }

  redirect(`/deals/${dealId}`)
}

// The athlete knows (or found) a contact address discovery didn't. Stored on
// their own match only; validated with the same syntax + MX check discovery
// uses, so a typo can't become a dead-end mailto.
export async function addContactEmail(
  matchId: string,
  rawEmail: string,
): Promise<{ error?: string }> {
  if (!isRecordId(matchId)) return { error: MATCH_NOT_FOUND }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = contactEmailInputSchema.safeParse(rawEmail)
  const email = parsed.success ? parsed.data : ''
  if (!isUsableAthleteEmail(email)) return { error: 'That doesn’t look like a usable email address' }
  if (!(await hasValidMx(email, resolveMx))) {
    return { error: `${email.split('@')[1]} can’t receive email — double-check the address` }
  }

  const { data: match, error } = await supabase
    .from('brand_matches')
    .update({ contact_email: email })
    .eq('id', matchId)
    .select('brand_id')
    .maybeSingle()
  if (error) return { error: saveFailed(error, 'addContactEmail') }
  if (!match) return { error: MATCH_NOT_FOUND }

  after(() => track('contact_email_added', user.id, { match_id: matchId, brand_id: match.brand_id }))
  revalidatePath('/brands')
  return {}
}

// "What you're looking for": values and industries, edited separately from
// the interview. Once edited, re-doing the interview won't overwrite values.
export async function saveSearchPreferences(raw: unknown): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = searchPreferencesSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your entries' }
  const dedupe = (items: string[]) => [...new Map(items.map((i) => [i.toLowerCase(), i])).values()]

  const { data, error } = await supabase
    .from('interviews')
    .update({
      values: dedupe(parsed.data.values),
      target_industries: dedupe(parsed.data.target_industries),
      values_customized: true,
    })
    .eq('athlete_id', user.id)
    .select('id')
    .maybeSingle()
  if (error) return { error: saveFailed(error, 'saveSearchPreferences') }
  if (!data) return { error: 'Do the interview first' }

  after(() =>
    track('search_preferences_updated', user.id, {
      values_count: parsed.data.values.length,
      industries_count: parsed.data.target_industries.length,
    }),
  )
  revalidatePath('/brands')
  return {}
}
