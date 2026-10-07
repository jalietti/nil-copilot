'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth-shell'
import { Field, Notice, inputClass } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    // Same message whether or not the account exists, so this can't be used
    // to find out who has signed up. Only rate limits surface as errors.
    if (error && error.status === 429) {
      setError('Too many requests — wait a few minutes and try again.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <p className="text-[15px] leading-relaxed text-muted">
          If there&apos;s an account for <strong className="text-ink">{email}</strong>, we sent a
          link to reset your password. It can take a few minutes to arrive.
        </p>
        <Link href="/login" className="text-sm font-semibold text-accent-text">
          Back to log in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent text-[15px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <Link href="/login" className="text-sm text-muted">
        Back to <span className="font-semibold text-accent-text">log in</span>
      </Link>
    </AuthShell>
  )
}
