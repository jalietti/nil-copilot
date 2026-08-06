'use client'

import { useState, useTransition } from 'react'
import {
  COMPENSATION_ASK_LABELS,
  PRODUCT_VALUE_TIER_LABELS,
  type CompensationAsk,
  type ProductValueTier,
} from '@/lib/deal-preferences'
import { submitInterview } from './actions'

const inputClass = 'rounded border border-neutral-300 px-3 py-2'

const TIERS: ProductValueTier[] = ['low', 'mid', 'high']
const ASKS = Object.keys(COMPENSATION_ASK_LABELS) as CompensationAsk[]

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

interface Props {
  initial?: {
    interests: string[]
    brands_used: string[]
    what_matters: string
    deal_preferences: Partial<Record<ProductValueTier, CompensationAsk>> & { notes?: string }
  }
}

export function InterviewForm({ initial }: Props) {
  const [interests, setInterests] = useState(initial?.interests.join('\n') ?? '')
  const [brandsUsed, setBrandsUsed] = useState(initial?.brands_used.join('\n') ?? '')
  const [whatMatters, setWhatMatters] = useState(initial?.what_matters ?? '')
  const [prefs, setPrefs] = useState<Record<ProductValueTier, CompensationAsk>>({
    low: initial?.deal_preferences.low ?? 'product_only',
    mid: initial?.deal_preferences.mid ?? 'product_plus_payment',
    high: initial?.deal_preferences.high ?? 'payment_required',
  })
  const [notes, setNotes] = useState(initial?.deal_preferences.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitInterview({
        interests: parseLines(interests),
        brands_used: parseLines(brandsUsed),
        what_matters: whatMatters,
        deal_preferences: { ...prefs, notes: notes.trim() === '' ? undefined : notes },
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">What are you genuinely into?</span>
        <span className="text-neutral-500">
          One per line — hobbies, gear you care about, causes. The more specific, the better the
          brand matches.
        </span>
        <textarea
          required
          rows={4}
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder={'sustainable outdoor gear\ntrail running\nbackpacking'}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Brands or products you actually use and like</span>
        <span className="text-neutral-500">One per line. Optional but powerful.</span>
        <textarea
          rows={3}
          value={brandsUsed}
          onChange={(e) => setBrandsUsed(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">What matters to you in a partnership?</span>
        <textarea
          rows={3}
          value={whatMatters}
          onChange={(e) => setWhatMatters(e.target.value)}
          placeholder="e.g. I'd rather work with small brands I believe in than chase the biggest check"
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          What would make a deal worth it to you?
        </legend>
        <p className="text-sm text-neutral-500">
          Your answers here drive what the copilot asks for when it drafts outreach and counters.
        </p>
        {TIERS.map((tier) => (
          <label key={tier} className="flex flex-col gap-1 text-sm">
            {PRODUCT_VALUE_TIER_LABELS[tier]}
            <select
              value={prefs[tier]}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, [tier]: e.target.value as CompensationAsk }))
              }
              className={inputClass}
            >
              {ASKS.map((ask) => (
                <option key={ask} value={ask}>
                  {COMPENSATION_ASK_LABELS[ask]}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm">
          Anything else about compensation? (optional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save and find brands'}
      </button>
    </form>
  )
}
