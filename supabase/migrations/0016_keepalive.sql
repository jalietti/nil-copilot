-- Keep-alive RPC for the Supabase free-plan pause.
--
-- Free-plan projects pause after a week without enough user database
-- activity. The scheduled GitHub Action (.github/workflows/supabase-keepalive.yml)
-- calls this through PostgREST with the public anon key so each ping is a
-- real, successful query instead of a permission error.
-- Who can see it: anon may execute it. It reads no tables and returns only
-- the server clock, so no athlete data is reachable. Table grants unchanged.

create function public.keepalive ()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

-- 0004's default privileges already withhold execute; grant only to anon.
revoke execute on function public.keepalive () from public, authenticated;
grant execute on function public.keepalive () to anon;
