'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Supabase's own wording is specific ("…after 43 seconds") where it can be;
// its hourly project-wide email cap needs a plainer explanation.
function resendErrorMessage(status: number | undefined, message: string): string {
  const wait = message.match(/after (\d+) seconds?/i)
  if (wait) {
    const seconds = Number(wait[1])
    return seconds <= 1
      ? 'Wait a moment and try again.'
      : `For security, you can request another email in ${seconds} seconds.`
  }
  if (status === 429 || /rate limit/i.test(message)) {
    return 'We’ve hit our email limit for the moment — please try again in an hour.'
  }
  return message
}

// Sends a fresh signup confirmation email (the account already exists, so no
// invite code is needed). For athletes who lost the email or whose link
// didn't work.
export function ResendConfirmation({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function resend() {
    if (!email.trim()) {
      setState('error')
      setMessage('Enter your email above first.')
      return
    }
    setState('sending')
    setMessage(null)
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setState('error')
      setMessage(resendErrorMessage(error.status, error.message))
      return
    }
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <p className="text-sm text-green-700">
        Sent a new confirmation link to {email.trim()} — check your inbox and spam folder.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={resend}
        disabled={state === 'sending'}
        className="self-start text-sm underline disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Resend confirmation email'}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </div>
  )
}
