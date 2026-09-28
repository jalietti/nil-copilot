'use client'

import { useState, useTransition } from 'react'
import type { Brand, BrandMatch } from '@/lib/supabase/types'
import { addContactEmail, dismissMatch, startDeal } from './actions'

const inputClass = 'rounded border border-neutral-300 px-2 py-1 text-sm'

export function MatchCard({ match, brand }: { match: BrandMatch; brand: Brand }) {
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const contactEmail = match.contact_email ?? brand.contact_email

  function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addContactEmail(match.id, email)
      if (result.error) setError(result.error)
      else setAdding(false)
    })
  }

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
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending || !contactEmail}
          onClick={() => startTransition(() => startDeal(match.id).then(() => undefined))}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {match.status === 'drafting' || match.status === 'contacted'
            ? 'Open deal'
            : 'Draft outreach'}
        </button>
        {match.contact_email && (
          <span className="text-xs text-neutral-500">Using {match.contact_email} (added by you)</span>
        )}
        {!contactEmail && !adding && (
          <span className="text-xs text-neutral-500">
            No contact email found yet ·{' '}
            <button onClick={() => setAdding(true)} className="underline">
              Know their email? Add it
            </button>
          </span>
        )}
        <button
          disabled={pending}
          onClick={() => startTransition(() => dismissMatch(match.id))}
          className="text-sm text-neutral-500 underline"
        >
          Not for me
        </button>
      </div>
      {adding && (
        <form onSubmit={saveEmail} className="mt-3 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              required
              autoFocus
              placeholder={`partnerships@${brand.domain}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              {pending ? 'Checking…' : 'Save'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs underline">
              Cancel
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Only you see this. Check their website footer or Instagram bio for a partnerships or
            hello@ address.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
    </li>
  )
}
