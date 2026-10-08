-- LOCAL DEVELOPMENT ONLY. Loaded by `npm run db:reset` (supabase db reset)
-- into the local Supabase stack; `supabase db push` never runs seeds, so none
-- of this reaches production.
--
-- A realistic athlete with the app in every state, so each screen can be
-- designed without running discovery or spending API credits. Brands are
-- fictional (.test domains) fixtures, not a curated brand list.
--
-- Log in at http://localhost:3000/login:
--   maya@example.test / nilcopilot-local   fully set up, deals in every status
--   new@example.test  / nilcopilot-local   confirmed but not onboarded yet
-- Sign up new accounts with invite code LOCALDEV1.

insert into public.invite_codes (code, label, max_uses) values ('LOCALDEV1', 'local dev', null);

-- Auth users the way GoTrue stores them (empty strings, not nulls, for tokens).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('nilcopilot-local', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"invite_code":"LOCALDEV1"}',
  now() - interval '14 days', now(), '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'maya@example.test'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'new@example.test')
) as u (id, email);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users where email in ('maya@example.test', 'new@example.test');

-- Maya: international (F-1) water polo player, fully onboarded.
update public.profiles set
  full_name = 'Maya Chen', school = 'Test State University', sport = 'Water polo', division = 'D1',
  instagram_followers = 640, tiktok_followers = 210, other_followers = null,
  citizenship_status = 'f1_visa', visa_guidance_shown_at = now() - interval '14 days',
  onboarding_completed_at = now() - interval '14 days'
where id = '11111111-1111-4111-8111-111111111111';

insert into public.interviews (athlete_id, interests, brands_used, category_tags, deal_preferences, raw_answers, voice_profile, "values", target_industries)
values (
  '11111111-1111-4111-8111-111111111111',
  '["open water swimming", "reef-safe sunscreen", "specialty coffee"]',
  '["Hydro Flask"]',
  '{open-water-swimming,reef-safe-sunscreen,sustainable-swimwear,specialty-coffee,ocean-conservation}',
  '{"low": "product_only", "mid": "product_plus_payment", "high": "payment_required"}',
  '{"what_matters": "Small brands that actually care about the ocean over a big check."}',
  'Casual and warm, a little dry. Talks about the water more than the sport. Short sentences, no hype — sounds like a teammate recommending something, not a pitch. Cares about ocean health and small brands that answer their own emails.',
  '{"ocean conservation","small independent brands"}',
  '{"specialty coffee"}'
);

insert into public.brands (id, domain, name, description, categories, contact_email, contact_checked_at, source_urls, discovered_via, verified_at) values
  ('b0000000-0000-4000-8000-000000000001', 'ridgelineswim.test', 'Ridgeline Swim', 'Small-batch recycled-nylon swimwear for open water swimmers.', '{sustainable-swimwear,open-water-swimming}', 'partnerships@ridgelineswim.test', now(), '{https://ridgelineswim.test}', 'tavily:sustainable-swimwear', now()),
  ('b0000000-0000-4000-8000-000000000002', 'tidewatersun.test', 'Tidewater Sun', 'Mineral, reef-safe sunscreen made for long days in the water.', '{reef-safe-sunscreen}', 'hello@tidewatersun.test', now(), '{https://tidewatersun.test}', 'tavily:reef-safe-sunscreen', now()),
  ('b0000000-0000-4000-8000-000000000003', 'saltlinegoggles.test', 'Saltline Goggles', 'Open water goggles with wide, fog-free lenses.', '{open-water-swimming}', 'team@saltlinegoggles.test', now(), '{https://saltlinegoggles.test}', 'tavily:open-water-swimming', now()),
  ('b0000000-0000-4000-8000-000000000004', 'kelpandco.test', 'Kelp & Co', 'Ocean-cleanup apparel; a share of every sale funds kelp restoration.', '{ocean-conservation,sustainable-swimwear}', 'collabs@kelpandco.test', now(), '{https://kelpandco.test}', 'tavily:ocean-conservation', now()),
  ('b0000000-0000-4000-8000-000000000005', 'driftwoodcoffee.test', 'Driftwood Coffee', 'Tiny coastal roaster doing single-origin light roasts.', '{specialty-coffee}', 'hello@driftwoodcoffee.test', now(), '{https://driftwoodcoffee.test}', 'tavily:specialty-coffee', now()),
  ('b0000000-0000-4000-8000-000000000006', 'summitbars.test', 'Summit Bars', 'Plant-based energy bars for endurance athletes.', '{endurance-nutrition}', 'info@summitbars.test', now(), '{https://summitbars.test}', 'tavily:endurance-nutrition', now()),
  ('b0000000-0000-4000-8000-000000000007', 'bluecurrent.test', 'Blue Current', 'Tow floats and safety gear for open water swimmers.', '{open-water-swimming}', null, now(), '{https://bluecurrent.test}', 'tavily:open-water-swimming', now()),
  ('b0000000-0000-4000-8000-000000000008', 'harborroast.test', 'Harbor Roast', 'Direct-trade coffee roaster with a surf-town cafe.', '{specialty-coffee}', null, now(), '{https://harborroast.test}', 'tavily:specialty-coffee', now()),
  ('b0000000-0000-4000-8000-000000000009', 'glassreef.test', 'Glass Reef', 'Reusable dive and snorkel gear.', '{ocean-conservation}', 'press@glassreef.test', now(), '{https://glassreef.test}', 'tavily:ocean-conservation', now()),
  ('b0000000-0000-4000-8000-000000000010', 'shorebreak.test', 'Shorebreak Towels', 'Quick-dry towels made from recycled bottles.', '{sustainable-swimwear}', 'hi@shorebreak.test', now(), '{https://shorebreak.test}', 'tavily:sustainable-swimwear', now());

-- Matches in every card state: new with email, new without email (the
-- "add it" prompt), email added by the athlete, in a deal, and dismissed.
insert into public.brand_matches (athlete_id, brand_id, fit_reason, status, contact_email, created_at) values
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000009', 'Reusable ocean gear lines up with Maya''s ocean-conservation interest and daily open water swims.', 'suggested', null, now() - interval '1 day'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000010', 'Recycled-bottle towels fit her sustainable-swimwear interest and live in every swim bag.', 'suggested', null, now() - interval '1 day'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000007', 'Tow floats are core open water safety gear — exactly what she swims with.', 'suggested', null, now() - interval '1 day'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000008', 'A surf-town roaster matches her specialty-coffee interest and coastal lifestyle.', 'suggested', 'cafe@harborroast.test', now() - interval '2 days'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000001', 'Recycled swimwear built for open water — her two biggest interests in one brand.', 'drafting', null, now() - interval '10 days'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000002', 'She named reef-safe sunscreen specifically; this is a small mineral-only brand.', 'contacted', null, now() - interval '10 days'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000003', 'Open water goggles she''d actually use every morning swim.', 'contacted', null, now() - interval '10 days'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000004', 'Ocean-cleanup apparel fits her conservation values and swimwear interest.', 'contacted', null, now() - interval '12 days'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000005', 'Tiny coastal roaster — her coffee interest plus the small-brand preference.', 'contacted', null, now() - interval '13 days'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000006', 'Endurance nutrition for long swims, though not ocean-focused.', 'dismissed', null, now() - interval '13 days');

insert into public.discovery_runs (athlete_id, status, brands_found, matches_created, started_at, finished_at, created_at) values
  ('11111111-1111-4111-8111-111111111111', 'completed', 4, 5, now() - interval '26 hours', now() - interval '25 hours 55 minutes', now() - interval '26 hours');

-- Deals, one per status. The "sent" one is 7 days old with no reply, so the
-- dashboard shows the "did you hear back?" prompt.
insert into public.deals (id, athlete_id, brand_id, status, sent_at, created_at) values
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000001', 'draft', null, now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000002', 'sent', now() - interval '7 days', now() - interval '8 days'),
  ('d0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000003', 'sent', now() - interval '6 days', now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000004', 'sent', now() - interval '9 days', now() - interval '11 days'),
  ('d0000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000005', 'sent', now() - interval '12 days', now() - interval '13 days'),
  ('d0000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000006', 'draft', null, now() - interval '13 days');

insert into public.messages (deal_id, direction, subject, content, athlete_edited, original_subject, original_content, created_at) values
  -- Draft: a fresh outreach draft, not sent yet.
  ('d0000000-0000-4000-8000-000000000001', 'outbound_draft', 'Open water swimmer who already lives in your suits',
   E'Hey Ridgeline team,\n\nI swim open water most mornings before practice, and the recycled suits have held up better than anything else I''ve owned — chlorine, salt, all of it.\n\nI''m Maya, I play water polo at Test State. My following is small (about 850 across platforms) but it''s real swimmers asking what I use.\n\nWould love to talk about a partnership if you''re open to it.\n\nThanks so much,\nMaya',
   false, null, null, now() - interval '1 day'),
  -- Sent a week ago, no reply yet (follow-up prompt).
  ('d0000000-0000-4000-8000-000000000002', 'outbound_draft', 'Reef-safe everything, including my sunscreen',
   E'Hi Tidewater team,\n\nI switched to mineral sunscreen after a summer of open water swims, and yours is the first that doesn''t wash off halfway through.\n\nI''m Maya, a water polo player at Test State. Would you be open to a small partnership?\n\nThanks,\nMaya',
   false, null, null, now() - interval '8 days'),
  -- Reply received, athlete's move.
  ('d0000000-0000-4000-8000-000000000003', 'outbound_draft', 'Fog-free goggles for a very foggy coast',
   E'Hi Saltline,\n\nMorning swims here are foggy in every sense — your goggles are the only ones that stay clear.\n\nWould love to work together if you''re open to it.\n\nMaya',
   false, null, null, now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000003', 'inbound_pasted', null,
   E'Hi Maya! Thanks for reaching out — we love hearing from swimmers. We could send you our new wide-lens pair and a cap. Would you post about them a couple of times this season?\n\n— Jordan, Saltline',
   false, null, null, now() - interval '2 days'),
  -- Negotiating: reply in, counter drafted and edited by the athlete.
  ('d0000000-0000-4000-8000-000000000004', 'outbound_draft', 'Kelp restoration + open water',
   E'Hi Kelp & Co,\n\nThe kelp restoration piece is why I wear your stuff. I''d love to talk about a partnership.\n\nMaya',
   false, null, null, now() - interval '11 days'),
  ('d0000000-0000-4000-8000-000000000004', 'inbound_pasted', null,
   E'Hey Maya, we''d love to have you on board. We can offer a $50 gift card for two posts. Let us know!',
   false, null, null, now() - interval '5 days'),
  ('d0000000-0000-4000-8000-000000000004', 'outbound_draft', 'Re: Kelp restoration + open water',
   E'Thanks so much — really excited about this.\n\nFor two posts I''d be looking at a modest payment plus a piece from the new line, so I can actually swim in it on camera. Would $100 plus a rash guard work?\n\nMaya',
   true, 'Re: Kelp restoration + open water',
   E'Thank you so much for getting back to me!\n\nFor two posts I''d be looking at product plus a modest payment. Would $100 plus a rash guard work for you?\n\nMaya',
   now() - interval '4 days'),
  -- Agreed.
  ('d0000000-0000-4000-8000-000000000005', 'outbound_draft', 'Coastal swimmer, coffee person',
   E'Hi Driftwood,\n\nPost-swim coffee is a ritual, and yours is the bag I keep reordering. Open to a partnership?\n\nMaya',
   false, null, null, now() - interval '13 days'),
  ('d0000000-0000-4000-8000-000000000005', 'inbound_pasted', null,
   E'Maya, love it. Two bags a month for a post each month works for us — deal?',
   false, null, null, now() - interval '10 days');

-- Past deals (and the brand outcome facts their triggers record).
update public.deals set status = 'agreed' where id = 'd0000000-0000-4000-8000-000000000005';
update public.deals set status = 'reply_received' where id = 'd0000000-0000-4000-8000-000000000003';
update public.deals set status = 'negotiating' where id = 'd0000000-0000-4000-8000-000000000004';
update public.deals set status = 'dead' where id = 'd0000000-0000-4000-8000-000000000006';

-- "I sent it" clicks: every draft the brand replied to, and the outreach
-- waiting on Tidewater. Kelp & Co's edited counter is still unsent — the
-- athlete's move.
update public.messages m
   set sent_at = m.created_at + interval '1 hour'
 where m.direction = 'outbound_draft'
   and (
     m.deal_id = 'd0000000-0000-4000-8000-000000000002'
     or exists (
       select 1 from public.messages r
        where r.deal_id = m.deal_id and r.direction = 'inbound_pasted' and r.created_at > m.created_at
     )
   );
