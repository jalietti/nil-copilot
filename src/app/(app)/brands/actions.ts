'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

export async function startDiscovery(): Promise<{ error?: string }> {
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

  const { data: run, error } = await supabase
    .from('discovery_runs')
    .insert({ athlete_id: user.id })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await inngest.send({
    name: 'app/discover-brands.requested',
    data: { athleteId: user.id, runId: run.id },
  })

  revalidatePath('/brands')
  return {}
}

export async function dismissMatch(matchId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('brand_matches').update({ status: 'dismissed' }).eq('id', matchId)
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
  }

  redirect(`/deals/${dealId}`)
}
