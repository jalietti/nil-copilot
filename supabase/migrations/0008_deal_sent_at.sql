-- When the athlete last told us they sent something for this deal (outreach
-- or a follow-up) — drives the dashboard's "did you hear back?" prompt. Set
-- only from the athlete's own "I sent it" action; the app has no inbox access.
-- Deals sent before this column existed fall back to updated_at.
alter table public.deals add column sent_at timestamptz;
