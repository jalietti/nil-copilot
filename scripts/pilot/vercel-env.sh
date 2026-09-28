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
  local flag=--no-sensitive
  [ "$3" = yes ] && flag=--sensitive
  printf '%s' "$2" | vercel env add "$1" production --force "$flag" > /dev/null
  echo "  set $1"
}

ask() { # name prompt secret(yes|no) [default]
  local value
  if [ "$3" = yes ]; then
    read -rsp "$2: " value; echo
  else
    read -rp "$2${4:+ [$4]}: " value
    value="${value:-${4:-}}"
  fi
  [ -n "$value" ] || { echo "  $1 is required"; exit 1; }
  add "$1" "$value" "$3"
}

echo "Fetching Supabase keys for $ref..."
keys="$(npx -y supabase@2 projects api-keys --project-ref "$ref" --reveal --output-format json)"
pick() { node -e '
  const keys = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const k = keys.find((k) => k.type === process.argv[1] || k.name === process.argv[2]);
  if (!k) process.exit(1);
  process.stdout.write(k.api_key);' "$1" "$2" <<< "$keys"; }
add NEXT_PUBLIC_SUPABASE_URL "https://$ref.supabase.co" no
add NEXT_PUBLIC_SUPABASE_ANON_KEY "$(pick publishable anon)" no
add SUPABASE_SERVICE_ROLE_KEY "$(pick secret service_role)" yes

echo
echo "Paste each value (fresh production keys, not the ones in .env.local)."
ask ANTHROPIC_API_KEY "Anthropic API key" yes
ask TAVILY_API_KEY "Tavily API key" yes
ask NEXT_PUBLIC_SENTRY_DSN "Sentry DSN (https://...ingest...sentry.io/...)" no
ask SENTRY_ORG "Sentry organization slug" no
ask SENTRY_PROJECT "Sentry project slug" no nil-copilot
ask SENTRY_AUTH_TOKEN "Sentry auth token" yes
ask POSTHOG_KEY "PostHog project API key (phc_...)" no
ask POSTHOG_HOST "PostHog host" no https://us.i.posthog.com

echo
echo "Done. Inngest keys come from the Inngest Vercel integration. Redeploy to apply."
