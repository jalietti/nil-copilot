# Isolation test snippets

Add to the existing suites — don't create new test files for a single table.

## `tests/db/rls.test.ts` (PGlite, runs in `npm test`)

1. Add an id constant and insert B's row in `beforeAll`:

   ```ts
   const B_[THING] = '00000000-0000-4000-8000-0000000000c[N]'
   // in beforeAll:
   await db.query(`insert into [table_name] (id, athlete_id, [column]) values ($1, $2, [value])`, [B_[THING], B])
   ```

2. Add `['[table_name]', B_[THING]]` to `B_ROWS` — the read/update/delete cases loop over it.
3. Add an insert-on-B's-behalf case under `'athlete A cannot create rows on behalf of athlete B'`:

   ```ts
   it('[table_name]', () => rejected(`insert into [table_name] (athlete_id) values ($1)`, [B]))
   ```

4. Service-only table instead: add a case under `'shared and service-only tables'` asserting A can neither `select` nor `insert`/`update` (see the brand outcomes case).

## `tests/integration/rls.supabase.test.ts` (real Supabase, `npm run test:rls`)

1. Create B's row in the setup (as B, through supabase-js) and keep its id in `ids`.
2. Add `['[table_name]', ids.[thing]]` to `tables()` — read, update/delete and anon cases loop over it.
3. Service-only: add a "closed to athletes" case like `"brand outcomes (fed by B's pasted reply) are closed to athletes"`.

## `tests/db/grants.test.ts` (app paths still work)

```ts
it('[feature]: [what the app does]', async () => {
  await asA(async (tx) => {
    await tx.query(`insert into [table_name] (athlete_id, [column]) values ($1, [value])`, [A])
    const { rows } = await tx.query(`select [column] from [table_name]`)
    expect(rows).toHaveLength(1)
  })
})
```

Filled-in example: `'discovery: enqueues a focused search with its text'` in `tests/db/grants.test.ts`.
