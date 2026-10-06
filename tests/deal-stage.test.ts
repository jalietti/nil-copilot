import { describe, expect, it } from 'vitest'
import { DEAL_GROUPS, dealProgress, dealStage, groupDeals } from '@/lib/deal-stage'
import type { DealStatus } from '@/lib/supabase/types'

describe('dealStage', () => {
  it('puts drafts and fresh replies in "Your move"', () => {
    expect(dealStage('draft').group).toBe('move')
    expect(dealStage('reply_received').group).toBe('move')
  })

  it('maps every other status to exactly one group', () => {
    expect(dealStage('sent').group).toBe('waiting')
    expect(dealStage('negotiating').group).toBe('negotiating')
    expect(dealStage('agreed').group).toBe('agreed')
    expect(dealStage('closed').group).toBe('past')
    expect(dealStage('dead').group).toBe('past')
  })

  it('marks only dead deals as a warning', () => {
    const all: DealStatus[] = ['draft', 'sent', 'reply_received', 'negotiating', 'agreed', 'closed', 'dead']
    expect(all.filter((s) => dealStage(s).tone === 'warn')).toEqual(['dead'])
  })
})

describe('groupDeals', () => {
  const deals = [
    { id: 'a', status: 'sent' as DealStatus },
    { id: 'b', status: 'reply_received' as DealStatus },
    { id: 'c', status: 'dead' as DealStatus },
    { id: 'd', status: 'draft' as DealStatus },
  ]

  it('returns non-empty groups in pipeline order, keeping deal order within a group', () => {
    const groups = groupDeals(deals)
    expect(groups.map((g) => g.key)).toEqual(['move', 'waiting', 'past'])
    expect(groups[0].deals.map((d) => d.id)).toEqual(['b', 'd'])
  })

  it('filters to one group when asked', () => {
    expect(groupDeals(deals, 'past').map((g) => g.key)).toEqual(['past'])
  })

  it('lists groups in the order the pipeline flows', () => {
    expect(DEAL_GROUPS.map((g) => g.key)).toEqual(['move', 'waiting', 'negotiating', 'agreed', 'past'])
  })
})

describe('dealProgress', () => {
  it('puts a draft on step 1, current', () => {
    expect(dealProgress('draft').map((s) => s.state)).toEqual(['current', 'next', 'next', 'next'])
  })

  it('marks outreach done and reply current once sent', () => {
    expect(dealProgress('sent').map((s) => s.state)).toEqual(['done', 'current', 'next', 'next'])
  })

  it('marks the first two steps done and negotiate current on reply or negotiating', () => {
    expect(dealProgress('reply_received').map((s) => s.state)).toEqual(['done', 'done', 'current', 'next'])
    expect(dealProgress('negotiating').map((s) => s.state)).toEqual(['done', 'done', 'current', 'next'])
  })

  it('marks every step done once agreed or closed', () => {
    expect(dealProgress('agreed').map((s) => s.state)).toEqual(['done', 'done', 'done', 'done'])
    expect(dealProgress('closed').map((s) => s.state)).toEqual(['done', 'done', 'done', 'done'])
  })

  it('mutes every step when the deal is dead', () => {
    expect(dealProgress('dead').map((s) => s.state)).toEqual(['muted', 'muted', 'muted', 'muted'])
  })

  it('keeps the canonical step labels in order', () => {
    expect(dealProgress('draft').map((s) => s.label)).toEqual([
      'Outreach sent',
      'They replied',
      'Negotiate',
      'Agreed',
    ])
  })
})
