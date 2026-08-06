'use client'

import { useTransition } from 'react'
import type { Brand, BrandMatch } from '@/lib/supabase/types'
import { dismissMatch, startDeal } from './actions'

export function MatchCard({ match, brand }: { match: BrandMatch; brand: Brand }) {
  const [pending, startTransition] = useTransition()

  return (
    <li className="rounded border border-neutral-200 p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-medium">{brand.name}</h2>
        <a
          href={`https://${brand.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-neutral-500 underline"
        >
          {brand.domain}
        </a>
      </div>
      {brand.description && <p className="mb-2 text-sm text-neutral-600">{brand.description}</p>}
      <p className="mb-3 text-sm">
        <span className="font-medium">Why it fits: </span>
        {match.fit_reason}
      </p>
      <div className="flex items-center gap-3">
        <button
          disabled={pending || !brand.contact_email}
          onClick={() => startTransition(() => startDeal(match.id).then(() => undefined))}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {match.status === 'drafting' || match.status === 'contacted'
            ? 'Open deal'
            : 'Draft outreach'}
        </button>
        {!brand.contact_email && (
          <span className="text-xs text-neutral-500">No contact email found yet</span>
        )}
        <button
          disabled={pending}
          onClick={() => startTransition(() => dismissMatch(match.id))}
          className="text-sm text-neutral-500 underline"
        >
          Not for me
        </button>
      </div>
    </li>
  )
}
