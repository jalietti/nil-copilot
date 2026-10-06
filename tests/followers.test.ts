import { describe, expect, it } from 'vitest'
import { parseFollowers } from '@/lib/followers'

describe('parseFollowers', () => {
  it('accepts plain digits, with or without commas', () => {
    expect(parseFollowers('1200')).toEqual({ value: 1200 })
    expect(parseFollowers('1,200')).toEqual({ value: 1200 })
  })

  it('accepts k/K and m suffixes', () => {
    expect(parseFollowers('1.2k')).toEqual({ value: 1200 })
    expect(parseFollowers('1.2K')).toEqual({ value: 1200 })
    expect(parseFollowers('3m')).toEqual({ value: 3_000_000 })
  })

  it('trims surrounding whitespace', () => {
    expect(parseFollowers(' 450 ')).toEqual({ value: 450 })
  })

  it('treats blank as "no answer"', () => {
    expect(parseFollowers('')).toEqual({ value: null })
    expect(parseFollowers('   ')).toEqual({ value: null })
  })

  it('returns an error for unrecognizable input instead of dropping it', () => {
    expect(parseFollowers('a lot')).toEqual({ error: 'Use a number like 450 or 1.2k' })
    expect(parseFollowers('NaN')).toEqual({ error: 'Use a number like 450 or 1.2k' })
    expect(parseFollowers('-5')).toEqual({ error: 'Use a number like 450 or 1.2k' })
    expect(parseFollowers('1.2.3')).toEqual({ error: 'Use a number like 450 or 1.2k' })
  })
})
