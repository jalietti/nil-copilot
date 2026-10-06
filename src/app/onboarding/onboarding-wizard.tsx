'use client'

import { useState } from 'react'
import {
  ProfileStep1Fields,
  ProfileStep2Fields,
  useProfileForm,
  type ProfileFields,
} from '@/components/profile-form'
import {
  InterviewStep3Fields,
  InterviewStep4Fields,
  useInterviewForm,
  type InterviewInitial,
} from '@/app/(app)/interview/interview-form'
import { Logo, Notice } from '@/components/ui'

type Step = 1 | 2 | 3 | 4

const STEP_NAMES: Record<Step, string> = {
  1: 'About you',
  2: 'Citizenship and visa',
  3: "What you're into",
  4: 'What a deal is worth to you',
}

const STEP_SUBTITLES: Record<Step, string> = {
  1: 'The basics brands will ask about. Keep it quick.',
  2: 'We ask this early on purpose. On some visas, NIL income can affect your status, and you should know that before you pitch anyone.',
  3: 'Be specific. "Trail running" finds better brands than "sports."',
  4: 'This drives what your copilot asks for in every draft.',
}

export function OnboardingWizard({
  userId,
  initialStep,
  profileInitial,
  interviewInitial,
}: {
  userId: string
  initialStep: 1 | 3
  profileInitial?: ProfileFields
  interviewInitial?: InterviewInitial
}) {
  const [step, setStep] = useState<Step>(initialStep)
  const profile = useProfileForm({ userId, mode: 'onboarding', initial: profileInitial })
  const interview = useInterviewForm(interviewInitial)

  async function handleContinue() {
    if (step === 1) {
      if (profile.validateStep1()) setStep(2)
      return
    }
    if (step === 2) {
      if (!profile.validateStep2()) return
      const ok = await profile.save()
      if (ok) setStep(3)
      return
    }
    if (step === 3) {
      if (interview.validateStep3()) setStep(4)
    }
  }

  function handleBack() {
    if (step === 2) setStep(1)
    if (step === 4) setStep(3)
  }

  const canBack = step === 2 || step === 4
  const nextLabel = step === 4 ? 'Finish and find brands' : 'Continue'
  const blocked = step === 2 && !profile.citizenship
  const minutesLeft = Math.max(1, 5 - step)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-8">
        <Logo />
        <span className="text-sm text-muted">Takes about 4 minutes</span>
      </header>

      <main className="flex flex-1 justify-center px-5 pb-16">
        <div className="flex w-full max-w-[640px] flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">
                Step {step} of 4 · {STEP_NAMES[step]}
              </span>
              <span className="text-muted">About {minutesLeft} min left</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={step}
              aria-label="Onboarding progress"
              className="flex gap-1.5"
            >
              {([1, 2, 3, 4] as const).map((n) => (
                <span
                  key={n}
                  className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-accent' : 'bg-line-soft'}`}
                />
              ))}
            </div>
          </div>

          <section className="flex flex-col gap-5 rounded-2xl border border-line-soft bg-surface p-6 sm:p-8">
            <div className="flex flex-col gap-2">
              <h1 className="display text-[36px] sm:text-[40px]">{STEP_NAMES[step]}</h1>
              <p className="text-[16px] leading-relaxed text-muted">{STEP_SUBTITLES[step]}</p>
            </div>

            {step === 1 && <ProfileStep1Fields form={profile} />}
            {step === 2 && (
              <>
                <ProfileStep2Fields form={profile} />
                {profile.formError && <Notice tone="error">{profile.formError}</Notice>}
              </>
            )}
            {step === 3 && <InterviewStep3Fields form={interview} />}
            {step === 4 && (
              <>
                <InterviewStep4Fields form={interview} />
                {interview.formError && <Notice tone="error">{interview.formError}</Notice>}
              </>
            )}

            {step === 3 && (
              <p className="text-[13px] text-muted">
                Profile saved. You can edit it anytime from your account.
              </p>
            )}

            <div className="mt-1 flex items-center justify-between gap-3 border-t border-line-soft pt-5">
              {canBack ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-transparent px-[18px] text-[15px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={step === 4 ? () => interview.submit() : handleContinue}
                disabled={blocked || profile.saving || interview.pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent px-[18px] text-[15px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
              >
                {step === 2 && profile.saving
                  ? 'Saving…'
                  : step === 4 && interview.pending
                    ? 'Saving…'
                    : nextLabel}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
