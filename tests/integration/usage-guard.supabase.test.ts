import { randomBytes, randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// The daily draft/interview limits through the real api_usage table, counted
// by the same service-role query the server actions run. Local Supabase only —
// see `npm run test:rls`.

const url = process.env.API_URL
const serviceKey = process.env.SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error('API_URL / SERVICE_ROLE_KEY not set. Run `npx supabase start`, then `npm run test:rls`.')
}
// createAdminClient reads the app's env names.
process.env.NEXT_PUBLIC_SUPABASE_URL = url
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey

const { checkDailyAllowance, DAILY_DRAFT_CAP, USAGE_CAP_MESSAGES } = await import('@/lib/usage-guard')

const admin = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const HOUR_MS = 60 * 60 * 1000

async function createAthlete(): Promise<string> {
  const code = `CAP${randomBytes(4).toString('hex').toUpperCase()}`
  await admin.from('invite_codes').insert({ code, max_uses: 1 }).throwOnError()
  const { data, error } = await admin.auth.admin.createUser({
    email: `cap-${randomUUID()}@example.test`,
    password: randomBytes(18).toString('base64url'),
    email_confirm: true,
    user_metadata: { invite_code: code },
  })
  if (error) throw error
  return data.user.id
}

async function recordCalls(athleteId: string, count: number, source: string, hoursAgo = 0) {
  const created_at = new Date(Date.now() - hoursAgo * HOUR_MS).toISOString()
  const rows = Array.from({ length: count }, () => ({
    provider: 'anthropic',
    operation: 'messages',
    source,
    athlete_id: athleteId,
    created_at,
  }))
  await admin.from('api_usage').insert(rows).throwOnError()
}

let underCap: string
let atCap: string

beforeAll(async () => {
  underCap = await createAthlete()
  atCap = await createAthlete()
  // Calls older than a day, and calls from other features, don't count.
  await recordCalls(underCap, DAILY_DRAFT_CAP - 1, 'draft')
  await recordCalls(underCap, 10, 'draft', 25)
  await recordCalls(underCap, 10, 'discovery')
  await recordCalls(atCap, DAILY_DRAFT_CAP, 'draft')
})

describe('checkDailyAllowance against api_usage', () => {
  it('lets an athlete under the daily draft limit keep drafting', async () => {
    expect(await checkDailyAllowance('draft', underCap)).toBeNull()
  })

  it('stops an athlete who has hit the daily draft limit', async () => {
    expect(await checkDailyAllowance('draft', atCap)).toBe(USAGE_CAP_MESSAGES.draft)
  })

  it('keeps each feature’s limit separate', async () => {
    expect(await checkDailyAllowance('interview', atCap)).toBeNull()
  })
})
