'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { buttonClass } from '@/components/ui'
import { MailIcon } from '@/components/icons'
import { generateFollowUpDraft, setDealStatus } from '../deals/[id]/actions'

// "Did you hear back?" — shown for deals sent ~5+ days ago with no reply
// logged. The app can't see the athlete's inbox, so it just asks.
export function FollowUpPrompt({ dealId, brandName }: { dealId: string; brandName: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-[14px] border border-line-soft bg-surface p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-wait-soft text-wait">
        <MailIcon />
      </span>
      <div className="flex min-w-[260px] flex-1 flex-col gap-1">
        <h3 className="text-[17px] font-semibold text-ink">Did {brandName} reply?</h3>
        <p className="text-[15px] text-muted">
          It&apos;s been a few days since you emailed {brandName}. If they haven&apos;t replied, now is
          the time for one short follow-up.
        </p>
        {error && <p className="text-[13px] font-medium text-warn">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/deals/${dealId}#reply`} className={buttonClass({ variant: 'secondary', size: 'md' })}>
          They replied
        </Link>
        <button
          type="button"
          onClick={() => run(() => generateFollowUpDraft(dealId))}
          disabled={pending}
          className={buttonClass({ variant: 'ghost', size: 'md' })}
        >
          {pending ? 'Drafting…' : 'Not yet — draft a follow-up'}
        </button>
        <button
          type="button"
          onClick={() => run(() => setDealStatus(dealId, 'dead'))}
          disabled={pending}
          className={buttonClass({ variant: 'ghost', size: 'md' })}
        >
          I&apos;m done with this one
        </button>
      </div>
    </li>
  )
}
