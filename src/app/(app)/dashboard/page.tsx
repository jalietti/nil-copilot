import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Brand, Deal, DealStatus } from '@/lib/supabase/types'

const STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Drafting',
  sent: 'Waiting on reply',
  reply_received: 'They replied — your move',
  negotiating: 'Negotiating',
  agreed: 'Agreed',
  closed: 'Closed',
  dead: 'Dead',
}

const ACTIVE_STATUSES: DealStatus[] = ['draft', 'sent', 'reply_received', 'negotiating', 'agreed']

export default async function DashboardPage() {
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
      .select('*, brands(*)')
      .eq('athlete_id', user.id)
      .order('updated_at', { ascending: false }),
  ])

  if (!profile?.onboarding_completed_at) redirect('/onboarding')

  const deals = (dealRows ?? []) as unknown as (Deal & { brands: Brand })[]
  const active = deals.filter((deal) => ACTIVE_STATUSES.includes(deal.status))
  const inactive = deals.filter((deal) => !ACTIVE_STATUSES.includes(deal.status))

  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold">
        {profile.full_name ? `Hey ${profile.full_name.split(' ')[0]}` : 'Dashboard'}
      </h1>
      <p className="mb-6 text-sm text-neutral-600">Your partnership pipeline, in one place.</p>

      {!interview && (
        <p className="mb-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Start with the{' '}
          <Link href="/interview" className="underline">
            interview
          </Link>{' '}
          so the copilot knows which brands actually fit you.
        </p>
      )}

      {deals.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No deals yet.{' '}
          <Link href="/brands" className="underline">
            Find brands that fit you
          </Link>{' '}
          to start your first thread.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Active ({active.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {active.map((deal) => (
                <DealRow key={deal.id} deal={deal} />
              ))}
              {active.length === 0 && (
                <li className="text-sm text-neutral-500">Nothing in flight right now.</li>
              )}
            </ul>
          </section>
          {inactive.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
                Past ({inactive.length})
              </h2>
              <ul className="flex flex-col gap-3">
                {inactive.map((deal) => (
                  <DealRow key={deal.id} deal={deal} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

function DealRow({ deal }: { deal: Deal & { brands: Brand } }) {
  return (
    <li>
      <Link
        href={`/deals/${deal.id}`}
        className="flex items-center justify-between rounded border border-neutral-200 p-3 hover:border-neutral-400"
      >
        <div>
          <p className="font-medium">{deal.brands.name}</p>
          <p className="text-xs text-neutral-500">{deal.brands.domain}</p>
        </div>
        <span className="rounded bg-neutral-100 px-2 py-1 text-xs">
          {STATUS_LABELS[deal.status]}
        </span>
      </Link>
    </li>
  )
}
