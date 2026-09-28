// Where the auth callback may send someone after signing them in. Only
// same-site paths: "//evil.test" or "https://…" would turn the callback into
// an open redirect.
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/onboarding'
  }
  return next
}
