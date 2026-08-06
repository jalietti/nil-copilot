-- NIL Copilot initial schema.
-- Brand discovery cache (`brands`) is written ONLY by the service role from
-- background jobs — live research results, never a hand-curated list.

create type citizenship_status as enum (
  'us_citizen',
  'permanent_resident',
  'f1_visa',
  'other_visa',
  'prefer_not_to_say'
);

create type match_status as enum ('suggested', 'dismissed', 'drafting', 'contacted');

create type deal_status as enum (
  'draft',
  'sent',
  'reply_received',
  'negotiating',
  'agreed',
  'closed',
  'dead'
);

create type message_direction as enum ('outbound_draft', 'inbound_pasted');

create type discovery_run_status as enum ('queued', 'running', 'completed', 'failed');

-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  school text,
  sport text,
  division text,
  instagram_followers integer,
  tiktok_followers integer,
  other_followers integer,
  citizenship_status citizenship_status,
  -- International athletes must see real guidance, not silence; this records that it happened.
  visa_guidance_shown_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid () = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid () = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid () = id);

-- Auto-create a profile row when a user signs up.
create function public.handle_new_user () returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- ---------------------------------------------------------------------------

create table public.interviews (
  id uuid primary key default gen_random_uuid (),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  -- Free-text interests as entered by the athlete.
  interests jsonb not null default '[]'::jsonb,
  -- Brands/products the athlete genuinely uses.
  brands_used jsonb not null default '[]'::jsonb,
  -- Normalized category tags (Claude-derived from free text).
  category_tags text[] not null default '{}',
  -- Athlete-stated preference per brand tier (follower count x product value).
  -- No external market comp data in v1.
  deal_preferences jsonb not null default '{}'::jsonb,
  raw_answers jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interviews_athlete_id_idx on public.interviews (athlete_id);

alter table public.interviews enable row level security;

create policy "interviews_all_own" on public.interviews
  for all using (auth.uid () = athlete_id) with check (auth.uid () = athlete_id);

-- ---------------------------------------------------------------------------
-- Shared brand-discovery cache. Grows from live research (Tavily + Claude in
-- Inngest jobs, via service role). Authenticated users can read; no
-- insert/update/delete policies exist on purpose — only the service role
-- (which bypasses RLS) writes here.

create table public.brands (
  id uuid primary key default gen_random_uuid (),
  domain text not null unique,
  name text not null,
  description text,
  categories text[] not null default '{}',
  contact_email text,
  source_urls text[] not null default '{}',
  -- The search query / research path that surfaced this brand.
  discovered_via text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brands_categories_idx on public.brands using gin (categories);

alter table public.brands enable row level security;

create policy "brands_select_authenticated" on public.brands
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------

create table public.brand_matches (
  id uuid primary key default gen_random_uuid (),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  fit_reason text not null default '',
  status match_status not null default 'suggested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, brand_id)
);

create index brand_matches_athlete_id_idx on public.brand_matches (athlete_id);

alter table public.brand_matches enable row level security;

-- Matches are created by the discovery job (service role); athletes read and
-- update (e.g. dismiss) their own.
create policy "brand_matches_select_own" on public.brand_matches
  for select using (auth.uid () = athlete_id);

create policy "brand_matches_update_own" on public.brand_matches
  for update using (auth.uid () = athlete_id) with check (auth.uid () = athlete_id);

-- ---------------------------------------------------------------------------

create table public.deals (
  id uuid primary key default gen_random_uuid (),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  status deal_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_athlete_id_idx on public.deals (athlete_id);

alter table public.deals enable row level security;

create policy "deals_all_own" on public.deals
  for all using (auth.uid () = athlete_id) with check (auth.uid () = athlete_id);

-- ---------------------------------------------------------------------------
-- Everything in a deal thread: outreach drafts, pasted brand replies, drafted
-- counters. Nothing here is ever transmitted by the app — outbound content
-- only leaves via the athlete's own mailto: click.

create table public.messages (
  id uuid primary key default gen_random_uuid (),
  deal_id uuid not null references public.deals (id) on delete cascade,
  direction message_direction not null,
  subject text,
  content text not null,
  athlete_edited boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_deal_id_idx on public.messages (deal_id);

alter table public.messages enable row level security;

create policy "messages_all_own" on public.messages
  for all using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id and d.athlete_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.deals d
      where d.id = deal_id and d.athlete_id = auth.uid ()
    )
  );

-- ---------------------------------------------------------------------------

create table public.discovery_runs (
  id uuid primary key default gen_random_uuid (),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  status discovery_run_status not null default 'queued',
  params jsonb not null default '{}'::jsonb,
  brands_found integer not null default 0,
  matches_created integer not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index discovery_runs_athlete_id_idx on public.discovery_runs (athlete_id);

alter table public.discovery_runs enable row level security;

-- Athletes can see and enqueue their own runs; only the job (service role)
-- updates progress.
create policy "discovery_runs_select_own" on public.discovery_runs
  for select using (auth.uid () = athlete_id);

create policy "discovery_runs_insert_own" on public.discovery_runs
  for insert with check (auth.uid () = athlete_id);

-- ---------------------------------------------------------------------------

create function public.set_updated_at () returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at ();
create trigger set_interviews_updated_at before update on public.interviews
  for each row execute function public.set_updated_at ();
create trigger set_brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at ();
create trigger set_brand_matches_updated_at before update on public.brand_matches
  for each row execute function public.set_updated_at ();
create trigger set_deals_updated_at before update on public.deals
  for each row execute function public.set_updated_at ();
