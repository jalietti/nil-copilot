'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startDiscovery } from './actions'

interface Props {
  latestRun: {
    status: string
    brands_found: number
    matches_created: number
    created_at: string
  } | null
}

export function DiscoveryControls({ latestRun }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const running = latestRun?.status === 'queued' || latestRun?.status === 'running'

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await startDiscovery()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {running && (
          <button onClick={() => router.refresh()} className="text-sm text-neutral-500 underline">
            Researching… refresh
          </button>
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
          Last run: {latestRun.brands_found} brands researched, {latestRun.matches_created} matches
        </p>
      )}
      {latestRun?.status === 'failed' && (
        <p className="text-xs text-red-600">Last run failed — try again</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
