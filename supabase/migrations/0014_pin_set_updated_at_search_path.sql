-- Pin set_updated_at's search_path (Supabase advisor lint 0011,
-- function_search_path_mutable). It was the one function in public that
-- resolved names through the caller's search_path; every other function
-- already pins it. Empty is the strictest setting: the body only calls now(),
-- which lives in pg_catalog and is always found.
-- Who can see it: no access change — no tables, grants, or data touched.

alter function public.set_updated_at () set search_path = '';
