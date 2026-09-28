'use client'

import { useState, useTransition } from 'react'
import { saveSearchPreferences } from './actions'

const inputClass = 'w-full rounded border border-neutral-300 px-3 py-2 text-sm'

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

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-sm text-neutral-500">{empty}</span>
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-neutral-100 px-3 py-1 text-sm">
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
    <section className="mb-6 rounded border border-neutral-200 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-medium">What you&apos;re looking for</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-sm underline">
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              Values brands should share{fromInterview && values.length > 0 ? ' (from your interview)' : ''}
            </p>
            <Chips items={values} empty="None yet — add what matters to you in a brand." />
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Industries to search</p>
            <Chips items={industries} empty="None yet — add industries you'd like to work in." />
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3">
          {whatMatters && (
            <p className="rounded bg-neutral-50 p-2 text-xs text-neutral-600">
              In your interview you said: &ldquo;{whatMatters}&rdquo;
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Values brands should share (one per line)
            <textarea
              rows={3}
              value={valuesText}
              onChange={(e) => setValuesText(e.target.value)}
              placeholder={'sustainability\nwomen-owned\nsmall independent brands'}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Industries you&apos;d like to work in (one per line)
            <textarea
              rows={3}
              value={industriesText}
              onChange={(e) => setIndustriesText(e.target.value)}
              placeholder={'specialty coffee\noutdoor gear\nskincare'}
              className={inputClass}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm underline">
              Cancel
            </button>
          </div>
        </form>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        Discovery researches your industries and favors brands that share your values, starting
        with your next run.
      </p>
    </section>
  )
}
