import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb, signUp } from './harness'

// Self-serve account deletion removes the auth user; every table holding the
// athlete's data must cascade from that, leaving other athletes untouched and
// only anonymous brand-level facts behind.

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const BRAND = '00000000-0000-4000-8000-0000000000b1'
const ATHLETE_TABLES = ['profiles', 'interviews', 'brand_matches', 'deals', 'messages', 'discovery_runs']

let db: PGlite

async function seedAthlete(uid: string) {
  await db.query(`update profiles set citizenship_status = 'f1_visa' where id = $1`, [uid])
  await db.query(`insert into interviews (athlete_id, voice_profile) values ($1, 'Dry and direct.')`, [uid])
  await db.query(`insert into brand_matches (athlete_id, brand_id, contact_email) values ($1, $2, 'hi@shared.test')`, [
    uid,
    BRAND,
  ])
  await db.query(`insert into discovery_runs (athlete_id, status) values ($1, 'completed')`, [uid])
  const { rows } = await db.query<{ id: string }>(
    `insert into deals (athlete_id, brand_id) values ($1, $2) returning id`,
    [uid, BRAND],
  )
  await db.query(`insert into messages (deal_id, direction, content) values ($1, 'inbound_pasted', 'reply')`, [
    rows[0].id,
  ])
}

async function rowsFor(uid: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const table of ATHLETE_TABLES) {
    const sql =
      table === 'profiles'
        ? 'select count(*)::int as n from profiles where id = $1'
        : table === 'messages'
          ? 'select count(*)::int as n from messages m join deals d on d.id = m.deal_id where d.athlete_id = $1'
          : `select count(*)::int as n from ${table} where athlete_id = $1`
    counts[table] = (await db.query<{ n: number }>(sql, [uid])).rows[0].n
  }
  return counts
}

beforeAll(async () => {
  db = await createTestDb()
  await db.exec(`insert into invite_codes (code) values ('PILOT001')`)
  await signUp(db, A, 'PILOT001')
  await signUp(db, B, 'PILOT001')
  await db.query(`insert into brands (id, domain, name) values ($1, 'shared.test', 'Shared')`, [BRAND])
  await seedAthlete(A)
  await seedAthlete(B)
  // What auth.admin.deleteUser does.
  await db.query('delete from auth.users where id = $1', [A])
})

describe('account deletion', () => {
  it("removes every row of the athlete's data, including visa status and pasted replies", async () => {
    expect(await rowsFor(A)).toEqual(Object.fromEntries(ATHLETE_TABLES.map((t) => [t, 0])))
  })

  it("leaves other athletes' data intact", async () => {
    expect(await rowsFor(B)).toEqual(Object.fromEntries(ATHLETE_TABLES.map((t) => [t, 1])))
  })

  it('keeps only the anonymous brand-level facts and the shared brand', async () => {
    const outcomes = await db.query('select any_reply from brand_outcomes where brand_id = $1', [BRAND])
    expect(outcomes.rows).toEqual([{ any_reply: true }])
    expect((await db.query('select 1 from brands where id = $1', [BRAND])).rows).toHaveLength(1)
  })
})
