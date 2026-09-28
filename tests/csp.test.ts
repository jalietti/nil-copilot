import { describe, expect, it } from 'vitest'
import { buildCsp, generateNonce } from '@/lib/csp'

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

describe('buildCsp', () => {
  const prod = buildCsp({ nonce: 'abc123', isDev: false, supabaseUrl: 'https://proj.supabase.co' })

  it('allows scripts only by nonce (+ strict-dynamic), never unsafe-inline or eval in prod', () => {
    expect(directive(prod, 'script-src')).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
  })

  it('lets the browser reach Supabase and Sentry, and nothing else', () => {
    expect(directive(prod, 'connect-src')).toBe(
      "connect-src 'self' https://proj.supabase.co wss://proj.supabase.co https://*.sentry.io",
    )
  })

  it('keeps the lockdown directives', () => {
    for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests']) {
      expect(prod).toContain(d)
    }
  })

  it("adds dev-only allowances (eval for React debugging, HMR websockets) only in dev", () => {
    const dev = buildCsp({ nonce: 'n', isDev: true, supabaseUrl: 'http://127.0.0.1:54321' })
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'")
    expect(directive(dev, 'connect-src')).toContain('ws://localhost:*')
    expect(dev).not.toContain('upgrade-insecure-requests')
  })
})

describe('generateNonce', () => {
  it('is unique per call and CSP-safe base64', () => {
    const a = generateNonce()
    expect(a).not.toBe(generateNonce())
    expect(a).toMatch(/^[A-Za-z0-9+/=]{24,}$/)
  })
})
