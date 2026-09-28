'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { generateFollowUpDraft, setDealStatus } from '../deals/[id]/actions'

// "Did you hear back?" — shown for deals sent ~5+ days ago with no reply
// logged. The app can't see the athlete's inbox, so it just asks.
export function FollowUpPrompt({ dealId, brandName }: { dealId: string; brandName: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <li className="rounded border border-amber-300 bg-amber-50 p-3">
      <p className="mb-2 text-sm">
        It&apos;s been a few days since you emailed <span className="font-medium">{brandName}</span>.
        Did you hear back?
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/deals/${dealId}#reply`}
          className="rounded bg-black px-3 py-1.5 text-white"
        >
          They replied
        </Link>
        <button
          onClick={() => run(() => generateFollowUpDraft(dealId))}
          disabled={pending}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-50"
        >
          {pending ? 'Drafting…' : 'Not yet — draft a follow-up'}
        </button>
        <button
          onClick={() => run(() => setDealStatus(dealId, 'dead'))}
          disabled={pending}
          className="text-neutral-500 underline disabled:opacity-50"
        >
          I&apos;m done with this one
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  )
}
