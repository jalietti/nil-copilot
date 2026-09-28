'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startDiscovery } from './actions'

const REFRESH_MS = 5000

interface Props {
  latestRun: {
    status: string
    brands_found: number
    matches_created: number
    created_at: string
    kind: string
    focus: string | null
  } | null
  // Computed server-side: queued/running and not stale.
  inFlight: boolean
}

export function DiscoveryControls({ latestRun, inFlight }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const running = inFlight

  // While a run is in flight, re-fetch the page so matches appear as the job
  // stores them. Stops once the server reports the run finished (or went
  // stale). Plain polling — the run is minutes long and this is one page.
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => router.refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [running, router])

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await startDiscovery()
      if (!result.ok) setError(result.message)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {running && (
          <span className="text-sm text-neutral-500" aria-live="polite">
            {latestRun?.focus ? `Searching “${latestRun.focus}”…` : 'Researching brands…'} new
            matches show up here as they&apos;re found
          </span>
        )}
        <button
          onClick={handleClick}
          disabled={pending || running}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Starting…' : 'Find new brands'}
        </button>
      </div>
      {latestRun?.status === 'completed' && (
        <p className="text-xs text-neutral-500">
          {latestRun.focus ? `Last search (“${latestRun.focus}”)` : 'Last run'}:{' '}
          {latestRun.brands_found} brands researched, {latestRun.matches_created} matches
        </p>
      )}
      {latestRun?.status === 'failed' && !error && (
        <p className="text-xs text-red-600">
          Last run hit a problem on our end — it didn&apos;t count toward your daily runs. Try again.
        </p>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  )
}
