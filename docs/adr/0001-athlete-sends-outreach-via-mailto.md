# 1. The athlete sends all outreach themselves, via `mailto:`

**Status:** Accepted (permanent) · **Date:** 2026-08-04

## Context

NIL Copilot drafts brand outreach and negotiation emails for student-athletes.
Many US states regulate *athlete agents* (people who solicit or negotiate
deals on an athlete's behalf), and a deal-contingent fee or sending on someone's
behalf moves a product toward that line. We want the product to be clearly a
writing tool the athlete uses, not a party to the deal.

Options considered for getting a draft to a brand:

1. **Send on the athlete's behalf** with Gmail OAuth (`gmail.send` scope) or SMTP.
   Smoothest UX, but the transmission is an API call made with delegated
   authority, which is a legal grey area, and it asks athletes to trust us with
   their inbox.
2. **`mailto:` handoff.** The copilot builds a `mailto:` link; the athlete's own
   email client opens with the draft filled in, and the athlete clicks send.

## Decision

Option 2, permanently. The copilot drafts; the athlete is always the sender and
final approver of everything outbound. There is no send-on-behalf path, no
inbox read access, and Resend (our transactional email provider) is used only
for platform email such as sign-up confirmation, never for outreach.

Replies come back to the athlete's own inbox. To get a drafted counter-offer,
the athlete pastes the brand's reply into the deal thread.

## Consequences

- A real, separate human action (the athlete's click) is the transmission step:
  the strongest available claim that the athlete is the one communicating.
- Zero setup and zero trust ask: no OAuth consent screen, no Google security review.
- The app can't know an email was actually sent, so the athlete marks it sent
  ("I sent it"), which stamps the draft (`messages.sent_at`) and locks it.
- `buildMailtoUrl` (`src/lib/mailto.ts`) has to follow RFC 6068 exactly (CRLF
  line breaks, `%20` not `+`), because every mail client parses the link differently.
- Revisit only if legal review clears send-on-behalf **and** there is a concrete
  product reason `mailto:` is failing.
