-- Least-privilege table grants for the API roles.
--
-- 0001 (and Supabase's platform defaults) granted ALL on every table to anon
-- and authenticated, leaving RLS as the only line of defense. This narrows
-- each role to exactly what its RLS policies and the app need, so a missing
-- or mistaken policy can't silently widen access.
--
-- From here on, new tables get NO anon/authenticated privileges by default —
-- every migration that adds a table must grant explicitly.

-- Stop granting future objects to the API roles by default.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- Start from nothing on everything that exists today.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;

-- The service role (Inngest jobs, server-side admin client) bypasses RLS and
-- keeps full access.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- anon: nothing. Signup/login go through Supabase Auth, not table access.

-- authenticated, table by table, matching the RLS policies in 0001.

-- profiles: the row is created by the handle_new_user trigger; athletes read
-- and edit their own. id and invite_code are never athlete-writable.
grant select on public.profiles to authenticated;
grant update (
  full_name, school, sport, division,
  instagram_followers, tiktok_followers, other_followers,
  citizenship_status, visa_guidance_shown_at, onboarding_completed_at
) on public.profiles to authenticated;

-- interviews, deals, messages: "for all" own-row policies.
grant select, insert, update, delete on public.interviews to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

-- brands: shared cache, read-only for athletes; only the service role writes.
grant select on public.brands to authenticated;

-- brand_matches: created by the discovery job; athletes read and change status.
grant select on public.brand_matches to authenticated;
grant update (status) on public.brand_matches to authenticated;

-- discovery_runs: athletes read and enqueue their own; only the job updates
-- progress, so athletes can't forge status or counts.
grant select on public.discovery_runs to authenticated;
grant insert (athlete_id) on public.discovery_runs to authenticated;

-- invite_codes: service role only (no grants here on purpose).
