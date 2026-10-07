import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { as, createTestDb, signUp } from './harness'

// Least-privilege grants (0004): every table operation the app performs as an
// athlete still works, and everything else is denied at the privilege level —
// before RLS is even consulted.

const A = '00000000-0000-4000-8000-00000000000a'
const BRAND = '00000000-0000-4000-8000-0000000000b1'

let db: PGlite

beforeEach(async () => {
  db = await createTestDb()
  await db.exec(`insert into invite_codes (code) values ('PILOT001')`)
  await signUp(db, A, 'PILOT001')
  await db.query(
    `insert into brands (id, domain, name, verified_at) values ($1, 'ridgeline.test', 'Ridgeline', now())`,
    [BRAND],
  )
  await db.query(`insert into brand_matches (athlete_id, brand_id) values ($1, $2)`, [A, BRAND])
})

const asA = <T>(fn: Parameters<typeof as<T>>[3]) => as(db, 'authenticated', A, fn)

describe('authenticated athlete: the app paths still work', () => {
  it('onboarding: reads and updates own profile', async () => {
    await asA(async (tx) => {
      await tx.query(
        `update profiles set full_name = 'Alex', school = 'State', sport = 'Track',
           citizenship_status = 'f1_visa', visa_guidance_shown_at = now(),
           onboarding_completed_at = now() where id = $1`,
        [A],
      )
      const { rows } = await tx.query<{ full_name: string }>('select full_name from profiles')
      expect(rows).toEqual([{ full_name: 'Alex' }])
    })
  })

  it('interview: insert then update own interview', async () => {
    await asA(async (tx) => {
      await tx.query(
        `insert into interviews (athlete_id, interests, category_tags) values ($1, '["trail running"]', '{trail-running}')`,
        [A],
      )
      await tx.query(
        `update interviews set category_tags = '{running}', voice_profile = 'Chill and dry.' where athlete_id = $1`,
        [A],
      )
    })
  })

  it('brands page: reads the brand cache and matches, dismisses a match', async () => {
    await asA(async (tx) => {
      expect((await tx.query('select * from brands')).rows).toHaveLength(1)
      expect((await tx.query('select *, brand_id from brand_matches')).rows).toHaveLength(1)
      await tx.query(`update brand_matches set status = 'dismissed'`)
    })
  })

  it('discovery: enqueues and reads own runs', async () => {
    await asA(async (tx) => {
      await tx.query('insert into discovery_runs (athlete_id) values ($1) returning id', [A])
      expect((await tx.query('select status from discovery_runs')).rows).toHaveLength(1)
    })
  })

  it('discovery: enqueues a focused search with its text', async () => {
    await asA(async (tx) => {
      await tx.query(
        `insert into discovery_runs (athlete_id, kind, focus) values ($1, 'focused', 'women-owned skincare')`,
        [A],
      )
      const { rows } = await tx.query('select kind, focus from discovery_runs')
      expect(rows).toEqual([{ kind: 'focused', focus: 'women-owned skincare' }])
    })
  })

  it('discovery: kind and focus must agree', async () => {
    await expect(
      asA((tx) => tx.query(`insert into discovery_runs (athlete_id, kind) values ($1, 'focused')`, [A])),
    ).rejects.toThrow(/check constraint/)
    await expect(
      asA((tx) => tx.query(`insert into discovery_runs (athlete_id, focus) values ($1, 'coffee')`, [A])),
    ).rejects.toThrow(/check constraint/)
  })

  it('deal thread: creates a deal, drafts, pastes a reply, edits, changes status', async () => {
    await asA(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        'insert into deals (athlete_id, brand_id) values ($1, $2) returning id',
        [A, BRAND],
      )
      const dealId = rows[0].id
      const msg = await tx.query<{ id: string }>(
        `insert into messages (deal_id, direction, subject, content) values ($1, 'outbound_draft', 's', 'b') returning id`,
        [dealId],
      )
      await tx.query(
        `update messages set content = 'edited', athlete_edited = true,
           original_subject = 's', original_content = 'b' where id = $1`,
        [msg.rows[0].id],
      )
      await tx.query(
        `insert into messages (deal_id, direction, content) values ($1, 'inbound_pasted', 'reply')`,
        [dealId],
      )
      await tx.query(`update deals set status = 'sent' where id = $1`, [dealId])
    })
  })
})

describe('authenticated athlete: denied beyond what policies need', () => {
  const denied = (sql: string, params: unknown[] = []) =>
    expect(asA((tx) => tx.query(sql, params))).rejects.toThrow(/permission denied/)

  it('cannot write the brand cache', async () => {
    await denied(`insert into brands (domain, name) values ('evil.test', 'Evil')`)
    await denied(`update brands set contact_email = 'x@evil.test'`)
    await denied(`delete from brands`)
  })

  it('cannot forge discovery run progress', async () => {
    await denied(`insert into discovery_runs (athlete_id, status) values ($1, 'completed')`, [A])
    await denied(`update discovery_runs set status = 'failed'`)
  })

  it('cannot create matches or rewrite them beyond status', async () => {
    await denied(`insert into brand_matches (athlete_id, brand_id) values ($1, $2)`, [A, BRAND])
    await denied(`update brand_matches set fit_reason = 'x'`)
  })

  it('cannot read or write API usage (owner-only)', async () => {
    await denied('select * from api_usage')
    await denied(`insert into api_usage (provider, operation, source) values ('tavily', 'search', 'draft')`)
  })

  it('cannot change its own invite code or id, or insert profiles', async () => {
    await denied(`update profiles set invite_code = 'PILOT001'`)
    await denied(`update profiles set id = gen_random_uuid()`)
    await denied(`insert into profiles (id) values (gen_random_uuid())`)
  })
})

describe('anon', () => {
  it.each([
    'profiles',
    'interviews',
    'brands',
    'brand_matches',
    'deals',
    'messages',
    'discovery_runs',
    'invite_codes',
    'api_usage',
  ])('has no access to %s', async (table) => {
    await expect(as(db, 'anon', null, (tx) => tx.query(`select * from ${table}`))).rejects.toThrow(
      /permission denied/,
    )
  })
})

// Supabase advisor lint 0011: a function without a pinned search_path resolves
// names through whatever path the caller set. 0014 pins the last one.
describe('database functions', () => {
  it('every public function pins its search_path', async () => {
    const { rows } = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    )
    expect(rows).toEqual([])
  })

  it('set_updated_at still stamps updated_at on an athlete update', async () => {
    await db.exec(`update profiles set updated_at = '2000-01-01' where id = '${A}'`)
    await asA((tx) => tx.query(`update profiles set full_name = 'Alex' where id = $1`, [A]))
    const { rows } = await db.query<{ stamped: boolean }>(
      `select updated_at > now() - interval '1 minute' as stamped from profiles where id = $1`,
      [A],
    )
    expect(rows).toEqual([{ stamped: true }])
  })
})
