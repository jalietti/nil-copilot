-- When discovery last looked for this brand's contact email (homepage, then
-- /contact and /about), whether or not it found one. Lets discovery skip
-- refetching pages for brands checked recently. Readable by authenticated
-- via the table-level select grant on brands (0004); written only by the
-- service role.
alter table public.brands add column contact_checked_at timestamptz;
