'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { onboardingSchema } from '@/lib/validators/onboarding'
import { getVisaGuidance } from '@/lib/visa-guidance'
import { parseFollowers } from '@/lib/followers'
import type { CitizenshipStatus, Profile } from '@/lib/supabase/types'
import { CheckIcon } from './icons'
import { Field, FieldError, Notice, inputClass } from './ui'

export const CITIZENSHIP_OPTIONS: { value: CitizenshipStatus; label: string }[] = [
  { value: 'us_citizen', label: 'US citizen' },
  { value: 'permanent_resident', label: 'US permanent resident (green card)' },
  { value: 'f1_visa', label: 'International student (F-1 visa)' },
  { value: 'other_visa', label: 'Other visa' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export type ProfileFields = Pick<
  Profile,
  | 'full_name'
  | 'school'
  | 'sport'
  | 'division'
  | 'instagram_followers'
  | 'tiktok_followers'
  | 'other_followers'
  | 'citizenship_status'
>

const asText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

type ProfileFieldErrors = Partial<{
  full_name: string
  school: string
  sport: string
  instagram: string
  tiktok: string
  other: string
  citizenship: string
}>

// Onboarding (step 1-2 of the wizard) and the Account page (single page,
// edit anytime) share this hook, so field rendering and save logic — the
// zod schema, the visa-guidance lookup, the onboarding_completed_at /
// visa_guidance_shown_at bookkeeping — live in exactly one place.
export function useProfileForm({
  userId,
  mode,
  initial,
}: {
  userId: string
  mode: 'onboarding' | 'edit'
  initial?: ProfileFields
}) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [citizenship, setCitizenship] = useState<CitizenshipStatus | ''>(
    initial?.citizenship_status ?? '',
  )
  const [school, setSchool] = useState(initial?.school ?? '')
  const [sport, setSport] = useState(initial?.sport ?? '')
  const [division, setDivision] = useState(initial?.division ?? '')
  const [instagram, setInstagram] = useState(asText(initial?.instagram_followers))
  const [tiktok, setTiktok] = useState(asText(initial?.tiktok_followers))
  const [other, setOther] = useState(asText(initial?.other_followers))
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const guidance = citizenship ? getVisaGuidance(citizenship) : null

  function validateStep1(): boolean {
    const errors: ProfileFieldErrors = {}
    if (fullName.trim() === '') errors.full_name = 'Name is required'
    if (school.trim() === '') errors.school = 'School is required'
    if (sport.trim() === '') errors.sport = 'Sport is required'
    const ig = parseFollowers(instagram)
    if ('error' in ig) errors.instagram = ig.error
    const tk = parseFollowers(tiktok)
    if ('error' in tk) errors.tiktok = tk.error
    const ot = parseFollowers(other)
    if ('error' in ot) errors.other = ot.error
    // Clear only the fields this step owns; leave citizenship's error alone.
    setFieldErrors((e) => ({
      full_name: errors.full_name,
      school: errors.school,
      sport: errors.sport,
      instagram: errors.instagram,
      tiktok: errors.tiktok,
      other: errors.other,
      citizenship: e.citizenship,
    }))
    return Object.keys(errors).length === 0
  }

  function validateStep2(): boolean {
    if (!citizenship) {
      setFieldErrors((e) => ({ ...e, citizenship: 'Pick one to continue' }))
      return false
    }
    setFieldErrors((e) => ({ ...e, citizenship: undefined }))
    return true
  }

  // Validates everything and saves. Used by onboarding step 2 (Continue)
  // and the Account page's single-page edit form (Save profile).
  async function save(): Promise<boolean> {
    setFormError(null)
    const ig = parseFollowers(instagram)
    const tk = parseFollowers(tiktok)
    const ot = parseFollowers(other)
    if ('error' in ig || 'error' in tk || 'error' in ot || !citizenship) {
      // A step's Continue should have already caught this; re-validate to
      // be safe (e.g. the single-page Account form has no separate steps).
      validateStep1()
      validateStep2()
      return false
    }

    const parsed = onboardingSchema.safeParse({
      full_name: fullName,
      school,
      sport,
      division: division.trim() === '' ? null : division,
      instagram_followers: ig.value,
      tiktok_followers: tk.value,
      other_followers: ot.value,
      citizenship_status: citizenship,
    })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please check the form')
      return false
    }

    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ...parsed.data,
        // Records that an athlete who needs visa guidance was shown it; an
        // earlier record is kept if their status no longer needs it.
        ...(guidance ? { visa_guidance_shown_at: now } : {}),
        ...(mode === 'onboarding' ? { onboarding_completed_at: now } : {}),
      })
      .eq('id', userId)

    setSaving(false)
    if (updateError) {
      setFormError(updateError.message)
      return false
    }
    setSaved(true)
    router.refresh()
    return true
  }

  return {
    fullName,
    setFullName,
    citizenship,
    setCitizenship,
    school,
    setSchool,
    sport,
    setSport,
    division,
    setDivision,
    instagram,
    setInstagram,
    tiktok,
    setTiktok,
    other,
    setOther,
    fieldErrors,
    formError,
    saving,
    saved,
    guidance,
    validateStep1,
    validateStep2,
    save,
  }
}

export type ProfileFormState = ReturnType<typeof useProfileForm>

// Step 1 of onboarding ("About you"), also used as the top half of the
// Account page's profile card.
export function ProfileStep1Fields({ form }: { form: ProfileFormState }) {
  return (
    <>
      <Field label="Full name" error={form.fieldErrors.full_name}>
        <input
          required
          autoComplete="name"
          value={form.fullName}
          onChange={(e) => form.setFullName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="School" error={form.fieldErrors.school}>
        <input
          required
          value={form.school}
          onChange={(e) => form.setSchool(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Sport" error={form.fieldErrors.sport}>
          <input
            required
            value={form.sport}
            onChange={(e) => form.setSport(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={<>Division <span className="font-normal text-muted">(optional)</span></>}>
          <input
            value={form.division}
            onChange={(e) => form.setDivision(e.target.value)}
            placeholder="e.g. D1"
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ink">
          Followers <span className="text-[13px] font-normal text-muted">Leave blank if none. Small counts are fine.</span>
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Instagram" error={form.fieldErrors.instagram}>
            <input
              inputMode="numeric"
              value={form.instagram}
              onChange={(e) => form.setInstagram(e.target.value)}
              placeholder="e.g. 450 or 1.2k"
              className={inputClass}
            />
          </Field>
          <Field label="TikTok" error={form.fieldErrors.tiktok}>
            <input
              inputMode="numeric"
              value={form.tiktok}
              onChange={(e) => form.setTiktok(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Other" error={form.fieldErrors.other}>
            <input
              inputMode="numeric"
              value={form.other}
              onChange={(e) => form.setOther(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>
    </>
  )
}

// Step 2 of onboarding ("Citizenship and visa"), also used in the Account
// page's profile card. Asked early on purpose: visa status can make NIL
// income a serious immigration problem, and athletes need to know before
// going further. Never skippable, never buried.
export function ProfileStep2Fields({ form }: { form: ProfileFormState }) {
  return (
    <>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">Citizenship / visa status</legend>
        {CITIZENSHIP_OPTIONS.map((option) => {
          const checked = form.citizenship === option.value
          return (
            <label
              key={option.value}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 text-[15px] font-medium ${
                checked
                  ? 'border-accent-text bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent-text)]'
                  : 'border-line bg-surface hover:border-subtle'
              }`}
            >
              <input
                type="radio"
                name="citizenship"
                value={option.value}
                checked={checked}
                onChange={() => form.setCitizenship(option.value)}
                className="size-[18px] accent-accent"
              />
              {option.label}
            </label>
          )
        })}
      </fieldset>
      {form.fieldErrors.citizenship && <FieldError>{form.fieldErrors.citizenship}</FieldError>}

      {form.guidance && (
        <Notice title={form.guidance.headline}>
          <ul className="list-disc space-y-1.5 pl-5">
            {form.guidance.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="text-[13px] text-muted">{form.guidance.disclaimer}</p>
        </Notice>
      )}

      <p className="text-[13px] leading-relaxed text-muted">
        Anonymous brand-response outcomes — whether a brand replied or a deal happened, never your
        messages or who you are — help improve matching for other athletes.
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

// Single-page edit mode used on the Account page: both steps' fields in one
// form, one submit, with their own save logic reused unchanged from the hook.
export function ProfileForm({
  userId,
  mode,
  initial,
}: {
  userId: string
  mode: 'onboarding' | 'edit'
  initial?: ProfileFields
}) {
  const form = useProfileForm({ userId, mode, initial })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const step1Ok = form.validateStep1()
    const step2Ok = form.validateStep2()
    if (!step1Ok || !step2Ok) return
    await form.save()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ProfileStep1Fields form={form} />
      <ProfileStep2Fields form={form} />

      {form.formError && <Notice tone="error">{form.formError}</Notice>}

      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={form.saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent px-[18px] text-[15px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
        >
          {form.saving ? 'Saving…' : 'Save profile'}
        </button>
        {form.saved && <SavedLine />}
      </div>
    </form>
  )
}
