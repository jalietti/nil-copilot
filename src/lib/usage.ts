import { AsyncLocalStorage } from 'node:async_hooks'
import { createAdminClient } from './supabase/admin'
import { reportError } from './observability/sentry'

// Records every Anthropic / Tavily call made while a usage context is active,
// into the owner-only api_usage table (0011). The discovery job and the
// server actions that call the APIs set the context; anything else (scripts,
// tests) runs without one and records nothing. Recording never fails the
// caller.

export interface UsageContext {
  source: 'discovery' | 'interview' | 'draft'
  athleteId?: string
  discoveryRunId?: string
}

interface ActiveContext extends UsageContext {
  pending: Promise<unknown>[]
}

export interface UsageEntry {
  provider: 'anthropic' | 'tavily'
  operation: string
  call?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
  urls_requested?: number
  urls_succeeded?: number
  credits?: number
}

const storage = new AsyncLocalStorage<ActiveContext>()

// Runs `fn` with usage attributed to `context`, and waits for the usage rows
// to be written before returning (serverless runtimes may freeze afterwards).
export async function withUsageContext<T>(context: UsageContext, fn: () => Promise<T>): Promise<T> {
  const active: ActiveContext = { ...context, pending: [] }
  return storage.run(active, async () => {
    try {
      return await fn()
    } finally {
      await Promise.allSettled(active.pending)
    }
  })
}

export function recordUsage(entry: UsageEntry): void {
  const context = storage.getStore()
  if (!context) return
  const write = (async () => {
    const { error } = await createAdminClient()
      .from('api_usage')
      .insert({
        ...entry,
        source: context.source,
        athlete_id: context.athleteId ?? null,
        discovery_run_id: context.discoveryRunId ?? null,
      })
    if (error) throw new Error(error.message)
  })().catch((error) => reportError(error, { area: 'usage' }))
  context.pending.push(write)
}

// Tavily's pricing unit for basic extract: 1 credit per 5 successful URLs.
export function tavilyExtractCredits(succeeded: number): number {
  return succeeded === 0 ? 0 : Math.ceil(succeeded / 5)
}
