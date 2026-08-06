# Tech Stack: NIL Copilot (name TBD)

Reference doc for Claude Code. V1 = build now. Later = deliberate upgrades once
there's real usage to justify them, not default-on.

---

## V1 Stack

**Dev tooling**
- Claude Code — building the app. Personal subscription cost, fixed, doesn't scale
  with end users.
- GitHub — version control.

**App infrastructure**
- Supabase — Postgres database, auth (use Supabase Auth, not a separate provider),
  storage. Also the brand-discovery cache: a table of verified brands tagged by
  category, populated by live research, not hand-curated.
- Vercel — hosting/deploy.
- Namecheap — domain registrar.

**Core mechanism (the actual product)**
- Anthropic API (Claude Platform) — separate billing account from Jason's personal
  Claude Code subscription. This is the real variable/runtime cost that scales with
  users.
- A web search API — Brave Search API, Tavily, or Firecrawl. Required for live brand
  discovery; nothing else in this stack can search or read the web.
- A background job runner — Inngest, Trigger.dev, or Upstash QStash. Required, not
  optional: live discovery (multiple searches + page reads per candidate brand) will
  exceed Vercel's serverless function time limits if run synchronously.

**Outreach**
- Resend — transactional/platform email only (signup confirmation, "new brand match"
  notifications, support). Never used to send the actual brand outreach or
  negotiation emails.
- `mailto:` handoff for the actual outreach — copilot drafts, opens in the athlete's
  own email client, they send it themselves. Keeps the athlete as the real sender
  (legal positioning), zero setup, zero trust ask.

**Ops**
- Sentry — error tracking.
- PostHog — analytics.

## Cut from the original list, and why

- **Clerk** — redundant with Supabase's built-in auth. Two auth systems to sync for
  no v1 benefit.
- **Pinecone** — Supabase's `pgvector` extension does vector search in the same
  database. No reason for a second vendor at this scale.
- **Upstash (as a Redis cache)** — the brand cache is just a Postgres table. No
  second stateful store needed yet.
- **Cloudflare** — optional extra hop between Namecheap and Vercel. Skip for v1
  simplicity, add back if bot protection/WAF becomes a real need.
- **Stripe** — not needed until monetization turns on. Free-for-friends doesn't need
  a billing system yet.
- **Gmail OAuth** — deliberately not used for sending. Mailto keeps a real human
  action (the athlete's own click) as the transmission step; API-sent-on-their-behalf
  is a legal gray area not worth entering for a marginal UX gain. See decision below.

---

## Decision: mailto stays the permanent send mechanism, not a v1 stopgap

Considered upgrading to `gmail.send`-only OAuth (Google's cheap "Sensitive" tier, no
security audit) to send on the athlete's behalf after their approval. Decided against
it: mailto keeps a real, separate human action (the athlete's own click) as the actual
transmission step, which is a strictly stronger claim to "the athlete is the one
communicating" than an API call made with delegated authorization. Both are probably
legally fine, but mailto removes the ambiguity for zero cost, and this product doesn't
need to take on legal risk it can avoid. Revisit only if real legal review clears it
AND there's a concrete product reason mailto is failing.

Negotiation replies: athlete handles their own replies directly, with an optional
paste-in-the-reply-for-a-drafted-counter feature. No inbox read access, ever, by
default.

## Future additions, in likely order

1. **Stripe** — turn on when subscription monetization launches.
2. **Cloudflare** — if abuse, bot traffic, or DNS-level control becomes a real need.
3. **Semantic brand matching via `pgvector`** — still inside Supabase, no new vendor
   — once category-tag matching feels too rigid.
4. **Dedicated vector DB (Pinecone or similar)** — only if `pgvector` genuinely can't
   keep up at real scale. Postgres + pgvector scales further than most projects ever
   need.
5. **Upstash Redis (real caching/rate-limiting)** — once request volume is high
   enough that Postgres reads for the brand cache become a bottleneck.
6. **LLM spend monitoring/dashboard** — per-user token cost tracking. Important as
   soon as real API billing is live, to catch runaway usage before it's a surprise
   bill, not after.
