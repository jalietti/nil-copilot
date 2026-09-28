import Anthropic from '@anthropic-ai/sdk'
import { reportError } from './observability/sentry'

// One model constant for all copilot calls (drafting, fit eval, normalization).
// claude-sonnet-5 per the approved v1 plan; override via env without a deploy.
export const COPILOT_MODEL = process.env.COPILOT_MODEL ?? 'claude-sonnet-5'

// Server-side only — the key must never reach client code.
export function createAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// Output cap for every structured (JSON) copilot call. The model may reason
// before answering, and that counts against max_tokens: at 1024 it sometimes
// used the whole budget thinking and returned no JSON at all. It's a ceiling,
// not a target — only tokens actually generated are billed.
export const COPILOT_MAX_TOKENS = 4096

// The text answer of a copilot call. A truncated answer is reported (it means
// COPILOT_MAX_TOKENS is too low for this call) rather than failing silently;
// callers still validate the JSON and fall back as before.
export function responseText(response: Anthropic.Message, call: string): string {
  if (response.stop_reason === 'max_tokens') {
    reportError(new Error(`Copilot output truncated at max_tokens (${call})`), { call })
  }
  return response.content.find((block) => block.type === 'text')?.text ?? ''
}
