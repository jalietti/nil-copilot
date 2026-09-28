// Content-Security-Policy, built per request with a fresh nonce (src/proxy.ts).
// Scripts run only if they carry the nonce — which Next stamps on its own
// scripts during dynamic rendering — or are loaded by one that does
// ('strict-dynamic'). No 'unsafe-inline' for scripts, so injected markup
// (e.g. from pasted brand replies) can't execute even if escaping ever fails.

export function generateNonce(): string {
  return btoa(crypto.randomUUID())
}

export function buildCsp({
  nonce,
  isDev,
  supabaseUrl,
}: {
  nonce: string
  isDev: boolean
  supabaseUrl: string | undefined
}): string {
  // Supabase auth + PostgREST from client components; Sentry's ingest host is
  // a region-dependent subdomain. PostHog is server-side only.
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const connect = [
    "'self'",
    supabaseOrigin,
    supabaseOrigin.replace(/^http/, 'ws'),
    'https://*.sentry.io',
    isDev ? 'ws://localhost:* ws://127.0.0.1:*' : '',
  ]

  return [
    "default-src 'self'",
    // 'unsafe-eval' only in dev (React debug tooling).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Styles keep 'unsafe-inline': React style attributes need it, and a
    // nonce here would disable it. Style injection can't run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.filter(Boolean).join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? '' : 'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ')
}
