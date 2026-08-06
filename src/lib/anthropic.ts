import Anthropic from '@anthropic-ai/sdk'

// One model constant for all copilot calls (drafting, fit eval, normalization).
// claude-sonnet-5 per the approved v1 plan; override via env without a deploy.
export const COPILOT_MODEL = process.env.COPILOT_MODEL ?? 'claude-sonnet-5'

// Server-side only — the key must never reach client code.
export function createAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}
