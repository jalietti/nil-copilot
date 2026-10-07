'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from './actions'
import { Field, Notice, cardClass, inputClass } from '@/components/ui'

export function DeleteAccount() {
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await deleteAccount(confirmation)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <section className={`flex flex-col gap-4 p-6 sm:p-8 ${cardClass}`}>
      <div className="flex flex-col gap-1">
        <h2 className="eyebrow">Delete your account</h2>
        <p className="text-[15px] text-muted">
          Permanently deletes your account and everything listed above. This can&apos;t be undone.
          Anonymous brand-level facts (like &ldquo;this brand has replied to someone&rdquo;) aren&apos;t
          linked to you and stay.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Type DELETE to confirm" className="max-w-xs">
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button
          type="submit"
          disabled={pending || confirmation.trim() !== 'DELETE'}
          className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-[10px] border border-warn bg-transparent px-[18px] text-[15px] font-semibold text-warn transition-colors hover:bg-warn-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Deleting…' : 'Delete my account'}
        </button>
      </form>
    </section>
  )
}
