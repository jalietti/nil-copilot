-- External API usage (Anthropic tokens, Tavily credits), one row per call,
-- attributed to the feature, athlete, and discovery run that caused it.
-- Owner-only: RLS on, no policies, and no anon/authenticated grants — read it
-- with `npm run usage:report` (service role) or the Supabase dashboard.
-- Deleting an athlete keeps their calls in the totals but drops the link.

create table public.api_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  provider text not null check (provider in ('anthropic', 'tavily')),
  -- anthropic: 'messages'; tavily: 'search' | 'extract'
  operation text not null,
  -- Which feature made the call: 'discovery' | 'interview' | 'draft'
  source text not null,
  -- The specific call site, e.g. 'extractBrandMentions', 'outreach'
  call text,
  athlete_id uuid references public.profiles (id) on delete set null,
  discovery_run_id uuid references public.discovery_runs (id) on delete set null,
  model text,
  input_tokens integer,
  output_tokens integer,
  -- Tavily: URLs requested / successfully extracted, and estimated credits
  -- (basic search = 1; basic extract = 1 per 5 successful URLs).
  urls_requested integer,
  urls_succeeded integer,
  credits numeric
);

create index api_usage_created_at_idx on public.api_usage (created_at);
create index api_usage_athlete_idx on public.api_usage (athlete_id);

alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;
grant all on public.api_usage to service_role;
