import { describe, expect, it } from 'vitest'
import { splitList } from '@/lib/split-list'

describe('splitList', () => {
  it('splits one-per-line answers', () => {
    expect(splitList('trail running\nbackpacking')).toEqual(['trail running', 'backpacking'])
  })

  it('accepts commas and semicolons too, and mixes', () => {
    expect(splitList('trail running, backpacking; coffee\nclimbing')).toEqual([
      'trail running',
      'backpacking',
      'coffee',
      'climbing',
    ])
  })

  it('drops blanks and trims', () => {
    expect(splitList('  a ,, \n\n b ')).toEqual(['a', 'b'])
    expect(splitList('')).toEqual([])
  })
})
