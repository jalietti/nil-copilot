-- [What this adds and why, in one or two sentences.]
-- Who can see it: [own-rows | service-only | shared read-only] — [why].

-- ---------------------------------------------------------------------------
-- OWN-ROWS table: one athlete's data, visible only to that athlete.
create table public.[table_name] (
  id uuid primary key default gen_random_uuid (),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  [column] [type] [not null default ...],
  created_at timestamptz not null default now()
);

create index [table_name]_athlete_id_idx on public.[table_name] (athlete_id);

alter table public.[table_name] enable row level security;

create policy "[table_name]_all_own" on public.[table_name]
  for all using (auth.uid () = athlete_id) with check (auth.uid () = athlete_id);

-- Grant only what the app does (0004: new tables get nothing by default).
grant select, insert on public.[table_name] to authenticated;
grant update ([athlete_editable_column]) on public.[table_name] to authenticated;

-- ---------------------------------------------------------------------------
-- SERVICE-ONLY table: built from more than one athlete's data. Athletes never
-- read it; they only see results. RLS on, no policies, no grants.
create table public.[table_name] (
  id uuid primary key default gen_random_uuid (),
  [column] [type],
  updated_at timestamptz not null default now()
);

alter table public.[table_name] enable row level security;
revoke all on public.[table_name] from anon, authenticated;

-- ---------------------------------------------------------------------------
-- NEW COLUMN on an existing table: read-only to athletes unless they edit it.
alter table public.[existing_table] add column [column] [type];
-- Only if the athlete edits it in the app:
-- grant update ([column]) on public.[existing_table] to authenticated;

-- ---------------------------------------------------------------------------
-- Filled-in example (0013_focused_search.sql):
--
-- alter table public.discovery_runs
--   add column kind text not null default 'regular' check (kind in ('regular', 'focused')),
--   add column focus text check (focus is null or length(focus) between 3 and 100),
--   add constraint discovery_runs_focus_matches_kind check ((kind = 'focused') = (focus is not null));
--
-- grant insert (athlete_id, kind, focus) on public.discovery_runs to authenticated;
--
-- alter table public.brand_matches add column search_focus text;
