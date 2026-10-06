// Short relative timestamps for deal rows: "today", "yesterday", "N days ago"
// for the last month, then a short month+day. `now` is always passed in by
// the caller so this stays pure and testable (no Date mocking).

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function relativeTime(date: Date | string, now: Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / DAY_MS)

  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days > 1 && days <= 30) return `${days} days ago`

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (d.getFullYear() !== now.getFullYear()) options.year = 'numeric'
  return d.toLocaleDateString('en-US', options)
}
