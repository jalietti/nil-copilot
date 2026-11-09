# 3. Brand discovery is live research in a background job, over a growing cache

**Status:** Accepted · **Date:** 2026-08-04

## Context

The core problem (see `docs/problem-framing-canvas.md`) is that NIL marketplaces
surface the same few generic brands. A hand-curated brand list would repeat that
problem and go stale. Brands have to be found for each athlete's real interests.

Finding them means several web searches, reading the pages they return, asking
Claude to evaluate fit, and looking up a contact email, for each interest tag.
A full run takes minutes, far longer than a serverless request should be held
open, and any single external call can fail.

## Decision

- **Live research, cached.** Candidates come from live web research (Tavily
  search + extract) and Claude fit evaluation. Verified brands accumulate in the
  shared `brands` table, so later runs check the cache first and only research
  what's missing. No hardcoded brand list ships, ever; test fixtures are fine.
- **Background job.** Discovery runs as an Inngest function
  (`src/inngest/functions/discover-brands.ts`), triggered by an event from a
  server action. It never runs inside a request.
- **Checkpointed steps.** Every external call is its own `step.run`. Inngest
  memoizes completed steps, so a retry resumes after the last successful step
  instead of starting over. Work isn't repeated, and API spend isn't double-counted.
- **One run at a time.** A partial unique index (`0002`) allows at most one
  `queued`/`running` run per athlete. The server action checks first for a
  friendly message; the index is the backstop for a double-click race.
- **Failure is visible.** `onFailure` marks the run `failed` (so the athlete
  isn't left on "Researching…") and reports to Sentry.

## Consequences

- The discovery UI is asynchronous: start a run, then poll the run's status.
- Quality is measured, not eyeballed: `npm run eval:discovery` runs the same
  pipeline against sample profiles and reports matches per tag and email hit rate.
  It spends real credits, so it runs by hand rather than in CI.
- Spend is bounded by per-run limits (`DISCOVERY_LIMITS`) and per-athlete daily
  run caps enforced server-side (`src/lib/discovery-guard.ts`). Every call is
  also recorded in `api_usage` for the owner's spend report.
- Brand outcomes collected from deals may later *reorder* matches but never add
  off-interest brands (see ADR 4).
