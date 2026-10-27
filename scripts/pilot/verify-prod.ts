// Automated production readiness check (PILOT-SETUP.md): the deployed app,
// its Supabase project, and the Inngest connection. Read-only.
//
//   npm run pilot:verify -- --url https://your-app.vercel.app --project-ref <prod-ref>
//
// Uses the Supabase CLI login on this machine for keys (never printed).

import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { supabaseProject } from './supabase-project'

type Result = 'PASS' | 'WARN' | 'FAIL'
const results: { result: Result; check: string; detail?: string }[] = []
const record = (result: Result, check: string, detail?: string) => results.push({ result, check, detail })
const pass = (check: string, ok: boolean, detail?: string, severity: Result = 'FAIL') =>
  record(ok ? 'PASS' : severity, check, ok ? undefined : detail)

async function checkApp(appUrl: string, supabaseUrl: string) {
  const login = await fetch(`${appUrl}/login`)
  pass('App serves /login', login.ok, `HTTP ${login.status}`)

  const csp = login.headers.get('content-security-policy') ?? ''
  const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? ''
  pass('CSP: scripts need a per-request nonce', /'nonce-[^']+'/.test(scriptSrc) && scriptSrc.includes("'strict-dynamic'"), scriptSrc || 'no CSP header')
  pass("CSP: no 'unsafe-inline' or 'unsafe-eval' for scripts", !/unsafe-(inline|eval)/.test(scriptSrc), scriptSrc)
  pass(
    'App is built against this Supabase project',
    csp.includes(supabaseUrl),
    `CSP connect-src doesn't include ${supabaseUrl} — NEXT_PUBLIC_SUPABASE_URL in Vercel points elsewhere (or needs a redeploy)`,
  )
  for (const [header, expected] of [
    ['x-frame-options', 'DENY'],
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
  ] as const) {
    pass(`Header ${header}`, login.headers.get(header) === expected, `got ${login.headers.get(header)}`)
  }
  pass('Header strict-transport-security', !!login.headers.get('strict-transport-security'), 'missing')

  const signup = await (await fetch(`${appUrl}/signup`)).text()
  // Looks for the field's label, not marketing copy, so rewording the page
  // can't break the check. The code itself is enforced in the auth.users trigger.
  pass('Signup is invite-only', signup.includes('Invite code'), 'signup page lacks the invite code field')

  const dashboard = await fetch(`${appUrl}/dashboard`, { redirect: 'manual' })
  pass(
    'Signed-out visitors are sent to login',
    dashboard.status >= 300 && dashboard.status < 400 && (dashboard.headers.get('location') ?? '').includes('/login'),
    `HTTP ${dashboard.status}`,
  )

  // In cloud mode the SDK answers only requests signed by Inngest itself, so
  // an unsigned check gets 401 — which is the production-safe setting. (An
  // open 200 with details means dev mode or an older SDK.)
  const inngest = await fetch(`${appUrl}/api/inngest`)
  const info = (await inngest.json().catch(() => ({}))) as Record<string, unknown>
  if (inngest.status === 401 && info.message === 'Unauthorized') {
    record('PASS', 'Inngest endpoint only accepts Inngest-signed requests (cloud mode)')
    record(
      'WARN',
      'Inngest sync can only be confirmed in its dashboard',
      'app.inngest.com → Apps: nil-copilot synced, 1 function (discover-brands)',
    )
    return
  }
  pass('Inngest endpoint responds', inngest.ok, `HTTP ${inngest.status}`)
  pass('Inngest has an event key', info.has_event_key === true, 'add the Inngest Vercel integration (or INNGEST_EVENT_KEY) and redeploy')
  pass('Inngest has a signing key', info.has_signing_key === true, 'add the Inngest Vercel integration (or INNGEST_SIGNING_KEY) and redeploy')
  pass('Inngest sees the discovery function', Number(info.function_count ?? 0) >= 1, JSON.stringify(info))
  pass('Inngest is in cloud mode (not dev)', info.mode === 'cloud', `mode=${String(info.mode)} — INNGEST_DEV must not be set in Vercel`)
}

// Inngest's Vercel integration calls each deployment's own URL
// (nil-copilot-<id>-<team>.vercel.app), not the production domain. If Vercel
// Deployment Protection puts a login in front of those, Inngest can't run
// jobs: discovery runs sit "queued" forever with no error anywhere.
// Production deployments only: previews are expected to sit behind Vercel
// Authentication, so testing whichever deployment is newest (often a PR
// preview) would report a login wall that production doesn't have.
async function checkDeploymentReachable() {
  let listing: string
  try {
    listing = execFileSync('npx', ['-y', 'vercel@latest', 'ls', 'nil-copilot', '--environment', 'production'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    record('WARN', 'Deployment URLs reachable by Inngest', 'could not list deployments (npx vercel login?)')
    return
  }
  const deploymentUrl = listing.match(/https:\/\/[a-z0-9-]+\.vercel\.app/)?.[0]
  if (!deploymentUrl) {
    record('WARN', 'Deployment URLs reachable by Inngest', 'no deployment found')
    return
  }
  const res = await fetch(`${deploymentUrl}/api/inngest`, { redirect: 'manual' })
  const location = res.headers.get('location') ?? ''
  pass(
    'Deployment URLs reachable by Inngest (no Vercel login wall)',
    !(res.status >= 300 && res.status < 400 && location.includes('vercel.com/sso')),
    'Vercel → Settings → Deployment Protection → Vercel Authentication: set "Only Preview Deployments" (or off)',
  )
}

async function checkSupabase(ref: string) {
  const { url, publishableKey, secretKey } = supabaseProject(ref)

  const settings = (await (
    await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishableKey } })
  ).json()) as { mailer_autoconfirm?: boolean; disable_signup?: boolean; external?: Record<string, boolean> }
  // The pilot runs with confirmation on through a custom SMTP sender
  // (PILOT-SETUP.md step 3); the app handles either setting.
  record(
    'PASS',
    settings.mailer_autoconfirm === false
      ? 'Auth: email confirmation ON (needs a custom SMTP sender for more than ~2 emails/hour)'
      : 'Auth: email confirmation OFF (signup signs athletes in directly; invite codes still gate)',
  )
  pass('Auth: email signups enabled', settings.disable_signup === false && settings.external?.email === true, 'enable the Email provider')
  const others = Object.entries(settings.external ?? {})
    .filter(([name, on]) => on && !['email', 'phone'].includes(name))
    .map(([name]) => name)
  pass('Auth: no other sign-in providers enabled', others.length === 0, `enabled: ${others.join(', ')}`, 'WARN')

  const admin = createClient<Database>(url, secretKey, { auth: { persistSession: false } })
  const expected: Record<string, string> = {
    profiles: 'invite_code',
    interviews: 'values, voice_profile',
    brands: 'contact_checked_at',
    brand_matches: 'contact_email, search_focus',
    deals: 'sent_at',
    messages: 'previous_versions, original_content, sent_at',
    discovery_runs: 'kind, focus',
    invite_codes: 'code',
    brand_outcomes: 'brand_id',
    api_usage: 'credits',
  }
  const missing: string[] = []
  for (const [table, columns] of Object.entries(expected)) {
    const { error } = await admin.from(table as 'profiles').select(columns).limit(0)
    if (error) missing.push(`${table} (${error.message})`)
  }
  pass('Database: all migrations applied (0001-0016)', missing.length === 0, `missing: ${missing.join('; ')} — run npm run pilot:db-push -- ${ref}`)

  const anon = createClient<Database>(url, publishableKey, { auth: { persistSession: false } })
  // Same call the scheduled keep-alive workflow makes. Plain fetch: keepalive()
  // isn't in the typed Database (adding a Functions entry breaks embed inference).
  const keepalive = await fetch(`${url}/rest/v1/rpc/keepalive`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: '{}',
  })
  pass('Database: keep-alive ping succeeds (stops free-plan pausing)', keepalive.ok, `keepalive() returned HTTP ${keepalive.status} — run npm run pilot:db-push -- ${ref}`)
  const { error: anonError } = await anon.from('profiles').select('id').limit(1)
  pass('Database: signed-out visitors can read no athlete data', !!anonError && /permission denied/i.test(anonError.message), 'anon could query profiles')

  const { count } = await admin
    .from('invite_codes')
    .select('code', { count: 'exact', head: true })
    .is('revoked_at', null)
  pass('Invite codes minted', (count ?? 0) > 0, `none yet — npm run pilot:invites -- ${ref}`, 'WARN')
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string' }, 'project-ref': { type: 'string' } } })
  const appUrl = values.url?.replace(/\/$/, '')
  const ref = values['project-ref']
  if (!appUrl || !ref) throw new Error('Usage: npm run pilot:verify -- --url <app url> --project-ref <prod ref>')

  await checkApp(appUrl, `https://${ref}.supabase.co`).catch((e) => record('FAIL', 'App reachable', String(e)))
  await checkSupabase(ref).catch((e) => record('FAIL', 'Supabase reachable', String(e)))
  await checkDeploymentReachable().catch((e) => record('FAIL', 'Deployment URLs reachable', String(e)))

  for (const r of results) console.log(`${r.result.padEnd(4)}  ${r.check}${r.detail ? `\n      → ${r.detail}` : ''}`)
  console.log(
    '\nNot checkable from here — confirm by hand: Supabase Auth → URL Configuration (Site URL = your app URL,' +
      ' redirect URL = <app>/**), Sentry receiving events, PostHog receiving events.',
  )
  if (results.some((r) => r.result === 'FAIL')) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
