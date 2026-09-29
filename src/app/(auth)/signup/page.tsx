'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ResendConfirmation } from '@/components/resend-confirmation'
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
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-neutral-600">
          We sent a confirmation link to <strong>{email}</strong>. Click it to finish signing up.
        </p>
        <p className="text-sm text-neutral-600">
          It can take a few minutes. Didn&apos;t get it, or the link didn&apos;t work?
        </p>
        <ResendConfirmation email={email} />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-600">
          NIL Copilot is invite-only while we pilot it. You&apos;ll need the code you were sent.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Invite code
          <input
            required
            autoComplete="off"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 uppercase"
          />
        </label>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-neutral-600">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  )
}
