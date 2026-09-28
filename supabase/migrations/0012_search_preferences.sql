-- "What you're looking for": values an athlete wants brands to share and
-- industries they want to work in, editable any time from the Brands page,
-- separately from the interview. Values start pre-filled from the interview
-- answers (values_customized = false) until the athlete edits them.
-- Discovery searches target_industries alongside interest tags and uses
-- values as a soft preference; drafts can mention both.
alter table public.interviews
  add column "values" text[] not null default '{}',
  add column target_industries text[] not null default '{}',
  add column values_customized boolean not null default false;
