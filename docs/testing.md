# Testing

| Command | What it runs | Needs |
| --- | --- | --- |
| `npm run test` | Unit tests + database tests (`tests/db/`) | Nothing — runs anywhere |
| `npm run test:rls` | API-level RLS isolation tests (`tests/integration/`) | A running local Supabase |
| `npm run lint` / `npm run build` | ESLint / production build + typecheck | Nothing |

CI (`.github/workflows/ci.yml`) runs all of them on every push and PR.

## Database tests (`tests/db/`, part of `npm run test`)

Run against [PGlite](https://pglite.dev) — the actual Postgres engine compiled
to WASM, in-process — with every file in `supabase/migrations/` applied on top
of a small shim of what the Supabase platform provides (`anon` /
`authenticated` / `service_role` / `supabase_auth_admin` roles, `auth.users`,
`auth.uid()`, and Supabase's default table grants). Queries run under
`set role` + JWT claims exactly as PostgREST issues them, so grants and RLS
policies are enforced for real. Covers invite-code signup, least-privilege
grants, and cross-athlete isolation on every table holding athlete data.

## API-level RLS tests (`npm run test:rls`)

The same isolation guarantees, proven through the real stack: Supabase Auth
issues real JWTs, PostgREST enforces the grants and policies, and athlete A
uses the same `supabase-js` client the app uses to try to read and write
athlete B's rows.

```bash
npx supabase start   # needs Docker; applies supabase/migrations
npm run test:rls
```

`npx supabase stop` shuts the stack down. The tests create their own invite
code and throwaway users, so they can run against a stack you're also using
for local development.

## Local end-to-end against the local stack

`supabase/config.toml` configures the local stack with email confirmations on
(the confirmation emails land in Mailpit at http://127.0.0.1:54324). To point
the app at it instead of a hosted project, override the three Supabase
variables from `npx supabase status -o env` (`API_URL`, `ANON_KEY`,
`SERVICE_ROLE_KEY`) and mint an invite code:

```bash
docker exec supabase_db_nil-copilot psql -U postgres \
  -c "insert into invite_codes (code, label) values ('LOCALDEV1', 'local dev')"
```
