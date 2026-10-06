'use client'

import { useState, useTransition } from 'react'
import { DAILY_FOCUSED_CAP } from '@/lib/discovery-guard'
import { Button, Field, FieldError, inputClass } from '@/components/ui'
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
    <section className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Field
          label={
            <>
              Focus the next search <span className="font-normal text-muted">(optional)</span>
            </>
          }
          hint="Describe it however you like: a category, a vibe, a place. This search adds to your matches and replaces nothing."
        >
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. local coffee roasters in the Bay Area"
            maxLength={100}
            className={inputClass}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button
          type="submit"
          disabled={pending || disabled || focus.trim().length < 3}
          className="self-start"
        >
          {pending ? 'Starting…' : 'Search'}
        </Button>
      </form>
      <p className="text-[13px] text-muted">
        {DAILY_FOCUSED_CAP} a day, on top of your regular runs.
      </p>
    </section>
  )
}
