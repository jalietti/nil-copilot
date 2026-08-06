'use client'

import { useState, useTransition } from 'react'
import { buildMailtoUrl } from '@/lib/mailto'
import type { DealStatus, Message } from '@/lib/supabase/types'
import {
  generateCounterDraft,
  generateOutreachDraft,
  markSent,
  saveBrandReply,
  saveDraftEdits,
  setDealStatus,
} from './actions'

const inputClass = 'w-full rounded border border-neutral-300 px-3 py-2'

interface Props {
  dealId: string
  dealStatus: DealStatus
  brandName: string
  contactEmail: string | null
  messages: Message[]
}

export function DealThread({ dealId, dealStatus, brandName, contactEmail, messages }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  const last = messages.at(-1)
  const activeDraft = last?.direction === 'outbound_draft' ? last : null
  const [subject, setSubject] = useState(activeDraft?.subject ?? '')
  const [body, setBody] = useState(activeDraft?.content ?? '')

  function run(action: () => Promise<{ error?: string } | void>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  const priorMessages = activeDraft ? messages.slice(0, -1) : messages

  return (
    <div className="flex flex-col gap-6">
      {priorMessages.length > 0 && (
        <ol className="flex flex-col gap-3">
          {priorMessages.map((message) => (
            <li
              key={message.id}
              className={`rounded border p-3 text-sm ${
                message.direction === 'outbound_draft'
                  ? 'border-neutral-200'
                  : 'border-blue-200 bg-blue-50'
              }`}
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {message.direction === 'outbound_draft' ? 'You' : `${brandName} (pasted)`}
                {message.subject ? ` — ${message.subject}` : ''}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </li>
          ))}
        </ol>
      )}

      {messages.length === 0 && (
        <button
          onClick={() => run(() => generateOutreachDraft(dealId))}
          disabled={pending}
          className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Drafting…' : 'Draft outreach email'}
        </button>
      )}

      {activeDraft && (
        <section className="rounded border border-neutral-300 p-4">
          <h2 className="mb-3 text-sm font-medium">
            Your draft {activeDraft.athlete_edited ? '(edited by you)' : '(copilot draft — make it yours)'}
          </h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Subject
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Body
              <textarea
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={inputClass}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => run(() => saveDraftEdits(activeDraft.id, dealId, subject, body))}
                disabled={pending}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Save edits
              </button>
              {contactEmail ? (
                <a
                  href={buildMailtoUrl({ to: contactEmail, subject, body })}
                  className="rounded bg-black px-3 py-1.5 text-sm text-white"
                >
                  Open in your email app
                </a>
              ) : (
                <span className="text-xs text-neutral-500">No contact email on file</span>
              )}
              <button
                onClick={() => run(() => markSent(dealId))}
                disabled={pending}
                className="rounded border border-green-600 px-3 py-1.5 text-sm text-green-700 disabled:opacity-50"
              >
                I sent it ✓
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              “Open in your email app” hands the draft to your own email client — you press send
              there.
            </p>
          </div>
        </section>
      )}

      {last?.direction === 'inbound_pasted' && (
        <button
          onClick={() => run(() => generateCounterDraft(dealId))}
          disabled={pending}
          className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Drafting…' : 'Draft my reply'}
        </button>
      )}

      {messages.length > 0 && (
        <section className="rounded border border-dashed border-neutral-300 p-4">
          <h2 className="mb-2 text-sm font-medium">Got a reply from {brandName}?</h2>
          <p className="mb-2 text-xs text-neutral-500">
            Paste it here and the copilot will draft your response around what you said matters to
            you. It never reads your inbox — only what you paste.
          </p>
          <textarea
            rows={5}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className={inputClass}
          />
          <button
            onClick={() =>
              run(async () => {
                const result = await saveBrandReply(dealId, reply)
                if (!result.error) setReply('')
                return result
              })
            }
            disabled={pending}
            className="mt-2 rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Save reply
          </button>
        </section>
      )}

      {!['agreed', 'closed', 'dead'].includes(dealStatus) && messages.length > 0 && (
        <div className="flex gap-3 text-sm">
          <button
            onClick={() => run(() => setDealStatus(dealId, 'agreed'))}
            disabled={pending}
            className="text-green-700 underline"
          >
            We agreed on a deal
          </button>
          <button
            onClick={() => run(() => setDealStatus(dealId, 'dead'))}
            disabled={pending}
            className="text-neutral-500 underline"
          >
            This one&apos;s dead
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
