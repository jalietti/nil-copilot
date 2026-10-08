import type { Message } from './supabase/types'

// Which message on a deal is the athlete's live draft. A draft stops being
// editable once the athlete confirms they sent it from their own email
// client ("I sent it" stamps sent_at) — the app never sends anything itself.

type ThreadMessage = Pick<Message, 'id' | 'direction' | 'sent_at'>

export function isSent(message: Pick<Message, 'direction' | 'sent_at'>): boolean {
  return message.direction === 'outbound_draft' && message.sent_at !== null
}

// The latest message, if it's an outbound draft the athlete hasn't sent yet.
export function activeDraft<T extends ThreadMessage>(messages: T[]): T | null {
  const last = messages.at(-1)
  return last && last.direction === 'outbound_draft' && last.sent_at === null ? last : null
}

// "I sent it" only applies to the live draft — not an earlier draft, an
// already-sent one (double click / stale tab), or a pasted brand reply.
export function canMarkSent(messages: ThreadMessage[], messageId: string): boolean {
  return activeDraft(messages)?.id === messageId
}
