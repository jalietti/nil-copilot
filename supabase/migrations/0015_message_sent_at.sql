-- When the athlete confirmed they sent this draft from their own email client
-- ("I sent it"). Set only by that athlete action — the app never sends
-- anything and has no inbox access. A sent draft is history, not an editable
-- draft; null means the athlete hasn't confirmed sending it.
-- Who can see it: own-rows, like the rest of the message (messages_all_own).
-- The table-wide update grant from 0004 already covers it; no new grant.

alter table public.messages
  add column sent_at timestamptz,
  add constraint messages_sent_at_outbound_only
    check (sent_at is null or direction = 'outbound_draft');

-- Backfill only what can be inferred safely from existing rows:

-- 1. A draft the brand later replied to was sent. Its send time isn't known,
--    so use when it was drafted.
update public.messages m
   set sent_at = m.created_at
 where m.direction = 'outbound_draft'
   and m.sent_at is null
   and exists (
     select 1 from public.messages r
      where r.deal_id = m.deal_id
        and r.direction = 'inbound_pasted'
        and r.created_at > m.created_at
   );

-- 2. In a deal still marked `sent` (no reply yet), drafts that existed when
--    the athlete last clicked "I sent it". A follow-up drafted after that
--    click is still unsent. Deals sent before 0008 fall back to updated_at.
update public.messages m
   set sent_at = coalesce(d.sent_at, d.updated_at)
  from public.deals d
 where d.id = m.deal_id
   and d.status = 'sent'
   and m.direction = 'outbound_draft'
   and m.sent_at is null
   and m.created_at <= coalesce(d.sent_at, d.updated_at);

-- Not backfilled: the latest counter in a negotiating deal. Drafting a
-- counter already moves the deal to `negotiating`, so whether it went out is
-- unknown; the athlete can still confirm it with "I sent it".
