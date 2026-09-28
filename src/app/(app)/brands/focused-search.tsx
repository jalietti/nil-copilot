'use client'

import { useState, useTransition } from 'react'
import { DAILY_FOCUSED_CAP } from '@/lib/discovery-guard'
import { startFocusedSearch } from './actions'

// A one-off search in a direction the athlete names, beyond their saved
// interests — with its own daily allowance on top of regular runs.
export function FocusedSearch({ disabled }: { disabled: boolean }) {
  const [focus, setFocus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await startFocusedSearch(focus)
      if (!result.ok) setError(result.message)
      else setFocus('')
    })
  }

  return (
    <section className="mb-6 rounded border border-neutral-200 p-4">
      <h2 className="mb-1 font-medium">Search a specific direction</h2>
      <p className="mb-3 text-sm text-neutral-600">
        Looking for something your interests don&apos;t cover? Describe it and the copilot will
        research it just this once. {DAILY_FOCUSED_CAP} a day, on top of your regular runs.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. women-owned skincare, specialty coffee"
          maxLength={100}
          aria-label="What to search for"
          className="min-w-0 flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || disabled || focus.trim().length < 3}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Starting…' : 'Search'}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
