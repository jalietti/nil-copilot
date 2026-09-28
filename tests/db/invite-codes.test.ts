import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { as, createTestDb, signUp } from './harness'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'

let db: PGlite

beforeEach(async () => {
  db = await createTestDb()
  await db.exec(`
    insert into invite_codes (code, label, max_uses) values
      ('TEAM2026', 'water polo', 2),
      ('SINGLEUSE', null, 1),
      ('UNLIMITED', null, null);
    insert into invite_codes (code, revoked_at) values ('REVOKED1', now());
  `)
})

async function uses(code: string): Promise<number> {
  const { rows } = await db.query<{ uses: number }>(
    'select uses from invite_codes where code = $1',
    [code],
  )
  return rows[0].uses
}

async function profileCode(id: string): Promise<string | null | undefined> {
  const { rows } = await db.query<{ invite_code: string | null }>(
    'select invite_code from profiles where id = $1',
    [id],
  )
  return rows[0]?.invite_code
}

describe('invite-gated signup (auth.users trigger)', () => {
  it('accepts a valid code, records it on the profile, and consumes a use', async () => {
    await signUp(db, A, 'TEAM2026')
    expect(await profileCode(A)).toBe('TEAM2026')
    expect(await uses('TEAM2026')).toBe(1)
  })

  it('normalizes case and whitespace', async () => {
    await signUp(db, A, '  team2026 ')
    expect(await profileCode(A)).toBe('TEAM2026')
  })

  it('rejects a signup with no code, and creates no user or profile', async () => {
    await expect(signUp(db, A, null)).rejects.toThrow(/invalid_invite_code/)
    const { rows } = await db.query('select 1 from auth.users where id = $1', [A])
    expect(rows).toHaveLength(0)
    expect(await profileCode(A)).toBeUndefined()
  })

  it('rejects an unknown code', async () => {
    await expect(signUp(db, A, 'NOPE-NOPE')).rejects.toThrow(/invalid_invite_code/)
  })

  it('rejects a revoked code', async () => {
    await expect(signUp(db, A, 'REVOKED1')).rejects.toThrow(/invalid_invite_code/)
  })

  it('rejects an exhausted code and leaves its use count at the cap', async () => {
    await signUp(db, A, 'SINGLEUSE')
    await expect(signUp(db, B, 'SINGLEUSE')).rejects.toThrow(/invalid_invite_code/)
    expect(await uses('SINGLEUSE')).toBe(1)
  })

  it('counts every use of a multi-use code up to max_uses', async () => {
    await signUp(db, A, 'TEAM2026')
    await signUp(db, B, 'TEAM2026')
    await expect(signUp(db, C, 'TEAM2026')).rejects.toThrow(/invalid_invite_code/)
    expect(await uses('TEAM2026')).toBe(2)
  })

  it('allows unlimited codes', async () => {
    await signUp(db, A, 'UNLIMITED')
    await signUp(db, B, 'UNLIMITED')
    await signUp(db, C, 'UNLIMITED')
    expect(await uses('UNLIMITED')).toBe(3)
  })
})

describe('invite_codes access', () => {
  it.each(['anon', 'authenticated'] as const)('is not readable or writable by %s', async (role) => {
    await signUp(db, A, 'UNLIMITED')
    const uid = role === 'authenticated' ? A : null
    await expect(as(db, role, uid, (tx) => tx.query('select * from invite_codes'))).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      as(db, role, uid, (tx) => tx.query(`insert into invite_codes (code) values ('HACKED01')`)),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(db, role, uid, (tx) => tx.query('update invite_codes set uses = 0')),
    ).rejects.toThrow(/permission denied/)
  })

  it('is readable by the service role', async () => {
    const rows = await as(db, 'service_role', null, (tx) => tx.query('select code from invite_codes'))
    expect(rows.rows).toHaveLength(4)
  })
})
