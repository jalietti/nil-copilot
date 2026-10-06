---
name: supabase-migration
description: Use whenever a change needs anything new or different in supabase/migrations/ — a table, column, grant, RLS policy, trigger, function, or index. Covers designing the schema with the owner, writing the migration, isolation tests, types, pilot checks, and moving it local → dev → prod without touching the wrong database. Not for app code that only uses existing columns, or prod operations with no schema change (e.g. minting invite codes).
---

# Supabase migration

**Purpose:** ship a schema change that keeps every athlete's data invisible to every other athlete, lands in the right database, and leaves every file that mirrors the schema in sync.

## When to use this

- A feature needs a new table, column, enum value, grant, policy, trigger, function, or index.
- A security fix changes who can read or write something.
- **Not** for: app code that only reads/writes existing columns; prod-only data operations with no schema change.

## Inputs

- The feature or fix that needs the change (usually worked out mid-feature — the schema is rarely decided up front).
- `supabase/migrations/` — the last migration number and existing patterns (`0001` policies, `0004` grants, `0007` service-only table).
- The three databases (never confuse them):

  | | Ref | Who uses it |
  |---|---|---|
  | Local | Docker (`npx supabase start`) | tests, `npm run dev:local` |
  | Dev (hosted) | `wmjlkinwymxmpmzcufso` (`nil-copilot`) | `.env.local`, plain `npm run dev` |
  | **Prod (hosted)** | `fufkczizcrjxxhuksqpy` (`nil-copilot-prod`) | the pilot — real athletes |

- Templates: `files/INDEX.md`.

## Steps

1. **Check which database the CLI points at.** Run `cat supabase/.temp/project-ref` and say which of the three it is. If it says prod, say so out loud — nothing in this skill runs a bare `supabase db push`, but the owner should know.
2. **Design the schema with the owner — don't decide silently.** Present 2–3 options in plain language first: what the athlete or app experiences, what could go wrong, then the SQL detail underneath. Wait for a choice. Apply the access rules in **Decisions** to every option.
3. **Write the migration** as `supabase/migrations/00NN_short_name.sql`, the next number after the highest existing one. Start from `files/migration-template.sql`. Open with a comment block explaining *why* and who can see the data, matching the existing migrations' style.
4. **Grant explicitly.** Since `0004`, new tables get no access by default. Grant `authenticated` only what the app actually does, column by column for updates. Service-only tables get no grants at all.
5. **Add isolation tests** (patterns in `files/rls-test-snippets.md`):
   - athlete-data table → add B's row to `tests/db/rls.test.ts` (`B_ROWS` + insert-on-B's-behalf case) and to `tables()` in `tests/integration/rls.supabase.test.ts`;
   - service-only table → a "closed to athletes" case in both files;
   - every app read/write path → a case in `tests/db/grants.test.ts` proving it still works as the athlete.
6. **Update every mirror of the schema:**
   - `src/lib/supabase/types.ts` (hand-authored — row type + `Database.public.Tables` entry, enums);
   - `scripts/pilot/verify-prod.ts` — add the new column to `expected` and bump the `0001-00NN` label;
   - `PILOT-SETUP.md` — every mention of the previous latest migration number;
   - `supabase/seed.sql` — only if athletes see the new data on screen.
7. **Run locally:** `npx supabase start` (if not running), `npm run db:reset`, `npm test`, `npm run test:rls`, `npm run lint`, `npm run build`. Run `npm run test:e2e` only if the change touches signup → onboarding → draft → reply.
8. **Run the Definition of done** (below) before showing the owner anything.
9. **Hand off the dev push.** Hosted pushes ask for the database password, so the owner runs them. Give exactly:
   ```bash
   npm run pilot:db-push -- wmjlkinwymxmpmzcufso
   ```
   Then read their terminal (or ask them to paste) and confirm the new migration shows in both Local and Remote.
10. **Hand off the prod push**, only after dev is confirmed:
    ```bash
    npm run pilot:db-push -- fufkczizcrjxxhuksqpy
    ```
    then `npm run pilot:verify -- --url <pilot url> --project-ref fufkczizcrjxxhuksqpy`, then re-link the CLI to dev so prod is never the default:
    ```bash
    npx -y supabase@2 link --project-ref wmjlkinwymxmpmzcufso
    ```
11. **Commit** after local checks pass (step 8), with a message saying what the change does and which checks passed. Push handoffs don't block the commit.

## Decisions

- **Who can see it:**
  - Holds one athlete's data → **own-rows**: `athlete_id` column, `auth.uid () = athlete_id` policy. No athlete ever sees another athlete's data.
  - Built from more than one athlete's data (like `brand_outcomes`) → **service-only**: RLS on, no policies, no grants. Athletes only ever see the *result* (their own matches), never the inputs.
  - Facts from the public web (like `brands`) → **shared read-only**: `select` to `authenticated`, writes by the service role only.
- **New column on an existing table** → read-only to athletes by default. Grant `update (column)` only if the athlete edits it in the app; say so in the options.
- **Changes existing data** (drop, rename, type change, new `not null` on a populated column, backfill) → **stop**. Present options with pros and cons, and give the owner a read-only count query to run against prod so they see how many rows are affected. Prefer additive: rename = add new column → move app over → drop the old one in a later migration.
- **CLI linked somewhere unexpected** → stop and tell the owner; never re-link silently except the dev re-link in step 10.
- **More than two Definition-of-done checks fail on the first pass** → stop and say which step of this process caused it, instead of patching the output.

## Definition of done

Run every check, fix failures, run again. Report one line per check — pass/fail plus the evidence. List anything that could not be verified, and why, instead of assuming it passed.

1. **Number:** the new file is the next number with no gap or duplicate — evidence: `ls supabase/migrations`.
2. **Access:** every new table has `enable row level security` and the grants matching its access rule — evidence: the lines quoted from the SQL.
3. **Isolation:** new athlete-data / service-only tables appear in `tests/db/rls.test.ts` and `tests/integration/rls.supabase.test.ts`; `npm test` and `npm run test:rls` pass — evidence: test names + pass counts.
4. **App paths:** a `tests/db/grants.test.ts` case runs the app's real read/write as the athlete and passes — evidence: test name.
5. **Types:** `src/lib/supabase/types.ts` has every new column/table/enum; `npm run build` passes — evidence: the diff lines + build exit status.
6. **Prod check:** `verify-prod.ts` expects the new column and its label says the new number — evidence: the diff lines.
7. **Setup doc:** `grep -n "00<previous>" PILOT-SETUP.md` returns nothing stale — evidence: grep output.
8. **Right database:** `supabase/.temp/project-ref` was read and named before any database command; no bare `db push` was run — evidence: the commands run this session.
9. **Lint:** `npm run lint` exits 0 — evidence: exit status.
10. **Seed (only if athletes see the data):** `supabase/seed.sql` covers it and `npm run db:reset` succeeds — evidence: exit status.

## Edge cases

- **Working in the wrong database** has happened before: `.env.local` points at dev while the CLI can be linked to prod. Always read the link first (step 1) and pass refs explicitly.
- `pilot:db-push` re-links the CLI to whatever ref it was given — after a prod push the CLI points at prod until re-linked.
- `0001` was applied by hand on older projects; `pilot:db-push -- <ref> --adopt-existing` repairs that history. Don't use it on a project that already shows 0001 in Remote.
- `npm run test:e2e` resets the local database to the seed — warn before running it if the owner has local data they care about.
- Functions: `0004` revokes `execute` from `public` by default. Trigger functions that need to write service-only tables use `security definer set search_path = public` (see `0007`).
- Never put a project's database password, API key, or service-role key in any file, command line, or chat message.
