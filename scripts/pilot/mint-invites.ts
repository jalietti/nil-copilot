// Mint invite codes in a hosted project (the SQL in PILOT-SETUP.md, as a
// command). Codes are random, easy to read aloud, and printed once.
//
//   npm run pilot:invites -- <project-ref>                       # 10 single-use codes
//   npm run pilot:invites -- <project-ref> --count 12 --label "water polo" --max-uses 1

import { randomInt } from 'node:crypto'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { supabaseProject } from './supabase-project'

// No 0/O, 1/I/L: codes get typed from a text message.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const code = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      count: { type: 'string', default: '10' },
      label: { type: 'string', default: 'pilot' },
      'max-uses': { type: 'string', default: '1' },
    },
  })
  const ref = positionals[0]
  if (!ref) throw new Error('Usage: npm run pilot:invites -- <project-ref> [--count N] [--label X] [--max-uses N]')

  const { url, secretKey } = supabaseProject(ref)
  const db = createClient<Database>(url, secretKey, { auth: { persistSession: false } })
  const rows = Array.from({ length: Number(values.count) }, () => ({
    code: code(),
    label: values.label!,
    max_uses: Number(values['max-uses']),
  }))
  const { data, error } = await db.from('invite_codes').insert(rows).select('code')
  if (error) throw new Error(error.message)
  console.log(`Created ${data.length} invite codes (${values.label}, ${values['max-uses']} use each):\n`)
  for (const row of data) console.log(`  ${row.code}`)
  console.log(`\nSend each athlete one code with your app's /signup link.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
