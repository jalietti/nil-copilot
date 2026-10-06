import { describe, expect, it } from 'vitest'
import { activeDraft, canMarkSent, isSent } from '@/lib/deal-thread'
import type { MessageDirection } from '@/lib/supabase/types'

const SENT = '2026-10-01T12:00:00Z'
const msg = (id: string, direction: MessageDirection, sent_at: string | null = null) => ({
  id,
  direction,
  sent_at,
})

describe('activeDraft', () => {
  it('is null with no messages', () => {
    expect(activeDraft([])).toBeNull()
  })

  it('is the outreach draft before it is sent', () => {
    expect(activeDraft([msg('a', 'outbound_draft')])?.id).toBe('a')
  })

  it('is null once the outreach is marked sent (survives a reload)', () => {
    expect(activeDraft([msg('a', 'outbound_draft', SENT)])).toBeNull()
  })

  it('is null once a negotiating counter is marked sent', () => {
    const thread = [
      msg('a', 'outbound_draft', SENT),
      msg('b', 'inbound_pasted'),
      msg('c', 'outbound_draft', SENT),
    ]
    expect(activeDraft(thread)).toBeNull()
  })

  it('is the unsent counter after a pasted reply', () => {
    const thread = [msg('a', 'outbound_draft', SENT), msg('b', 'inbound_pasted'), msg('c', 'outbound_draft')]
    expect(activeDraft(thread)?.id).toBe('c')
  })

  it('is a new follow-up drafted after a sent outreach', () => {
    const thread = [msg('a', 'outbound_draft', SENT), msg('b', 'outbound_draft')]
    expect(activeDraft(thread)?.id).toBe('b')
  })

  it('is null when the latest message is a pasted reply', () => {
    expect(activeDraft([msg('a', 'outbound_draft'), msg('b', 'inbound_pasted')])).toBeNull()
  })
})

describe('canMarkSent', () => {
  const thread = [msg('a', 'outbound_draft'), msg('b', 'inbound_pasted'), msg('c', 'outbound_draft')]

  it('allows the live draft', () => {
    expect(canMarkSent(thread, 'c')).toBe(true)
  })

  it('rejects an earlier, superseded draft', () => {
    expect(canMarkSent(thread, 'a')).toBe(false)
  })

  it('rejects a pasted brand reply', () => {
    expect(canMarkSent([msg('a', 'outbound_draft', SENT), msg('b', 'inbound_pasted')], 'b')).toBe(false)
  })

  it('rejects a draft already marked sent (double click, stale tab)', () => {
    expect(canMarkSent([msg('a', 'outbound_draft', SENT)], 'a')).toBe(false)
  })

  it('rejects an unknown id', () => {
    expect(canMarkSent(thread, 'zzz')).toBe(false)
  })
})

describe('isSent', () => {
  it('is true only for a confirmed outbound draft', () => {
    expect(isSent(msg('a', 'outbound_draft', SENT))).toBe(true)
    expect(isSent(msg('a', 'outbound_draft'))).toBe(false)
    expect(isSent(msg('a', 'inbound_pasted'))).toBe(false)
  })
})
