import type { ApiUsage } from './supabase/types'

// Owner-only rollup of api_usage (scripts/usage-report.ts): tokens and Tavily
// credits by provider, by feature, per discovery run, and per athlete. Counts
// only — dollar costs are deliberately not computed (prices change; spend
// metering is deferred).

export type UsageRow = Pick<
  ApiUsage,
  'provider' | 'source' | 'athlete_id' | 'discovery_run_id' | 'input_tokens' | 'output_tokens' | 'credits'
>

interface Totals {
  calls: number
  inputTokens: number
  outputTokens: number
  tavilyCredits: number
}

function totals(rows: UsageRow[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      calls: t.calls + 1,
      inputTokens: t.inputTokens + (r.input_tokens ?? 0),
      outputTokens: t.outputTokens + (r.output_tokens ?? 0),
      tavilyCredits: t.tavilyCredits + Number(r.credits ?? 0),
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, tavilyCredits: 0 },
  )
}

function groupBy(rows: UsageRow[], key: (r: UsageRow) => string | null) {
  const groups = new Map<string, UsageRow[]>()
  for (const row of rows) {
    const k = key(row)
    if (k === null) continue
    groups.set(k, [...(groups.get(k) ?? []), row])
  }
  return groups
}

export function buildUsageReport(rows: UsageRow[], { topAthletes = 10 } = {}) {
  const runs = groupBy(rows, (r) => r.discovery_run_id)
  const runTotals = [...runs.values()].map(totals)
  const avg = (f: (t: Totals) => number) =>
    runTotals.length === 0 ? 0 : Math.round(runTotals.reduce((n, t) => n + f(t), 0) / runTotals.length)

  return {
    overall: totals(rows),
    byFeature: Object.fromEntries([...groupBy(rows, (r) => r.source)].map(([k, v]) => [k, totals(v)])),
    perDiscoveryRun: {
      runs: runTotals.length,
      avgInputTokens: avg((t) => t.inputTokens),
      avgOutputTokens: avg((t) => t.outputTokens),
      avgTavilyCredits: avg((t) => t.tavilyCredits),
      maxTavilyCredits: Math.max(0, ...runTotals.map((t) => t.tavilyCredits)),
    },
    // Heaviest athletes first; ids are shortened (look them up in Supabase if
    // needed). Calls from since-deleted athletes are grouped as "deleted".
    topAthletes: [...groupBy(rows, (r) => r.athlete_id?.slice(0, 8) ?? 'deleted')]
      .map(([athlete, v]) => ({ athlete, ...totals(v) }))
      .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens))
      .slice(0, topAthletes),
  }
}
