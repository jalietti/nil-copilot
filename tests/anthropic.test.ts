import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'

const reportError = vi.fn()
vi.mock('@/lib/observability/sentry', () => ({ reportError }))

const { responseText } = await import('@/lib/anthropic')

const message = (stop_reason: Anthropic.Message['stop_reason'], content: unknown[]) =>
  ({ stop_reason, content }) as unknown as Anthropic.Message

describe('responseText', () => {
  it('returns the text block, skipping thinking blocks', () => {
    const text = responseText(
      message('end_turn', [{ type: 'thinking', thinking: '…' }, { type: 'text', text: '{"ok":true}' }]),
      'test',
    )
    expect(text).toBe('{"ok":true}')
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a truncated answer instead of failing silently', () => {
    const text = responseText(message('max_tokens', [{ type: 'thinking', thinking: '…' }]), 'extractBrandMentions')
    expect(text).toBe('')
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { call: 'extractBrandMentions' })
  })
})
