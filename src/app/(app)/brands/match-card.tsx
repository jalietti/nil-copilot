'use client'

import { useState, useTransition } from 'react'
import type { Brand, BrandMatch } from '@/lib/supabase/types'
import { Button, Field, FieldError, Monogram, cardClass, inputClass } from '@/components/ui'
import { CheckIcon, ExternalIcon, InfoIcon } from '@/components/icons'
import { addContactEmail, dismissMatch, startDeal } from './actions'

const SHIMMER = 'bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--line-soft)_50%,var(--surface-2)_100%)] bg-[length:200%_100%] animate-shimmer'

export function MatchCard({
  match,
  brand,
  isNew,
}: {
  match: BrandMatch
  brand: Brand
  isNew: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const contactEmail = match.contact_email ?? brand.contact_email
  const canOpenDeal = match.status === 'drafting' || match.status === 'contacted'

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
    <li className={`flex flex-col gap-3.5 p-5 ${cardClass}`}>
      <div className="flex items-start gap-3">
        <Monogram name={brand.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-[17px] font-semibold text-ink">{brand.name}</h3>
          <a
            href={`https://${brand.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="-my-3 inline-flex items-center gap-1 py-3 text-[13px] text-muted hover:text-ink"
          >
            {brand.domain}
            <ExternalIcon size={14} />
          </a>
        </div>
        {isNew && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-[12px] font-bold tracking-wide text-accent-text uppercase">
            New
          </span>
        )}
      </div>

      {match.search_focus && (
        <p className="text-[13px] text-muted">From your search: {match.search_focus}</p>
      )}

      {brand.description && (
        <p className="text-[15px] leading-relaxed text-muted">{brand.description}</p>
      )}

      <div className="flex flex-col gap-1 rounded-[10px] bg-surface-2 p-3">
        <span className="eyebrow text-[11px]">Why it fits you</span>
        <span className="text-[15px] leading-snug text-ink">{match.fit_reason}</span>
      </div>

      <div className="flex-1" />

      {contactEmail ? (
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <CheckIcon size={16} className="shrink-0 text-agreed" />
          {match.contact_email
            ? `Using ${match.contact_email} (added by you)`
            : `Contact: ${contactEmail}`}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <InfoIcon size={16} className="shrink-0" />
          No contact email found yet. Check their site footer or Instagram bio.
        </span>
      )}

      <div className="flex gap-2">
        {contactEmail ? (
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => startTransition(() => startDeal(match.id).then(() => undefined))}
          >
            {canOpenDeal ? 'Open deal' : 'Draft outreach'}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => setAdding(true)}
          >
            Add email to draft
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => dismissMatch(match.id))}
        >
          Not for me
        </Button>
      </div>

      {adding && (
        <form onSubmit={saveEmail} className="flex flex-col gap-2">
          <Field label="Contact email" hint="Only you see this.">
            <input
              type="email"
              required
              autoFocus
              placeholder={`partnerships@${brand.domain}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? 'Checking…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

// Rendered while a run is in flight, appended after the real cards.
export function MatchCardSkeleton() {
  return (
    <li
      aria-hidden="true"
      className="flex flex-col gap-3.5 rounded-[14px] border border-dashed border-line p-5"
    >
      <div className="flex items-center gap-3">
        <span className={`size-10 shrink-0 rounded-[10px] ${SHIMMER}`} />
        <div className="flex flex-1 flex-col gap-2">
          <span className={`h-3.5 w-3/5 rounded ${SHIMMER}`} />
          <span className={`h-2.5 w-2/5 rounded ${SHIMMER}`} />
        </div>
      </div>
      <span className={`h-3 rounded ${SHIMMER}`} />
      <span className={`h-3 w-4/5 rounded ${SHIMMER}`} />
      <span className={`h-16 rounded-[10px] ${SHIMMER}`} />
      <span className="text-[13px] text-muted">Arriving…</span>
    </li>
  )
}
