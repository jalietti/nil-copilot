import type { Message } from './supabase/types'

export type DraftKind = 'outreach' | 'counter' | 'follow_up'

// What an outbound draft is, from the messages before it: a reply to a pasted
// brand message is a counter; a later draft with no reply yet is a follow-up.
export function draftKind(messagesBefore: Pick<Message, 'direction'>[]): DraftKind {
  if (messagesBefore.some((m) => m.direction === 'inbound_pasted')) return 'counter'
  return messagesBefore.some((m) => m.direction === 'outbound_draft') ? 'follow_up' : 'outreach'
}
