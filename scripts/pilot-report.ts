// Pilot check-in for the owner: aggregate counts straight from the database
// (service role). Prints no names, visa status, or message/draft text.
//
//   npm run pilot:report              # uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//                                     # (from .env.local, or exported for production)
//   npm run pilot:report -- --local   # the local Supabase stack
//
// Mailto clicks and repeat visits live in PostHog, not the database.

import { execSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { buildPilotReport } from '@/lib/pilot-report'

function connection(local: boolean): { url: string; key: string } {
  if (local) {
    const env = Object.fromEntries(
      execSync('npx -y supabase@2 status -o env', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .map((line) => line.split('=').map((part) => part.replace(/^"|"$/g, '')) as [string, string]),
    )
    return { url: env.API_URL, key: env.SERVICE_ROLE_KEY }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --local')
  return { url, key }
}

async function main() {
  const { values } = parseArgs({ options: { local: { type: 'boolean', default: false } } })
  const { url, key } = connection(values.local!)
  const db = createClient<Database>(url, key, { auth: { persistSession: false } })

  const select = async <T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => {
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Counts only — the voice profile text itself is never fetched.
  const countRows = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await query
    if (error) throw new Error(error.message)
    return count ?? 0
  }

  const [inviteCodes, profiles, interviewTotal, withVoiceProfile, runs, matches, brands, deals, messages] = await Promise.all([
    select(db.from('invite_codes').select('code, label, uses, max_uses, revoked_at').order('created_at')),
    select(db.from('profiles').select('invite_code, onboarding_completed_at')),
    countRows(db.from('interviews').select('id', { count: 'exact', head: true })),
    countRows(
      db.from('interviews').select('id', { count: 'exact', head: true }).not('voice_profile', 'is', null),
    ),
    select(db.from('discovery_runs').select('status, brands_found, matches_created')),
    select(db.from('brand_matches').select('status, brand_id, contact_email')),
    select(db.from('brands').select('id, contact_email')),
    select(db.from('deals').select('status')),
    select(db.from('messages').select('direction, athlete_edited')),
  ])

  const brandHasEmail = new Set(brands.filter((b) => b.contact_email).map((b) => b.id))
  const report = buildPilotReport({
    inviteCodes,
    profiles,
    interviews: { total: interviewTotal, withVoiceProfile },
    runs,
    matches: matches.map((m) => ({ status: m.status, has_email: !!m.contact_email || brandHasEmail.has(m.brand_id) })),
    deals,
    messages,
  })

  console.log('\nInvite codes')
  console.table(report.inviteCodes)
  for (const [section, numbers] of Object.entries(report).filter(([k]) => k !== 'inviteCodes')) {
    console.log(`\n${section}`)
    console.table(numbers)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
