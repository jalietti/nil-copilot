# 2. Supabase is the single backend: auth, data, cache, and (later) vectors

**Status:** Accepted · **Date:** 2026-08-04

## Context

The original vendor list had separate services for auth (Clerk), vector search
(Pinecone) and caching (Upstash Redis), alongside a Postgres database. For a
pre-revenue pilot run by one developer, every extra stateful vendor is another
bill, another set of keys, and another system to keep in sync with user identity.

## Decision

Use Supabase for all of it:

- **Auth:** Supabase Auth (email + password, email confirmation, invite-gated sign-up).
- **Data and authorization:** Postgres with row-level security on every table
  that holds athlete data, and least-privilege grants (migration `0004`).
  The browser talks to the database directly through PostgREST, so RLS is the
  security boundary, not application code.
- **Brand cache:** an ordinary `brands` table, not a Redis cache (see ADR 3).
- **Vector search, when needed:** the `pgvector` extension in the same database.

Clerk, Pinecone and Upstash-as-cache are explicitly out.

## Consequences

- One identity (`auth.uid()`) flows straight into RLS policies, with no syncing
  of users between an auth vendor and the database.
- Because RLS *is* the security boundary, it's tested at two levels: in-process
  against every migration with PGlite (`tests/db/`), and end to end through real
  Supabase Auth JWTs and PostgREST (`tests/integration/`, `npm run test:rls`).
  Each table holding athlete data has a cross-athlete isolation test.
- Server-only tables (`brand_outcomes`, `api_usage`) have RLS on with no
  policies and no grants to `anon`/`authenticated`: only the service role can read them.
- If `pgvector` or Postgres reads ever become a real bottleneck, a dedicated
  vector DB or Redis can be added then. See `docs/tech-stack.md` for the order.
