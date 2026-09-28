import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  CONTACT_RECHECK_MS,
  extractEmails,
  findContactEmail,
  hasValidMx,
  isRoleAddress,
  needsContactLookup,
  rankContactEmails,
  type MxResolver,
} from '@/lib/contact-email'

const html = readFileSync(join(__dirname, 'fixtures', 'contact-page.html'), 'utf8')

// Mocked DNS: only these domains have mail exchangers.
const mx: MxResolver = vi.fn(async (domain: string) => {
  if (['ridgelinegear.com', 'gmail.com'].includes(domain)) {
    return [{ exchange: `mx.${domain}` }]
  }
  const error = Object.assign(new Error(`queryMx ENOTFOUND ${domain}`), { code: 'ENOTFOUND' })
  throw error
})

describe('extractEmails', () => {
  it('finds plain, mailto, entity-encoded, and [at]/[dot] addresses in HTML, lowercased', () => {
    expect(extractEmails(html)).toEqual([
      'support@ridgelinegear.com',
      'partnerships@ridgelinegear.com',
      'jamie.cho@ridgelinegear.com',
      'press@ridgelinegear.com',
      'studio@pixelagency.io',
      'noreply@ridgelinegear.com',
      'abc123@o1.ingest.sentry.io',
    ])
  })

  it('ignores retina asset filenames that look like emails', () => {
    expect(extractEmails('<img src="logo@2x.png"> <img src="a@3x.webp">')).toEqual([])
  })

  it('returns nothing for a page with no addresses', () => {
    expect(extractEmails('<p>Use the form below to reach us.</p>')).toEqual([])
  })
})

describe('rankContactEmails', () => {
  it('prefers role addresses over a personal one, best role first, and drops junk', () => {
    expect(rankContactEmails(extractEmails(html), 'ridgelinegear.com')).toEqual([
      'partnerships@ridgelinegear.com',
      'press@ridgelinegear.com',
      'support@ridgelinegear.com',
      'jamie.cho@ridgelinegear.com',
    ])
  })

  it('keeps a free-mail address for small brands but never a third-party domain', () => {
    expect(
      rankContactEmails(['studio@pixelagency.io', 'ridgelinegear@gmail.com'], 'ridgelinegear.com'),
    ).toEqual(['ridgelinegear@gmail.com'])
  })

  it('prefers on-domain over free-mail at the same rank, and accepts subdomains', () => {
    expect(
      rankContactEmails(['owner@gmail.com', 'owner@mail.ridgelinegear.com'], 'ridgelinegear.com'),
    ).toEqual(['owner@mail.ridgelinegear.com', 'owner@gmail.com'])
  })

  it('classifies role addresses', () => {
    expect(isRoleAddress('hello@x.com')).toBe(true)
    expect(isRoleAddress('marketing+nil@x.com')).toBe(true)
    expect(isRoleAddress('jamie.cho@x.com')).toBe(false)
  })
})

describe('hasValidMx (mocked resolver)', () => {
  it('accepts a domain with MX records', async () => {
    expect(await hasValidMx('hello@ridgelinegear.com', mx)).toBe(true)
  })

  it('rejects a domain without MX records, bad syntax, and DNS errors', async () => {
    expect(await hasValidMx('hello@no-mail.test', mx)).toBe(false)
    expect(await hasValidMx('not an email', mx)).toBe(false)
    expect(await hasValidMx('hello@empty.test', async () => [])).toBe(false)
  })
})

describe('findContactEmail', () => {
  it('uses a valid homepage address without fetching contact pages', async () => {
    const fetchContactPages = vi.fn()
    const result = await findContactEmail(
      'ridgelinegear.com',
      ['jamie.cho@ridgelinegear.com', 'hello@ridgelinegear.com'],
      { fetchContactPages, resolveMx: mx },
    )
    expect(result).toEqual({ email: 'hello@ridgelinegear.com', fetchedPages: false })
    expect(fetchContactPages).not.toHaveBeenCalled()
  })

  it('falls back to /contact and /about when the homepage has nothing usable', async () => {
    const fetchContactPages = vi.fn(async () => [html])
    const result = await findContactEmail('ridgelinegear.com', [null], {
      fetchContactPages,
      resolveMx: mx,
    })
    expect(fetchContactPages).toHaveBeenCalledWith('ridgelinegear.com')
    expect(result).toEqual({ email: 'partnerships@ridgelinegear.com', fetchedPages: true })
  })

  it('stores no email rather than one that fails MX validation', async () => {
    const result = await findContactEmail('deadmail.test', ['hello@deadmail.test'], {
      fetchContactPages: async () => ['Write to partnerships@deadmail.test'],
      resolveMx: mx,
    })
    expect(result).toEqual({ email: null, fetchedPages: true })
  })

  it('returns null when no page has any address', async () => {
    const result = await findContactEmail('ridgelinegear.com', [], {
      fetchContactPages: async () => ['<p>Use our contact form.</p>'],
      resolveMx: mx,
    })
    expect(result).toEqual({ email: null, fetchedPages: true })
  })
})

describe('needsContactLookup', () => {
  const now = new Date('2026-09-28T12:00:00Z')
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

  it('never re-checks a brand that has an email', () => {
    expect(needsContactLookup({ contact_email: 'a@b.com', contact_checked_at: null }, now)).toBe(false)
  })

  it('checks never-checked brands and ones past the recheck window only', () => {
    expect(needsContactLookup({ contact_email: null, contact_checked_at: null }, now)).toBe(true)
    expect(needsContactLookup({ contact_email: null, contact_checked_at: daysAgo(2) }, now)).toBe(false)
    const stale = new Date(now.getTime() - CONTACT_RECHECK_MS).toISOString()
    expect(needsContactLookup({ contact_email: null, contact_checked_at: stale }, now)).toBe(true)
  })
})
