import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { as, createTestDb, signUp } from './harness'

// Cross-athlete isolation, enforced by RLS + grants, on every table holding
// athlete data. Athlete A (authenticated, JWT sub = A) must not be able to
// read or write any of athlete B's rows. Complements the API-level suite in
// tests/integration (real Supabase + supabase-js).

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const BRAND = '00000000-0000-4000-8000-0000000000b1'
const B_INTERVIEW = '00000000-0000-4000-8000-0000000000c1'
const B_MATCH = '00000000-0000-4000-8000-0000000000c2'
const B_DEAL = '00000000-0000-4000-8000-0000000000c3'
const B_MESSAGE = '00000000-0000-4000-8000-0000000000c4'
const B_RUN = '00000000-0000-4000-8000-0000000000c5'

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await db.exec(`insert into invite_codes (code) values ('PILOT001')`)
  await signUp(db, A, 'PILOT001')
  await signUp(db, B, 'PILOT001')
  await db.query(
    `update profiles set full_name = 'Bea', citizenship_status = 'f1_visa' where id = $1`,
    [B],
  )
  await db.query(`insert into brands (id, domain, name) values ($1, 'shared.test', 'Shared')`, [
    BRAND,
  ])
  await db.query(
    `insert into interviews (id, athlete_id, interests) values ($1, $2, '["private interest"]')`,
    [B_INTERVIEW, B],
  )
  await db.query(`insert into brand_matches (id, athlete_id, brand_id) values ($1, $2, $3)`, [
    B_MATCH,
    B,
    BRAND,
  ])
  await db.query(`insert into deals (id, athlete_id, brand_id) values ($1, $2, $3)`, [
    B_DEAL,
    B,
    BRAND,
  ])
  await db.query(
    `insert into messages (id, deal_id, direction, content) values ($1, $2, 'inbound_pasted', 'private reply')`,
    [B_MESSAGE, B_DEAL],
  )
  await db.query(`insert into discovery_runs (id, athlete_id) values ($1, $2)`, [B_RUN, B])
})

const asA = <T>(fn: Parameters<typeof as<T>>[3]) => as(db, 'authenticated', A, fn)

async function rowsAsA(sql: string, params: unknown[] = []) {
  return asA(async (tx) => (await tx.query(sql, params)).rows)
}

async function affectedAsA(sql: string, params: unknown[] = []) {
  return asA(async (tx) => (await tx.query(sql, params)).affectedRows ?? 0)
}

const B_ROWS: [table: string, id: string][] = [
  ['profiles', B],
  ['interviews', B_INTERVIEW],
  ['brand_matches', B_MATCH],
  ['deals', B_DEAL],
  ['messages', B_MESSAGE],
  ['discovery_runs', B_RUN],
]

describe("athlete A cannot read athlete B's rows", () => {
  it.each(B_ROWS)('%s: B row invisible, whole-table scan returns nothing of B', async (table, id) => {
    expect(await rowsAsA(`select * from ${table} where id = $1`, [id])).toEqual([])
    const all = await rowsAsA(`select * from ${table}`)
    expect(JSON.stringify(all)).not.toContain(B)
  })

  it("never sees B's visa status", async () => {
    expect(await rowsAsA(`select citizenship_status from profiles where id = $1`, [B])).toEqual([])
  })

  it('the service role (background jobs) still sees them, so the rows really exist', async () => {
    const count = await as(db, 'service_role', null, async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        `select (select count(*) from messages where id = $1)::int as n`,
        [B_MESSAGE],
      )
      return rows[0].n
    })
    expect(count).toBe(1)
  })
})

describe("athlete A cannot modify athlete B's rows", () => {
  it('profiles: update affects nothing', async () => {
    expect(await affectedAsA(`update profiles set full_name = 'pwned' where id = $1`, [B])).toBe(0)
  })

  it('interviews: update and delete affect nothing', async () => {
    expect(await affectedAsA(`update interviews set interests = '[]' where id = $1`, [B_INTERVIEW])).toBe(0)
    expect(await affectedAsA(`delete from interviews where id = $1`, [B_INTERVIEW])).toBe(0)
  })

  it('brand_matches: status update affects nothing', async () => {
    expect(
      await affectedAsA(`update brand_matches set status = 'dismissed' where id = $1`, [B_MATCH]),
    ).toBe(0)
  })

  it('deals: update and delete affect nothing', async () => {
    expect(await affectedAsA(`update deals set status = 'dead' where id = $1`, [B_DEAL])).toBe(0)
    expect(await affectedAsA(`delete from deals where id = $1`, [B_DEAL])).toBe(0)
  })

  it('messages: update and delete affect nothing', async () => {
    expect(await affectedAsA(`update messages set content = 'x' where id = $1`, [B_MESSAGE])).toBe(0)
    expect(await affectedAsA(`delete from messages where id = $1`, [B_MESSAGE])).toBe(0)
  })

  it('and the rows are unchanged afterwards', async () => {
    const { rows } = await db.query<{ content: string }>('select content from messages where id = $1', [
      B_MESSAGE,
    ])
    expect(rows).toEqual([{ content: 'private reply' }])
  })
})

describe('athlete A cannot create rows on behalf of athlete B', () => {
  const rejected = (sql: string, params: unknown[]) =>
    expect(asA((tx) => tx.query(sql, params))).rejects.toThrow(/row-level security|permission denied/)

  it('interviews', () => rejected(`insert into interviews (athlete_id) values ($1)`, [B]))
  it('deals', () => rejected(`insert into deals (athlete_id, brand_id) values ($1, $2)`, [B, BRAND]))
  it('discovery_runs', () => rejected(`insert into discovery_runs (athlete_id) values ($1)`, [B]))
  it("messages in B's deal", () =>
    rejected(`insert into messages (deal_id, direction, content) values ($1, 'outbound_draft', 'x')`, [
      B_DEAL,
    ]))

  it("cannot move its own deal onto B or its own message into B's deal", async () => {
    await asA(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        'insert into deals (athlete_id, brand_id) values ($1, $2) returning id',
        [A, BRAND],
      )
      await expect(
        tx.query('update deals set athlete_id = $1 where id = $2', [B, rows[0].id]),
      ).rejects.toThrow(/row-level security/)
    })
    await asA(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        'insert into deals (athlete_id, brand_id) values ($1, $2) returning id',
        [A, BRAND],
      )
      const msg = await tx.query<{ id: string }>(
        `insert into messages (deal_id, direction, content) values ($1, 'outbound_draft', 'x') returning id`,
        [rows[0].id],
      )
      await expect(
        tx.query('update messages set deal_id = $1 where id = $2', [B_DEAL, msg.rows[0].id]),
      ).rejects.toThrow(/row-level security/)
    })
  })
})

describe('shared and service-only tables', () => {
  it('authenticated cannot write brands', async () => {
    await expect(
      asA((tx) => tx.query(`update brands set name = 'x' where id = $1`, [BRAND])),
    ).rejects.toThrow(/permission denied/)
  })

  it('authenticated cannot read or write invite codes', async () => {
    await expect(asA((tx) => tx.query('select * from invite_codes'))).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      asA((tx) => tx.query(`insert into invite_codes (code) values ('SNEAKY01')`)),
    ).rejects.toThrow(/permission denied/)
  })

  it("brand outcomes (fed by B's reply) are unreadable and unwritable by A", async () => {
    expect(
      (await db.query('select any_reply from brand_outcomes where brand_id = $1', [BRAND])).rows,
    ).toEqual([{ any_reply: true }])
    await expect(asA((tx) => tx.query('select * from brand_outcomes'))).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      asA((tx) => tx.query(`update brand_outcomes set any_agreed = true`)),
    ).rejects.toThrow(/permission denied/)
  })

  it('an unauthenticated (anon) request sees no athlete data at all', async () => {
    for (const [table] of B_ROWS) {
      await expect(as(db, 'anon', null, (tx) => tx.query(`select * from ${table}`))).rejects.toThrow(
        /permission denied/,
      )
    }
  })
})
