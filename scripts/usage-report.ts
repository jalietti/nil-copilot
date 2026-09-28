// Owner-only API usage report from the api_usage table (service role).
// Athletes can't see this data anywhere in the app.
//
//   npm run usage:report                  # last 7 days, database from env
//   npm run usage:report -- --days 30
//   npm run usage:report -- --local       # the local Supabase stack
//
// Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env.local,
// or exported production values) unless --local.

import { execSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { buildUsageReport, type UsageRow } from '@/lib/usage-report'

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
  const { values } = parseArgs({
    options: { local: { type: 'boolean', default: false }, days: { type: 'string', default: '7' } },
  })
  const { url, key } = connection(values.local!)
  const db = createClient<Database>(url, key, { auth: { persistSession: false } })
  const since = new Date(Date.now() - Number(values.days) * 24 * 60 * 60 * 1000).toISOString()

  const rows: UsageRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('api_usage')
      .select('provider, source, athlete_id, discovery_run_id, input_tokens, output_tokens, credits')
      .gte('created_at', since)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const report = buildUsageReport(rows)
  console.log(`\nAPI usage, last ${values.days} days (${rows.length} calls)`)
  console.log('\nOverall')
  console.table(report.overall)
  console.log('\nBy feature')
  console.table(report.byFeature)
  console.log('\nPer discovery run')
  console.table(report.perDiscoveryRun)
  console.log('\nTop athletes')
  console.table(report.topAthletes)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
