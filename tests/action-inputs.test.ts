import { describe, expect, it } from 'vitest'
import {
  brandReplySchema,
  contactEmailInputSchema,
  dealOutcomeSchema,
  draftEditSchema,
  draftKindSchema,
  isRecordId,
} from '@/lib/validators/action-inputs'

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'

describe('isRecordId', () => {
  it('accepts a uuid', () => {
    expect(isRecordId(ID)).toBe(true)
  })

  it.each(['', 'not-an-id', `${ID}' or 1=1`, 42, null, undefined, { id: ID }])(
    'rejects %s',
    (value) => {
      expect(isRecordId(value)).toBe(false)
    },
  )
})

describe('dealOutcomeSchema', () => {
  it.each(['agreed', 'closed', 'dead'])('accepts %s', (status) => {
    expect(dealOutcomeSchema.safeParse(status).success).toBe(true)
  })

  it.each(['sent', 'negotiating', 'AGREED', '', 1])('rejects %s', (status) => {
    expect(dealOutcomeSchema.safeParse(status).success).toBe(false)
  })
})

describe('draftKindSchema', () => {
  it.each(['outreach', 'counter', 'follow_up'])('accepts %s', (kind) => {
    expect(draftKindSchema.safeParse(kind).success).toBe(true)
  })

  it('rejects anything else', () => {
    expect(draftKindSchema.safeParse('<script>').success).toBe(false)
  })
})

describe('draftEditSchema', () => {
  it('keeps the draft exactly as typed', () => {
    const result = draftEditSchema.safeParse({ subject: 'Hi ', content: '  Body\n' })
    expect(result.data).toEqual({ subject: 'Hi ', content: '  Body\n' })
  })

  it('rejects an empty body', () => {
    const result = draftEditSchema.safeParse({ subject: 'Hi', content: '   ' })
    expect(result.error?.issues[0]?.message).toBe('The email body is empty')
  })

  it.each([
    { subject: 'x'.repeat(201), content: 'Body' },
    { subject: 'Hi', content: 'x'.repeat(8001) },
  ])('rejects an oversized draft', (draft) => {
    expect(draftEditSchema.safeParse(draft).error?.issues[0]?.message).toBe('That draft is too long')
  })

  it('rejects non-text fields', () => {
    expect(draftEditSchema.safeParse({ subject: 1, content: ['Body'] }).success).toBe(false)
  })
})

describe('brandReplySchema', () => {
  it('trims the pasted reply', () => {
    expect(brandReplySchema.safeParse('  Thanks!  ').data).toBe('Thanks!')
  })

  it('rejects an empty reply', () => {
    expect(brandReplySchema.safeParse('  ').error?.issues[0]?.message).toBe('Paste the brand’s reply first')
  })

  it('rejects a reply over 20,000 characters', () => {
    expect(brandReplySchema.safeParse('x'.repeat(20_001)).error?.issues[0]?.message).toBe(
      'That reply is too long',
    )
  })

  it('rejects non-text input', () => {
    expect(brandReplySchema.safeParse({ content: 'hi' }).success).toBe(false)
  })
})

describe('contactEmailInputSchema', () => {
  it('trims and lowercases', () => {
    expect(contactEmailInputSchema.safeParse('  Deals@Brand.TEST ').data).toBe('deals@brand.test')
  })

  it.each([123, null, 'x'.repeat(321)])('rejects %s', (value) => {
    expect(contactEmailInputSchema.safeParse(value).success).toBe(false)
  })
})
