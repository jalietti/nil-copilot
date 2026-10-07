'use client'

import { useState, useTransition } from 'react'
import { Button, Field, FieldError, textareaClass } from '@/components/ui'
import { saveSearchPreferences } from './actions'

const toLines = (items: string[]) => items.join('\n')
const fromLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

interface Props {
  values: string[]
  industries: string[]
  // Pre-filled from the interview and not edited yet.
  fromInterview: boolean
  whatMatters: string
}

function Pills({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-[14px] text-muted">{empty}</span>
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-surface-2 px-3 py-1.5 text-[14px] text-ink">
          {item}
        </li>
      ))}
    </ul>
  )
}

// "What you're looking for": values brands should share and industries to
// search, separate from the interview. Discovery uses both on the next run.
export function SearchPreferences({ values, industries, fromInterview, whatMatters }: Props) {
  const [editing, setEditing] = useState(false)
  const [valuesText, setValuesText] = useState(toLines(values))
  const [industriesText, setIndustriesText] = useState(toLines(industries))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await saveSearchPreferences({
        values: fromLines(valuesText),
        target_industries: fromLines(industriesText),
      })
      if (result.error) setError(result.error)
      else setEditing(false)
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">What you&apos;re looking for</h3>
        {!editing && (
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold tracking-wide text-subtle uppercase">
              Values brands should share
              {fromInterview && values.length > 0 ? ' (from your interview)' : ''}
            </p>
            <Pills items={values} empty="None yet — add what matters to you in a brand." />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold tracking-wide text-subtle uppercase">
              Industries to search
            </p>
            <Pills items={industries} empty="None yet — add industries you'd like to work in." />
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-4">
          {whatMatters && (
            <p className="rounded-[10px] bg-surface-2 p-3 text-[13px] text-muted">
              In your interview you said: &ldquo;{whatMatters}&rdquo;
            </p>
          )}
          <Field label="Values brands should share (one per line)">
            <textarea
              rows={3}
              value={valuesText}
              onChange={(e) => setValuesText(e.target.value)}
              placeholder={'sustainability\nwomen-owned\nsmall independent brands'}
              className={textareaClass}
            />
          </Field>
          <Field label="Industries you'd like to work in (one per line)">
            <textarea
              rows={3}
              value={industriesText}
              onChange={(e) => setIndustriesText(e.target.value)}
              placeholder={'specialty coffee\noutdoor gear\nskincare'}
              className={textareaClass}
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <p className="text-[13px] text-muted">
        Discovery researches your industries and favors brands that share your values, starting
        with your next run.
      </p>
    </section>
  )
}
