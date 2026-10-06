import { CheckIcon } from '@/components/icons'
import { Notice } from '@/components/ui'
import type { DiscoveryRunKind, DiscoveryRunStatus } from '@/lib/supabase/types'

// Pure server-rendered status panel — no client state of its own. While a run
// is in flight, DiscoveryControls' 5s router.refresh() re-renders this with
// fresh data, so "Started N min ago" and the match count update on their own.

interface LatestRun {
  status: DiscoveryRunStatus
  brands_found: number
  matches_created: number
  created_at: string
  finished_at: string | null
  kind: DiscoveryRunKind
  focus: string | null
}

const RECENT_COMPLETION_MS = 10 * 60 * 1000

function minutesAgo(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'less than a minute ago'
  return `${mins} min${mins === 1 ? '' : 's'} ago`
}

export function DiscoveryStatus({
  latestRun,
  inFlight,
  newMatchesCount,
  now,
}: {
  latestRun: LatestRun | null
  inFlight: boolean
  newMatchesCount: number
  now: Date
}) {
  if (inFlight && latestRun) {
    const started = latestRun.status === 'running'
    return (
      <section
        aria-live="polite"
        aria-label="Discovery progress"
        className="flex flex-col gap-4 rounded-[14px] border border-line-soft bg-surface p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="size-2.5 shrink-0 animate-pulse rounded-full bg-accent" />
            <h2 className="text-[17px] font-semibold text-ink">Researching brands for you</h2>
          </div>
          <span className="text-sm text-muted">
            Started {minutesAgo(latestRun.created_at, now)} · usually takes a few minutes
          </span>
        </div>
        <div aria-hidden="true" className="relative h-1 overflow-hidden rounded-full bg-surface-2">
          <span className="absolute inset-y-0 left-0 w-[35%] animate-slide rounded-full bg-accent" />
        </div>
        <ol className="flex flex-wrap gap-x-7 gap-y-2 text-sm">
          <li className="flex items-center gap-2 text-muted">
            <CheckIcon size={18} className="shrink-0 text-agreed" />
            Queued
          </li>
          <li className="flex items-center gap-2 font-semibold text-ink">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
            {started ? 'Researching the web' : 'Waiting to start'}
          </li>
          <li className="flex items-center gap-2 font-semibold text-ink">
            <span className="font-display text-xl text-accent-text">{newMatchesCount}</span>
            new matches so far
          </li>
        </ol>
        <p className="text-sm text-muted">
          You can leave this page. New matches land here as they&apos;re found.
        </p>
      </section>
    )
  }

  if (latestRun?.status === 'failed') {
    return <Notice tone="error">That search hit a problem. Try Find more brands again.</Notice>
  }

  if (latestRun?.status === 'completed' && latestRun.finished_at) {
    const sinceFinish = now.getTime() - new Date(latestRun.finished_at).getTime()
    if (sinceFinish <= RECENT_COMPLETION_MS) {
      const n = latestRun.matches_created
      return (
        <p className="flex items-center gap-2 text-[14px] text-ink">
          <CheckIcon size={18} className="shrink-0 text-agreed" />
          {n > 0
            ? `Found ${n} new match${n === 1 ? '' : 'es'}.`
            : 'No new matches this time. Try tuning your search.'}
        </p>
      )
    }
  }

  return null
}
