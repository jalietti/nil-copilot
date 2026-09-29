'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ResendConfirmation } from '@/components/resend-confirmation'

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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      {deleted && (
        <p className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
          Your account and your data have been deleted.
        </p>
      )}
      <h1 className="text-2xl font-semibold">Log in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <Link href="/forgot-password" className="-mt-2 self-end text-xs text-neutral-600 underline">
          Forgot password?
        </Link>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!error && linkFailed && (
          <p className="text-sm text-neutral-700">
            That email link couldn&apos;t sign you in — it may have expired, or been opened in a
            different browser than the one you signed up in. If you were confirming your email,
            it&apos;s probably confirmed already: try logging in. Otherwise, resend it below.
          </p>
        )}
        {(needsConfirmation || linkFailed) && <ResendConfirmation email={email} />}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-sm text-neutral-600">
        New here?{' '}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
      </p>
    </main>
  )
}
