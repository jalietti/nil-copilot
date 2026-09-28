-- Brand-level outcome facts, accumulating now for post-pilot ranking (NOT used
-- for ranking yet). One row per brand, and only these facts:
--   * did any athlete get a reply from this brand
--   * did any deal with this brand reach `agreed`
--   * which contact email proved to work (the one on file when it happened)
-- Never reply text, draft text, or which athlete — no athlete id, message id,
-- deal id, or per-athlete timestamp is stored here.
--
-- Derived by triggers from existing deal/message state changes, so no app
-- code path can skip it and athletes need no write access. Readable only by
-- the service role: RLS on, no policies, no anon/authenticated grants.

create table public.brand_outcomes (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  any_reply boolean not null default false,
  any_agreed boolean not null default false,
  working_contact_email text,
  updated_at timestamptz not null default now()
);

alter table public.brand_outcomes enable row level security;
revoke all on public.brand_outcomes from anon, authenticated;

create function public.record_brand_outcome (
  p_brand_id uuid,
  p_reply boolean,
  p_agreed boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.brand_outcomes as o (brand_id, any_reply, any_agreed, working_contact_email)
  select p_brand_id, p_reply, p_agreed, b.contact_email
    from public.brands b
   where b.id = p_brand_id
  on conflict (brand_id) do update
    set any_reply = o.any_reply or excluded.any_reply,
        any_agreed = o.any_agreed or excluded.any_agreed,
        working_contact_email = coalesce(excluded.working_contact_email, o.working_contact_email),
        updated_at = now();
end;
$$;

-- A pasted brand reply means the brand answered at the address on file.
create function public.brand_outcome_on_reply () returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'inbound_pasted' then
    perform public.record_brand_outcome (
      (select d.brand_id from public.deals d where d.id = new.deal_id), true, false
    );
  end if;
  return new;
end;
$$;

create trigger messages_brand_outcome
  after insert on public.messages
  for each row execute function public.brand_outcome_on_reply ();

-- An agreed deal implies the brand responded, too.
create function public.brand_outcome_on_agreed () returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'agreed' and old.status is distinct from 'agreed' then
    perform public.record_brand_outcome (new.brand_id, true, true);
  end if;
  return new;
end;
$$;

create trigger deals_brand_outcome
  after update of status on public.deals
  for each row execute function public.brand_outcome_on_agreed ();

-- Internal only: not callable through the API.
revoke execute on function public.record_brand_outcome (uuid, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.brand_outcome_on_reply () from public, anon, authenticated;
revoke execute on function public.brand_outcome_on_agreed () from public, anon, authenticated;
