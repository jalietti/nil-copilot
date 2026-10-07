import { beforeEach, describe, expect, it, vi } from 'vitest'

const reportError = vi.fn()
vi.mock('@/lib/observability/sentry', () => ({ reportError }))

const { SAVE_FAILED, saveFailed } = await import('@/lib/action-errors')

describe('saveFailed', () => {
  beforeEach(() => reportError.mockClear())

  it('gives the athlete a friendly message, never the database text', () => {
    const dbError = { message: 'new row violates row-level security policy for table "messages"', code: '42501' }

    const message = saveFailed(dbError, 'saveBrandReply')

    expect(message).toBe(SAVE_FAILED)
    expect(message).not.toContain('messages')
  })

  it('reports the real error to Sentry, tagged with the action', () => {
    saveFailed({ message: 'duplicate key value', code: '23505' }, 'startDeal')

    expect(reportError).toHaveBeenCalledTimes(1)
    const [reported, tags] = reportError.mock.calls[0]
    expect(reported).toBeInstanceOf(Error)
    expect(reported.message).toBe('23505: duplicate key value')
    expect(tags).toEqual({ action: 'startDeal' })
  })

  it('passes real Error objects through unchanged', () => {
    const error = new Error('boom')
    saveFailed(error, 'markSent')
    expect(reportError.mock.calls[0][0]).toBe(error)
  })
})
