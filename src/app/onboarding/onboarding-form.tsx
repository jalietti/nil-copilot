'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { onboardingSchema } from '@/lib/validators/onboarding'
import { getVisaGuidance } from '@/lib/visa-guidance'
import type { CitizenshipStatus } from '@/lib/supabase/types'

const CITIZENSHIP_OPTIONS: { value: CitizenshipStatus; label: string }[] = [
  { value: 'us_citizen', label: 'US citizen' },
  { value: 'permanent_resident', label: 'US permanent resident (green card)' },
  { value: 'f1_visa', label: 'International student (F-1 visa)' },
  { value: 'other_visa', label: 'Other visa' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const inputClass = 'rounded border border-neutral-300 px-3 py-2'

function parseFollowers(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.floor(n) : null
}

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [citizenship, setCitizenship] = useState<CitizenshipStatus | ''>('')
  const [school, setSchool] = useState('')
  const [sport, setSport] = useState('')
  const [division, setDivision] = useState('')
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [other, setOther] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const guidance = citizenship ? getVisaGuidance(citizenship) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = onboardingSchema.safeParse({
      full_name: fullName,
      school,
      sport,
      division: division.trim() === '' ? null : division,
      instagram_followers: parseFollowers(instagram),
      tiktok_followers: parseFollowers(tiktok),
      other_followers: parseFollowers(other),
      citizenship_status: citizenship,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ...parsed.data,
        visa_guidance_shown_at: guidance ? now : null,
        onboarding_completed_at: now,
      })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    router.push('/interview')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Full name
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
      </label>

      {/* Asked early on purpose: visa status can make NIL income a serious
          immigration problem, and athletes need to know before going further. */}
      <label className="flex flex-col gap-1 text-sm">
        Citizenship / visa status
        <select
          required
          value={citizenship}
          onChange={(e) => setCitizenship(e.target.value as CitizenshipStatus)}
          className={inputClass}
        >
          <option value="" disabled>
            Select…
          </option>
          {CITIZENSHIP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {guidance && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="mb-2 font-medium">{guidance.headline}</p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            {guidance.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="text-xs text-neutral-600">{guidance.disclaimer}</p>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        School
        <input required value={school} onChange={(e) => setSchool(e.target.value)} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Sport
          <input required value={sport} onChange={(e) => setSport(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Division (optional)
          <input value={division} onChange={(e) => setDivision(e.target.value)} className={inputClass} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Followers (leave blank if none)</legend>
        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Instagram
            <input type="number" min={0} value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            TikTok
            <input type="number" min={0} value={tiktok} onChange={(e) => setTiktok(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Other
            <input type="number" min={0} value={other} onChange={(e) => setOther(e.target.value)} className={inputClass} />
          </label>
        </div>
      </fieldset>

      <p className="text-xs text-neutral-500">
        Anonymous brand-response outcomes — whether a brand replied or a deal happened, never your
        messages or who you are — help improve matching for other athletes.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Continue to interview'}
      </button>
    </form>
  )
}
