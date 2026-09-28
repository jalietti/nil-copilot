import type { DealStatus, Message } from './supabase/types'

// The dashboard's "did you hear back?" prompt. Driven only by what the athlete
// has logged in the app (their "I sent it" clicks and pasted replies) — there
// is no inbox access, ever.

export const FOLLOW_UP_AFTER_MS = 5 * 24 * 60 * 60 * 1000

export interface FollowUpDeal {
  status: DealStatus
  sent_at: string | null
  updated_at: string
  messages: Pick<Message, 'direction' | 'created_at'>[]
}

// A deal the athlete sent at least ~5 days ago, with no reply pasted since.
// Drafting a follow-up (or sending one) restarts the clock, so the prompt
// doesn't nag while the athlete is acting on it.
export function needsFollowUp(deal: FollowUpDeal, now: Date): boolean {
  if (deal.status !== 'sent') return false
  if (deal.messages.some((m) => m.direction === 'inbound_pasted')) return false
  const lastActivity = Math.max(
    new Date(deal.sent_at ?? deal.updated_at).getTime(),
    ...deal.messages
      .filter((m) => m.direction === 'outbound_draft')
      .map((m) => new Date(m.created_at).getTime()),
  )
  return now.getTime() - lastActivity >= FOLLOW_UP_AFTER_MS
}

export type DealEvent =
  | 'marked_sent'
  | 'reply_pasted'
  | 'counter_drafted'
  | 'follow_up_drafted'
  | 'agreed'
  | 'closed'
  | 'dead'

// Single source of truth for how athlete actions move a deal.
export function nextDealStatus(current: DealStatus, event: DealEvent): DealStatus {
  switch (event) {
    case 'marked_sent':
      return current === 'draft' ? 'sent' : current
    case 'reply_pasted':
      return 'reply_received'
    case 'counter_drafted':
      return 'negotiating'
    case 'follow_up_drafted':
      // Still waiting on the brand; the follow-up is just another outbound draft.
      return current
    case 'agreed':
    case 'closed':
    case 'dead':
      return event
  }
}
