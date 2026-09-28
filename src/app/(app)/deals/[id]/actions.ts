'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { draftOutreachEmail, draftCounterEmail, draftFollowUpEmail } from '@/lib/draft-email'
import { track } from '@/lib/analytics'
import { draftEditUpdate, regeneratedDraftUpdate } from '@/lib/draft-edits'
import { draftKind, type DraftKind } from '@/lib/draft-kind'
import { needsFollowUp, nextDealStatus } from '@/lib/deal-follow-up'
import { reportError } from '@/lib/observability/sentry'
import type { Brand, Deal, DealStatus, Interview, Message, Profile } from '@/lib/supabase/types'

const DRAFTING_FAILED = 'The copilot couldn’t write a draft just now — try again in a minute.'

function trackStatusChange(athleteId: string, dealId: string, from: DealStatus, to: DealStatus) {
  if (from === to) return
  after(() => track('deal_status_changed', athleteId, { deal_id: dealId, from, to }))
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

interface DealContext {
  dealId: string
  athleteId: string
  dealStatus: DealStatus
  deal: Pick<Deal, 'status' | 'sent_at' | 'updated_at'>
  brand: Brand
  profile: Profile
  interview: Interview
  messages: Message[]
  fitReason: string
}

async function loadDealContext(dealId: string): Promise<DealContext | { error: string }> {
  const { supabase, user } = await requireUser()

  const { data: deal } = await supabase
    .from('deals')
    .select('id, brand_id, athlete_id, status, sent_at, updated_at')
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
    athleteId: user.id,
    dealStatus: deal.status,
    deal,
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
    reportError(e, { action: 'generateOutreachDraft' })
    return { error: DRAFTING_FAILED }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    deal_id: dealId,
    direction: 'outbound_draft',
    subject: draft.subject,
    content: draft.body,
  })
  if (error) return { error: error.message }
  after(() =>
    track('outreach_draft_generated', ctx.athleteId, {
      deal_id: dealId,
      brand_id: ctx.brand.id,
      voice_profile: ctx.interview.voice_profile !== null,
    }),
  )
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
    reportError(e, { action: 'generateCounterDraft' })
    return { error: DRAFTING_FAILED }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    deal_id: dealId,
    direction: 'outbound_draft',
    subject: draft.subject,
    content: draft.body,
  })
  if (error) return { error: error.message }
  const status = nextDealStatus(ctx.dealStatus, 'counter_drafted')
  await supabase.from('deals').update({ status }).eq('id', dealId)
  after(() =>
    track('counter_draft_generated', ctx.athleteId, {
      deal_id: dealId,
      voice_profile: ctx.interview.voice_profile !== null,
    }),
  )
  trackStatusChange(ctx.athleteId, dealId, ctx.dealStatus, status)
  revalidatePath(`/deals/${dealId}`)
  return {}
}

export async function saveDraftEdits(
  messageId: string,
  dealId: string,
  subject: string,
  content: string,
): Promise<{ error?: string }> {
  if (content.trim().length === 0) return { error: 'The email body is empty' }
  if (subject.length > 200 || content.length > 8000) return { error: 'That draft is too long' }

  const supabase = await createClient()
  const { data: message } = await supabase
    .from('messages')
    .select('subject, content, athlete_edited, direction')
    .eq('id', messageId)
    .eq('deal_id', dealId)
    .maybeSingle()
  if (!message || message.direction !== 'outbound_draft') return { error: 'Draft not found' }

  const update = draftEditUpdate(message, { subject, content })
  if (!update) return {}
  const { error } = await supabase.from('messages').update(update).eq('id', messageId)
  if (error) return { error: error.message }
  revalidatePath(`/deals/${dealId}`)
  return {}
}

// The athlete confirms they clicked send in their own email client. The app
// never sends anything itself — this only records what already happened.
export async function markSent(dealId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()

  const { data: deal } = await supabase
    .from('deals')
    .select('brand_id, status')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return { error: 'Deal not found' }

  const newStatus = nextDealStatus(deal.status, 'marked_sent')
  // Starts (or, after a follow-up, restarts) the "did you hear back?" clock.
  const sentAt = newStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}
  const { error } = await supabase
    .from('deals')
    .update({ status: newStatus, ...sentAt })
    .eq('id', dealId)
  if (error) return { error: error.message }

  await supabase
    .from('brand_matches')
    .update({ status: 'contacted' })
    .eq('athlete_id', user.id)
    .eq('brand_id', deal.brand_id)
  trackStatusChange(user.id, dealId, deal.status, newStatus)
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

  const { supabase, user } = await requireUser()
  const { data: deal } = await supabase.from('deals').select('status').eq('id', dealId).maybeSingle()
  if (!deal) return { error: 'Deal not found' }

  const { error } = await supabase.from('messages').insert({
    deal_id: dealId,
    direction: 'inbound_pasted',
    content: trimmed,
  })
  if (error) return { error: error.message }
  const status = nextDealStatus(deal.status, 'reply_pasted')
  await supabase.from('deals').update({ status }).eq('id', dealId)
  after(() => track('reply_pasted', user.id, { deal_id: dealId }))
  trackStatusChange(user.id, dealId, deal.status, status)
  revalidatePath(`/deals/${dealId}`)
  return {}
}

export async function setDealStatus(
  dealId: string,
  status: 'agreed' | 'closed' | 'dead',
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  const { data: deal } = await supabase.from('deals').select('status').eq('id', dealId).maybeSingle()
  if (!deal) return { error: 'Deal not found' }

  const newStatus = nextDealStatus(deal.status, status)
  const { error } = await supabase.from('deals').update({ status: newStatus }).eq('id', dealId)
  if (error) return { error: error.message }
  trackStatusChange(user.id, dealId, deal.status, newStatus)
  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/dashboard')
  return {}
}

// "Not yet" from the dashboard prompt: draft a short nudge for the athlete to
// send themselves via mailto, same as outreach. The deal stays `sent`.
export async function generateFollowUpDraft(dealId: string): Promise<{ error?: string }> {
  const ctx = await loadDealContext(dealId)
  if ('error' in ctx) return { error: ctx.error }
  if (!needsFollowUp({ ...ctx.deal, messages: ctx.messages }, new Date())) {
    return { error: 'No follow-up needed for this one right now' }
  }

  let draft
  try {
    draft = await draftFollowUpEmail({
      profile: ctx.profile,
      interview: ctx.interview,
      brand: ctx.brand,
      thread: ctx.messages,
    })
  } catch (e) {
    reportError(e, { action: 'generateFollowUpDraft' })
    return { error: DRAFTING_FAILED }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    deal_id: dealId,
    direction: 'outbound_draft',
    subject: draft.subject,
    content: draft.body,
  })
  if (error) return { error: error.message }
  after(() =>
    track('follow_up_draft_generated', ctx.athleteId, {
      deal_id: dealId,
      voice_profile: ctx.interview.voice_profile !== null,
    }),
  )
  revalidatePath('/dashboard')
  redirect(`/deals/${dealId}`)
}

// Analytics only: the athlete opened a draft in their own email client. The
// app still sends nothing — the athlete presses send there.
export async function recordMailtoClick(
  dealId: string,
  kind: DraftKind,
): Promise<void> {
  const { supabase, user } = await requireUser()
  const { data: deal } = await supabase.from('deals').select('id').eq('id', dealId).maybeSingle()
  if (!deal) return
  after(() => track('mailto_clicked', user.id, { deal_id: dealId, kind }))
}

// "Try another version": redraft the active draft with a different angle. The
// replaced version (and any edits to it) is kept in previous_versions.
export async function regenerateDraft(dealId: string, messageId: string): Promise<{ error?: string }> {
  const ctx = await loadDealContext(dealId)
  if ('error' in ctx) return { error: ctx.error }

  const current = ctx.messages.at(-1)
  if (!current || current.id !== messageId || current.direction !== 'outbound_draft') {
    return { error: 'Only the latest draft can be redrafted' }
  }
  const before = ctx.messages.slice(0, -1)
  const kind = draftKind(before)
  const shared = {
    profile: ctx.profile,
    interview: ctx.interview,
    brand: ctx.brand,
    previousDraft: { subject: current.subject ?? '', body: current.content },
  }

  let draft
  try {
    draft =
      kind === 'outreach'
        ? await draftOutreachEmail({ ...shared, fitReason: ctx.fitReason })
        : kind === 'counter'
          ? await draftCounterEmail({ ...shared, thread: before })
          : await draftFollowUpEmail({ ...shared, thread: before })
  } catch (e) {
    reportError(e, { action: 'regenerateDraft' })
    return { error: DRAFTING_FAILED }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('messages')
    .update(regeneratedDraftUpdate(current, { subject: draft.subject, content: draft.body }, new Date()))
    .eq('id', messageId)
  if (error) return { error: error.message }
  after(() => track('draft_regenerated', ctx.athleteId, { deal_id: dealId, kind }))
  revalidatePath(`/deals/${dealId}`)
  return {}
}
