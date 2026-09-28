-- At most one in-flight discovery run per athlete, enforced by the database.
-- The server action checks first and returns a friendly message; this index is
-- the backstop for the race where two requests (a double-click) both pass the
-- check before either inserts. Stale runs are marked failed before a new insert.

create unique index discovery_runs_one_in_flight_idx
  on public.discovery_runs (athlete_id)
  where status in ('queued', 'running');

create index discovery_runs_athlete_created_idx
  on public.discovery_runs (athlete_id, created_at desc);
