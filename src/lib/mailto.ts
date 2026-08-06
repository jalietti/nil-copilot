export interface MailtoDraft {
  to: string
  subject: string
  body: string
}

// RFC 6068: header values are percent-encoded, line breaks in body must be CRLF.
// Not URLSearchParams — it encodes spaces as "+", which mail clients render literally.
export function buildMailtoUrl({ to, subject, body }: MailtoDraft): string {
  const crlfBody = body.replace(/\r\n|\r|\n/g, '\r\n')
  const params = [
    ['subject', subject],
    ['body', crlfBody],
  ]
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

  const encodedTo = encodeURIComponent(to.trim()).replace(/%40/g, '@')
  return params.length > 0 ? `mailto:${encodedTo}?${params}` : `mailto:${encodedTo}`
}
