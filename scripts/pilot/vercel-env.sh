#!/usr/bin/env bash
# Set every production environment variable on the linked Vercel project.
#
#   npm run pilot:vercel-env -- <prod-supabase-project-ref>
#
# Supabase values are fetched from the Supabase CLI (never printed). You're
# prompted for the rest; secret inputs are hidden and passed to Vercel over
# stdin, so they don't appear on screen, in shell history, or in `ps`.
# Needs `npx supabase login` and `npx vercel login`, and the project linked
# (`npx vercel link`). Re-running overwrites existing values.
set -euo pipefail
cd "$(dirname "$0")/../.."

ref="${1:?Usage: npm run pilot:vercel-env -- <prod-supabase-project-ref>}"
vercel() { npx -y vercel@latest "$@"; }

add() { # name value sensitive(yes|no)
  [ -n "$2" ] || { echo "  refusing to set $1 to an empty value"; exit 1; }
  local flag=--no-sensitive
  [ "$3" = yes ] && flag=--sensitive
  printf '%s' "$2" | vercel env add "$1" production --force "$flag" > /dev/null
  echo "  set $1"
}

read_value() { # prompt secret(yes|no) [default] -> $value
  if [ "$2" = yes ]; then
    read -rsp "$1: " value; echo
  else
    read -rp "$1${3:+ [$3]}: " value
    value="${value:-${3:-}}"
  fi
}

ask() { # name prompt secret(yes|no) [default]
  read_value "$2" "$3" "${4:-}"
  [ -n "$value" ] || { echo "  $1 is required"; exit 1; }
  add "$1" "$value" "$3"
}

ask_optional() { # name prompt secret(yes|no) [default] — Enter skips
  read_value "$2 (Enter to skip)" "$3" "${4:-}"
  if [ -n "$value" ]; then add "$1" "$value" "$3"; else echo "  skipped $1"; fi
}

echo "Fetching Supabase keys for $ref..."
keys="$(npx -y supabase@2 projects api-keys --project-ref "$ref" --reveal --output-format json)"
# The CLI returns { "keys": [...] }; prefer the new publishable/secret keys,
# falling back to the legacy anon/service_role ones. Fails loudly if missing.
pick() { node -e '
  const out = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const keys = Array.isArray(out) ? out : out.keys ?? [];
  const k = keys.find((k) => k.type === process.argv[1]) ?? keys.find((k) => k.name === process.argv[2]);
  if (!k?.api_key) { console.error(`No ${process.argv[1]} key found`); process.exit(1); }
  process.stdout.write(k.api_key);' "$1" "$2" <<< "$keys"; }
# Assigned first (not inside the add call) so a failure stops the script
# instead of saving an empty value.
publishable="$(pick publishable anon)"
secret="$(pick secret service_role)"
add NEXT_PUBLIC_SUPABASE_URL "https://$ref.supabase.co" no
add NEXT_PUBLIC_SUPABASE_ANON_KEY "$publishable" no
add SUPABASE_SERVICE_ROLE_KEY "$secret" yes

echo
echo "Paste each value (fresh production keys, not the ones in .env.local)."
ask ANTHROPIC_API_KEY "Anthropic API key" yes
ask TAVILY_API_KEY "Tavily API key" yes
ask NEXT_PUBLIC_SENTRY_DSN "Sentry DSN (https://...ingest...sentry.io/...)" no
# Source-map upload only (readable stack traces); errors are captured without.
ask_optional SENTRY_AUTH_TOKEN "Sentry auth token" yes
if [ -n "$value" ]; then
  ask SENTRY_ORG "Sentry organization slug" no
  ask SENTRY_PROJECT "Sentry project slug" no nil-copilot
fi
ask POSTHOG_KEY "PostHog project API key (phc_...)" no
ask POSTHOG_HOST "PostHog host" no https://us.i.posthog.com

echo
echo "Done. Inngest keys come from the Inngest Vercel integration. Redeploy to apply."
