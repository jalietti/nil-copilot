-- An athlete can add a contact email for a matched brand that discovery
-- couldn't find one for (they may know it, or find it on the brand's social
-- pages). It's stored on their own match — private to them, never shown to
-- other athletes — after the app validates syntax + MX. It only becomes a
-- brand-level fact once it's proven: brand_outcomes.working_contact_email
-- records the email actually used when a brand reply is pasted.

alter table public.brand_matches
  add column contact_email text
  check (
    contact_email is null
    or (length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

grant update (contact_email) on public.brand_matches to authenticated;

-- Outcome facts: record the email the athlete actually used (their own match
-- email if they added one, else the brand's), not just the one on file.
drop trigger messages_brand_outcome on public.messages;
drop trigger deals_brand_outcome on public.deals;
drop function public.brand_outcome_on_reply ();
drop function public.brand_outcome_on_agreed ();
drop function public.record_brand_outcome (uuid, boolean, boolean);

create function public.record_brand_outcome (
  p_athlete_id uuid,
  p_brand_id uuid,
  p_reply boolean,
  p_agreed boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.brand_outcomes as o (brand_id, any_reply, any_agreed, working_contact_email)
  select p_brand_id, p_reply, p_agreed, coalesce(m.contact_email, b.contact_email)
    from public.brands b
    left join public.brand_matches m on m.brand_id = b.id and m.athlete_id = p_athlete_id
   where b.id = p_brand_id
  on conflict (brand_id) do update
    set any_reply = o.any_reply or excluded.any_reply,
        any_agreed = o.any_agreed or excluded.any_agreed,
        working_contact_email = coalesce(excluded.working_contact_email, o.working_contact_email),
        updated_at = now();
end;
$$;

create function public.brand_outcome_on_reply () returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  if new.direction = 'inbound_pasted' then
    select athlete_id, brand_id into d from public.deals where id = new.deal_id;
    perform public.record_brand_outcome (d.athlete_id, d.brand_id, true, false);
  end if;
  return new;
end;
$$;

create trigger messages_brand_outcome
  after insert on public.messages
  for each row execute function public.brand_outcome_on_reply ();

create function public.brand_outcome_on_agreed () returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'agreed' and old.status is distinct from 'agreed' then
    perform public.record_brand_outcome (new.athlete_id, new.brand_id, true, true);
  end if;
  return new;
end;
$$;

create trigger deals_brand_outcome
  after update of status on public.deals
  for each row execute function public.brand_outcome_on_agreed ();

revoke execute on function public.record_brand_outcome (uuid, uuid, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.brand_outcome_on_reply () from public, anon, authenticated;
revoke execute on function public.brand_outcome_on_agreed () from public, anon, authenticated;
