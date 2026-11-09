# 4. Brand outcomes are stored now, and may only reorder an athlete's matches

**Status:** Accepted · **Date:** 2026-09-28

## Context

Which brands actually reply, and which deals reach agreement, is the most
valuable ranking signal the product will ever have, and it can't be collected
retroactively. But it's also sensitive: it comes from athletes' private deal
threads, and a "responsiveness" score could tempt a future ranking change into
pushing brands the athlete never asked for.

## Decision

Start collecting now, with tight limits on what's stored and how it can be used.

- **Brand-level facts only.** `brand_outcomes` has one row per brand: did any
  athlete get a reply, did any deal reach `agreed`, and which contact email worked.
  No reply or draft text, no athlete, message or deal id, no per-athlete timestamp.
- **Written by triggers, not app code.** Triggers on `deals` and `messages` derive
  the row from state changes, so no code path can skip it, and athletes need no
  write access.
- **Server-only.** RLS is on with no policies and no grants to `anon` or
  `authenticated`. Athletes can't read it.
- **Reorder, never expand.** When ranking is built, responsiveness may only
  reorder candidates that already match the athlete's stated interests. It may
  never inject an off-interest brand.

## Consequences

- The ranking signal accumulates from the first pilot deal, at no privacy cost
  to any individual athlete.
- The grants and RLS are covered by the database tests, so a regression that
  exposes the table to athletes fails CI.
- Not used for ranking yet; that's post-pilot work, and it has to honour the
  reorder-only rule.
