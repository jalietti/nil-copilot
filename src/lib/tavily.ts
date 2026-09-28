import { recordUsage, tavilyExtractCredits } from './usage'

// Thin wrappers over the Tavily REST API — the only thing in this stack that
// can search and read the live web. Server-side only.

const TAVILY_BASE = 'https://api.tavily.com'

export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
}

async function tavilyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${TAVILY_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Tavily ${path} failed: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as T
}

export async function tavilySearch(
  query: string,
  { maxResults = 8 }: { maxResults?: number } = {},
): Promise<TavilySearchResult[]> {
  const data = await tavilyPost<{ results?: TavilySearchResult[] }>('/search', {
    query,
    max_results: maxResults,
    search_depth: 'basic',
  })
  recordUsage({ provider: 'tavily', operation: 'search', credits: 1 })
  return data.results ?? []
}

export async function tavilyExtract(
  urls: string[],
): Promise<{ url: string; raw_content: string }[]> {
  const data = await tavilyPost<{ results?: { url: string; raw_content: string }[] }>('/extract', {
    urls,
  })
  const results = data.results ?? []
  recordUsage({
    provider: 'tavily',
    operation: 'extract',
    urls_requested: urls.length,
    urls_succeeded: results.length,
    credits: tavilyExtractCredits(results.length),
  })
  return results
}

// Some sites only answer on www. (the bare domain fails to fetch). Brand URLs
// here are built from bare domains, so retry just the failures with www.
export async function tavilyExtractWithWww(
  urls: string[],
): Promise<{ url: string; raw_content: string }[]> {
  const pages = (await tavilyExtract(urls)).filter((page) => page.raw_content)
  const fetched = new Set(pages.map((page) => page.url.replace('://www.', '://')))
  const retry = urls
    .filter((url) => !fetched.has(url) && !url.includes('://www.'))
    .map((url) => url.replace('://', '://www.'))
  if (retry.length === 0) return pages
  return [...pages, ...(await tavilyExtract(retry)).filter((page) => page.raw_content)]
}

// Where brands list a contact address: pages the homepage links to (best
// first, see contactPageLinks), then the usual paths (/contact, /contact-us,
// Shopify's /pages/contact(-us), /about). One extract call, capped so the
// cost stays at about one extract credit per brand.
const CONTACT_PATHS = ['/contact', '/contact-us', '/pages/contact', '/pages/contact-us', '/about']
const MAX_CONTACT_PAGES = 6

export async function tavilyExtractContactPages(
  domain: string,
  linkedPages: string[] = [],
): Promise<string[]> {
  const urls = [
    ...new Set([...linkedPages, ...CONTACT_PATHS.map((path) => `https://${domain}${path}`)]),
  ].slice(0, MAX_CONTACT_PAGES)
  const pages = await tavilyExtractWithWww(urls)
  return pages.map((page) => page.raw_content)
}
