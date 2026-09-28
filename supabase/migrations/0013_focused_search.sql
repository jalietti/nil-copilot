-- One-off focused searches ("women-owned skincare", "specialty coffee"),
-- separate from regular discovery runs and with their own daily allowance
-- (enforced in the server action; see src/lib/discovery-guard.ts). Still
-- only one run of either kind in flight at a time (0002's index).
alter table public.discovery_runs
  add column kind text not null default 'regular' check (kind in ('regular', 'focused')),
  add column focus text check (focus is null or length(focus) between 3 and 100),
  add constraint discovery_runs_focus_matches_kind check ((kind = 'focused') = (focus is not null));

grant insert (athlete_id, kind, focus) on public.discovery_runs to authenticated;

-- The athlete's own search text, kept on their own matches only ("From your
-- search: …"). Brands are shared, so they never record the search text.
alter table public.brand_matches add column search_focus text;
