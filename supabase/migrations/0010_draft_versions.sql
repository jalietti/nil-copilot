-- "Try another version" replaces a draft in place; every replaced version
-- (generated text, and the athlete's edits if any) is kept here so nothing
-- the athlete saw or wrote is lost. Storage only, like edit capture.
alter table public.messages
  add column previous_versions jsonb not null default '[]'::jsonb;
