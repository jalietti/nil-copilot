# NIL Copilot — Project Rules

Planning docs: `docs/problem-framing-canvas.md`, `docs/storyboard.md`, `docs/tech-stack.md`.
Read them before proposing architecture changes. The constraints below are settled
decisions — do not re-derive, relitigate, or "improve" them.

## Hard constraints

- **Outreach is never auto-sent.** Brand outreach and negotiation emails go out via
  `mailto:` handoff only — the copilot drafts, the athlete's own email client opens,
  and the athlete clicks send themselves. This is a permanent legal-positioning
  decision, not a v1 stopgap. Never add Gmail OAuth send, SMTP send, or any other
  send-on-behalf path for outreach. No inbox read access, ever.
- **Copilot, not agent.** The athlete is always the sender and final approver of
  everything outbound. Nothing is transmitted to a brand without an explicit athlete
  action.
- **No Clerk, no Pinecone, no Upstash-as-cache.** Supabase covers all three:
  Supabase Auth for auth, `pgvector` (later) for vector search, and a Postgres table
  for the brand cache. Do not introduce these vendors.
- **Brand discovery is live research + a growing cache.** Candidate brands come from
  live web research (Tavily) and accumulate in the `brands` table. Never ship a
  hardcoded or hand-curated brand list. (Mocked fixtures in tests are fine.)
- **Resend is for platform email only** (signup confirmation, match notifications,
  support) — never for brand outreach or negotiation emails.
- **Brand outcomes may only reorder, never expand, an athlete's matches.** The
  `brand_outcomes` table (did any athlete get a reply, did any deal reach
  `agreed`, which contact email worked) is stored now for post-pilot ranking.
  When ranking is built, brand responsiveness may only reorder candidates that
  already match the athlete's stated interests — it may never inject an
  off-interest brand. It stays brand-level facts only: never reply or draft
  text, never which athlete, never readable by athletes.
- **Citizenship/visa onboarding is required.** Onboarding asks citizenship/visa
  status early and shows real guidance for international athletes (with a clear
  "not legal advice — talk to your DSO/international office" disclaimer). Never
  remove or bury this step.

## Stack (v1)

Next.js (App Router, TypeScript) on Vercel · Supabase (Postgres, Auth, storage,
brand cache) · Anthropic API (model constant in `src/lib/anthropic.ts`) · Tavily
(search + extract) · Inngest (background jobs — discovery must not run in a
synchronous request; it exceeds Vercel function limits) · Vitest.

Deferred, in `docs/tech-stack.md` order: Stripe, Cloudflare, pgvector matching,
dedicated vector DB, Upstash Redis, LLM spend dashboard.

## Secrets

Keys live in `.env.local` (gitignored) only — never hardcoded. `.env.example`
tracks the required variable names with empty values. If a secret ever lands in a
commit, say so immediately and treat the key as compromised.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (jalietti/nil-copilot) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
