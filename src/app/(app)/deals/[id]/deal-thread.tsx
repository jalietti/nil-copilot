'use client'

import { Fragment, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { buildMailtoUrl } from '@/lib/mailto'
import { draftKind, type DraftKind } from '@/lib/draft-kind'
import { dealProgress, type DealStepState } from '@/lib/deal-stage'
import { FOLLOW_UP_AFTER_MS } from '@/lib/deal-follow-up'
import type { DealStatus, Message } from '@/lib/supabase/types'
import type { DealVisaReminder } from '@/lib/visa-guidance'
import {
  Button,
  ButtonLink,
  Notice,
  Monogram,
  StageChip,
  buttonClass,
  cardClass,
  inputClass,
  textareaClass,
} from '@/components/ui'
import { ArrowLeftIcon, CheckIcon, MailIcon, MoreIcon, RefreshIcon } from '@/components/icons'
import {
  generateCounterDraft,
  generateOutreachDraft,
  markSent,
  recordMailtoClick,
  regenerateDraft,
  saveBrandReply,
  saveDraftEdits,
  setDealStatus,
} from './actions'

const FOLLOW_UP_DAYS = Math.round(FOLLOW_UP_AFTER_MS / (24 * 60 * 60 * 1000))

type ActionResult = { error?: string } | void

interface Props {
  dealId: string
  dealStatus: DealStatus
  brandName: string
  domain: string
  contactEmail: string | null
  messages: Message[]
  visaReminder: DealVisaReminder | null
}

export function DealThread({
  dealId,
  dealStatus,
  brandName,
  domain,
  contactEmail,
  messages,
  visaReminder,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [justSent, setJustSent] = useState(false)

  const last = messages.at(-1)
  const activeDraft = last?.direction === 'outbound_draft' ? last : null
  const priorMessages = activeDraft ? messages.slice(0, -1) : messages

  function run(action: () => Promise<ActionResult>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard"
        className="inline-flex h-8 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeftIcon size={16} />
        All deals
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Monogram name={brandName} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="display text-[40px]">{brandName}</h1>
          <p className="text-sm text-muted">
            {domain} · {contactEmail || 'No contact email yet'}
          </p>
        </div>
        <StageChip status={dealStatus} />
        <MoreActionsMenu dealId={dealId} dealStatus={dealStatus} pending={pending} run={run} />
      </header>

      <Stepper status={dealStatus} />

      {visaReminder && (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Visa check</p>
          <Notice tone="info" title="Check with your DSO first.">
            <p>{visaReminder.message}</p>
            <p className="text-xs text-muted">{visaReminder.disclaimer}</p>
          </Notice>
        </div>
      )}

      {dealStatus === 'agreed' && (
        <div className={`flex flex-col items-center gap-3 p-8 text-center ${cardClass}`}>
          <span className="grid size-14 shrink-0 animate-pop place-items-center rounded-full bg-agreed-soft text-agreed">
            <CheckIcon size={28} />
          </span>
          <h2 className="display text-[28px]">Deal agreed. Nice work.</h2>
          <p className="max-w-md text-[15px] text-muted">
            Deliver what you promised, then mark it closed from More actions when it&apos;s done.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="conv-h" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
          <h2 id="conv-h" className="eyebrow">
            Conversation
          </h2>

          {priorMessages.length === 0 && messages.length === 0 && (
            <p className="text-[15px] text-muted">Nothing here yet.</p>
          )}

          {priorMessages.map((message) => (
            <MessageCard key={message.id} message={message} brandName={brandName} />
          ))}

          {messages.length > 0 && (
            <section id="reply" className={`flex flex-col gap-3 p-4 ${cardClass}`}>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                <span>Got a reply from {brandName}?</span>
                <span className="text-[13px] leading-snug font-normal text-muted">
                  Paste their reply exactly as you got it.
                </span>
                <textarea
                  rows={5}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className={textareaClass}
                />
              </label>
              <Button
                variant="secondary"
                className="self-start"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const result = await saveBrandReply(dealId, reply)
                    if (!result.error) setReply('')
                    return result
                  })
                }
              >
                Save reply
              </Button>
            </section>
          )}
        </section>

        <section
          aria-labelledby="draft-h"
          className={`flex min-w-0 flex-[1.5_1_460px] flex-col gap-4 rounded-2xl p-[22px] ${cardClass}`}
        >
          {justSent ? (
            <SentMoment followUpClock={dealStatus === 'sent'} />
          ) : activeDraft ? (
            <DraftEditor
              key={`${activeDraft.id}:${activeDraft.previous_versions.length}`}
              dealId={dealId}
              draft={activeDraft}
              contactEmail={contactEmail}
              kind={draftKind(messages.slice(0, -1))}
              pending={pending}
              run={run}
              onSent={() => setJustSent(true)}
            />
          ) : dealStatus === 'dead' ? (
            // Closed out: no red call to action pulling the athlete back in.
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <h2 id="draft-h" className="text-[18px] font-semibold text-ink">
                You closed this one out
              </h2>
              <p className="max-w-sm text-[15px] text-muted">
                Not every brand says yes. Your next match is a few clicks away.
              </p>
              <ButtonLink href="/brands" variant="secondary">
                See your brand matches
              </ButtonLink>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <h2 id="draft-h" className="text-[18px] font-semibold text-ink">
                No draft yet
              </h2>
              <p className="max-w-sm text-[15px] text-muted">
                Your copilot writes the first email from your interview answers. You always review
                it before anything goes out.
              </p>
              <Button size="lg" disabled={pending} onClick={() => run(() => generateOutreachDraft(dealId))}>
                {pending ? 'Drafting…' : 'Draft outreach email'}
              </Button>
            </div>
          ) : last?.direction === 'inbound_pasted' ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <h2 id="draft-h" className="text-[18px] font-semibold text-ink">
                They replied
              </h2>
              <p className="max-w-sm text-[15px] text-muted">
                Your copilot can draft a response built around what you said matters to you.
              </p>
              <Button size="lg" disabled={pending} onClick={() => run(() => generateCounterDraft(dealId))}>
                {pending ? 'Drafting…' : 'Draft my reply'}
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}

function MessageCard({ message, brandName }: { message: Message; brandName: string }) {
  const outbound = message.direction === 'outbound_draft'
  const date = new Date(message.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return (
    <article
      className={`flex flex-col gap-2 rounded-[14px] p-4 ${
        outbound ? `border border-line-soft bg-surface` : 'bg-nego-soft'
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[13px] text-muted">
        <strong className="text-ink">{outbound ? 'You' : brandName}</strong>
        <span>
          {outbound ? 'Sent' : 'Pasted'} {date}
        </span>
      </div>
      {message.subject && <p className="text-[14px] font-semibold text-ink">{message.subject}</p>}
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{message.content}</p>
    </article>
  )
}

// The "did you hear back?" clock only starts when markSent moves the deal to
// `sent` (first outreach or a follow-up); a counter sent mid-negotiation
// doesn't start it, so don't promise a check-in then.
function SentMoment({ followUpClock }: { followUpClock: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="grid size-[72px] shrink-0 animate-pop place-items-center rounded-full bg-agreed-soft text-agreed">
        <CheckIcon size={32} />
      </span>
      <h2 className="display text-[32px]">Sent. Nice work.</h2>
      <p className="max-w-sm text-[15px] leading-relaxed text-muted">
        {followUpClock &&
          `We'll check in on Home in ${FOLLOW_UP_DAYS} days if they haven't replied. `}
        Paste their reply here whenever it lands.
      </p>
      <ButtonLink href="/dashboard" variant="secondary">
        Back to Home
      </ButtonLink>
    </div>
  )
}

interface DraftEditorProps {
  dealId: string
  draft: Message
  contactEmail: string | null
  kind: DraftKind
  pending: boolean
  run: (action: () => Promise<ActionResult>) => void
  onSent: () => void
}

const DRAFT_TITLES: Record<DraftKind, string> = {
  outreach: 'Your outreach',
  counter: 'Your counter',
  follow_up: 'Your follow-up',
}

function DraftEditor({ dealId, draft, contactEmail, kind, pending, run, onSent }: DraftEditorProps) {
  const [subject, setSubject] = useState(draft.subject ?? '')
  const [body, setBody] = useState(draft.content)
  const dirty = subject !== (draft.subject ?? '') || body !== draft.content

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="draft-h" className="text-[18px] font-semibold text-ink">
          {DRAFT_TITLES[kind]}
        </h2>
        <span className="text-[13px] text-muted">
          Drafted by your copilot{draft.athlete_edited ? ' · edited by you' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2.5 text-[14px]">
        <span className="w-16 shrink-0 text-muted">To</span>
        <span className="min-w-0 truncate font-medium text-ink">{contactEmail || 'No contact email yet'}</span>
      </div>

      <label className="flex items-center gap-2.5 text-[14px]">
        <span className="w-16 shrink-0 text-muted">Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Body</span>
        <textarea
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${textareaClass} resize-y`}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            const edited = dirty || draft.athlete_edited
            if (edited && !window.confirm('Replace your edited draft with a new version?')) return
            run(() => regenerateDraft(dealId, draft.id))
          }}
        >
          <RefreshIcon size={16} />
          {pending ? 'Working…' : 'Try another version'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || !dirty}
          onClick={() => run(() => saveDraftEdits(draft.id, dealId, subject, body))}
        >
          Save edits
        </Button>
      </div>

      <div className="flex flex-col gap-3 pt-1">
        {contactEmail ? (
          <a
            href={buildMailtoUrl({ to: contactEmail, subject, body })}
            onClick={() => {
              // Keep what they actually sent, even if they never hit Save.
              if (dirty) void saveDraftEdits(draft.id, dealId, subject, body)
              void recordMailtoClick(dealId, kind)
            }}
            className={buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' })}
          >
            <MailIcon />
            Open in my email
          </a>
        ) : (
          <>
            <button
              type="button"
              disabled
              className={buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' })}
            >
              <MailIcon />
              Open in my email
            </button>
            <Notice tone="info">
              No contact email on file yet.{' '}
              <Link href="/brands" className="font-semibold underline">
                Add one from Brands
              </Link>{' '}
              before you send.
            </Notice>
          </>
        )}
        <p className="text-center text-[13px] leading-relaxed text-muted">
          Opens your email app with this draft filled in. You review it and hit send. We never
          send anything for you.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        <span className="text-[14px] text-muted">Sent it from your email?</span>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await markSent(dealId)
              if (!result?.error) onSent()
              return result
            })
          }
        >
          I sent it
        </Button>
      </div>

      {kind === 'outreach' && (
        <p className="rounded-[10px] bg-surface-2 p-3 text-[13px] text-muted">
          Optional: if they write back, you can come back here and paste their reply — the
          copilot will help you negotiate. Totally fine to handle the reply yourself, too.
        </p>
      )}
    </>
  )
}

function Stepper({ status }: { status: DealStatus }) {
  const steps = dealProgress(status)
  return (
    <ol aria-label="Deal progress" className={`flex flex-wrap items-center gap-3 p-4 ${cardClass}`}>
      {steps.map((step, i) => (
        <Fragment key={step.label}>
          <li
            className="flex items-center gap-2.5 text-[14px] font-semibold text-muted"
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <StepDot state={step.state} index={i + 1} />
            <span className={step.state === 'current' ? 'text-ink' : ''}>{step.label}</span>
          </li>
          {i < steps.length - 1 && (
            <li
              aria-hidden="true"
              className={`h-0.5 min-w-4 flex-1 ${step.state === 'done' ? 'bg-agreed' : 'bg-line-soft'}`}
            />
          )}
        </Fragment>
      ))}
    </ol>
  )
}

function StepDot({ state, index }: { state: DealStepState; index: number }) {
  if (state === 'done') {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-agreed-soft text-agreed">
        <CheckIcon size={14} strokeWidth={3} />
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink">
        {index}
      </span>
    )
  }
  const muted = state === 'muted'
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ring-2 ring-inset ${
        muted ? 'text-subtle/60 ring-line-soft' : 'text-subtle ring-line'
      }`}
    >
      {index}
    </span>
  )
}

function MoreActionsMenu({
  dealId,
  dealStatus,
  pending,
  run,
}: {
  dealId: string
  dealStatus: DealStatus
  pending: boolean
  run: (action: () => Promise<ActionResult>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const canAgreeOrKill = !['agreed', 'closed', 'dead'].includes(dealStatus)
  const canClose = dealStatus === 'agreed'
  if (!canAgreeOrKill && !canClose) return null

  const menuItem =
    'flex h-11 w-full items-center rounded-[10px] px-3 text-left text-[15px] font-medium text-ink hover:bg-surface-2 disabled:opacity-50'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 shrink-0 place-items-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink"
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line-soft bg-surface p-1.5 shadow-lg"
        >
          {canAgreeOrKill && (
            <button
              role="menuitem"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false)
                run(() => setDealStatus(dealId, 'agreed'))
              }}
              className={menuItem}
            >
              We agreed on a deal
            </button>
          )}
          {canClose && (
            <button
              role="menuitem"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false)
                run(() => setDealStatus(dealId, 'closed'))
              }}
              className={menuItem}
            >
              Mark as closed
            </button>
          )}
          {canAgreeOrKill && (
            <button
              role="menuitem"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false)
                run(() => setDealStatus(dealId, 'dead'))
              }}
              className={`${menuItem} text-warn`}
            >
              This one&apos;s dead
            </button>
          )}
        </div>
      )}
    </div>
  )
}
