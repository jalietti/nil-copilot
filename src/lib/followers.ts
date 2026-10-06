// Postel's law for follower counts: accept whatever shape an athlete is
// likely to type ("1,200", "1.2k", "3M", " 450 "), never silently drop it.
// Blank means "no answer" (null). Anything that isn't a recognizable number
// is an error the form can show, instead of quietly coercing it to nothing.

export type ParsedFollowers = { value: number | null; error?: undefined } | { value?: undefined; error: string }

export const FOLLOWERS_ERROR = 'Use a number like 450 or 1.2k'

export function parseFollowers(raw: string): ParsedFollowers {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: null }

  const withoutCommas = trimmed.replace(/,/g, '')
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*([km])?$/i.exec(withoutCommas)
  if (!match) return { error: FOLLOWERS_ERROR }

  const n = Number(match[1])
  if (!Number.isFinite(n)) return { error: FOLLOWERS_ERROR }

  const suffix = match[2]?.toLowerCase()
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1
  const value = Math.round(n * multiplier)
  if (value < 0) return { error: FOLLOWERS_ERROR }

  return { value }
}
