#!/usr/bin/env bash
# Run the app against the local Supabase stack (Docker) instead of a hosted
# project — with the design seed data from supabase/seed.sql.
#
#   npm run dev:local    # start (or reuse) the stack, then next dev on :3000
#   npm run db:reset     # wipe local data: re-apply migrations + seed
#
# Supabase settings come from the running stack and override .env.local for
# this process only. Anthropic/Tavily keys still come from .env.local, so
# drafting and discovery work (and spend credits) if you use them. Discovery
# also needs the Inngest dev server: npx inngest-cli@latest dev
set -euo pipefail
cd "$(dirname "$0")/.."

SERVICES_OFF=studio,storage-api,realtime,imgproxy,edge-runtime,logflare,vector,postgres-meta,supavisor
npx -y supabase@2 start -x "$SERVICES_OFF" > /dev/null

eval "$(npx -y supabase@2 status -o env)"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export INNGEST_DEV=1

echo "Local Supabase: $API_URL   (emails land in Mailpit: $MAILPIT_URL)"
echo "Log in as maya@example.test / nilcopilot-local — see supabase/seed.sql"
exec npx next dev -p "${PORT:-3000}"
