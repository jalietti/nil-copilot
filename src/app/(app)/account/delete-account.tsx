'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from './actions'

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
    <section className="rounded border border-red-200 p-4">
      <h2 className="mb-1 text-sm font-medium">Delete your account</h2>
      <p className="mb-3 text-sm text-neutral-600">
        Permanently deletes your account and everything listed above. This can&apos;t be undone.
        Anonymous brand-level facts (like &ldquo;this brand has replied to someone&rdquo;) aren&apos;t
        linked to you and stay.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending || confirmation.trim() !== 'DELETE'}
          className="self-start rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Deleting…' : 'Delete my account'}
        </button>
      </form>
    </section>
  )
}
