'use client'

import { useState, useTransition } from 'react'
import {
  COMPENSATION_ASK_LABELS,
  PRODUCT_VALUE_TIER_LABELS,
  type CompensationAsk,
  type ProductValueTier,
} from '@/lib/deal-preferences'
import { Field, FieldError, Notice, inputClass, textareaClass } from '@/components/ui'
import { CheckIcon } from '@/components/icons'
import { splitList } from '@/lib/split-list'
import { submitInterview } from './actions'

const TIERS: ProductValueTier[] = ['low', 'mid', 'high']
const ASKS = Object.keys(COMPENSATION_ASK_LABELS) as CompensationAsk[]

const parseLines = splitList

export interface InterviewInitial {
  interests: string[]
  brands_used: string[]
  what_matters: string
  deal_preferences: Partial<Record<ProductValueTier, CompensationAsk>> & { notes?: string }
}

// Shared by onboarding (split across steps 3-4) and the Account page
// (single page). The save logic — submitInterview, which redirects to
// /brands — lives in exactly one place.
export function useInterviewForm(initial?: InterviewInitial) {
  const [interests, setInterests] = useState(initial?.interests.join('\n') ?? '')
  const [brandsUsed, setBrandsUsed] = useState(initial?.brands_used.join('\n') ?? '')
  const [whatMatters, setWhatMatters] = useState(initial?.what_matters ?? '')
  const [prefs, setPrefs] = useState<Record<ProductValueTier, CompensationAsk>>({
    low: initial?.deal_preferences.low ?? 'product_only',
    mid: initial?.deal_preferences.mid ?? 'product_plus_payment',
    high: initial?.deal_preferences.high ?? 'payment_required',
  })
  const [notes, setNotes] = useState(initial?.deal_preferences.notes ?? '')
  const [interestsError, setInterestsError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function validateStep3(): boolean {
    if (parseLines(interests).length === 0) {
      setInterestsError('Share at least one genuine interest')
      return false
    }
    setInterestsError(null)
    return true
  }

  function submit() {
    setFormError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await submitInterview({
        interests: parseLines(interests),
        brands_used: parseLines(brandsUsed),
        what_matters: whatMatters,
        deal_preferences: { ...prefs, notes: notes.trim() === '' ? undefined : notes },
      })
      if (result?.error) setFormError(result.error)
      else setSaved(true)
    })
  }

  return {
    interests,
    setInterests,
    brandsUsed,
    setBrandsUsed,
    whatMatters,
    setWhatMatters,
    prefs,
    setPrefs,
    notes,
    setNotes,
    interestsError,
    formError,
    saved,
    pending,
    validateStep3,
    submit,
  }
}

export type InterviewFormState = ReturnType<typeof useInterviewForm>

// Step 3 ("What you're into").
export function InterviewStep3Fields({ form }: { form: InterviewFormState }) {
  return (
    <>
      <Field label="What are you genuinely into?" hint="One per line or separated by commas, whatever's easier.">
        <textarea
          required
          rows={5}
          value={form.interests}
          onChange={(e) => form.setInterests(e.target.value)}
          placeholder={'sustainable outdoor gear\ntrail running\nbackpacking'}
          className={textareaClass}
        />
        {form.interestsError && <FieldError>{form.interestsError}</FieldError>}
      </Field>

      <Field
        label="Brands or products you actually use and like"
        hint="Optional, but these make the strongest pitches."
      >
        <textarea
          rows={3}
          value={form.brandsUsed}
          onChange={(e) => form.setBrandsUsed(e.target.value)}
          placeholder="e.g. the bars you eat before meets"
          className={textareaClass}
        />
      </Field>
    </>
  )
}

// Step 4 ("What a deal is worth to you").
export function InterviewStep4Fields({ form }: { form: InterviewFormState }) {
  return (
    <>
      <Field label="What matters to you in a partnership?">
        <textarea
          rows={3}
          value={form.whatMatters}
          onChange={(e) => form.setWhatMatters(e.target.value)}
          placeholder="e.g. I'd rather work with small brands I believe in than chase the biggest check"
          className={textareaClass}
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-ink">What would make it worth it?</legend>
        {TIERS.map((tier) => (
          <Field key={tier} label={PRODUCT_VALUE_TIER_LABELS[tier]}>
            <select
              value={form.prefs[tier]}
              onChange={(e) =>
                form.setPrefs((p) => ({ ...p, [tier]: e.target.value as CompensationAsk }))
              }
              className={inputClass}
            >
              {ASKS.map((ask) => (
                <option key={ask} value={ask}>
                  {COMPENSATION_ASK_LABELS[ask]}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Field label="Anything else about compensation? (optional)">
          <input
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <p className="rounded-xl bg-surface-2 p-3.5 text-[13px] leading-relaxed text-muted">
        <span className="font-semibold text-ink">How your answers are used:</span> they decide which
        brands the copilot researches for you, and it also uses them to learn how you talk — so the
        emails it drafts for you sound like you, not a template. Other athletes never see them.
      </p>
    </>
  )
}

function SavedLine() {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-agreed">
      <CheckIcon size={16} className="shrink-0" />
      Saved
    </p>
  )
}

// Single-page edit mode used on the Account page.
export function InterviewForm({
  initial,
  submitLabel = 'Save and find brands',
}: {
  initial?: InterviewInitial
  submitLabel?: string
}) {
  const form = useInterviewForm(initial)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.validateStep3()) return
    form.submit()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <InterviewStep3Fields form={form} />
      <InterviewStep4Fields form={form} />

      {form.formError && <Notice tone="error">{form.formError}</Notice>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={form.pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent px-[18px] text-[15px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
        >
          {form.pending ? 'Saving…' : submitLabel}
        </button>
        {form.saved && <SavedLine />}
      </div>
    </form>
  )
}
