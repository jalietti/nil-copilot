import { describe, expect, it } from 'vitest'
import { buildMailtoUrl } from '@/lib/mailto'

describe('buildMailtoUrl', () => {
  it('builds a mailto URL with encoded subject and body', () => {
    const url = buildMailtoUrl({
      to: 'partnerships@brand.com',
      subject: 'Partnership inquiry — track athlete',
      body: 'Hi there,\n\nI genuinely use your gear.',
    })
    expect(url.startsWith('mailto:partnerships@brand.com?')).toBe(true)
    expect(url).toContain('subject=Partnership%20inquiry%20%E2%80%94%20track%20athlete')
    expect(url).toContain('body=Hi%20there%2C%0D%0A%0D%0AI%20genuinely%20use%20your%20gear.')
  })

  it('never encodes spaces as "+"', () => {
    const url = buildMailtoUrl({ to: 'a@b.com', subject: 'two words', body: 'more words here' })
    expect(url).not.toContain('+')
  })

  it('normalizes bare LF and CR line breaks to CRLF', () => {
    const url = buildMailtoUrl({ to: 'a@b.com', subject: 's', body: 'line1\nline2\rline3\r\nline4' })
    const body = decodeURIComponent(url.split('body=')[1])
    expect(body).toBe('line1\r\nline2\r\nline3\r\nline4')
  })

  it('keeps @ readable in the address and trims whitespace', () => {
    const url = buildMailtoUrl({ to: '  hello@brand.co  ', subject: '', body: '' })
    expect(url).toBe('mailto:hello@brand.co')
  })

  it('omits empty params but keeps non-empty ones', () => {
    const url = buildMailtoUrl({ to: 'a@b.com', subject: 'only subject', body: '' })
    expect(url).toBe('mailto:a@b.com?subject=only%20subject')
  })

  it('round-trips a full drafted email through decodeURIComponent', () => {
    const body = 'Hi Ridgeline team,\r\n\r\nI’m a D2 track athlete & real customer — 100% organic reach.\r\n\r\nBest,\r\nAlex'
    const url = buildMailtoUrl({ to: 'a@b.com', subject: 'Collab?', body })
    expect(decodeURIComponent(url.split('body=')[1])).toBe(body)
  })
})
