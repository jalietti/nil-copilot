'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button, Notice } from '@/components/ui'
import { PlusIcon } from '@/components/icons'
import { startDiscovery } from './actions'

const REFRESH_MS = 5000
// The header row stays clean; any error from starting a run is portaled into
// this slot (rendered by the page, just below the header) instead.
const ERROR_SLOT_ID = 'discovery-error-slot'

interface Props {
  // Computed server-side: queued/running and not stale.
  inFlight: boolean
}

export function DiscoveryControls({ inFlight }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // While a run is in flight, re-fetch the page so matches appear as the job
  // stores them. Stops once the server reports the run finished (or went
  // stale). Plain polling — the run is minutes long and this is one page.
  useEffect(() => {
    if (!inFlight) return
    const timer = setInterval(() => router.refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [inFlight, router])

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await startDiscovery()
      if (!result.ok) setError(result.message)
    })
  }

  // This component only runs client-side ('use client'), but still
  // server-renders during SSR where `document` doesn't exist.
  const errorSlot = typeof document !== 'undefined' ? document.getElementById(ERROR_SLOT_ID) : null

  return (
    <>
      <Button onClick={handleClick} disabled={pending || inFlight}>
        {!inFlight && <PlusIcon size={18} />}
        {inFlight ? 'Researching…' : pending ? 'Starting…' : 'Find more brands'}
      </Button>
      {error &&
        errorSlot &&
        createPortal(<Notice tone="error">{error}</Notice>, errorSlot)}
    </>
  )
}
