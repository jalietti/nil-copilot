import { z } from 'zod'

// Finding a usable contact email for a discovered brand. A match without one
// is unactionable, so discovery looks harder than the homepage when it has
// to — but a bad address is worse than none: an email is only stored if it
// passes syntax + DNS MX validation. No third-party verification service.

// How long a brand's contact lookup result (found or not) is trusted before
// discovery is allowed to fetch its pages again.
export const CONTACT_RECHECK_MS = 30 * 24 * 60 * 60 * 1000

// Role local-parts, best first. Anything not listed is treated as personal.
const ROLE_RANKS: string[][] = [
  ['partnerships', 'partnership', 'partners', 'partner', 'collab', 'collabs', 'collaborations',
    'influencer', 'influencers', 'ambassador', 'ambassadors', 'sponsorship', 'sponsorships',
    'athletes', 'nil'],
  ['marketing', 'brand', 'social', 'community', 'pr', 'press', 'media'],
  ['hello', 'hi', 'hey', 'contact', 'info', 'team', 'inquiries', 'enquiries', 'general'],
  ['support', 'help', 'care', 'customercare', 'customerservice', 'service', 'sales', 'shop', 'store'],
]

// Never an outreach target.
const BLOCKED_LOCAL_PARTS = new Set([
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'mailer-daemon', 'postmaster', 'webmaster',
  'hostmaster', 'abuse', 'privacy', 'legal', 'dmca', 'security', 'unsubscribe', 'jobs', 'careers',
  'hiring', 'recruiting', 'returns', 'orders', 'order', 'billing', 'accounts', 'accounting',
  'invoices', 'wholesale', 'example', 'email', 'name', 'yourname', 'your-email', 'user',
])

// Small brands often run on a personal mailbox; anything else off-domain is
// more likely an agency, platform, or site developer than the brand.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com',
  'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com',
])

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi
const ASSET_SUFFIX = /\.(?:png|jpe?g|gif|webp|svg|avif|css|js)$/i
const emailSchema = z.string().email().max(254)

function deobfuscate(text: string): string {
  return text
    .replace(/&#0*64;|&#x0*40;|&commat;/gi, '@')
    .replace(/&#0*46;|&#x0*2e;|&period;/gi, '.')
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.')
}

// All plausible email addresses in page text or HTML (including mailto:
// links), lowercased and deduped, in order of appearance.
export function extractEmails(content: string): string[] {
  const found = new Set<string>()
  for (const match of deobfuscate(content).matchAll(EMAIL_PATTERN)) {
    const email = match[0].toLowerCase().replace(/^\.+|\.+$/g, '')
    if (!ASSET_SUFFIX.test(email)) found.add(email)
  }
  return [...found]
}

function roleRank(localPart: string): number {
  const base = localPart.split('+')[0]
  const rank = ROLE_RANKS.findIndex((group) => group.includes(base))
  return rank === -1 ? ROLE_RANKS.length : rank
}

export function isRoleAddress(email: string): boolean {
  return roleRank(email.split('@')[0]) < ROLE_RANKS.length
}

function belongsToBrand(emailDomain: string, brandDomain: string): boolean {
  return emailDomain === brandDomain || emailDomain.endsWith(`.${brandDomain}`)
}

// Candidates worth validating, best first: role addresses before personal
// ones, on-domain before free-mail, and never blocked or foreign addresses.
export function rankContactEmails(candidates: string[], brandDomain: string): string[] {
  const domain = brandDomain.toLowerCase()
  const scored = [...new Set(candidates.map((c) => c.trim().toLowerCase()))]
    .filter((email) => emailSchema.safeParse(email).success)
    .flatMap((email, index) => {
      const [localPart, emailDomain] = email.split('@')
      if (BLOCKED_LOCAL_PARTS.has(localPart.split('+')[0])) return []
      const onDomain = belongsToBrand(emailDomain, domain)
      if (!onDomain && !FREE_MAIL_DOMAINS.has(emailDomain)) return []
      return [{ email, rank: roleRank(localPart), offDomain: onDomain ? 0 : 1, index }]
    })
  scored.sort((a, b) => a.rank - b.rank || a.offDomain - b.offDomain || a.index - b.index)
  return scored.map((s) => s.email)
}

// For an address an athlete typed in: well-formed and not a mailbox nobody
// reads. (Any domain is fine — they may know the brand's real address.)
export function isUsableAthleteEmail(email: string): boolean {
  if (!emailSchema.safeParse(email).success) return false
  return !BLOCKED_LOCAL_PARTS.has(email.split('@')[0].split('+')[0])
}

// Pages linked from a brand's homepage that are likely to list a contact
// address, best first. Brands link their real contact page (often
// /pages/support or /pages/contact-us on Shopify), which guessing /contact
// misses. Same-site links only; images and other assets are skipped.
const CONTACT_LINK_RANKS: RegExp[] = [
  /contact|get in touch|email us/i,
  /partner|collab|ambassador|athlete|affiliate|influencer|sponsor|team/i,
  /press|media/i,
  /about|our story/i,
  /support|help|faq|customer/i,
]

export function contactPageLinks(homepageMarkdown: string, domain: string): string[] {
  const root = domain.toLowerCase()
  const ranked: { url: string; rank: number; index: number }[] = []
  let index = 0
  for (const match of homepageMarkdown.matchAll(/\[([^\]]{0,80})\]\(([^)\s]+)\)/g)) {
    const [, text, href] = match
    let url: URL
    try {
      url = new URL(href, `https://${root}`)
    } catch {
      continue
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== root && !host.endsWith(`.${root}`)) continue
    if (/\.(?:png|jpe?g|gif|webp|svg|avif|css|js|pdf)$/i.test(url.pathname)) continue
    if (url.pathname.includes('/cdn/') || url.pathname === '/') continue
    const rank = CONTACT_LINK_RANKS.findIndex((re) => re.test(`${text} ${url.pathname}`))
    if (rank === -1) continue
    ranked.push({ url: `https://${root}${url.pathname}`, rank, index: index++ })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index)
  return [...new Set(ranked.map((r) => r.url))]
}

export type MxResolver = (domain: string) => Promise<{ exchange: string }[]>

// Syntax + at least one MX record. DNS failures count as invalid.
export async function hasValidMx(email: string, resolveMx: MxResolver): Promise<boolean> {
  if (!emailSchema.safeParse(email).success) return false
  try {
    const records = await resolveMx(email.split('@')[1])
    return records.some((r) => r.exchange.length > 0)
  } catch {
    return false
  }
}

export interface ContactLookupDeps {
  // Plain text of the brand's contact/about pages (whatever loads), trying
  // `linkedPages` (from the homepage) before the usual guessed paths.
  fetchContactPages: (domain: string, linkedPages: string[]) => Promise<string[]>
  resolveMx: MxResolver
}

export interface ContactLookupResult {
  email: string | null
  // Whether /contact and /about were fetched (for cost visibility).
  fetchedPages: boolean
}

// The best validated address from what the initial homepage extract found;
// only if none of those validate are /contact and /about fetched.
export async function findContactEmail(
  domain: string,
  initialCandidates: (string | null | undefined)[],
  deps: ContactLookupDeps,
  linkedPages: string[] = [],
): Promise<ContactLookupResult> {
  const mxCache = new Map<string, Promise<boolean>>()
  const validate = (email: string) => {
    const key = email.split('@')[1]
    if (!mxCache.has(key)) mxCache.set(key, hasValidMx(email, deps.resolveMx))
    return mxCache.get(key)!
  }
  const firstValid = async (candidates: string[]) => {
    for (const email of rankContactEmails(candidates, domain)) {
      if (await validate(email)) return email
    }
    return null
  }

  const fromHomepage = await firstValid(initialCandidates.filter((c): c is string => !!c))
  if (fromHomepage) return { email: fromHomepage, fetchedPages: false }

  const pages = await deps.fetchContactPages(domain, linkedPages)
  const fromPages = await firstValid(pages.flatMap(extractEmails))
  return { email: fromPages, fetchedPages: true }
}

// Whether a brand's contact lookup is due: never checked, or checked long
// enough ago that its pages may have changed.
export function needsContactLookup(
  brand: { contact_email: string | null; contact_checked_at: string | null },
  now: Date,
): boolean {
  if (brand.contact_email) return false
  if (!brand.contact_checked_at) return true
  return now.getTime() - new Date(brand.contact_checked_at).getTime() >= CONTACT_RECHECK_MS
}
