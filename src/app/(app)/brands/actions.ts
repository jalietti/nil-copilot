'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { track } from '@/lib/analytics'
import { reportError } from '@/lib/observability/sentry'
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
    .select('id, status, created_at')
    .eq('athlete_id', user.id)
    .or(`status.in.(queued,running),created_at.gte.${dailyWindowStart(now)}`)
  if (runsError) return { ok: false, reason: 'error', message: runsError.message }

  const guard = evaluateDiscoveryGuard(runs ?? [], now)
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
    .insert({ athlete_id: user.id })
    .select('id')
    .single()
  if (error) {
    // Unique violation on the one-in-flight index: a concurrent request won.
    if (error.code === '23505') {
      return { ok: false, reason: 'in_progress', message: DISCOVERY_BLOCK_MESSAGES.in_progress }
    }
    return { ok: false, reason: 'error', message: error.message }
  }

  try {
    await inngest.send({
      name: 'app/discover-brands.requested',
      data: { athleteId: user.id, runId: run.id },
    })
  } catch (e) {
    reportError(e, { action: 'startDiscovery' })
    // Never leave a queued row behind for a job that was never enqueued.
    await createAdminClient()
      .from('discovery_runs')
      .update({ status: 'failed', error: 'Could not enqueue', finished_at: now.toISOString() })
      .eq('id', run.id)
    return { ok: false, reason: 'error', message: 'Could not start discovery — try again' }
  }

  after(() => track('discovery_run_started', user.id, { run_id: run.id }))
  revalidatePath('/brands')
  return { ok: true }
}

export async function dismissMatch(matchId: string): Promise<void> {
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
  if (!match) return { error: 'Match not found' }

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
    if (error) return { error: error.message }
    dealId = deal.id
    await supabase.from('brand_matches').update({ status: 'drafting' }).eq('id', matchId)
    const newDealId = deal.id
    after(() =>
      track('deal_status_changed', user.id, { deal_id: newDealId, from: 'none', to: 'draft' }),
    )
  }

  redirect(`/deals/${dealId}`)
}
