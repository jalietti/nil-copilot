import { randomBytes, randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Cross-athlete isolation through the real stack: Supabase Auth issues real
// JWTs, PostgREST applies the migrations' grants + RLS, and athlete A uses
// the same supabase-js client the app uses. Runs against a local Supabase
// (`npx supabase start`) — see `npm run test:rls` and .github/workflows/ci.yml.

const url = process.env.API_URL
const anonKey = process.env.ANON_KEY
const serviceKey = process.env.SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) {
  throw new Error(
    'API_URL / ANON_KEY / SERVICE_ROLE_KEY not set. Run `npx supabase start`, then `npm run test:rls`.',
  )
}

type Client = SupabaseClient<Database>
const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin: Client = createClient<Database>(url, serviceKey, noSession)

async function createAthlete(inviteCode: string) {
  const email = `rls-${randomUUID()}@example.test`
  const password = randomBytes(18).toString('base64url')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { invite_code: inviteCode },
  })
  if (error) throw error
  const client = createClient<Database>(url!, anonKey!, noSession)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, client }
}

let a: { id: string; client: Client }
let b: { id: string; client: Client }
const ids = { brand: '', interview: '', match: '', deal: '', message: '', run: '' }

beforeAll(async () => {
  const code = `RLS${randomBytes(4).toString('hex').toUpperCase()}`
  const { error } = await admin.from('invite_codes').insert({ code, max_uses: 2 })
  if (error) throw error
  a = await createAthlete(code)
  b = await createAthlete(code)

  // B's data, written the way the app writes it.
  const bc = b.client
  await bc
    .from('profiles')
    .update({ full_name: 'Bea', citizenship_status: 'f1_visa' })
    .eq('id', b.id)
    .throwOnError()
  ids.interview = (
    await bc.from('interviews').insert({ athlete_id: b.id, interests: ['private'] }).select('id').single().throwOnError()
  ).data.id
  ids.brand = (
    await admin
      .from('brands')
      .insert({ domain: `${randomUUID()}.test`, name: 'Shared' })
      .select('id')
      .single()
      .throwOnError()
  ).data.id
  ids.match = (
    await admin
      .from('brand_matches')
      .insert({ athlete_id: b.id, brand_id: ids.brand })
      .select('id')
      .single()
      .throwOnError()
  ).data.id
  ids.deal = (
    await bc.from('deals').insert({ athlete_id: b.id, brand_id: ids.brand }).select('id').single().throwOnError()
  ).data.id
  ids.message = (
    await bc
      .from('messages')
      .insert({ deal_id: ids.deal, direction: 'inbound_pasted', content: 'private reply' })
      .select('id')
      .single()
      .throwOnError()
  ).data.id
  ids.run = (
    await bc.from('discovery_runs').insert({ athlete_id: b.id }).select('id').single().throwOnError()
  ).data.id
}, 60_000)

const tables = () =>
  [
    ['profiles', b.id],
    ['interviews', ids.interview],
    ['brand_matches', ids.match],
    ['deals', ids.deal],
    ['messages', ids.message],
    ['discovery_runs', ids.run],
  ] as const

describe("athlete A, signed in, cannot read athlete B's data", () => {
  it('B can read their own rows (sanity)', async () => {
    for (const [table, id] of tables()) {
      const { data } = await b.client.from(table).select('id').eq('id', id)
      expect(data, table).toHaveLength(1)
    }
  })

  it('every table returns nothing of B for A', async () => {
    for (const [table, id] of tables()) {
      const { data, error } = await a.client.from(table).select('*').eq('id', id)
      expect(error, table).toBeNull()
      expect(data, table).toEqual([])
      const { data: all } = await a.client.from(table).select('*')
      expect(JSON.stringify(all), table).not.toContain(b.id)
    }
  })
})

describe("athlete A cannot modify or delete athlete B's data", () => {
  it('updates and deletes match zero rows and leave B unchanged', async () => {
    await a.client.from('profiles').update({ full_name: 'pwned' }).eq('id', b.id)
    await a.client.from('interviews').delete().eq('id', ids.interview)
    await a.client.from('brand_matches').update({ status: 'dismissed' }).eq('id', ids.match)
    await a.client.from('deals').update({ status: 'dead' }).eq('id', ids.deal)
    await a.client.from('messages').update({ content: 'x' }).eq('id', ids.message)
    await a.client.from('messages').delete().eq('id', ids.message)

    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', b.id).single()
    const { data: match } = await admin.from('brand_matches').select('status').eq('id', ids.match).single()
    const { data: deal } = await admin.from('deals').select('status').eq('id', ids.deal).single()
    const { data: message } = await admin.from('messages').select('content').eq('id', ids.message).single()
    const { data: interview } = await admin.from('interviews').select('id').eq('id', ids.interview)
    expect(profile?.full_name).toBe('Bea')
    expect(match?.status).toBe('suggested')
    expect(deal?.status).toBe('draft')
    expect(message?.content).toBe('private reply')
    expect(interview).toHaveLength(1)
  })

  it("inserts on B's behalf are rejected", async () => {
    const attempts = await Promise.all([
      a.client.from('interviews').insert({ athlete_id: b.id }),
      a.client.from('deals').insert({ athlete_id: b.id, brand_id: ids.brand }),
      a.client.from('messages').insert({ deal_id: ids.deal, direction: 'outbound_draft', content: 'x' }),
      a.client.from('discovery_runs').insert({ athlete_id: b.id }),
    ])
    for (const { error } of attempts) expect(error).not.toBeNull()
  })
})

describe('shared and service-only tables', () => {
  it('authenticated cannot write the brand cache', async () => {
    const { error } = await a.client.from('brands').update({ name: 'x' }).eq('id', ids.brand)
    expect(error?.message).toMatch(/permission denied/)
  })

  it('authenticated cannot read or write invite codes', async () => {
    const read = await a.client.from('invite_codes').select('*')
    expect(read.error?.message).toMatch(/permission denied/)
    const write = await a.client.from('invite_codes').insert({ code: 'SNEAKY01' })
    expect(write.error?.message).toMatch(/permission denied/)
  })

  it('anon (no session) gets nothing from athlete tables', async () => {
    const anon = createClient<Database>(url!, anonKey!, noSession)
    for (const [table] of tables()) {
      const { data, error } = await anon.from(table).select('*')
      expect(data ?? [], table).toEqual([])
      expect(error?.message, table).toMatch(/permission denied/)
    }
  })
})
