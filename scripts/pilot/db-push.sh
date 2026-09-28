#!/usr/bin/env bash
# Apply every migration in supabase/migrations to a hosted Supabase project.
#
#   npm run pilot:db-push -- <project-ref>                    # a new project
#   npm run pilot:db-push -- <project-ref> --adopt-existing   # a project whose
#       first migration (0001) was applied by hand in the SQL editor
#
# You'll be asked for that project's database password (Project Settings ->
# Database). Needs `npx supabase login` once on this machine.
set -euo pipefail
cd "$(dirname "$0")/../.."

ref="${1:?Usage: npm run pilot:db-push -- <project-ref> [--adopt-existing]}"
supabase() { npx -y supabase@2 "$@"; }

supabase link --project-ref "$ref"
if [ "${2:-}" = "--adopt-existing" ]; then
  # 0001 is already in the database but not in Supabase's migration history.
  supabase migration repair --status applied 0001
fi
supabase db push
echo
supabase migration list
echo "Done: every migration above should show in both Local and Remote."
