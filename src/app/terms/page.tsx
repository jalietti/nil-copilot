import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactEmail, LegalPage, LegalSection } from '@/components/legal-page'
import { LEGAL_NAME, MINIMUM_AGE } from '@/lib/legal'

export const metadata: Metadata = { title: 'Terms of Service · NIL Copilot' }

// Bump LEGAL_VERSION in src/lib/legal.ts when these change materially.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p className="text-[15px] leading-relaxed text-muted">
        These terms are an agreement between you and {LEGAL_NAME} (“we”, “us”). By creating an
        account or using {LEGAL_NAME}, you agree to them and to our{' '}
        <Link href="/privacy" className="font-semibold text-accent-text">
          Privacy Policy
        </Link>
        . If you don’t agree, don’t use the service.
      </p>

      <LegalSection title="Who can use it">
        <p>
          You must be at least {MINIMUM_AGE} and able to agree to these terms. {LEGAL_NAME} is an
          invite-only pilot. Keep your login to yourself; you’re responsible for activity on your
          account.
        </p>
      </LegalSection>

      <LegalSection title="What NIL Copilot is, and isn’t">
        <p>
          {LEGAL_NAME} is a copilot. It suggests brands and drafts emails; <strong>you</strong>{' '}
          decide what to send and send it yourself from your own email. We never contact brands for
          you.
        </p>
        <ul>
          <li>
            We are not your agent, manager, or representative, and we don’t negotiate or sign
            anything on your behalf.
          </li>
          <li>
            We are not a law firm and don’t give legal, tax, financial, or immigration advice.
            Guidance in the app, including citizenship and visa guidance, is general information.
            Talk to your school’s compliance office, your international student office (DSO), or a
            qualified professional before you act on it.
          </li>
          <li>
            We aren’t affiliated with or endorsed by the NCAA, any conference, any school, or any
            brand shown in the app.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your responsibilities">
        <ul>
          <li>
            Follow the NIL rules that apply to you, including NCAA, conference, school, and state
            rules, and any disclosure or reporting your school requires.
          </li>
          <li>
            If you’re on a visa, make sure any NIL activity is allowed for your status before you
            agree to anything.
          </li>
          <li>
            Read every draft before you send it. AI-written drafts can contain mistakes, and you’re
            responsible for what you send and agree to.
          </li>
          <li>Follow the law when you email brands, including anti-spam laws.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don’t use {LEGAL_NAME} to:</p>
        <ul>
          <li>send spam, mass email, or anything deceptive, or impersonate anyone;</li>
          <li>break the law or anyone else’s rights;</li>
          <li>scrape, overload, reverse engineer, or get around usage limits or security; or</li>
          <li>share or resell access.</li>
        </ul>
        <p>
          To keep costs fair, we set daily limits on drafts and brand searches, and may change them.
        </p>
      </LegalSection>

      <LegalSection title="Brand information">
        <p>
          Brand suggestions and contact details come from public web sources and AI analysis. They
          may be out of date or wrong. We don’t guarantee that any brand will reply, offer a deal,
          or pay you.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You own what you put into {LEGAL_NAME} and the drafts made for you. You give us
          permission to store and process it only as needed to run the service, as described in
          our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="The pilot">
        <p>
          {LEGAL_NAME} is free during the pilot. It’s early software: features may change, break,
          or be discontinued, and we may suspend or close accounts that break these terms. You can
          stop using it and delete your account any time.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers and limits on liability">
        <p>
          {LEGAL_NAME} is provided “as is” and “as available,” without warranties of any kind,
          to the fullest extent the law allows. We aren’t liable for indirect or consequential
          damages, or for deals, payments, or eligibility outcomes, that result from your use of the
          service. Our total liability for any claim is limited to $50. Some places don’t allow
          these limits, so they may not fully apply to you.
        </p>
        <p>
          If your misuse of the service, or breaking these terms, leads to a claim against us, you
          agree to cover the reasonable costs of that claim.
        </p>
      </LegalSection>

      <LegalSection title="General">
        <p>
          These terms are governed by the laws of the State of California. If we make a material
          change, we’ll update the date above and ask you to agree again. Questions:{' '}
          <ContactEmail />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
