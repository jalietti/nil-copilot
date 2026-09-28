-- Invite-only signup for the friends-and-family pilot.
--
-- Enforced in the database, not the app: the auth.users insert trigger claims
-- a code atomically and aborts the signup if none is valid. That covers the
-- signup server action AND anyone calling Supabase Auth's /signup endpoint
-- directly with the public anon key. The code travels in the signup request's
-- user metadata (`options.data.invite_code`).
--
-- Codes are service-role only: RLS on with no policies, and no grants to
-- anon/authenticated. Mint them with SQL (see PILOT-SETUP.md).

create table public.invite_codes (
  code text primary key check (code = upper(code) and length(code) between 6 and 64),
  label text,
  -- null = unlimited
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;

alter table public.profiles
  add column invite_code text references public.invite_codes (code);

create or replace function public.handle_new_user () returns trigger
language plpgsql security definer set search_path = public as $$
declare
  claimed text;
begin
  -- Row lock on the code serializes concurrent signups, so max_uses holds.
  update public.invite_codes
     set uses = uses + 1
   where code = upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')))
     and revoked_at is null
     and (max_uses is null or uses < max_uses)
  returning code into claimed;

  if claimed is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.profiles (id, invite_code) values (new.id, claimed)
  on conflict (id) do nothing;
  return new;
end;
$$;
