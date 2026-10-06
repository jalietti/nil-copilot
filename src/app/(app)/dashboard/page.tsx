import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsFollowUp } from '@/lib/deal-follow-up'
import { DEAL_GROUPS, dealStage, groupDeals, isDealGroupKey, type DealGroupKey } from '@/lib/deal-stage'
import { relativeTime } from '@/lib/relative-time'
import { ButtonLink, Monogram, PageHeader, StageChip, cardClass } from '@/components/ui'
import { ChevronRightIcon, PlusIcon } from '@/components/icons'
import type { Brand, Deal, Message } from '@/lib/supabase/types'
import { FollowUpPrompt } from './follow-up-prompt'

type DealWithBrand = Deal & {
  brands: Brand
  messages: Pick<Message, 'direction' | 'created_at'>[]
}

const TILE_KEYS = ['move', 'waiting', 'negotiating', 'agreed'] as const satisfies readonly DealGroupKey[]

const TILE_CAPTIONS: Record<(typeof TILE_KEYS)[number], string> = {
  move: 'Reply or send today',
  waiting: "We'll prompt you to follow up",
  negotiating: 'Counter in progress',
  agreed: 'Deliver what you promised',
}

const FILTER_OPTIONS: { key: DealGroupKey | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'move', label: 'Your move' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'negotiating', label: 'Negotiating' },
  { key: 'agreed', label: 'Agreed' },
  { key: 'past', label: 'Past' },
]

export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: interview }, { data: dealRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, onboarding_completed_at').eq('id', user.id).maybeSingle(),
    supabase.from('interviews').select('id').eq('athlete_id', user.id).maybeSingle(),
    supabase
      .from('deals')
      .select('*, brands(*), messages(direction, created_at)')
      .eq('athlete_id', user.id)
      .order('updated_at', { ascending: false }),
  ])

  if (!profile?.onboarding_completed_at) redirect('/onboarding')
  if (!interview) redirect('/onboarding')

  const deals = (dealRows ?? []) as unknown as DealWithBrand[]
  const now = new Date()
  const followUps = deals.filter((deal) => needsFollowUp(deal, now))

  const stageParam = (await searchParams).stage
  const stageValue = Array.isArray(stageParam) ? stageParam[0] : stageParam
  const filter = isDealGroupKey(stageValue) ? stageValue : undefined

  const firstName = profile.full_name?.split(' ')[0]
  const moveDeals = deals.filter((deal) => dealStage(deal.status).group === 'move')
  const description =
    moveDeals.length > 0
      ? `${moveDeals.length} deal${moveDeals.length === 1 ? '' : 's'} need${
          moveDeals.length === 1 ? 's' : ''
        } you. Start with ${moveDeals[0].brands.name}.`
      : deals.length > 0
        ? 'Nothing needs you right now. Find more brands to keep the pipeline moving.'
        : 'Your pipeline starts with one email.'

  const tileCounts = Object.fromEntries(
    TILE_KEYS.map((key) => [key, deals.filter((deal) => dealStage(deal.status).group === key).length]),
  ) as Record<(typeof TILE_KEYS)[number], number>

  const groups = groupDeals(deals, filter)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={firstName ? `Hey ${firstName}` : 'Your pipeline'}
        description={description}
        actions={
          <ButtonLink href="/brands">
            <PlusIcon size={18} />
            Find more brands
          </ButtonLink>
        }
      />

      <section aria-label="Pipeline" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILE_KEYS.map((key) => {
          const group = DEAL_GROUPS.find((g) => g.key === key)!
          const count = tileCounts[key]
          const hot = key === 'move' && count > 0
          const active = filter === key
          return (
            <Link
              key={key}
              href={`/dashboard?stage=${key}`}
              aria-current={active ? 'true' : undefined}
              className={`flex flex-col gap-2.5 rounded-[14px] border p-5 ${
                hot
                  ? 'border-accent bg-accent text-accent-ink hover:bg-accent-hover'
                  : `${cardClass} hover:border-line`
              } ${active ? 'ring-2 ring-ink/40' : ''}`}
            >
              <span className={`eyebrow ${hot ? 'text-accent-ink/88' : ''}`}>{group.label}</span>
              <span className="display text-[44px] sm:text-[56px]">{count}</span>
              <span className={`text-sm ${hot ? 'text-accent-ink/88' : 'text-muted'}`}>
                {TILE_CAPTIONS[key]}
              </span>
            </Link>
          )
        })}
      </section>

      {followUps.length > 0 && (
        <section aria-label="Follow-ups" className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {followUps.map((deal) => (
              <FollowUpPrompt key={deal.id} dealId={deal.id} brandName={deal.brands.name} />
            ))}
          </ul>
        </section>
      )}

      {deals.length === 0 ? (
        <div className={`${cardClass} flex flex-col gap-3 p-6`}>
          <p className="text-[15px] text-muted">
            No deals yet. Pick a brand that fits you and your copilot drafts the first email.
          </p>
          <Link href="/brands" className="self-start text-[15px] font-semibold text-accent-text underline">
            See your brand matches
          </Link>
        </div>
      ) : (
        <>
          <div
            role="group"
            aria-label="Filter deals"
            className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1"
          >
            {FILTER_OPTIONS.map((option) => {
              const isAll = option.key === 'all'
              const active = isAll ? !filter : filter === option.key
              return (
                <Link
                  key={option.key}
                  href={isAll ? '/dashboard' : `/dashboard?stage=${option.key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-9 items-center rounded-[9px] px-3.5 text-sm font-semibold ${
                    active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>

          {groups.length === 0 ? (
            <p className="text-[15px] text-muted">
              Nothing here right now.{' '}
              <Link href="/dashboard" className="font-semibold text-accent-text underline">
                See all deals
              </Link>
              .
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-2.5">
                <h2 className="eyebrow">
                  {group.label} · {group.deals.length}
                </h2>
                <ul className={`${cardClass} overflow-hidden`}>
                  {group.deals.map((deal, index) => (
                    <li key={deal.id} className={index > 0 ? 'border-t border-line-soft' : ''}>
                      <Link
                        href={`/deals/${deal.id}`}
                        className="flex items-center gap-3.5 px-[18px] py-3.5 hover:bg-surface-2"
                      >
                        <Monogram name={deal.brands.name} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[16px] font-semibold text-ink">{deal.brands.name}</span>
                          <span className="text-[14px] text-muted">
                            {deal.brands.domain} · {lastActivity(deal, now)}
                          </span>
                        </span>
                        <StageChip status={deal.status} />
                        <ChevronRightIcon className="shrink-0 text-subtle" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

function lastActivity(deal: DealWithBrand, now: Date): string {
  const latestMessage = deal.messages
    .map((m) => m.created_at)
    .sort()
    .at(-1)
  return relativeTime(latestMessage ?? deal.updated_at, now)
}
