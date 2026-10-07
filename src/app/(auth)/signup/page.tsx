'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ResendConfirmation } from '@/components/resend-confirmation'
import { AuthShell } from '@/components/auth-shell'
import { Field, Notice, inputClass } from '@/components/ui'
import { signUpWithInvite } from './actions'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signUpWithInvite({ email, password, inviteCode })
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <p className="text-[15px] leading-relaxed text-muted">
          We sent a confirmation link to <strong className="text-ink">{email}</strong>. Click it
          to finish signing up.
        </p>
        <p className="text-[15px] leading-relaxed text-muted">
          It can take a few minutes. Didn&apos;t get it, or the link didn&apos;t work?
        </p>
        <ResendConfirmation email={email} />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Join the pilot"
      subtitle="You'll need the invite code from whoever brought you in."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Invite code">
          <input
            required
            autoComplete="off"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className={`${inputClass} uppercase`}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent text-[15px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
        >
          {loading ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent-text">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
