import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DiscoveryControls } from './discovery-controls'
import { DiscoveryStatus } from './discovery-status'
import { MatchCard, MatchCardSkeleton } from './match-card'
import { TuneDrawer } from './tune-drawer'
import { isRunInFlight } from '@/lib/discovery-guard'
import { PageHeader, cardClass } from '@/components/ui'
import type { Brand, BrandMatch } from '@/lib/supabase/types'

const NEW_PILL_MS = 3 * 24 * 60 * 60 * 1000

export default async function BrandsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: interview }, { data: matches }, { data: latestRun }] = await Promise.all([
    supabase
      .from('interviews')
      .select('id, values, target_industries, values_customized, raw_answers')
      .eq('athlete_id', user.id)
      .maybeSingle(),
    supabase
      .from('brand_matches')
      .select('*, brands(*)')
      .eq('athlete_id', user.id)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false }),
    supabase
      .from('discovery_runs')
      .select('status, brands_found, matches_created, created_at, finished_at, kind, focus')
      .eq('athlete_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!interview) redirect('/onboarding')

  const now = new Date()
  const matchList = (matches ?? []) as (BrandMatch & { brands: Brand })[]
  const inFlight = latestRun ? isRunInFlight(latestRun, now) : false
  const newMatchesCount = latestRun
    ? matchList.filter((m) => new Date(m.created_at).getTime() >= new Date(latestRun.created_at).getTime())
        .length
    : 0
  const whatMatters = (
    (interview.raw_answers as { what_matters?: string } | null)?.what_matters ?? ''
  ).trim()
  const basedOn = [...(interview.values ?? []), ...(interview.target_industries ?? [])]
    .slice(0, 3)
    .join(', ')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Brand matches"
        description="Researched live for you, never pulled from a fixed list. Pick one that fits and draft the outreach. You send it yourself."
        actions={
          <>
            <TuneDrawer
              values={interview.values}
              industries={interview.target_industries}
              fromInterview={!interview.values_customized}
              whatMatters={whatMatters}
              focusDisabled={inFlight}
            />
            <DiscoveryControls inFlight={inFlight} />
          </>
        }
      />

      {/* DiscoveryControls portals its start-run error here, below the header. */}
      <div id="discovery-error-slot" />

      <DiscoveryStatus
        latestRun={latestRun}
        inFlight={inFlight}
        newMatchesCount={newMatchesCount}
        now={now}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="eyebrow">
          {matchList.length} match{matchList.length === 1 ? '' : 'es'}
        </h2>
        {basedOn && <span className="text-sm text-muted">Based on: {basedOn}</span>}
      </div>

      {matchList.length === 0 && !inFlight ? (
        <div className={`flex flex-col gap-2 p-6 ${cardClass}`}>
          <p className="text-[15px] text-muted">
            Your copilot is ready. Hit Find more brands and it researches the live web for brands
            that fit you. It takes a few minutes, and you can leave while it works.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {matchList.map((match) => {
            const isNew =
              match.status === 'suggested' &&
              now.getTime() - new Date(match.created_at).getTime() < NEW_PILL_MS
            return <MatchCard key={match.id} match={match} brand={match.brands} isNew={isNew} />
          })}
          {inFlight && (
            <>
              <MatchCardSkeleton />
              <MatchCardSkeleton />
            </>
          )}
        </ul>
      )}
    </div>
  )
}
