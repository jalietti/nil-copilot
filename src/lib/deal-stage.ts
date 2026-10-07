import type { DealStatus } from './supabase/types'

// How a deal status reads on screen: which pipeline group it belongs to
// (who has the next move) and how its chip looks. One vocabulary for Home,
// the deal page, and anywhere else a status shows.

export type DealGroupKey = 'move' | 'waiting' | 'negotiating' | 'agreed' | 'past'
export type StageTone = 'move' | 'draft' | 'wait' | 'nego' | 'agreed' | 'closed' | 'warn'

export const DEAL_GROUPS: { key: DealGroupKey; label: string }[] = [
  { key: 'move', label: 'Your move' },
  { key: 'waiting', label: 'Waiting on them' },
  { key: 'negotiating', label: 'Negotiating' },
  { key: 'agreed', label: 'Agreed' },
  { key: 'past', label: 'Past' },
]

const STAGES: Record<DealStatus, { group: DealGroupKey; label: string; tone: StageTone }> = {
  draft: { group: 'move', label: 'Draft ready', tone: 'draft' },
  reply_received: { group: 'move', label: 'Reply received', tone: 'move' },
  sent: { group: 'waiting', label: 'Waiting', tone: 'wait' },
  negotiating: { group: 'negotiating', label: 'Negotiating', tone: 'nego' },
  agreed: { group: 'agreed', label: 'Agreed', tone: 'agreed' },
  closed: { group: 'past', label: 'Closed', tone: 'closed' },
  dead: { group: 'past', label: 'Dead', tone: 'warn' },
}

export function dealStage(status: DealStatus) {
  return STAGES[status]
}

// The 4-step pipeline shown on the deal page's stepper: Outreach sent → They
// replied → Negotiate → Agreed. `dead` mutes every step (the chip alone says
// "Dead"); `agreed`/`closed` complete every step, including the last.
export type DealStepState = 'done' | 'current' | 'next' | 'muted'

export interface DealStep {
  label: string
  state: DealStepState
}

const PROGRESS_LABELS = ['Outreach sent', 'They replied', 'Negotiate', 'Agreed'] as const

const PROGRESS_INDEX: Record<'draft' | 'sent' | 'reply_received' | 'negotiating', number> = {
  draft: 0,
  sent: 1,
  reply_received: 2,
  negotiating: 2,
}

export function dealProgress(status: DealStatus): DealStep[] {
  if (status === 'dead') {
    return PROGRESS_LABELS.map((label) => ({ label, state: 'muted' }))
  }
  if (status === 'agreed' || status === 'closed') {
    return PROGRESS_LABELS.map((label) => ({ label, state: 'done' }))
  }
  const current = PROGRESS_INDEX[status]
  return PROGRESS_LABELS.map((label, i) => ({
    label,
    state: i < current ? 'done' : i === current ? 'current' : 'next',
  }))
}

export function isDealGroupKey(value: unknown): value is DealGroupKey {
  return DEAL_GROUPS.some((g) => g.key === value)
}

// Groups deals in pipeline order, dropping empty groups. Deal order within a
// group is preserved (callers pass them most-recent first).
export function groupDeals<T extends { status: DealStatus }>(deals: T[], only?: DealGroupKey) {
  return DEAL_GROUPS.filter((g) => !only || g.key === only)
    .map((g) => ({ ...g, deals: deals.filter((d) => STAGES[d.status].group === g.key) }))
    .filter((g) => g.deals.length > 0)
}
