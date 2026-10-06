import type { Metadata } from 'next'
import { ContactEmail, LegalPage, LegalSection } from '@/components/legal-page'
import { LEGAL_NAME, MINIMUM_AGE } from '@/lib/legal'

export const metadata: Metadata = { title: 'Privacy Policy · NIL Copilot' }

// Keep this in step with what the app actually does. If a feature starts
// collecting or sharing something new, update this page and bump
// LEGAL_VERSION in src/lib/legal.ts.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-[15px] leading-relaxed text-muted">
        {LEGAL_NAME} (“we”, “us”) helps college athletes find brands and draft NIL outreach. This
        policy explains what we collect, why, who we share it with, and how to delete it. Questions:{' '}
        <ContactEmail />.
      </p>

      <LegalSection title="The short version">
        <ul>
          <li>We never read your inbox and never send email for you. You send every email yourself.</li>
          <li>We don’t sell your data or use it for advertising.</li>
          <li>Your citizenship or visa status is never shared with brands.</li>
          <li>You can delete your account and data any time from your Account page.</li>
        </ul>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Account:</strong> your email address and password (stored hashed by our
            authentication provider; we can’t see it), and the invite code you signed up with.
          </li>
          <li>
            <strong>Profile:</strong> your name, school, sport, division, social follower counts,
            and citizenship or visa status.
          </li>
          <li>
            <strong>Interview answers:</strong> your interests, brands you use, what matters to you,
            deal preferences, and a short summary of your writing style we generate from them.
          </li>
          <li>
            <strong>Deals:</strong> the brands you pursue, drafts we write and the edits you make,
            brand replies you paste in, brand contact emails you add, and the status of each deal.
          </li>
          <li>
            <strong>Usage and technical data:</strong> which features you use, how many AI requests
            and searches you trigger, error reports, and standard server logs (like IP address and
            browser type) kept by our hosting providers.
          </li>
        </ul>
        <p>We don’t collect payment information, and we don’t access your email account.</p>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>To find brands that fit your interests and to draft outreach, counters, and follow-ups in your voice.</li>
          <li>To show you guidance for your citizenship or visa situation. We don’t use it to decide what you can access.</li>
          <li>To keep the service running and secure, enforce usage limits, and fix problems.</li>
          <li>To understand how the pilot is going, using counts and internal IDs rather than your answers or drafts.</li>
          <li>
            To learn which brands tend to respond. We may record brand-level facts (for example, that
            a brand replied to someone, or which contact address worked) without recording who you
            are or what was written.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          Nothing reaches a brand unless you send it from your own email. We share data only with
          service providers that run parts of the app for us:
        </p>
        <ul>
          <li><strong>Supabase:</strong> database and sign-in. Stores everything listed above.</li>
          <li><strong>Vercel:</strong> hosts the website.</li>
          <li>
            <strong>Anthropic:</strong> the AI that writes drafts and reads your interview. It
            receives your profile, interview answers, and the deal thread needed for each draft.
          </li>
          <li>
            <strong>Tavily:</strong> web search for brand discovery. It receives search terms built
            from your interests and brand names, not your name or contact details.
          </li>
          <li><strong>Inngest:</strong> runs brand searches in the background, using internal IDs.</li>
          <li><strong>Sentry:</strong> error reports, so we can fix bugs.</li>
          <li><strong>PostHog:</strong> product analytics, using internal IDs and counts, never your form contents.</li>
        </ul>
        <p>
          We may also disclose information if the law requires it, or to protect the safety of our
          users or the service.
        </p>
      </LegalSection>

      <LegalSection title="Keeping and deleting your data">
        <p>
          We keep your data while your account is open. Deleting your account (Account page →
          Delete account) permanently removes your profile, interview, deals, and messages. Usage
          counts and brand-level facts stay in our totals but are no longer linked to you. Copies in
          our providers’ backups expire on their normal schedule.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          You can view and edit your profile and interview in the app at any time. To get a copy of
          your data, correct something, or delete it, email <ContactEmail />. Depending on where you
          live, you may have additional privacy rights; we’ll honor these requests wherever you are.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Each athlete’s data is isolated at the database level, and keys to outside services stay
          on our servers. No system is perfectly secure, so we can’t guarantee absolute security.
          If we learn of a breach affecting you, we’ll tell you.
        </p>
      </LegalSection>

      <LegalSection title="Age and location">
        <p>
          {LEGAL_NAME} is for people {MINIMUM_AGE} and older. We don’t knowingly collect data from
          anyone younger. Our providers store data in the United States.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we make a material change to this policy, we’ll update the date above and ask you to
          agree again before you keep using the app.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
