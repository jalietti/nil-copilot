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
  return data.results ?? []
}

export async function tavilyExtract(
  urls: string[],
): Promise<{ url: string; raw_content: string }[]> {
  const data = await tavilyPost<{ results?: { url: string; raw_content: string }[] }>('/extract', {
    urls,
  })
  return data.results ?? []
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

// Where brands usually list a contact address: /contact and /about, plus the
// common variants (/contact-us, and Shopify's /pages/contact). Pages that
// don't exist just come back absent; one extract call covers them all.
const CONTACT_PATHS = ['/contact', '/contact-us', '/pages/contact', '/about']

export async function tavilyExtractContactPages(domain: string): Promise<string[]> {
  const pages = await tavilyExtractWithWww(CONTACT_PATHS.map((path) => `https://${domain}${path}`))
  return pages.map((page) => page.raw_content)
}
