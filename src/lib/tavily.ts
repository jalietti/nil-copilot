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
