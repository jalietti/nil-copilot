import { afterEach, describe, expect, it, vi } from 'vitest'
import { tavilyExtractWithWww } from '@/lib/tavily'

// Fake Tavily /extract: only the listed URLs "load".
function mockExtract(loads: string[]) {
  const calls: string[][] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const { urls } = JSON.parse(init.body) as { urls: string[] }
      calls.push(urls)
      const results = urls.filter((u) => loads.includes(u)).map((url) => ({ url, raw_content: `page ${url}` }))
      return new Response(JSON.stringify({ results }), { status: 200 })
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('tavilyExtractWithWww', () => {
  it('retries only the URLs that failed, with www.', async () => {
    const calls = mockExtract(['https://ridgeline.test/contact', 'https://www.soar.test'])
    const pages = await tavilyExtractWithWww(['https://ridgeline.test/contact', 'https://soar.test'])
    expect(pages.map((p) => p.url)).toEqual(['https://ridgeline.test/contact', 'https://www.soar.test'])
    expect(calls).toEqual([['https://ridgeline.test/contact', 'https://soar.test'], ['https://www.soar.test']])
  })

  it('makes one call when everything loads, and returns nothing if both forms fail', async () => {
    const calls = mockExtract(['https://ok.test'])
    expect((await tavilyExtractWithWww(['https://ok.test'])).length).toBe(1)
    expect(calls).toHaveLength(1)
    expect(await tavilyExtractWithWww(['https://blocked.test'])).toEqual([])
  })
})
