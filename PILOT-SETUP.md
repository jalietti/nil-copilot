# Pilot setup — owner checklist

Everything here is a dashboard or account action only the owner can do. Work
top to bottom; each step depends on the ones before it. Budget ~2 hours.

**Rule for every secret below:** generate a fresh production value. Never
reuse a key from `.env.local` or local development.

You'll need: the GitHub repo (`jalietti/nil-copilot`), Node 24, and accounts
at Vercel, Supabase, Inngest, Sentry, PostHog, Anthropic, and Tavily.

---

## 1. Create the Vercel project (don't deploy yet)

1. vercel.com → **Add New… → Project** → import `jalietti/nil-copilot`.
2. Framework preset: **Next.js** (auto-detected). Leave build/output settings
   at their defaults. Root directory: the repo root.
3. **Don't deploy yet.** If Vercel starts a first build anyway, let it fail;
   it has no env vars. You'll redeploy in step 7.
4. Note the production URL Vercel assigns (e.g. `https://nil-copilot.vercel.app`).
   Below this is called `$APP_URL`. If you attach a custom domain, use that
   instead everywhere `$APP_URL` appears.

## 2. Create the production Supabase project and apply migrations

1. supabase.com → **New project**. Pick a region near your users (e.g.
   `us-west-1` / `us-east-1`) and generate a strong database password. Save the
   password in your password manager, not in the repo.
2. Apply every migration in `supabase/migrations/` (0001 → 0013 as of this writing, in order) from
   your laptop:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>   # ref is in the project URL: https://supabase.com/dashboard/project/<project-ref>
   npx supabase db push                            # prompts for the database password
   ```

   `db push` must list every file in `supabase/migrations/` (0001 through 0013) and finish without errors.
3. Check it worked (**SQL Editor**):

   ```sql
   select count(*) from public.invite_codes;          -- 0, and no error
   select column_name from information_schema.columns
    where table_name = 'discovery_runs' and column_name = 'focus';  -- 1 row (0013 applied)
   ```

4. Where the keys come from (**Project Settings → API Keys**, plus **Data API**
   for the URL):

   | Env var | Where |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL, `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **publishable** key (`sb_publishable_…`), or the legacy `anon` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | The **secret** key (`sb_secret_…`), or the legacy `service_role` key. Server-only; never paste it anywhere public |

## 3. Supabase Auth: enforce email confirmation and set URLs

1. **Authentication → Sign In / Providers → Email**: **Enable email provider**
   ON, **Confirm email** ON. Disable every other provider.
2. **Authentication → URL Configuration**:
   - Site URL: `$APP_URL`
   - Redirect URLs: add `$APP_URL/auth/callback`
3. Heads-up on email volume: Supabase's built-in email sender is heavily
   rate-limited (a few emails per hour). Fine for ~10 athletes, but stagger
   signups instead of sending everyone the link at the same minute. If a
   confirmation email doesn't arrive, wait an hour and have them sign up again.
   A custom SMTP sender is out of scope for the pilot.

## 4. Inngest (background discovery jobs)

Discovery runs only through Inngest; it never runs inside a web request.

1. app.inngest.com → sign up and use the **Production** environment.
2. Easiest path: **Integrations → Vercel** → connect the `nil-copilot` Vercel
   project. This sets `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel
   for you and re-syncs the app on every deploy.
3. Manual path (if you skip the integration):
   - **Manage → Event Keys → Create event key** → this is `INNGEST_EVENT_KEY`.
   - **Manage → Signing Key** → this is `INNGEST_SIGNING_KEY`.
   - After step 7's deploy: **Apps → Sync new app** → `$APP_URL/api/inngest`.
4. You'll confirm the sync in step 9: the app `nil-copilot` should show the
   function `discover-brands`.

## 5. Sentry (errors) and PostHog (pilot funnel)

**Sentry**
1. sentry.io → **Create project** → platform **Next.js** → name `nil-copilot`.
2. `NEXT_PUBLIC_SENTRY_DSN`: **Project Settings → Client Keys (DSN)**.
3. `SENTRY_ORG` / `SENTRY_PROJECT`: the org slug and project slug in the
   Sentry URL (`https://<org>.sentry.io/projects/<project>/`).
4. `SENTRY_AUTH_TOKEN`: **Settings → Auth Tokens → Create New Token**
   (organization token). This is only used at build time to upload source maps.
5. **Project Settings → Security & Privacy**: turn ON **Data Scrubber**,
   **Use Default Scrubbers**, and **Prevent Storing of IP Addresses**. The app
   already strips request bodies, cookies, headers, and user data before
   sending (`src/lib/observability/scrub.ts`); this is a second layer.

**PostHog**
1. posthog.com → create a project (US or EU cloud).
2. `POSTHOG_KEY`: **Project settings → Project API key** (`phc_…`).
3. `POSTHOG_HOST`: `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU).
4. Events are sent server-side only, with no browser SDK and no session
   replay. Properties are ids, counts, enums, and booleans. See "What we're
   measuring" below for the insights to build.

## 6. Anthropic and Tavily keys

- `ANTHROPIC_API_KEY`: console.anthropic.com → the separate billing account for
  this app → **API Keys → Create Key** named `nil-copilot-prod`. Set a monthly
  spend limit under **Limits** as a backstop.
- `TAVILY_API_KEY`: app.tavily.com → **API Keys** → create a new key for
  production.

## 7. Set every env var in Vercel, then deploy

Vercel → project → **Settings → Environment Variables**. Scope each one to
**Production** (and Preview only if you want previews to work):

| Variable | Value from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Step 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 2 (mark **Sensitive**) |
| `ANTHROPIC_API_KEY` | Step 6 (Sensitive) |
| `TAVILY_API_KEY` | Step 6 (Sensitive) |
| `INNGEST_EVENT_KEY` | Step 4 (already set if you used the integration) |
| `INNGEST_SIGNING_KEY` | Step 4 (already set if you used the integration; Sensitive) |
| `NEXT_PUBLIC_SENTRY_DSN` | Step 5 |
| `SENTRY_ORG` | Step 5 |
| `SENTRY_PROJECT` | Step 5 |
| `SENTRY_AUTH_TOKEN` | Step 5 (Sensitive) |
| `POSTHOG_KEY` | Step 5 |
| `POSTHOG_HOST` | Step 5 |

Leave unset: `RESEND_API_KEY` (not used by anything yet) and `COPILOT_MODEL`
(only an override; the default model lives in `src/lib/anthropic.ts`, and
setting it blank would break drafting).

Then **Deployments → Redeploy** (or push to `main`). The build must succeed.
The `NEXT_PUBLIC_*` values are baked in at build time, so any change to them
needs another redeploy.

## 8. Mint the first batch of invite codes

Supabase → **SQL Editor** → run once per batch. This makes ten single-use codes:

```sql
insert into public.invite_codes (code, label, max_uses)
select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), 'pilot batch 1', 1
from generate_series(1, 10)
returning code;
```

Copy the returned codes and send one to each athlete privately, along with
`$APP_URL/signup`. Codes aren't case-sensitive for them.

Useful follow-ups:

```sql
-- Who's used what (uses = 1 means claimed)
select code, label, uses, max_uses, revoked_at, created_at from public.invite_codes order by created_at;

-- One shared code for a team, e.g. up to 12 signups
insert into public.invite_codes (code, label, max_uses) values ('POLO2026TEAM', 'water polo team', 12);

-- Kill a code that leaked
update public.invite_codes set revoked_at = now() where code = 'ABC123DEF4';
```

Codes are only readable and writable through the SQL editor or the service
role; athletes can't list or edit them. Signup without a valid code is
rejected by the database itself, not just the form.

## 9. Production smoke test (do this before sending anyone the link)

Use a real inbox you control and a code from step 8 (it will consume a use;
mint one extra for yourself).

1. [ ] Open `$APP_URL/signup` and try a made-up code. You should get
   "That invite code isn't valid…".
2. [ ] Sign up with a real code. You get "Check your email", the confirmation
   email arrives, and the link lands you on onboarding. (If you try to log in
   before confirming, it should refuse.)
3. [ ] Onboarding: choose **International student (F-1 visa)**. The amber
   visa guidance and the "not legal advice, talk to your DSO" disclaimer
   appear. Finish onboarding.
4. [ ] Interview: the "How your answers are used" note is visible. Submit.
   You land on Brands.
5. [ ] Click **Find new brands**. The button shows "Researching…". In Inngest
   (**Runs**) a `discover-brands` run starts. Within ~5 minutes, refresh
   Brands: matches appear, and at least one ideally shows **Draft outreach**
   enabled (it has a contact email).
6. [ ] Click **Find new brands** again while it's running: "A run is already
   in progress".
   Once it finishes, try **Search a specific direction** (e.g. "specialty
   coffee"): matches appear labeled "From your search".
7. [ ] Open a match with an email → **Draft outreach email**. The draft
   appears in the editor right away, with the optional "come back and paste
   their reply" note under it.
8. [ ] Click **Open in your email app**. Your mail client opens with the
   brand address, subject, and body filled in. **Don't send it.** Close the
   draft.
9. [ ] Log out, click **Forgot password?**, and reset your password from the
   email link. You land on the dashboard, and the new password works for
   log in.
10. [ ] Sentry: nothing new under Issues (or only errors you expect).
   PostHog → **Activity**: `interview_completed`, `discovery_run_started`,
   `discovery_run_completed`, `outreach_draft_generated`, and `mailto_clicked`
   showed up, with no email text or visa status in their properties.
11. [ ] Clean up: in Supabase **Authentication → Users**, delete your test
    user. Its profile, interview, deals, and messages cascade away.

Only after all eleven pass, send the codes.

## 10. Post-pilot survey (Google Form)

1. forms.google.com → blank form "NIL Copilot pilot — quick feedback".
   Suggested questions:
   - If NIL Copilot disappeared tomorrow, how would you feel? (Very
     disappointed / Somewhat / Not really)
   - Would you open it on your own, without us nudging you? (Yes / Maybe / No)
   - Did it find at least one brand you'd genuinely want to work with? (Yes / No)
   - Did you send any outreach it drafted? If not, what stopped you?
   - Did the drafts sound like you? (1–5)
   - Anything confusing, broken, or missing? (paragraph)
   - Optional: your email if we can follow up.
2. **Settings → Responses**: turn OFF "Collect email addresses" (keep it
   optional via the last question).
3. **Where to link it:** the app has no survey link built in (deliberately
   out of scope). Send the form link directly to each athlete, by text or the
   team group chat, at the end of the pilot (about 2–3 weeks in), and once
   more a few days later to anyone who hasn't answered.

---

## Checking in during the pilot

For a quick read of the numbers straight from the production database (no
PostHog needed), export the production values and run the report:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<production secret key> \
npm run pilot:report
```

It prints counts only: signups per invite code, onboarding and interview
completion, discovery runs and yields, matches with a usable email, deals by
status, and the success signals below. It never prints names, visa status,
or message text. Don't paste the secret key into a file in the repo;
exporting it for the one command is enough. Mailto clicks and repeat visits
are only in PostHog.

### API usage (only you can see this)

Every Anthropic and Tavily call is recorded in the `api_usage` table,
attributed to the feature (discovery, interview, draft), the athlete, and the
discovery run. Athletes can't see it anywhere. With the same exported
production values as above:

```bash
npm run usage:report                 # last 7 days
npm run usage:report -- --days 30
```

It shows tokens and Tavily credits overall, by feature, per discovery run,
and for the heaviest athletes (shortened ids). As measured locally, one
discovery run is roughly 24 Tavily credits and ~90k input / ~5k output Claude
tokens. Check your Tavily plan's monthly credits against that before the
pilot. Dollar costs aren't computed (prices change; spend metering is on the
deferred list).

## What we're measuring

The pilot succeeds if athletes get actionable matches, actually reach out,
and would come back on their own. All of the following except the last come
from PostHog events (server-side, athlete uuid as the distinct id):

| Signal | How to compute it in PostHog |
| --- | --- |
| **Matches with usable emails per run** | Trend of `discovery_run_completed`, property `matches_with_email` (sum or average per event). Compare with `matches_created` to see how many matches are actionable. |
| **Mailto clicks per match** | `mailto_clicked` (filter `kind = outreach`) ÷ total `matches_created` across `discovery_run_completed`. Also a funnel: `discovery_run_completed` → `outreach_draft_generated` → `mailto_clicked`. |
| **Replies pasted per sent deal** | `reply_pasted` ÷ `deal_status_changed` where `to = sent`. Low is not necessarily bad: pasting is optional, and many athletes will handle replies themselves. |
| **Would they use it unprompted** | Survey question "Would you open it on your own, without us nudging you?", plus PostHog retention: athletes with any event in week 2+ after their first `interview_completed`. |

Also worth a glance: `match_dismissed` (bad matches), `follow_up_draft_generated`
(no replies after 5 days), and `deal_status_changed` with `to = agreed` (the
actual outcome).
