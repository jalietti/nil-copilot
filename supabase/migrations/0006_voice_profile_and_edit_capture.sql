-- Per-athlete voice profile, generated from interview answers at interview
-- completion. Null for athletes who interviewed before this existed or when
-- generation failed; drafting falls back to the shared house voice.
alter table public.interviews add column voice_profile text;

-- Edit capture (storage only — not fed back into generation yet). When the
-- athlete edits a copilot draft, the generated text is kept here and
-- subject/content hold their edited version; athlete_edited is set.
alter table public.messages
  add column original_subject text,
  add column original_content text;
