# NIL Copilot: domain glossary

The words this codebase uses, what they mean, and where they live. Settled
decisions are in [`docs/adr/`](docs/adr/).

## People

- **Athlete:** a student-athlete using the app. One `profiles` row per Supabase
  Auth user. Always the sender and final approver of anything outbound ([ADR 1](docs/adr/0001-athlete-sends-outreach-via-mailto.md)).
- **Owner:** the person running the pilot. Mints invite codes and reads
  owner-only aggregate reports (`npm run pilot:report`, `npm run usage:report`).

## Onboarding

- **Invite code:** sign-up is invite-only during the pilot. Codes live in
  `invite_codes`, can be single-use, multi-use or unlimited, and can be revoked.
  Minted with SQL or `npm run pilot:invites`; never readable by `anon`/`authenticated`.
- **Citizenship status:** asked early in onboarding (`us_citizen`,
  `permanent_resident`, `f1_visa`, `other_visa`, `prefer_not_to_say`).
  International athletes see real guidance on NIL income and visas, with a
  "not legal advice, talk to your DSO" disclaimer (`src/lib/visa-guidance.ts`).
  This step is required and is never removed or buried.
- **Interview:** a short questionnaire about interests, brands the athlete
  already uses, values, and deal preferences. Claude normalizes it into
  **category tags** (what discovery searches for) and a **voice profile**
  (how drafts should sound). One `interviews` row per athlete.
- **Search preferences:** values and target industries, editable from the
  Brands page apart from the interview.

## Discovery

- **Brand:** a real company that could sponsor an athlete. Shared across all
  athletes in the `brands` table, which is the **brand cache**: populated by live
  research, never a hand-curated list ([ADR 3](docs/adr/0003-brand-discovery-is-a-background-job-over-a-growing-cache.md)).
- **Discovery run:** one background research job for one athlete
  (`discovery_runs`): `queued` → `running` → `completed` | `failed`. At most one
  in flight per athlete.
  - **Regular run:** rotates through the athlete's category tags.
  - **Focused run:** a one-off search for a phrase the athlete typed
    ("women-owned skincare"), with its own daily allowance.
- **Match:** a brand suggested to a specific athlete (`brand_matches`):
  `suggested` → `drafting` → `contacted`, or `dismissed`.
- **Contact email:** the address outreach goes to, found on the brand's site and
  checked for a working mail server (MX lookup).

## Deals

- **Deal:** one athlete's conversation with one brand (`deals`):
  `draft` → `sent` → `reply_received` → `negotiating` → `agreed` → `closed`,
  or `dead`. On screen, statuses group by who has the next move: *Your move*,
  *Waiting on them*, *Negotiating*, *Agreed*, *Past* (`src/lib/deal-stage.ts`).
- **Message:** an entry in a deal thread (`messages`). Either an
  **outbound draft** (written by the copilot, edited and sent by the athlete) or
  an **inbound pasted** reply (the brand's email, pasted in by the athlete).
- **Draft:** an outbound message not yet sent. "Try another version" replaces it
  in place and keeps every earlier version (`previous_versions`). Edits are
  captured alongside the original generated text.
- **Mailto handoff:** opening a draft in the athlete's own email client via a
  `mailto:` link. The app never sends outreach itself.
- **"I sent it":** the athlete's confirmation that they sent a draft. Stamps
  `messages.sent_at`; a sent draft leaves the editor for good.
- **Counter draft:** a drafted negotiation reply, generated from a pasted brand
  reply and the athlete's deal preferences.

## Server-only data

- **Brand outcome:** brand-level facts derived from deals (any reply, any
  agreement, which contact email worked). Service-role only; may only *reorder*
  matches, never add off-interest ones ([ADR 4](docs/adr/0004-brand-outcomes-may-only-reorder-matches.md)).
- **API usage:** every Anthropic and Tavily call, recorded per athlete and source
  (`api_usage`). Daily caps on drafts and interviews are counted from it on the
  server, never from client state; discovery caps are counted from `discovery_runs`.
