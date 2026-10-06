import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DiscoveryControls } from './discovery-controls'
import { MatchCard } from './match-card'
import { SearchPreferences } from './search-preferences'
import { FocusedSearch } from './focused-search'
import { isRunInFlight } from '@/lib/discovery-guard'
import type { Brand, BrandMatch } from '@/lib/supabase/types'

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
      .select('status, brands_found, matches_created, created_at, kind, focus')
      .eq('athlete_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!interview) redirect('/onboarding')

  const matchList = (matches ?? []) as (BrandMatch & { brands: Brand })[]

  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Brand matches</h1>
        <DiscoveryControls
          latestRun={latestRun}
          inFlight={latestRun ? isRunInFlight(latestRun, new Date()) : false}
        />
      </div>
      <SearchPreferences
        values={interview.values}
        industries={interview.target_industries}
        fromInterview={!interview.values_customized}
        whatMatters={
          ((interview.raw_answers as { what_matters?: string } | null)?.what_matters ?? '').trim()
        }
      />
      <FocusedSearch disabled={latestRun ? isRunInFlight(latestRun, new Date()) : false} />
      {matchList.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No matches yet. Kick off discovery and the copilot will research brands that actually fit
          your interests — live research, not a fixed list.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {matchList.map((match) => (
            <MatchCard key={match.id} match={match} brand={match.brands} />
          ))}
        </ul>
      )}
    </main>
  )
}
