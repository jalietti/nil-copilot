// Stand-in for the Anthropic Messages API during end-to-end tests
// (ANTHROPIC_BASE_URL points here). Returns canned structured output based on
// what the prompt asks for, so the real UI flows run without API keys, cost,
// or flakiness. Each draft is labeled with its kind so tests can assert which
// prompt ran.
import http from 'node:http'

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010)

function answer(prompt) {
  if (prompt.includes('brand-category tags')) {
    return { category_tags: ['open-water-swimming', 'reef-safe-sunscreen'] }
  }
  if (prompt.includes('voice profile')) {
    return {
      voice_profile:
        'Relaxed and direct, a little dry. Talks about the water more than the sport, prefers small brands, and keeps things short and honest rather than hyped.',
    }
  }
  if (prompt.includes('different version')) {
    return { subject: 'E2E alternate subject', body: 'E2E ALTERNATE DRAFT\n\nA different take.\n\nMaya' }
  }
  if (prompt.includes('ongoing NIL negotiation')) {
    return { subject: 'Re: partnership', body: 'E2E COUNTER DRAFT\n\nThanks so much — could we do product plus $100?\n\nMaya' }
  }
  if (prompt.includes('follow-up')) {
    return { subject: 'Re: partnership', body: 'E2E FOLLOW-UP DRAFT\n\nJust floating this back up.\n\nMaya' }
  }
  if (prompt.includes('first-touch NIL partnership outreach')) {
    return { subject: 'E2E outreach subject', body: 'E2E OUTREACH DRAFT\n\nHey team, I swim open water every morning.\n\nMaya' }
  }
  return {}
}

http
  .createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) {
        res.writeHead(404).end()
        return
      }
      const request = JSON.parse(body)
      const prompt = request.messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'msg_e2e',
          type: 'message',
          role: 'assistant',
          model: request.model,
          content: [{ type: 'text', text: JSON.stringify(answer(prompt)) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      )
    })
  })
  .listen(PORT, '127.0.0.1', () => console.log(`mock anthropic on ${PORT}`))
