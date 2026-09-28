# Testing

| Command | What it runs | Needs |
| --- | --- | --- |
| `npm run test` | Unit tests + database tests (`tests/db/`) | Nothing — runs anywhere |
| `npm run test:rls` | API-level RLS isolation tests (`tests/integration/`) | A running local Supabase |
| `npm run test:e2e` | Browser tests of the core flow (`tests/e2e/`) — **resets the local database to the seed** | A running local Supabase; `npx playwright install chromium` once |
| `npm run lint` / `npm run build` | ESLint / production build + typecheck | Nothing |
| `npm run eval:discovery` | Discovery quality check against sample profiles (live, costs credits) | `TAVILY_API_KEY`, `ANTHROPIC_API_KEY` |

CI (`.github/workflows/ci.yml`) runs test, test:rls, test:e2e, lint, and build on every push and PR.
`eval:discovery` is run by hand (it spends real API credits).

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

## End-to-end tests (`npm run test:e2e`)

Playwright drives Chromium through the core athlete flow against a production
build of the app (`scripts/e2e-server.sh`, port 3400), the local Supabase
stack, and a mock Anthropic API (`tests/e2e/mock-anthropic.mjs`, which
returns canned drafts/profiles/tags so no API keys or credits are needed):
invite-gated signup -> email confirmation (via Mailpit) -> onboarding visa
step -> interview consent; and, as the seeded athlete, the dashboard
follow-up prompt -> draft outreach -> try another version -> edit -> sent ->
paste reply -> counter draft -> "I'm done". Every page is checked for CSP
violations. Discovery isn't covered (it needs Tavily + Inngest; see the unit
tests and `eval:discovery`). Each run resets the local database first.

## Local app against the local stack (design + manual testing)

```bash
npm run dev:local   # starts local Supabase (Docker), then next dev on :3000
npm run db:reset    # wipe local data: re-apply all migrations + the seed
```

`dev:local` points the app at the local stack for that process only
(`.env.local` is untouched; its Anthropic/Tavily keys are still used if you
draft or run discovery). `supabase/seed.sql` loads an athlete with the app in
every state — matches with and without emails, deals in every status, a
"did you hear back?" prompt, a pasted reply and an edited counter draft — so
every screen can be designed without spending API credits. Log in as
`maya@example.test` / `nilcopilot-local` (or `new@example.test` for the
onboarding flow); sign up new test accounts with invite code `LOCALDEV1`.
Confirmation and reset emails land in Mailpit at http://127.0.0.1:54324.
Seeds run only locally; `supabase db push` never applies them.

## Discovery quality check (`npm run eval:discovery`)

Runs the live discovery pipeline (the same helpers the Inngest job uses, from
`src/lib/discovery-research.ts`) for the sample athlete profiles in
`scripts/discovery-eval-profiles.json`, with no database writes, and reports
per interest tag: pages read, brands mentioned, candidates, real brands, good
fits, and good fits with a validated contact email — plus a summary
(`matchesPerTag`, `emailRate`, `tagsWithZeroMatches`) and external call counts.
Run it before and after any discovery change; it spends real Tavily +
Anthropic credits (about one discovery run's worth per tag).

```bash
npm run eval:discovery                        # 1 tag per profile
npm run eval:discovery -- --tags 3 --out report.json
npm run eval:discovery -- --only climber
```
