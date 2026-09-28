import { execFileSync } from 'node:child_process'

// A hosted project's URL and API keys, fetched through the Supabase CLI login
// on this machine (`npx supabase login`), so no key is pasted anywhere or
// printed. Used by the pilot helper scripts.
export function supabaseProject(ref: string): { url: string; publishableKey: string; secretKey: string } {
  const raw = execFileSync(
    'npx',
    ['-y', 'supabase@2', 'projects', 'api-keys', '--project-ref', ref, '--reveal', '--output-format', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  type Key = { name?: string; type?: string; api_key: string }
  // The CLI returns { keys: [...] } (older versions: a bare array).
  const parsed = JSON.parse(raw) as Key[] | { keys?: Key[] }
  const keys = Array.isArray(parsed) ? parsed : (parsed.keys ?? [])
  const find = (type: string, legacyName: string) =>
    keys.find((k) => k.type === type)?.api_key ?? keys.find((k) => k.name === legacyName)?.api_key
  const publishableKey = find('publishable', 'anon')
  const secretKey = find('secret', 'service_role')
  if (!publishableKey || !secretKey) throw new Error(`Couldn't find API keys for project ${ref}`)
  return { url: `https://${ref}.supabase.co`, publishableKey, secretKey }
}
