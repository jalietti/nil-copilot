import { reportError } from './observability/sentry'

// Database errors stay on the server: their text names tables, columns and
// policies. The athlete gets a friendly message; Sentry gets the real error.

export const SAVE_FAILED = 'Couldn’t save that just now — try again in a minute.'

interface DbError {
  message: string
  code?: string
}

export function saveFailed(error: DbError | Error, action: string): string {
  const reported =
    error instanceof Error ? error : new Error(error.code ? `${error.code}: ${error.message}` : error.message)
  reportError(reported, { action })
  return SAVE_FAILED
}
