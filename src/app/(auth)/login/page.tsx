'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ResendConfirmation } from '@/components/resend-confirmation'
import { AuthShell } from '@/components/auth-shell'
import { Field, Notice, inputClass } from '@/components/ui'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  // Set by /auth/callback when a confirmation or reset link didn't work.
  const params = useSearchParams()
  const linkFailed = params.get('error') === 'auth'
  const deleted = params.get('deleted') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Unconfirmed account: offer a fresh confirmation email.
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const unconfirmed = error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)
      setNeedsConfirmation(unconfirmed)
      setError(unconfirmed ? 'Confirm your email first — use the link we sent you.' : error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see what needs you today.">
      {deleted && <Notice>Your account and your data have been deleted.</Notice>}
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
        <Field label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Link href="/forgot-password" className="-mt-2 self-end text-[13px] text-accent-text">
          Forgot password?
        </Link>
        {error && <Notice tone="error">{error}</Notice>}
        {!error && linkFailed && (
          <Notice>
            That email link couldn&apos;t sign you in — it may have expired, or been opened in a
            different browser than the one you signed up in. If you were confirming your email,
            it&apos;s probably confirmed already: try logging in. Otherwise, resend it below.
          </Notice>
        )}
        {(needsConfirmation || linkFailed) && <ResendConfirmation email={email} />}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent text-[15px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-sm text-muted">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-accent-text">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
