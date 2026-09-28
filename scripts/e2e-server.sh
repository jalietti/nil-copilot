#!/usr/bin/env bash
# Production build of the app for end-to-end tests: local Supabase for data,
# the mock Anthropic server for drafting (tests/e2e/mock-anthropic.mjs), and
# no Sentry/PostHog/Tavily. Started by playwright.config.ts.
set -euo pipefail
cd "$(dirname "$0")/.."

eval "$(npx -y supabase@2 status -o env)"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export ANTHROPIC_BASE_URL="http://127.0.0.1:${MOCK_ANTHROPIC_PORT:-4010}"
export ANTHROPIC_API_KEY=e2e-mock
export TAVILY_API_KEY=
export NEXT_PUBLIC_SENTRY_DSN=
export POSTHOG_KEY=
export INNGEST_DEV=1

npx next build
exec npx next start -p "${E2E_PORT:-3400}"
