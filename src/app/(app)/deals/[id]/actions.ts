'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { draftOutreachEmail, draftCounterEmail } from '@/lib/draft-email'
import type { Brand, Interview, Message, Profile } from '@/lib/supabase/types'

interface DealContext {
  dealId: string
  brand: Brand
  profile: Profile
  interview: Interview
  messages: Message[]
  fitReason: string
}

async function loadDealContext(dealId: string): Promise<DealContext | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deal } = await supabase
    .from('deals')
    .select('id, brand_id, athlete_id')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return { error: 'Deal not found' }

  const [{ data: brand }, { data: profile }, { data: interview }, { data: messages }, { data: match }] =
    await Promise.all([
      supabase.from('brands').select('*').eq('id', deal.brand_id).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('interviews').select('*').eq('athlete_id', user.id).maybeSingle(),
      supabase
        .from('messages')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true }),
      supabase
        .from('brand_matches')
        .select('fit_reason')
        .eq('athlete_id', user.id)
        .eq('brand_id', deal.brand_id)
        .maybeSingle(),
    ])

  if (!brand || !profile) return { error: 'Missing brand or profile' }
  if (!interview) return { error: 'Do the interview first — drafts are grounded in it' }

  return {
    dealId,
    brand: brand as Brand,
    profile: profile as Profile,
    interview: interview as Interview,
    messages: (messages ?? []) as Message[],
    fitReason: match?.fit_reason ?? '',
  }
}

export async function generateOutreachDraft(dealId: string): Promise<{ error?: string }> {
  const ctx = await loadDealContext(dealId)
  if ('error' in ctx) return { error: ctx.error }

  let draft
  try {
    draft = await draftOutreachEmail({
      profile: ctx.profile,
      interview: ctx.interview,
      brand: ctx.brand,
      fitReason: ctx.fitReason,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Drafting failed' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    deal_id: dealId,
    direction: 'outbound_draft',
    subject: draft.subject,
    content: draft.body,
  })
  if (error) return { error: error.message }
  revalidatePath(`/deals/${dealId}`)
  return {}
}

export async function generateCounterDraft(dealId: string): Promise<{ error?: string }> {
  const ctx = await loadDealContext(dealId)
  if ('error' in ctx) return { error: ctx.error }
  if (ctx.messages.at(-1)?.direction !== 'inbound_pasted') {
    return { error: 'Paste the brand’s reply first — counters are drafted from it' }
  }

  let draft
  try {
    draft = await draftCounterEmail({
      profile: ctx.profile,
      interview: ctx.interview,
      brand: ctx.brand,
      thread: ctx.messages,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Drafting failed' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    deal_id: dealId,
    direction: 'outbound_draft',
    subject: draft.subject,
    content: draft.body,
  })
  if (error) return { error: error.message }
  await supabase.from('deals').update({ status: 'negotiating' }).eq('id', dealId)
  revalidatePath(`/deals/${dealId}`)
  return {}
}

export async function saveDraftEdits(
  messageId: string,
  dealId: string,
  subject: string,
  content: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('messages')
    .update({ subject, content, athlete_edited: true })
    .eq('id', messageId)
  if (error) return { error: error.message }
  revalidatePath(`/deals/${dealId}`)
  return {}
}

// The athlete confirms they clicked send in their own email client. The app
// never sends anything itself — this only records what already happened.
export async function markSent(dealId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deal } = await supabase
    .from('deals')
    .select('brand_id, status')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return { error: 'Deal not found' }

  const newStatus = deal.status === 'draft' ? 'sent' : deal.status
  const { error } = await supabase.from('deals').update({ status: newStatus }).eq('id', dealId)
  if (error) return { error: error.message }

  await supabase
    .from('brand_matches')
    .update({ status: 'contacted' })
    .eq('athlete_id', user.id)
    .eq('brand_id', deal.brand_id)
  revalidatePath(`/deals/${dealId}`)
  return {}
}

export async function saveBrandReply(
  dealId: string,
  content: string,
): Promise<{ error?: string }> {
  const trimmed = content.trim()
  if (trimmed.length === 0) return { error: 'Paste the brand’s reply first' }
  if (trimmed.length > 20_000) return { error: 'That reply is too long' }

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    deal_id: dealId,
    direction: 'inbound_pasted',
    content: trimmed,
  })
  if (error) return { error: error.message }
  await supabase.from('deals').update({ status: 'reply_received' }).eq('id', dealId)
  revalidatePath(`/deals/${dealId}`)
  return {}
}

export async function setDealStatus(
  dealId: string,
  status: 'agreed' | 'closed' | 'dead',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').update({ status }).eq('id', dealId)
  if (error) return { error: error.message }
  revalidatePath(`/deals/${dealId}`)
  return {}
}
