import { beforeEach, describe, expect, it, vi } from 'vitest'

const inserts: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        inserts.push(row)
        return { error: null }
      },
    }),
  }),
}))
vi.mock('@/lib/observability/sentry', () => ({ reportError: vi.fn() }))

const { recordUsage, tavilyExtractCredits, withUsageContext } = await import('@/lib/usage')
const { buildUsageReport } = await import('@/lib/usage-report')

beforeEach(() => {
  inserts.length = 0
})

describe('recordUsage', () => {
  it('records nothing outside a usage context (scripts, tests)', async () => {
    recordUsage({ provider: 'tavily', operation: 'search', credits: 1 })
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(inserts).toEqual([])
  })

  it('attributes calls to the context and waits for the rows before returning', async () => {
    await withUsageContext({ source: 'discovery', athleteId: 'athlete-1', discoveryRunId: 'run-1' }, async () => {
      recordUsage({ provider: 'anthropic', operation: 'messages', call: 'evaluateCandidate', input_tokens: 900, output_tokens: 120 })
      recordUsage({ provider: 'tavily', operation: 'extract', urls_requested: 6, urls_succeeded: 3, credits: 1 })
    })
    expect(inserts).toEqual([
      expect.objectContaining({ provider: 'anthropic', source: 'discovery', athlete_id: 'athlete-1', discovery_run_id: 'run-1', input_tokens: 900 }),
      expect.objectContaining({ provider: 'tavily', operation: 'extract', credits: 1, athlete_id: 'athlete-1' }),
    ])
  })

  it('estimates basic extract credits as 1 per 5 successful URLs', () => {
    expect([0, 1, 5, 6, 10].map(tavilyExtractCredits)).toEqual([0, 1, 1, 2, 2])
  })
})

describe('buildUsageReport', () => {
  const row = (over: Record<string, unknown>) => ({
    provider: 'anthropic' as const,
    source: 'discovery',
    athlete_id: 'aaaaaaaa-1111',
    discovery_run_id: null,
    input_tokens: 0,
    output_tokens: 0,
    credits: null,
    ...over,
  })

  it('totals by feature and per discovery run, heaviest athletes first', () => {
    const report = buildUsageReport([
      row({ discovery_run_id: 'r1', input_tokens: 1000, output_tokens: 200 }),
      row({ discovery_run_id: 'r1', provider: 'tavily', credits: 3 }),
      row({ discovery_run_id: 'r2', input_tokens: 3000, output_tokens: 400 }),
      row({ source: 'draft', athlete_id: 'bbbbbbbb-2222', input_tokens: 500, output_tokens: 300 }),
      row({ source: 'draft', athlete_id: null, input_tokens: 10, output_tokens: 5 }),
    ])
    expect(report.overall).toEqual({ calls: 5, inputTokens: 4510, outputTokens: 905, tavilyCredits: 3 })
    expect(report.byFeature.draft).toEqual({ calls: 2, inputTokens: 510, outputTokens: 305, tavilyCredits: 0 })
    expect(report.perDiscoveryRun).toEqual({
      runs: 2,
      avgInputTokens: 2000,
      avgOutputTokens: 300,
      avgTavilyCredits: 2,
      maxTavilyCredits: 3,
    })
    expect(report.topAthletes.map((a) => a.athlete)).toEqual(['aaaaaaaa', 'bbbbbbbb', 'deleted'])
  })
})
