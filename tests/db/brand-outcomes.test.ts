import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { as, createTestDb, signUp } from './harness'

// Brand outcome facts (0007): derived from athletes' own deal/message
// activity, stored per brand with no athlete identity or text, and readable
// by no athlete at all.

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const BRAND = '00000000-0000-4000-8000-0000000000b1'
const REPLY = 'Hi Alex, we can do $75 plus product.'

let db: PGlite

beforeEach(async () => {
  db = await createTestDb()
  await db.exec(`insert into invite_codes (code) values ('PILOT001')`)
  await signUp(db, A, 'PILOT001')
  await signUp(db, B, 'PILOT001')
  await db.query(
    `insert into brands (id, domain, name, contact_email) values ($1, 'reef.test', 'Reef', 'partnerships@reef.test')`,
    [BRAND],
  )
})

const asAthlete = <T>(uid: string, fn: Parameters<typeof as<T>>[3]) =>
  db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ])
    await tx.exec('set local role authenticated')
    return fn(tx)
  })

async function outcome() {
  const { rows } = await db.query('select * from brand_outcomes where brand_id = $1', [BRAND])
  return rows[0] as Record<string, unknown> | undefined
}

async function athleteDeal(uid: string): Promise<string> {
  return asAthlete(uid, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      'insert into deals (athlete_id, brand_id) values ($1, $2) returning id',
      [uid, BRAND],
    )
    return rows[0].id
  })
}

describe('deriving brand outcomes from athlete activity', () => {
  it('records nothing for drafts alone', async () => {
    const deal = await athleteDeal(A)
    await asAthlete(A, (tx) =>
      tx.query(`insert into messages (deal_id, direction, content) values ($1, 'outbound_draft', 'hi')`, [deal]),
    )
    expect(await outcome()).toBeUndefined()
  })

  it('a pasted reply records any_reply and the working contact email', async () => {
    const deal = await athleteDeal(A)
    await asAthlete(A, (tx) =>
      tx.query(`insert into messages (deal_id, direction, content) values ($1, 'inbound_pasted', $2)`, [
        deal,
        REPLY,
      ]),
    )
    expect(await outcome()).toMatchObject({
      any_reply: true,
      any_agreed: false,
      working_contact_email: 'partnerships@reef.test',
    })
  })

  it('an agreed deal records any_agreed, and facts only ever accumulate', async () => {
    const deal = await athleteDeal(A)
    await asAthlete(A, (tx) => tx.query(`update deals set status = 'agreed' where id = $1`, [deal]))
    await asAthlete(A, (tx) => tx.query(`update deals set status = 'closed' where id = $1`, [deal]))
    expect(await outcome()).toMatchObject({ any_reply: true, any_agreed: true })
  })

  it('stores brand-level facts only — no athlete, deal, message, or text columns', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'brand_outcomes' order by ordinal_position`,
    )
    expect(rows.map((r) => r.column_name)).toEqual([
      'brand_id',
      'any_reply',
      'any_agreed',
      'working_contact_email',
      'updated_at',
    ])
    const deal = await athleteDeal(A)
    await asAthlete(A, (tx) =>
      tx.query(`insert into messages (deal_id, direction, content) values ($1, 'inbound_pasted', $2)`, [
        deal,
        REPLY,
      ]),
    )
    const serialized = JSON.stringify(await outcome())
    expect(serialized).not.toContain(A)
    expect(serialized).not.toContain(deal)
    expect(serialized).not.toContain('$75')
  })
})

describe('isolation', () => {
  it('no athlete can read brand outcomes — not even for brands they worked with', async () => {
    const deal = await athleteDeal(A)
    await asAthlete(A, (tx) =>
      tx.query(`insert into messages (deal_id, direction, content) values ($1, 'inbound_pasted', $2)`, [
        deal,
        REPLY,
      ]),
    )
    for (const uid of [A, B]) {
      await expect(
        as(db, 'authenticated', uid, (tx) => tx.query('select * from brand_outcomes')),
      ).rejects.toThrow(/permission denied/)
    }
    await expect(as(db, 'anon', null, (tx) => tx.query('select * from brand_outcomes'))).rejects.toThrow(
      /permission denied/,
    )
  })

  it('athletes cannot write outcomes or call the recorder directly', async () => {
    await expect(
      as(db, 'authenticated', B, (tx) =>
        tx.query(`insert into brand_outcomes (brand_id, any_agreed) values ($1, true)`, [BRAND]),
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(db, 'authenticated', B, (tx) => tx.query(`select record_brand_outcome($1, true, true)`, [BRAND])),
    ).rejects.toThrow(/permission denied/)
  })

  it("B still cannot see A's reply or deal after A's activity feeds the brand facts", async () => {
    const deal = await athleteDeal(A)
    await asAthlete(A, (tx) =>
      tx.query(`insert into messages (deal_id, direction, content) values ($1, 'inbound_pasted', $2)`, [
        deal,
        REPLY,
      ]),
    )
    const seen = await as(db, 'authenticated', B, async (tx) => ({
      messages: (await tx.query('select * from messages')).rows,
      deals: (await tx.query('select * from deals')).rows,
    }))
    expect(seen).toEqual({ messages: [], deals: [] })
  })
})
